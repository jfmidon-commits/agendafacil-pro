# OCI Control Bridge

This repository uses a GitHub Actions workflow as a controlled bridge to Oracle Cloud Infrastructure (OCI).

## One-time GitHub secrets

Configure these repository Actions secrets. Never commit their values to the repository.

- `OCI_TENANCY_OCID`
- `OCI_USER_OCID`
- `OCI_FINGERPRINT`
- `OCI_PRIVATE_KEY` — complete PEM private key, including BEGIN/END lines
- `OCI_REGION` — for this environment: `sa-saopaulo-1`

The OCI API key must belong to an OCI user with only the permissions needed to operate the AgendaFacil infrastructure.

## Control channel

The workflow watches `ops/oci-request.json` on `main`. Updating that file triggers one OCI operation. This lets an authorized GitHub integration submit a request without exposing OCI credentials.

Current operations:

- `inventory` — inspect the target VM, VNIC/IPs, instance-agent plugins and recent Run Command executions.
- `run_command_status` — inspect Compute Instance Run Command status.
- `run_instance_command` — submit a base64-encoded shell script through OCI Instance Agent Run Command and poll its execution status.

`script_b64` is stored in the public repository. Do not place passwords, API tokens, private keys, or other secrets inside remote scripts. Runtime secrets must come from GitHub Actions secrets or OCI-native secret storage.

## Target

Default instance: `agendafacil-evolution` in `sa-saopaulo-1`.

## Security model

The workflow has read-only GitHub repository permissions. OCI credentials exist only as GitHub Actions secrets and are written to the ephemeral runner for the duration of the job. Requests are constrained to a small allowlist of operations in the workflow.
