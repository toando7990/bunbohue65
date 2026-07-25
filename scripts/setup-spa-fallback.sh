#!/usr/bin/env bash
# =============================================================================
# setup-spa-fallback.sh
# Ap dung cau hinh SPA fallback (try_files $uri $uri/ /index.html) len VPS
# Fix loi 404 khi refresh truc tiep cac route con (vd: /enterprise-delivery)
# -----------------------------------------------------------------------------
# VPS: 103.149.170.47 (FPT)
# File nginx tren VPS: /etc/nginx/sites-enabled/bunbohue65-proxy
# =============================================================================
#
# CACH CHAY:
#   chmod +x scripts/setup-spa-fallback.sh
#   ./scripts/setup-spa-fallback.sh
#
# Script NAY AN TOAN:
#   - KHONG ghi de cau hinh nginx hien co
#   - Chi THEM chi thi try_files vao location / block neu chua co
#   - Backup file hien tai truoc khi thay doi
#   - Test nginx -t truoc khi reload; neu fail -> rollback backup
#   - Khong reload neu test fail
#
# YEU CAU:
#   - SSH key hoac password VPS (root@103.149.170.47)
#   - Nginx da cai dat tren VPS
# =============================================================================
set -euo pipefail

# -- Mau sac log ---------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# -- Cau hinh ------------------------------------------------------------------
VPS_USER="root"
VPS_HOST="103.149.170.47"
NGINX_CONF="/etc/nginx/sites-enabled/bunbohue65-proxy"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${NGINX_CONF}.bak.${TIMESTAMP}"

# -- Kiem tra dieu kien --------------------------------------------------------
preflight_check() {
  info "Kiem tra dieu kien..."
  command -v ssh >/dev/null 2>&1 || error "ssh chua duoc cai dat"
  success "Dieu kien OK (ssh co san)"
}

# -- Kiem tra ket noi SSH ------------------------------------------------------
test_ssh() {
  info "Kiem tra ket noi SSH toi ${VPS_HOST}..."
  ssh -o ConnectTimeout=10 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" "echo connected" \
    || error "Khong the ket noi SSH. Kiem tra key/password VPS."
  success "SSH ket noi thanh cong"
}

