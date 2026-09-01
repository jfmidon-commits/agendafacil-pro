#!/usr/bin/env bash
set -euo pipefail

echo "=== EVOLUTION API MINIMAL DEPLOY ==="
sudo -n true
echo "Preflight: sudo OK"

AVAILABLE_KB="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)"
SWAP_KB="$(awk '/SwapTotal:/ {print $2}' /proc/meminfo)"
DISK_FREE_KB="$(df -Pk / | awk 'NR==2 {print $4}')"
echo "Preflight memory available: $((AVAILABLE_KB/1024)) MiB"
echo "Preflight swap total: $((SWAP_KB/1024)) MiB"
echo "Preflight root disk free: $((DISK_FREE_KB/1024)) MiB"

if [ "$SWAP_KB" -lt 1500000 ]; then
  echo "ERROR: expected at least ~1.5 GiB swap before Evolution deployment"
  exit 21
fi
if [ "$DISK_FREE_KB" -lt 6000000 ]; then
  echo "ERROR: less than ~6 GiB free on root filesystem"
  exit 22
fi

sudo mkdir -p /opt/evolution
sudo chmod 700 /opt/evolution

if [ ! -f /opt/evolution/.env ]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  API_KEY="$(openssl rand -hex 32)"
  sudo bash -c "umask 077; cat > /opt/evolution/.env" <<EOF
SERVER_NAME=evolution
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=http://127.0.0.1:8080
TELEMETRY_ENABLED=false
PROMETHEUS_METRICS=false
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true
LOG_LEVEL=ERROR,WARN,INFO
LOG_COLOR=false
LOG_BAILEYS=error
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_CLIENT_NAME=agendafacil
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
DATABASE_SAVE_DATA_LABELS=true
DATABASE_SAVE_DATA_HISTORIC=true
DATABASE_SAVE_IS_ON_WHATSAPP=true
DATABASE_SAVE_IS_ON_WHATSAPP_DAYS=7
DATABASE_DELETE_MESSAGE=true
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379/6
CACHE_REDIS_TTL=604800
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false
WEBSOCKET_ENABLED=false
WEBHOOK_GLOBAL_ENABLED=false
RABBITMQ_ENABLED=false
SQS_ENABLED=false
PUSHER_ENABLED=false
KAFKA_ENABLED=false
OPENAI_ENABLED=false
DIFY_ENABLED=false
N8N_ENABLED=false
EVOAI_ENABLED=false
TYPEBOT_ENABLED=false
CHATWOOT_ENABLED=false
S3_ENABLED=false
CONFIG_SESSION_PHONE_CLIENT=AgendaFacil
CONFIG_SESSION_PHONE_NAME=Chrome
QRCODE_LIMIT=30
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=false
LANGUAGE=pt-BR
POSTGRES_DATABASE=evolution
POSTGRES_USERNAME=evolution
POSTGRES_PASSWORD=$DB_PASSWORD
AUTHENTICATION_API_KEY=$API_KEY
EOF
  unset DB_PASSWORD API_KEY
  echo "Secrets generated locally and stored only in /opt/evolution/.env"
else
  echo "Existing /opt/evolution/.env preserved"
fi
sudo chown root:root /opt/evolution/.env
sudo chmod 600 /opt/evolution/.env

