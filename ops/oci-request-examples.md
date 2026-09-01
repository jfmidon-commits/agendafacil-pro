# OCI Control Bridge — Resource Manager examples

The control request lives in `ops/oci-request.json`. A push to `main` that changes that file triggers exactly one OCI Control Bridge execution.

> Safety: changing the workflow, schema, documentation, or Python helper does **not** trigger an OCI operation. `stack_apply` is only attempted after an explicit request-file change or a manual workflow dispatch using a ref that already contains that request.

## Inspect a stack

```json
{
  "request_id": "stack-status-20260901-001",
  "operation": "stack_status",
  "stack_name": "agendafacil-evolution"
}
```

Expected: stack name, truncated OCID, lifecycle state, and creation time.

## Run a Terraform plan

```json
{
  "request_id": "stack-plan-20260901-002",
  "operation": "stack_plan",
  "stack_name": "agendafacil-evolution"
}
```

A PLAN validates the Terraform configuration without intentionally provisioning the requested infrastructure.

## Run a Terraform apply

```json
{
  "request_id": "stack-apply-20260901-003",
  "operation": "stack_apply",
  "stack_name": "agendafacil-evolution"
}
```

Use `stack_apply` only after `stack_status`/`stack_plan` have been reviewed and only when provisioning from that stack is actually intended. Do not use it merely to inspect an already-running VM.

Exit codes used by the helper:

| Code | Meaning |
| ---: | --- |
| 0 | SUCCESS |
| 2 | Stack not found |
| 3 | Failed to create Resource Manager job |
| 4 | PLAN failed or timed out |
| 5 | APPLY failed or timed out |
| 6 | No jobs found for `stack_job_status` |
| 10 | `OUT_OF_CAPACITY` detected |

`OUT_OF_CAPACITY` never invokes a destroy operation. The existing stack remains available for a later retry.

## Inspect the latest stack job

```json
{
  "request_id": "stack-job-status-20260901-004",
  "operation": "stack_job_status",
  "stack_name": "agendafacil-evolution"
}
```

Expected: truncated job OCID, display name, operation, state, and creation time.

## Capacity detection

`scripts/oci_stack_manager.py` checks capacity failures at these points:

1. the Resource Manager job-creation response;
2. `failure-details` on a failed Resource Manager job;
3. the raw Resource Manager job log (`get-job-logs-content`) when failure details are not specific enough.

The detector intentionally does **not** classify a generic service-limit/quota error as VM capacity shortage.

## Existing instance operations

| Operation | Description |
| --- | --- |
| `inventory` | Instance state, networking, Run Command plugin |
| `run_command_status` | Recent Run Command executions |
| `run_instance_command` | Execute the base64 script from `script_b64` |
| `reboot_instance` | Graceful OCI `SOFTRESET` |

## Compartment

By default the Resource Manager helper searches the tenancy/root compartment (`OCI_TENANCY_OCID`), which matches the current AgendaFácil stack setup. It also supports `OCI_STACK_COMPARTMENT_OCID` for a future non-root compartment without changing the script.