# -- Ham chinh: thuc hien tren VPS qua SSH -------------------------------------
apply_spa_fallback() {
  info "Ap dung SPA fallback len ${NGINX_CONF}..."

  # Truyen bien vao SSH heredoc de dung chung gia tri
  export NGINX_CONF BACKUP_FILE

  ssh "${VPS_USER}@${VPS_HOST}" 'bash -s' << 'ENDSSH'
set -euo pipefail

NGINX_CONF="/etc/nginx/sites-enabled/bunbohue65-proxy"
BACKUP_FILE="${NGINX_CONF}.bak.$(date +%Y%m%d-%H%M%S)"

# -- (1) Kiem tra file nginx co ton tai --------------------------------------
if [ ! -f "${NGINX_CONF}" ]; then
  echo "[ERROR] Khong tim thay file nginx: ${NGINX_CONF}"
  echo "        Kiem tra lai duong dan hoac tao file moi."
  echo "        Dan cau hinh tu scripts/nginx-spa-fallback.conf"
  exit 2
fi
echo "[INFO] Tim thay file nginx: ${NGINX_CONF}"

# -- (2) Backup file hien tai ------------------------------------------------
cp -p "${NGINX_CONF}" "${BACKUP_FILE}"
echo "[OK]   Backup da tao: ${BACKUP_FILE}"

# -- (3) Kiem tra xem try_files da co chua -----------------------------------
# Tim location / block va kiem tra co try_files ... /index.html khong
if grep -Eq 'try_files[[:space:]]+.*\$uri[[:space:]]+.*\$uri/[[:space:]]+.*/index\.html' "${NGINX_CONF}"; then
  echo "[SKIP] try_files fallback /index.html DA TON TAI trong ${NGINX_CONF}"
  echo "       Khong can thay doi gi. Cau hinh da dung cho SPA."
  exit 0
fi

echo "[INFO] try_files fallback CHUA co. Se them vao location / block..."

# -- (4) Them try_files vao location / block --------------------------------
# Cach an toan: dung sed de chen try_files ngay sau dong 'location / {'
# Neu da co 'location / {' -> them try_files vao ngay sau do
# Neu chua co location / block -> bao nguoi dung tao moi (de tranh hong cau hinh)

if ! grep -Eq '^[[:space:]]*location[[:space:]]*/[[:space:]]*\{' "${NGINX_CONF}"; then
  echo "[WARN] Khong tim thay 'location / {' trong ${NGINX_CONF}"
  echo "       Vui long them thu cong location / block voi try_files."
  echo "       Xem scripts/nginx-spa-fallback.conf de lay mau."
  echo ""
  echo "       Vi du them vao BEN TRONG server block:"
  echo "           location / {"
  echo "               try_files \$uri \$uri/ /index.html;"
  echo "           }"
  exit 3
fi

# Tao file tam thoi: chen 'try_files $uri $uri/ /index.html;' ngay sau 'location / {'
TMP_FILE="$(mktemp)"
# Escape ky tu dac biet cho sed pattern: $ -> \$
# Chen dong try_files ngay sau dong 'location / {'
sed -E '/^[[:space:]]*location[[:space:]]*\/[[:space:]]*\{/a\            try_files $uri $uri/ /index.html;' \
  "${NGINX_CONF}" > "${TMP_FILE}"

# Kiem tra da chen thanh cong
if grep -Eq 'try_files[[:space:]]+\$uri[[:space:]]+\$uri/[[:space:]]+/index\.html' "${TMP_FILE}"; then
  echo "[OK]   Da them try_files vao location / block"
else
  echo "[ERROR] Khong the them try_files tu dong."
  rm -f "${TMP_FILE}"
  exit 4
fi

# -- (5) Test nginx -t voi file moi (chua ghi de) ---------------------------
echo "[INFO] Test nginx -t voi cau hinh moi..."
if nginx -t -c "${TMP_FILE}" 2>&1; then
  echo "[OK]   nginx -t PASS voi cau hinh moi"
else
  echo "[ERROR] nginx -t FAIL voi cau hinh moi. KHONG ap dung."
  echo "        Vui long kiem tra lai file nginx hien tai."
  rm -f "${TMP_FILE}"
  exit 5
fi

# -- (6) Ap dung: ghi de file goc -------------------------------------------
cp "${TMP_FILE}" "${NGINX_CONF}"
rm -f "${TMP_FILE}"
echo "[OK]   Da cap nhat ${NGINX_CONF}"

# -- (7) Test nginx -t lan cuoi voi file goc -------------------------------
echo "[INFO] Test nginx -t lan cuoi..."
if ! nginx -t; then
  echo "[ERROR] nginx -t FAIL sau khi ghi de. ROLLBACK..."
  cp -p "${BACKUP_FILE}" "${NGINX_CONF}"
  echo "[INFO] Da rollback ve backup: ${BACKUP_FILE}"
  exit 6
fi
echo "[OK]   nginx -t PASS"

# -- (8) Reload nginx -------------------------------------------------------
echo "[INFO] Reload nginx..."
systemctl reload nginx
echo "[OK]   Nginx da reload"

# -- (9) Bao cao ket qua ----------------------------------------------------
echo ""
echo "========================================================="
echo "  SPA FALLBACK DA DUOC AP DUNG THANH CONG"
echo "========================================================="
echo "  File:        ${NGINX_CONF}"
echo "  Backup:      ${BACKUP_FILE}"
echo "  Chi thi da them: try_files \$uri \$uri/ /index.html;"
echo ""
echo "  Kiem tra refresh route con:"
echo "    curl -I https://www.bunbohue65.vn/enterprise-delivery"
echo "  Ket qua mong muon: HTTP/1.1 200 OK"
echo ""
echo "  Neu can ROLLBACK:"
echo "    cp ${BACKUP_FILE} ${NGINX_CONF}"
echo "    nginx -t && systemctl reload nginx"
echo "========================================================="
ENDSSH

  local rc=$?
  if [ ${rc} -eq 0 ]; then
    success "SPA fallback da duoc ap dung thanh cong"
  elif [ ${rc} -eq 2 ]; then
    error "Khong tim thay file nginx ${NGINX_CONF} tren VPS"
  elif [ ${rc} -eq 3 ]; then
    error "Khong tim thay location / block. Can them thu cong (xem huong dan)"
  elif [ ${rc} -eq 4 ]; then
    error "Khong the them try_files tu dong"
  elif [ ${rc} -eq 5 ]; then
    error "nginx -t FAIL voi cau hinh moi. Khong ap dung"
  elif [ ${rc} -eq 6 ]; then
    error "nginx -t FAIL sau ghi de. Da rollback backup"
  else
    error "Loi khong xac dinh (exit code ${rc})"
  fi
}

