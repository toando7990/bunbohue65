#!/usr/bin/env bash
# =============================================================================
# deploy-ahamove-worker.sh
# Tu dong trien khai AhaMove Shipper Worker tren VPS FPT
# VPS: 103.149.170.47 | Port worker: 3002
# =============================================================================
set -euo pipefail

# -- Mau sac log ---------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# -- Cau hinh -----------------------------------------------------------------
VPS_USER="root"
VPS_HOST="103.149.170.47"
WORKER_DIR="/opt/ahamove-worker"
WORKER_PORT=3002
PM2_APP_NAME="ahamove-worker"

# Duong dan file worker trong repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_WORKER_SRC="${SCRIPT_DIR}/../src/frontend/public/ahamove-worker.js"

# -- Kiem tra dieu kien truoc khi deploy --------------------------------------
preflight_check() {
  info "Kiem tra dieu kien trien khai..."
  command -v ssh  >/dev/null 2>&1 || error "ssh chua duoc cai dat"
  command -v scp  >/dev/null 2>&1 || error "scp chua duoc cai dat"
  [[ -f "${REPO_WORKER_SRC}" ]] || error "Khong tim thay file worker: ${REPO_WORKER_SRC}"
  success "Dieu kien OK"
}

# -- Ket noi kiem tra SSH -----------------------------------------------------
test_ssh() {
  info "Kiem tra ket noi SSH toi ${VPS_HOST}..."
  ssh -o ConnectTimeout=10 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" "echo connected" \
    || error "Khong the ket noi SSH. Kiem tra key/password VPS."
  success "SSH ket noi thanh cong"
}

