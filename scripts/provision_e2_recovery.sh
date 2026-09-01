#!/usr/bin/env bash
set -euo pipefail

SOURCE_INSTANCE_NAME="${SOURCE_INSTANCE_NAME:-agendafacil-evolution}"
TARGET_INSTANCE_NAME="${TARGET_INSTANCE_NAME:-agendafacil-evolution-v2}"
SHAPE="VM.Standard.E2.1.Micro"
BOOT_VOLUME_GB=50
MAX_ALWAYS_FREE_E2=2
MAX_ALWAYS_FREE_BLOCK_GB=200

echo "=== OCI E2 RECOVERY PROVISIONER ==="
echo "Source: $SOURCE_INSTANCE_NAME"
echo "Target: $TARGET_INSTANCE_NAME"
echo "Shape: $SHAPE"

SOURCE_SEARCH="$(oci search resource structured-search \
  --query-text "query instance resources where displayName = '$SOURCE_INSTANCE_NAME'" \
  --query 'data.items[0]' \
  --raw-output)"

if [ -z "$SOURCE_SEARCH" ] || [ "$SOURCE_SEARCH" = "null" ]; then
  echo "::error::Source instance '$SOURCE_INSTANCE_NAME' not found"
  exit 2
fi

SOURCE_ID="$(printf '%s' "$SOURCE_SEARCH" | jq -r '.identifier')"
SOURCE="$(oci compute instance get --instance-id "$SOURCE_ID" --output json)"
COMPARTMENT_ID="$(printf '%s' "$SOURCE" | jq -r '.data."compartment-id"')"
AVAILABILITY_DOMAIN="$(printf '%s' "$SOURCE" | jq -r '.data."availability-domain"')"
IMAGE_ID="$(printf '%s' "$SOURCE" | jq -r '.data."image-id"')"

if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
  echo "::error::Could not determine source image ID"
  exit 3
fi

VNIC_JSON="$(oci compute instance list-vnics --instance-id "$SOURCE_ID" --output json)"
SUBNET_ID="$(printf '%s' "$VNIC_JSON" | jq -r '.data[0]."subnet-id" // empty')"
if [ -z "$SUBNET_ID" ]; then
  echo "::error::Could not determine source subnet"
  exit 4
fi

# Idempotency: if the target already exists, do not create another one.
TARGET_LIST="$(oci compute instance list \
  --compartment-id "$COMPARTMENT_ID" \
  --display-name "$TARGET_INSTANCE_NAME" \
  --all \
  --output json)"
EXISTING_TARGET_ID="$(printf '%s' "$TARGET_LIST" | jq -r '[.data[] | select(."lifecycle-state" != "TERMINATED")][0].id // empty')"
if [ -n "$EXISTING_TARGET_ID" ]; then
  EXISTING_STATE="$(printf '%s' "$TARGET_LIST" | jq -r '[.data[] | select(."lifecycle-state" != "TERMINATED")][0]."lifecycle-state" // "UNKNOWN"')"
  echo "TARGET_ALREADY_EXISTS id=${EXISTING_TARGET_ID:0:30}... state=$EXISTING_STATE"
  exit 0
fi

# Guardrail 1: Oracle Always Free allows at most two E2.1.Micro VMs.
ALL_INSTANCES="$(oci compute instance list --compartment-id "$COMPARTMENT_ID" --all --output json)"
ACTIVE_E2_COUNT="$(printf '%s' "$ALL_INSTANCES" | jq '[.data[] | select(.shape == "VM.Standard.E2.1.Micro" and ."lifecycle-state" != "TERMINATED")] | length')"
echo "Existing non-terminated E2.1.Micro instances: $ACTIVE_E2_COUNT"
if [ "$ACTIVE_E2_COUNT" -ge "$MAX_ALWAYS_FREE_E2" ]; then
  echo "::error::FREE_TIER_GUARD: already at the two-instance E2.1.Micro Always Free limit"
  exit 10
fi

# Guardrail 2: keep aggregate boot-volume allocation under the documented 200 GB Always Free block storage pool.
BOOT_VOLUMES="$(oci bv boot-volume list \
  --availability-domain "$AVAILABILITY_DOMAIN" \
  --compartment-id "$COMPARTMENT_ID" \
  --all \
  --output json)"