sudo tee /opt/evolution/compose.yaml >/dev/null <<'COMPOSE'
services:
  postgres:
    image: postgres:15-alpine
    container_name: evolution_postgres
    restart: unless-stopped
    mem_limit: 256m
    environment:
      POSTGRES_DB: ${POSTGRES_DATABASE}
      POSTGRES_USER: ${POSTGRES_USERNAME}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    command:
      - postgres
      - -c
      - max_connections=30
      - -c
      - shared_buffers=64MB
      - -c
      - work_mem=2MB
      - -c
      - maintenance_work_mem=32MB
    volumes:
      - evolution_postgres_data:/var/lib/postgresql/data
    networks:
      - evolution_internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USERNAME} -d ${POSTGRES_DATABASE}"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 20s

  redis:
    image: redis:7-alpine
    container_name: evolution_redis
    restart: unless-stopped
    mem_limit: 96m
    command:
      - redis-server
      - --appendonly
      - "yes"
      - --maxmemory
      - 64mb
      - --maxmemory-policy
      - allkeys-lru
    volumes:
      - evolution_redis_data:/data
    networks:
      - evolution_internal
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 10s

  api:
    image: evoapicloud/evolution-api:latest
    container_name: evolution_api
    restart: unless-stopped
    mem_limit: 640m
    ports:
      - "127.0.0.1:8080:8080"
    env_file:
      - .env
    environment:
      DATABASE_CONNECTION_URI: postgresql://${POSTGRES_USERNAME}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DATABASE}?schema=evolution_api
      CACHE_REDIS_URI: redis://redis:6379/6
      NODE_OPTIONS: --max-old-space-size=512
    volumes:
      - evolution_instances:/evolution/instances
    networks:
      - evolution_internal
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

networks:
  evolution_internal:
    driver: bridge

volumes:
  evolution_postgres_data:
  evolution_redis_data:
  evolution_instances:
COMPOSE
sudo chown root:root /opt/evolution/compose.yaml
sudo chmod 600 /opt/evolution/compose.yaml

cd /opt/evolution

echo "Pulling official/current Evolution API stack images..."
sudo docker compose -f compose.yaml pull

echo "Starting PostgreSQL, Redis and Evolution API..."
sudo docker compose -f compose.yaml up -d

echo "Waiting for services..."
for attempt in $(seq 1 36); do
  API_STATE="$(sudo docker inspect -f '{{.State.Status}}' evolution_api 2>/dev/null || true)"
  PG_HEALTH="$(sudo docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' evolution_postgres 2>/dev/null || true)"
  REDIS_HEALTH="$(sudo docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' evolution_redis 2>/dev/null || true)"
  echo "attempt=$attempt api=${API_STATE:-missing} postgres=${PG_HEALTH:-missing} redis=${REDIS_HEALTH:-missing}"
  if [ "$API_STATE" = "running" ] && [ "$PG_HEALTH" = "healthy" ] && [ "$REDIS_HEALTH" = "healthy" ]; then
    break
  fi
  sleep 10
done

echo "=== COMPOSE PS ==="
sudo docker compose -f compose.yaml ps

echo "=== LOCAL API PROBE ==="
HTTP_CODE="$(curl -sS -o /tmp/evolution-probe.txt -w '%{http_code}' --max-time 10 http://127.0.0.1:8080/ || true)"
echo "HTTP_CODE=${HTTP_CODE:-none}"
head -c 500 /tmp/evolution-probe.txt 2>/dev/null | tr '\n' ' ' || true
echo

echo "=== RESOURCE SNAPSHOT ==="
free -h
sudo docker stats --no-stream --format '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}}' evolution_api evolution_postgres evolution_redis 2>/dev/null || true

API_STATE="$(sudo docker inspect -f '{{.State.Status}}' evolution_api 2>/dev/null || true)"
PG_HEALTH="$(sudo docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' evolution_postgres 2>/dev/null || true)"
REDIS_HEALTH="$(sudo docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' evolution_redis 2>/dev/null || true)"

if [ "$API_STATE" != "running" ] || [ "$PG_HEALTH" != "healthy" ] || [ "$REDIS_HEALTH" != "healthy" ]; then
  echo "=== NON-SECRET FAILURE DIAGNOSTICS ==="
  sudo docker compose -f compose.yaml ps || true
  sudo docker logs --tail 120 evolution_api 2>&1 | sed -E 's/(apikey|api_key|password|token|secret)[=: ][^ ,"]+/\1=[REDACTED]/Ig' || true
  exit 23
fi

sudo mkdir -p /var/lib/agendafacil
date -u +%FT%TZ | sudo tee /var/lib/agendafacil/evolution-stack-ready >/dev/null
echo "EVOLUTION_STACK_RUNNING"
