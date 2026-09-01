import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "oci_stack_manager.py"
spec = importlib.util.spec_from_file_location("oci_stack_manager", MODULE_PATH)
oci_stack_manager = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(oci_stack_manager)


class OciStackManagerTests(unittest.TestCase):
    def test_capacity_detection_is_specific(self):
        self.assertTrue(oci_stack_manager.is_capacity_error("Out of capacity for shape VM.Standard.A1.Flex"))
        self.assertTrue(oci_stack_manager.is_capacity_error("Insufficient capacity in this availability domain"))
        self.assertTrue(oci_stack_manager.is_capacity_error("VM.Standard.A1.Flex capacity unavailable"))
        self.assertFalse(oci_stack_manager.is_capacity_error("Service limit exceeded for compute cores"))

    def test_list_items_supports_common_oci_shapes(self):
        self.assertEqual(
            oci_stack_manager.list_items({"data": [{"id": "one"}]}),
            [{"id": "one"}],
        )
        self.assertEqual(
            oci_stack_manager.list_items({"data": {"items": [{"id": "two"}]}}),
            [{"id": "two"}],
        )

    @patch.object(oci_stack_manager, "run_oci")
    def test_find_stack_uses_newest_duplicate(self, run_oci):
        run_oci.return_value = (
            0,
            json.dumps(
                {
                    "data": [
                        {"id": "old", "display-name": "agendafacil-evolution", "time-created": "2026-08-31T10:00:00Z"},
                        {"id": "new", "display-name": "agendafacil-evolution", "time-created": "2026-09-01T10:00:00Z"},
                    ]
                }
            ),
            "",
        )
        stack = oci_stack_manager.find_stack_by_name("ocid1.tenancy.test", "agendafacil-evolution")
        self.assertEqual(stack["id"], "new")

    @patch.object(oci_stack_manager, "run_oci")
    def test_get_latest_job_handles_data_list(self, run_oci):
        run_oci.return_value = (
            0,
            json.dumps({"data": [{"id": "latest", "time-created": "2026-09-01T10:00:00Z"}]}),
            "",
        )
        job = oci_stack_manager.get_latest_job("ocid1.ormstack.test")
        self.assertEqual(job["id"], "latest")

    @patch.object(oci_stack_manager, "job_logs_contain_capacity_error", return_value=False)
    @patch.object(oci_stack_manager, "get_job")
    def test_failed_job_detects_capacity_from_failure_details(self, get_job, _logs):
        get_job.return_value = {
            "lifecycle-state": "FAILED",
            "failure-details": {
                "code": "TERRAFORM_EXECUTION_ERROR",
                "message": "Out of capacity for shape VM.Standard.A1.Flex",
            },
        }
        result = oci_stack_manager.wait_for_terminal_state("job", max_minutes=1)
        self.assertTrue(result["out_of_capacity"])
        self.assertEqual(result["error"], "OUT_OF_CAPACITY")

    @patch.object(oci_stack_manager, "job_logs_contain_capacity_error", return_value=True)
    @patch.object(oci_stack_manager, "get_job")
    def test_failed_job_falls_back_to_raw_logs(self, get_job, _logs):
        get_job.return_value = {
            "lifecycle-state": "FAILED",
            "failure-details": {
                "code": "TERRAFORM_EXECUTION_ERROR",
                "message": "Terraform apply failed",
            },
        }
        result = oci_stack_manager.wait_for_terminal_state("job", max_minutes=1)
        self.assertTrue(result["out_of_capacity"])
        self.assertEqual(result["error"], "OUT_OF_CAPACITY")


if __name__ == "__main__":
    unittest.main()