CURRENT_BOOT_GB="$(printf '%s' "$BOOT_VOLUMES" | jq '[.data[] | select(."lifecycle-state" != "TERMINATED") | (."size-in-gbs" // 0)] | add // 0 | floor')"
PROJECTED_BOOT_GB=$((CURRENT_BOOT_GB + BOOT_VOLUME_GB))
echo "Current boot-volume allocation: ${CURRENT_BOOT_GB} GB"
echo "Projected after launch: ${PROJECTED_BOOT_GB} GB"
if [ "$PROJECTED_BOOT_GB" -gt "$MAX_ALWAYS_FREE_BLOCK_GB" ]; then
  echo "::error::FREE_TIER_GUARD: projected boot-volume allocation exceeds 200 GB"
  exit 11
fi

cat >/tmp/agendafacil-cloud-init.yaml <<'CLOUDINIT'
#cloud-config
package_update: false
write_files:
  - path: /etc/sudoers.d/90-ocarun
    owner: root:root
    permissions: '0440'
    content: |
      ocarun ALL=(ALL) NOPASSWD:ALL
  - path: /usr/local/sbin/agendafacil-host-bootstrap.sh
    owner: root:root
    permissions: '0755'
    content: |
      #!/usr/bin/env bash
      set -euxo pipefail

      if ! swapon --show=NAME --noheadings 2>/dev/null | grep -qx '/swapfile'; then
        if [ ! -f /swapfile ]; then
          fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
        fi
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
      fi
      if ! grep -qE '^/swapfile\\s' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
      fi
      echo 'vm.swappiness=20' > /etc/sysctl.d/99-agendafacil-swap.conf
      sysctl -p /etc/sysctl.d/99-agendafacil-swap.conf || true

      apt-get update -y
      DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io ca-certificates curl openssl
      if ! docker compose version >/dev/null 2>&1; then
        DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-v2 || \
        DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose
      fi
      systemctl enable --now docker
      usermod -aG docker ubuntu || true

      mkdir -p /var/lib/agendafacil
      date -u +%FT%TZ > /var/lib/agendafacil/host-ready
      free -h > /var/lib/agendafacil/memory-after-bootstrap.txt
      docker --version > /var/lib/agendafacil/docker-version.txt
runcmd:
  - [ bash, /usr/local/sbin/agendafacil-host-bootstrap.sh ]
CLOUDINIT

echo "Launching guarded Always Free recovery VM..."
NEW_ID="$(oci compute instance launch \
  --availability-domain "$AVAILABILITY_DOMAIN" \
  --compartment-id "$COMPARTMENT_ID" \
  --display-name "$TARGET_INSTANCE_NAME" \
  --shape "$SHAPE" \
  --subnet-id "$SUBNET_ID" \
  --image-id "$IMAGE_ID" \
  --boot-volume-size-in-gbs "$BOOT_VOLUME_GB" \
  --assign-public-ip true \
  --user-data-file /tmp/agendafacil-cloud-init.yaml \
  --wait-for-state RUNNING \
  --max-wait-seconds 900 \
  --query 'data.id' \
  --raw-output)"

if [ -z "$NEW_ID" ] || [ "$NEW_ID" = "null" ]; then
  echo "::error::Launch returned no instance ID"
  exit 12
fi

echo "NEW_INSTANCE_RUNNING id=${NEW_ID:0:30}..."

PUBLIC_IP=""
for attempt in $(seq 1 30); do
  PUBLIC_IP="$(oci compute instance list-vnics \
    --instance-id "$NEW_ID" \
    --query 'data[0]."public-ip"' \
    --raw-output 2>/dev/null || true)"
  if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ] && [ "$PUBLIC_IP" != "None" ]; then
    break
  fi
  sleep 5
done

if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ] && [ "$PUBLIC_IP" != "None" ]; then
  echo "PUBLIC_IP_ASSIGNED=yes"
else
  echo "PUBLIC_IP_ASSIGNED=no"
fi

echo "PROVISION_E2_RECOVERY_DONE"
