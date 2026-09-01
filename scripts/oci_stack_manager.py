#!/usr/bin/env python3
"""Safe OCI Resource Manager stack operations for AgendaFácil.

Supported operations (via OPERATION env):
- stack_status
- stack_plan
- stack_apply
- stack_job_status

The script never prints OCI credentials and uses the existing OCI CLI profile
created by the GitHub Actions workflow.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from typing import Any, Optional

DEFAULT_STACK_NAME = "agendafacil-evolution"
MAX_APPLY_WAIT_MINUTES = 30
MAX_PLAN_WAIT_MINUTES = 15
POLL_INTERVAL_SECONDS = 30

EXIT_OK = 0
EXIT_INVALID_INPUT = 1
EXIT_NOT_FOUND = 2
EXIT_CREATE_JOB_FAILED = 3
EXIT_PLAN_FAILED = 4
EXIT_APPLY_FAILED = 5
EXIT_NO_JOBS = 6
EXIT_OUT_OF_CAPACITY = 10
EXIT_UNKNOWN_OPERATION = 99


def run_oci(cmd: list[str], timeout: int = 180) -> tuple[int, str, str]:
    """Run OCI CLI and capture output without echoing the command."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout if isinstance(exc.stdout, str) else ""
        stderr = exc.stderr if isinstance(exc.stderr, str) else ""
        return 124, stdout, stderr or "OCI CLI command timed out"


def parse_json(text: str) -> Optional[dict[str, Any]]:
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def is_capacity_error(text: str) -> bool:
    """Recognize OCI capacity shortage without conflating quota/limit errors."""
    msg = (text or "").lower()
    direct_patterns = (
        "out of capacity",
        "insufficient capacity",
        "no capacity",
        "capacity unavailable",
        "capacity is unavailable",
        "no available capacity",
    )
    if any(pattern in msg for pattern in direct_patterns):
        return True
    return "vm.standard.a1.flex" in msg and "capacity" in msg