# -- Tao package.json tren VPS ------------------------------------------------
create_package_json() {
  info "Tao package.json tren VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" 'bash -s' << 'ENDSSH'
set -e
mkdir -p /opt/ahamove-worker
cat > /opt/ahamove-worker/package.json << 'PKGJSON'
{
  "name": "ahamove-worker",
  "version": "1.0.0",
  "description": "AhaMove shipper status polling worker for TableOrder",
  "main": "ahamove-worker.js",
  "private": true,
  "scripts": {
    "start": "node ahamove-worker.js"
  },
  "dependencies": {
    "@dfinity/agent": "^2.1.3",
    "@dfinity/candid": "^2.1.3",
    "@dfinity/principal": "^2.1.3",
    "node-fetch": "^2.7.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
PKGJSON
echo "package.json created"
ENDSSH
  success "package.json da tao"
}

# -- Copy worker JS len VPS ---------------------------------------------------
copy_worker_file() {
  info "Copy ahamove-worker.js len VPS..."
  scp "${REPO_WORKER_SRC}" "${VPS_USER}@${VPS_HOST}:${WORKER_DIR}/ahamove-worker.js"
  success "File worker da duoc copy"
}

# -- Cai dat dependencies -----------------------------------------------------
install_deps() {
  info "Cai dat npm dependencies (co the mat 1-2 phut)..."
  ssh "${VPS_USER}@${VPS_HOST}" 'bash -s' << 'ENDSSH'
set -e
cd /opt/ahamove-worker
if ! node -e 'process.exit(parseInt(process.versions.node) < 18 ? 1 : 0)' 2>/dev/null; then
  echo "[ERROR] Node.js < 18. Can cai Node 18+."
  exit 1
fi
npm install --production --no-audit --no-fund
echo "Dependencies installed OK"
ENDSSH
  success "Dependencies da cai dat"
}

# -- Khoi dong/Restart voi PM2 ------------------------------------------------
start_with_pm2() {
  info "Khoi dong worker voi PM2..."
  ssh "${VPS_USER}@${VPS_HOST}" "bash -s -- ${WORKER_DIR} ${PM2_APP_NAME}" << 'ENDSSH'
set -e
WORKER_DIR="$1"
PM2_APP_NAME="$2"
cd "${WORKER_DIR}"
command -v pm2 >/dev/null 2>&1 || npm install -g pm2
pm2 delete "${PM2_APP_NAME}" 2>/dev/null || true
pm2 start "${WORKER_DIR}/ahamove-worker.js" \
  --name "${PM2_APP_NAME}" \
  --log /var/log/ahamove-worker.log \
  --error /var/log/ahamove-worker-error.log \
  --time \
  --restart-delay 5000 \
  --max-restarts 10
pm2 save
echo "PM2 started OK"
ENDSSH
  success "Worker da khoi dong voi PM2"
}

# -- Cau hinh PM2 Startup -----------------------------------------------------
configure_pm2_startup() {
  info "Cau hinh PM2 startup (auto-start sau reboot)..."
  ssh "${VPS_USER}@${VPS_HOST}" 'bash -s' << 'ENDSSH'
STARTUP_CMD=$(pm2 startup systemd -u root --hp /root 2>&1 | grep -E '^sudo' | head -1)
if [ -n "${STARTUP_CMD}" ]; then
  eval "${STARTUP_CMD}" || true
fi
pm2 save
echo "PM2 startup configured"
ENDSSH
  success "PM2 startup da cau hinh"
}

# -- Tao nginx snippet --------------------------------------------------------
create_nginx_snippet() {
  info "Tao nginx snippet cho /ahamove-health..."
  ssh "${VPS_USER}@${VPS_HOST}" 'bash -s' << 'ENDSSH'
set -e
NGINX_CONF="/etc/nginx/sites-enabled/bkav-proxy"
if grep -q 'ahamove-health' "${NGINX_CONF}" 2>/dev/null; then
  echo "[SKIP] Route /ahamove-health da ton tai trong nginx"
  exit 0
fi
mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/ahamove-worker.conf << 'NGINXSNIPPET'
    # AhaMove Worker health check (port 3002)
    location /ahamove-health {
        proxy_pass         http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 5s;
    }
NGINXSNIPPET
echo "Nginx snippet da tao: /etc/nginx/snippets/ahamove-worker.conf"
echo "ACTION NEEDED: Them dong sau vao server block trong ${NGINX_CONF}:"
echo "    include /etc/nginx/snippets/ahamove-worker.conf;"
echo "Sau do chay: nginx -t && systemctl reload nginx"
ENDSSH
  warn "Nginx snippet da tao. Xem huong dan o tren de them include vao nginx."
}

# -- Health Check -------------------------------------------------------------
health_check() {
  info "Kiem tra health check (port ${WORKER_PORT})..."
  sleep 4
  HTTP_CODE=$(ssh "${VPS_USER}@${VPS_HOST}" \
    "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${WORKER_PORT}/ --max-time 5" 2>/dev/null || echo "000")
  if [[ "${HTTP_CODE}" == "200" ]]; then
    success "Health check thanh cong (HTTP 200)"
  else
    warn "Health check tra ve HTTP ${HTTP_CODE}. Worker co the dang khoi dong."
    info "Kiem tra log: ssh ${VPS_USER}@${VPS_HOST} 'pm2 logs ${PM2_APP_NAME} --lines 30'"
  fi
}

# -- Show PM2 status ----------------------------------------------------------
show_pm2_status() {
  info "Trang thai PM2:"
  ssh "${VPS_USER}@${VPS_HOST}" "pm2 list" || true
}

# -- Main ---------------------------------------------------------------------
main() {
  echo ""
  echo "========================================================="
  echo "  AhaMove Worker -- Trien khai VPS FPT"
  echo "  VPS: ${VPS_HOST} | Port: ${WORKER_PORT}"
  echo "========================================================="
  echo ""

  preflight_check
  test_ssh
  create_package_json
  copy_worker_file
  install_deps
  start_with_pm2
  configure_pm2_startup
  create_nginx_snippet
  health_check
  show_pm2_status

  echo ""
  echo "========================================================="
  success "Trien khai hoan tat!"
  echo "========================================================="
  echo ""
  info "Worker dang chay tai: http://${VPS_HOST}:${WORKER_PORT}"
  info "Xem log: ssh ${VPS_USER}@${VPS_HOST} 'pm2 logs ${PM2_APP_NAME}'"
  info "Dung:    ssh ${VPS_USER}@${VPS_HOST} 'pm2 stop ${PM2_APP_NAME}'"
  info "Restart: ssh ${VPS_USER}@${VPS_HOST} 'pm2 restart ${PM2_APP_NAME}'"
  echo ""
}

main "$@"