# -- Danh sach route SPA can kiem tra fallback ---------------------------------
# Tat ca route con cua TanStack Router deu can tra HTTP 200 khi refresh truc tiep
SPA_ROUTES=(
  "/enterprise-delivery"
  "/accounting-view"
  "/customer-support"
  "/activate-device"
  "/admin/master-menu"
  "/HoaDondemo"
)

# -- Kiem tra sau khi ap dung (tu may tinh ca nhan) ----------------------------
# Kiem tra TAT CA route SPA can fallback, khong chi /enterprise-delivery
verify_remote() {
  info "Kiem tra ${#SPA_ROUTES[@]} route SPA tu ben ngoai..."
  echo ""
  echo "---------------------------------------------------------"
  echo "  Kiem tra fallback cho cac route SPA"
  echo "---------------------------------------------------------"
  printf "  %-28s %s\n" "Route" "HTTP status"
  echo "---------------------------------------------------------"

  local route http_code all_ok=1
  for route in "${SPA_ROUTES[@]}"; do
    http_code="$(curl -s -o /dev/null -w '%{http_code}' -I "https://www.bunbohue65.vn${route}" --max-time 10 2>/dev/null || echo "000")"
    printf "  %-28s %s\n" "${route}" "${http_code}"
    if [ "${http_code}" = "200" ]; then
      :
    else
      all_ok=0
    fi
  done
  echo "---------------------------------------------------------"
  echo ""

  if [ "${all_ok}" = "1" ]; then
    success "TAT CA ${#SPA_ROUTES[@]} route tra HTTP 200 -- SPA fallback hoat dong!"
  else
    warn "Mot so route KHONG tra HTTP 200. Xem bang tren."
    info "Nguyen nhan thuong gap:"
    info "  - Nginx chua reload hoac reload that bai -> 'systemctl status nginx'"
    info "  - File nginx da chinh khong phai file Nginx dang load -> 'nginx -T | grep bunbohue65'"
    info "  - dist chua duoc deploy (route tra 200 nhung trang trang) -> kiem tra /var/www/bunbohue65/dist"
    info "  - Co nhieu server block, file chinh khong phai file phuc vu bunbohue65.vn"
    info "Kiem tra truc tiep tren VPS:"
    info "  ssh ${VPS_USER}@${VPS_HOST} 'nginx -T | grep -A2 \"server_name bunbohue65\"'"
  fi
}

# -- Bao cao tong ket cuoi cung ------------------------------------------------
# In bang tong ket trang thai fallback va cac route da kiem tra
final_summary() {
  echo ""
  echo "========================================================="
  echo "  TONG KET SPA FALLBACK"
  echo "========================================================="
  echo "  VPS:           ${VPS_HOST}"
  echo "  File nginx:    ${NGINX_CONF}"
  echo "  Cac route da kiem tra:"
  local route
  for route in "${SPA_ROUTES[@]}"; do
    echo "    - https://www.bunbohue65.vn${route}"
  done
  echo ""
  echo "  De kiem tra lai bat ky luc nao:"
  echo "    curl -I https://www.bunbohue65.vn/enterprise-delivery"
  echo "    curl -I https://www.bunbohue65.vn/accounting-view"
  echo "    curl -I https://www.bunbohue65.vn/customer-support"
  echo "    curl -I https://www.bunbohue65.vn/activate-device"
  echo "    curl -I https://www.bunbohue65.vn/HoaDondemo"
  echo ""
  echo "  Neu can ROLLBACK (xem README-SPA-FALLBACK.md):"
  echo "    ssh ${VPS_USER}@${VPS_HOST}"
  echo "    cp ${NGINX_CONF}.bak.<timestamp> ${NGINX_CONF}"
  echo "    nginx -t && systemctl reload nginx"
  echo "========================================================="
}

# -- Main ---------------------------------------------------------------------
main() {
  echo ""
  echo "========================================================="
  echo "  SPA FALLBACK SETUP -- Fix loi 404 refresh route con"
  echo "  VPS: ${VPS_HOST}"
  echo "  File nginx: ${NGINX_CONF}"
  echo "========================================================="
  echo ""

  preflight_check
  test_ssh
  apply_spa_fallback
  verify_remote
  final_summary

  echo ""
  success "Hoan tat!"
  echo ""
}

main "$@"