def list_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize OCI list responses that can expose data as list or data.items."""
    data = payload.get("data")
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        items = data.get("items")
        if isinstance(items, list):
            return [item for item in items if isinstance(item, dict)]
    return []


def find_stack_by_name(compartment_id: str, stack_name: str) -> Optional[dict[str, Any]]:
    rc, out, err = run_oci(
        [
            "oci",
            "resource-manager",
            "stack",
            "list",
            "--compartment-id",
            compartment_id,
            "--all",
            "--output",
            "json",
        ]
    )
    if rc != 0:
        print(f"[ERROR] Failed to list stacks: {err.strip()}", file=sys.stderr)
        return None

    payload = parse_json(out)
    if payload is None:
        print("[ERROR] Invalid JSON returned by stack list", file=sys.stderr)
        return None

    matches = [item for item in list_items(payload) if item.get("display-name") == stack_name]
    if not matches:
        return None

    # Prefer the newest matching stack if duplicate display names exist.
    matches.sort(key=lambda item: item.get("time-created") or "", reverse=True)
    if len(matches) > 1:
        print(f"[WARN] Found {len(matches)} stacks named '{stack_name}'; using the newest one")
    return matches[0]


def create_job(stack_id: str, operation: str, display_name: str) -> tuple[Optional[str], bool]:
    rc, out, err = run_oci(
        [
            "oci",
            "resource-manager",
            "job",
            "create",
            "--stack-id",
            stack_id,
            "--operation",
            operation,
            "--display-name",
            display_name,
            "--output",
            "json",
        ]
    )
    if rc != 0:
        combined = f"{out}\n{err}"
        if is_capacity_error(combined):
            return None, True
        print(f"[ERROR] Failed to create {operation} job: {err.strip()}", file=sys.stderr)
        return None, False

    payload = parse_json(out)
    job_id = (payload or {}).get("data", {}).get("id") if isinstance((payload or {}).get("data"), dict) else None
    if not isinstance(job_id, str) or not job_id:
        print(f"[ERROR] OCI did not return a job OCID for {operation}", file=sys.stderr)
        return None, False
    return job_id, False


def get_job(job_id: str) -> Optional[dict[str, Any]]:
    rc, out, _ = run_oci(
        [
            "oci",
            "resource-manager",
            "job",
            "get",
            "--job-id",
            job_id,
            "--output",
            "json",
        ]
    )
    if rc != 0:
        return None
    payload = parse_json(out)
    data = (payload or {}).get("data")
    return data if isinstance(data, dict) else None


def job_logs_contain_capacity_error(job_id: str) -> bool:
    """Inspect raw Terraform job logs after a failed job."""
    # Oracle documents get-job-logs-content as the raw text log endpoint.
    rc, out, err = run_oci(
        [
            "oci",
            "resource-manager",
            "job",
            "get-job-logs-content",
            "--job-id",
            job_id,
        ],
        timeout=180,
    )
    if rc != 0:
        return False
    return is_capacity_error(f"{out}\n{err}")


def failure_message(job: dict[str, Any]) -> str:
    details = job.get("failure-details")
    if not isinstance(details, dict):
        return ""
    message = details.get("message")
    code = details.get("code")
    parts = [str(part) for part in (code, message) if part]
    return ": ".join(parts)


def wait_for_terminal_state(job_id: str, max_minutes: int) -> dict[str, Any]:
    terminal_states = {"SUCCEEDED", "FAILED", "CANCELED"}
    max_attempts = max(1, (max_minutes * 60) // POLL_INTERVAL_SECONDS)

    for attempt in range(1, max_attempts + 1):
        job = get_job(job_id)
        if job is None:
            print(f"[WARN] Could not retrieve job status (attempt {attempt}/{max_attempts})")
            if attempt < max_attempts:
                time.sleep(POLL_INTERVAL_SECONDS)
            continue

        state = str(job.get("lifecycle-state") or "UNKNOWN")
        print(f"[JOB] State: {state} (attempt {attempt}/{max_attempts})")

        if state in terminal_states:
            out_of_capacity = False
            error = None
            if state == "FAILED":
                error = failure_message(job) or "Resource Manager job failed"
                out_of_capacity = is_capacity_error(error)
                if not out_of_capacity:
                    out_of_capacity = job_logs_contain_capacity_error(job_id)
                if out_of_capacity:
                    error = "OUT_OF_CAPACITY"
            elif state == "CANCELED":
                error = "Resource Manager job was canceled"

            return {
                "state": state,
                "success": state == "SUCCEEDED",
                "out_of_capacity": out_of_capacity,
                "error": error,
                "job_id": job_id,
            }

        if attempt < max_attempts:
            time.sleep(POLL_INTERVAL_SECONDS)

    return {
        "state": "TIMEOUT",
        "success": False,
        "out_of_capacity": False,
        "error": f"Job did not reach a terminal state within {max_minutes} minutes",
        "job_id": job_id,
    }


def get_latest_job(stack_id: str) -> Optional[dict[str, Any]]:
    rc, out, err = run_oci(
        [
            "oci",
            "resource-manager",
            "job",
            "list",
            "--stack-id",
            stack_id,
            "--all",
            "--sort-by",
            "TIMECREATED",
            "--sort-order",
            "DESC",
            "--output",
            "json",
        ]
    )
    if rc != 0:
        print(f"[ERROR] Failed to list stack jobs: {err.strip()}", file=sys.stderr)
        return None
    payload = parse_json(out)
    if payload is None:
        return None
    items = list_items(payload)
    return items[0] if items else None


def print_stack_summary(stack: dict[str, Any]) -> None:
    stack_id = str(stack.get("id") or "")
    print(f"[FOUND] Stack: {stack.get('display-name', 'N/A')}")
    print(f"[FOUND] Stack ID: {stack_id[:30]}... (truncated)")
    print(f"[FOUND] State: {stack.get('lifecycle-state', 'UNKNOWN')}")
    print(f"[FOUND] Created: {stack.get('time-created', 'N/A')}")


def main() -> int:
    operation = os.environ.get("OPERATION", "").strip()
    tenancy_id = os.environ.get("OCI_TENANCY_OCID", "").strip()
    compartment_id = os.environ.get("OCI_STACK_COMPARTMENT_OCID", tenancy_id).strip()
    stack_name = os.environ.get("STACK_NAME", DEFAULT_STACK_NAME).strip()

    if not operation:
        print("[ERROR] OPERATION environment variable is required", file=sys.stderr)
        return EXIT_INVALID_INPUT
    if not compartment_id:
        print("[ERROR] OCI_TENANCY_OCID (or OCI_STACK_COMPARTMENT_OCID) is required", file=sys.stderr)
        return EXIT_INVALID_INPUT
    if not stack_name:
        print("[ERROR] STACK_NAME must not be empty", file=sys.stderr)
        return EXIT_INVALID_INPUT

    print(f"=== OCI Stack Operation: {operation} ===")
    print(f"Stack name: {stack_name}")
    print(f"Compartment: {compartment_id[:20]}... (truncated)")

    stack = find_stack_by_name(compartment_id, stack_name)
    if stack is None:
        print(f"[NOT_FOUND] Stack '{stack_name}' not found")
        return EXIT_NOT_FOUND

    if operation == "stack_status":
        print_stack_summary(stack)
        return EXIT_OK

    stack_id = str(stack.get("id") or "")
    if not stack_id:
        print("[ERROR] Stack has no OCID", file=sys.stderr)
        return EXIT_NOT_FOUND

    if operation == "stack_job_status":
        latest = get_latest_job(stack_id)
        if latest is None:
            print("[NOT_FOUND] No jobs found for this stack")
            return EXIT_NO_JOBS
        job_id = str(latest.get("id") or "")
        print(f"[JOB] Latest job ID: {job_id[:30]}... (truncated)")
        print(f"[JOB] Name: {latest.get('display-name', 'N/A')}")
        print(f"[JOB] Operation: {latest.get('operation', 'N/A')}")
        print(f"[JOB] State: {latest.get('lifecycle-state', 'N/A')}")
        print(f"[JOB] Created: {latest.get('time-created', 'N/A')}")
        return EXIT_OK

    if operation not in {"stack_plan", "stack_apply"}:
        print(f"[ERROR] Unknown operation: {operation}", file=sys.stderr)
        return EXIT_UNKNOWN_OPERATION

    job_operation = "PLAN" if operation == "stack_plan" else "APPLY"
    wait_minutes = MAX_PLAN_WAIT_MINUTES if operation == "stack_plan" else MAX_APPLY_WAIT_MINUTES
    display_name = f"{job_operation.lower()}-{stack_name}-{int(time.time())}"
    print(f"[INFO] Creating {job_operation} job for stack {stack_name}")

    job_id, capacity_error = create_job(stack_id, job_operation, display_name)
    if capacity_error:
        print("[OUT_OF_CAPACITY] Oracle reports insufficient capacity for the requested infrastructure")
        print("[OUT_OF_CAPACITY] Stack preserved; no destroy operation was requested")
        return EXIT_OUT_OF_CAPACITY
    if not job_id:
        return EXIT_CREATE_JOB_FAILED

    print(f"[INFO] {job_operation} job created: {job_id[:30]}... (truncated)")
    result = wait_for_terminal_state(job_id, max_minutes=wait_minutes)
    print(f"[RESULT] {job_operation} job state: {result['state']}")
    print(f"[RESULT] Success: {result['success']}")

    if result["out_of_capacity"]:
        print("[OUT_OF_CAPACITY] VM capacity unavailable")
        print("[OUT_OF_CAPACITY] Stack preserved; no destroy operation was requested")
        return EXIT_OUT_OF_CAPACITY
    if result["error"]:
        print(f"[RESULT] Error: {result['error']}")

    if result["success"]:
        return EXIT_OK
    return EXIT_PLAN_FAILED if operation == "stack_plan" else EXIT_APPLY_FAILED


if __name__ == "__main__":
    sys.exit(main())
