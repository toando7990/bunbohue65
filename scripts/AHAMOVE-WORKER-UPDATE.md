# AhaMove Worker — Update Guide

Hướng dẫn cập nhật worker AhaMove trên VPS FPT (`103.149.170.47`).

---

## Tổng quan

Worker AhaMove (`/opt/ahamove-worker/`) là một Node.js process chạy nền trên VPS, có nhiệm vụ:

- Poll trạng thái đơn hàng AhaMove mỗi 30 giây
- Gọi canister backend để cập nhật trạng thái đơn và thông tin tài xế
- Nhận webhook từ AhaMove và forward về canister (thông qua nginx)
- Cung cấp health check endpoint tại port `3002`

---

## Cách cập nhật worker

### Cách 1 — Từ máy local (scp + ssh)

```bash
# 1. Copy script và worker file lên VPS
scp src/frontend/public/ahamove-worker.js root@103.149.170.47:/tmp/
scp scripts/update-ahamove-worker.sh root@103.149.170.47:/tmp/

# 2. SSH vào VPS và chạy script
ssh root@103.149.170.47
bash /tmp/update-ahamove-worker.sh
```

### Cách 2 — Từ trong VPS (nếu đã clone repo)

```bash
# SSH vào VPS
ssh root@103.149.170.47

# Chạy script trực tiếp từ repo
bash /path/to/repo/scripts/update-ahamove-worker.sh
```

### Cách 3 — Cập nhật thủ công (chỉ copy file, không dùng script)

```bash
# 1. Copy worker file mới lên VPS
scp src/frontend/public/ahamove-worker.js root@103.149.170.47:/opt/ahamove-worker/

# 2. SSH vào VPS và restart
ssh root@103.149.170.47
pm2 reload ahamove-worker --update-env
pm2 logs ahamove-worker --lines 20
```

---

## Script làm gì?

`update-ahamove-worker.sh` thực hiện các bước sau theo thứ tự:

| Bước | Mô tả |
|------|-------|
| 1 | Kiểm tra quyền root (cảnh báo nếu không phải root) |
| 2 | Tìm file `ahamove-worker.js` (từ project hoặc `/tmp`) |
| 3 | Tạo thư mục `/opt/ahamove-worker/` nếu chưa có |
| 4 | Copy file worker mới vào `/opt/ahamove-worker/` |
| 5 | Tạo `package.json` nếu chưa tồn tại |
| 6 | Chạy `npm install --omit=dev` để cập nhật dependencies |
| 7 | Kiểm tra và cài `pm2` nếu chưa có |
| 8 | Reload (zero-downtime) hoặc start process pm2 `ahamove-worker` |
| 9 | Lưu cấu hình pm2 (`pm2 save`) |
| 10 | Hiển thị trạng thái pm2 |
| 11 | Kiểm tra health check (`curl http://localhost:3002/health`) |
| 12 | In tóm tắt kết quả |

Script **idempotent** — an toàn khi chạy nhiều lần liên tiếp.

---

## Kiểm tra sau khi cập nhật

### Health check local

```bash
curl http://localhost:3002/health
# Expected: ahamove-worker OK
```

### Health check qua HTTPS (từ bên ngoài)

```bash
curl https://proxy.bunbohue65.vn/ahamove-health
# Expected: ahamove-worker OK
```

### Webhook endpoint

```bash
curl -X POST https://proxy.bunbohue65.vn/ahamove-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Expected: {"received":true}
```

### Xem logs

```bash
# Logs realtime
pm2 logs ahamove-worker

# 50 dòng gần nhất
pm2 logs ahamove-worker --lines 50

# Chỉ xem error
pm2 logs ahamove-worker --err --lines 30
```

### Trạng thái pm2

```bash
pm2 status
pm2 show ahamove-worker
```

---

## Troubleshooting

### Worker không khởi động được

```bash
# Xem lỗi chi tiết
pm2 logs ahamove-worker --err --lines 50

# Thử chạy thủ công để xem lỗi ngay
cd /opt/ahamove-worker
node ahamove-worker.js
```

### Lỗi "Not a record type" trong logs

Đây là lỗi IDL không khớp với kiểu trả về của canister backend. Worker vẫn hoạt động bình thường (health check và webhook OK), chỉ bị lỗi khi gọi `getAhamoveWorkerConfig`. Cần cập nhật IDL trong worker để khớp với backend.

Worker đã có IDL đúng từ v288+ — nếu gặp lỗi này, hãy copy file worker mới nhất:

```bash
scp src/frontend/public/ahamove-worker.js root@103.149.170.47:/tmp/
ssh root@103.149.170.47 'bash /tmp/update-ahamove-worker.sh'
```

### Health check trả về 404

Nginx chưa route đúng. Kiểm tra:

```bash
# Xem cấu hình nginx
grep -n "ahamove" /etc/nginx/sites-enabled/bkav-proxy

# Kiểm tra snippet
cat /etc/nginx/snippets/ahamove-worker.conf

# Test và reload nginx
sudo nginx -t && sudo systemctl reload nginx
```

### Port 3002 đã bị dùng

```bash
# Xem process nào đang dùng port 3002
ss -tlnp | grep 3002

# Kill process cũ nếu cần
kill $(lsof -t -i:3002)

# Start lại worker
pm2 start ahamove-worker
```

### Worker bị restart quá nhiều lần

```bash
# Xem số lần restart
pm2 show ahamove-worker | grep restart

# Reset restart counter
pm2 reset ahamove-worker

# Xem logs để tìm nguyên nhân
pm2 logs ahamove-worker --err --lines 100
```

### Dependencies bị lỗi

```bash
cd /opt/ahamove-worker

# Xóa và cài lại
rm -rf node_modules package-lock.json
npm install

# Restart worker
pm2 restart ahamove-worker
```

---

## Cấu hình hệ thống

| Component | Giá trị |
|-----------|--------|
| VPS IP | `103.149.170.47` |
| Worker directory | `/opt/ahamove-worker/` |
| pm2 process name | `ahamove-worker` |
| Port | `3002` |
| Health check (local) | `http://localhost:3002/health` |
| Health check (public) | `https://proxy.bunbohue65.vn/ahamove-health` |
| Webhook URL | `https://proxy.bunbohue65.vn/ahamove-webhook` |
| Canister ID | `5trsv-sqaaa-aaaab-qhcoq-cai` |
| Poll interval | 30 giây |

### Các worker khác trên VPS

| Worker | Port | Directory |
|--------|------|-----------|
| bkav-worker | `3000` | `/opt/bkav-worker/` |
| ahamove-worker | `3002` | `/opt/ahamove-worker/` |

---

## Nhập webhook URL vào AhaMove Portal

1. Đăng nhập [AhaMove Partner Portal](https://partner.ahamove.com)
2. Vào **Settings → Webhooks**
3. Nhập URL: `https://proxy.bunbohue65.vn/ahamove-webhook`
4. Chọn events: `order.status_updated`, `order.driver_assigned`, `order.completed`, `order.cancelled`
5. Lưu lại

Webhook được xác thực bằng HMAC-SHA256 dùng API Key (server key) đã cấu hình trong Business Profile của ứng dụng.
