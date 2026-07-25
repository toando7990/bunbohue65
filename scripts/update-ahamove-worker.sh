#!/usr/bin/env bash
# =============================================================================
# update-ahamove-worker.sh
# Run this script ON THE VPS to update the AhaMove worker in-place.
# Safe to run multiple times (idempotent).
#
# Usage (two options):
#
#   Option A -- from your local machine, deploy via SCP+SSH:
#     scp src/frontend/public/ahamove-worker.js root@103.149.170.47:/tmp/
#     scp scripts/update-ahamove-worker.sh      root@103.149.170.47:/tmp/
#     ssh root@103.149.170.47 'bash /tmp/update-ahamove-worker.sh'
#
#   Option B -- run inside the VPS if the repo is cloned there:
#     bash scripts/update-ahamove-worker.sh
# =============================================================================

set -euo pipefail

# -- Config -------------------------------------------------------------------
WORKER_DIR="/opt/ahamove-worker"
WORKER_FILE="ahamove-worker.js"
PM2_NAME="ahamove-worker"
HEALTH_URL="http://localhost:3002/health"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_FILE="${SCRIPT_DIR}/../src/frontend/public/${WORKER_FILE}"

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# -- Banner -------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  AhaMove Worker -- Update Script"
echo "============================================================"
echo ""

# -- 1. Root check ------------------------------------------------------------
if [[ "${EUID}" -ne 0 ]]; then
  log_warn "Not running as root. Some steps may fail. Re-run with: sudo bash $0"
fi

# -- 2. Resolve source file ---------------------------------------------------
# Supports: project repo (Option B) or /tmp drop (Option A)
if [[ -f "${SOURCE_FILE}" ]]; then
  log_info "Source file: ${SOURCE_FILE}"
elif [[ -f "/tmp/${WORKER_FILE}" ]]; then
  SOURCE_FILE="/tmp/${WORKER_FILE}"
  log_warn "Using /tmp/${WORKER_FILE} as source (standalone/SCP mode)"
else
  log_error "Cannot find source file '${WORKER_FILE}'."
  echo ""
  echo "  Copy it first:"
  echo "    scp src/frontend/public/ahamove-worker.js root@VPS:/tmp/"
  echo "    scp scripts/update-ahamove-worker.sh      root@VPS:/tmp/"
  echo "    ssh root@VPS 'bash /tmp/update-ahamove-worker.sh'"
  echo ""
  exit 1
fi

# -- 3. Ensure destination directory exists -----------------------------------
log_info "Ensuring worker directory: ${WORKER_DIR}"
mkdir -p "${WORKER_DIR}"
log_ok "Directory ready"

# -- 4. Copy updated worker file ----------------------------------------------
log_info "Copying ${WORKER_FILE} -> ${WORKER_DIR}/${WORKER_FILE}"
cp -f "${SOURCE_FILE}" "${WORKER_DIR}/${WORKER_FILE}"
log_ok "Worker file copied"

# -- 5. Ensure package.json exists (idempotent) --------------------------------
PKGJSON="${WORKER_DIR}/package.json"
if [[ ! -f "${PKGJSON}" ]]; then
  log_info "Creating package.json (first-time setup)"
  cat > "${PKGJSON}" <<'PKGEOF'
{
  "name": "ahamove-worker",
  "version": "1.0.0",
  "description": "AhaMove shipper worker for TableOrder",
  "main": "ahamove-worker.js",
  "scripts": {
    "start": "node ahamove-worker.js"
  },
  "dependencies": {
    "@dfinity/agent": "^2.1.3",
    "@dfinity/candid": "^2.1.3",
    "@dfinity/principal": "^2.1.3",
    "node-fetch": "^2.7.0"
  }
}
PKGEOF
  log_ok "package.json created"
else
  log_info "package.json already exists -- skipping"
fi

# -- 6. Install / update npm dependencies --------------------------------------
log_info "Running npm install in ${WORKER_DIR}"
cd "${WORKER_DIR}" && npm install --omit=dev
log_ok "npm install complete"

# -- 7. Check if pm2 is installed ---------------------------------------------
if ! command -v pm2 &>/dev/null; then
  log_warn "pm2 not found -- installing globally"
  npm install -g pm2
  log_ok "pm2 installed"
fi

# -- 8. Reload or start the pm2 process (zero-downtime) -----------------------
cd "${WORKER_DIR}"
if pm2 describe "${PM2_NAME}" &>/dev/null; then
  log_info "pm2 process '${PM2_NAME}' found -- reloading (zero-downtime)"
  pm2 reload "${PM2_NAME}" --update-env
  log_ok "pm2 process reloaded"
else
  log_warn "pm2 process '${PM2_NAME}' not found -- starting fresh"
  pm2 start "${WORKER_FILE}" --name "${PM2_NAME}"
  log_ok "pm2 process started"
fi

# -- 9. Save pm2 startup list -------------------------------------------------
pm2 save
log_ok "pm2 process list saved"

# -- 10. Show pm2 status -------------------------------------------------------
echo ""
log_info "pm2 process status:"
pm2 show "${PM2_NAME}" 2>/dev/null \
  | grep -E 'status|restart|uptime|memory|exec mode' \
  || pm2 list

# -- 11. Health check ----------------------------------------------------------
echo ""
log_info "Waiting 3 seconds for worker to initialize..."
sleep 3

log_info "Testing health endpoint: ${HEALTH_URL}"
HTTP_CODE=$(curl -s -o /tmp/ahamove_health_resp.txt -w "%{http_code}" "${HEALTH_URL}" || echo "000")

if [[ "${HTTP_CODE}" == "200" ]]; then
  BODY=$(cat /tmp/ahamove_health_resp.txt)
  log_ok "Health check passed (HTTP ${HTTP_CODE}): ${BODY}"
else
  log_error "Health check failed (HTTP ${HTTP_CODE})"
  log_warn "Diagnose with: pm2 logs ${PM2_NAME} --lines 30"
fi

# -- 12. Summary ---------------------------------------------------------------
echo ""
echo "============================================================"
if [[ "${HTTP_CODE}" == "200" ]]; then
  echo -e "  ${GREEN}UPDATE COMPLETE ✓${NC}"
else
  echo -e "  ${YELLOW}UPDATE DONE -- health check failed, check logs${NC}"
fi
echo ""
echo "  Worker directory : ${WORKER_DIR}"
echo "  pm2 process name : ${PM2_NAME}"
echo "  Local health     : ${HEALTH_URL}"
echo "  Public health    : https://proxy.bunbohue65.vn/ahamove-health"
echo "  Webhook URL      : https://proxy.bunbohue65.vn/ahamove-webhook"
echo ""
echo "  View live logs   : pm2 logs ${PM2_NAME}"
echo "  View last errors : pm2 logs ${PM2_NAME} --err --lines 50"
echo "============================================================"
