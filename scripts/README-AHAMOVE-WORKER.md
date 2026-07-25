# AhaMove Shipper Worker — Huong dan trien khai

Worker Node.js tu dong poll trang thai don hang tu AhaMove API v3 va cap nhat ve canister ICP moi 30 giay.

---

## Thong tin co ban

| Thong so | Gia tri |
|---|---|
| VPS | 103.149.170.47 (FPT) |
| Port | 3002 |
| PM2 app name | `ahamove-worker` |
| Thu muc | `/opt/ahamove-worker/` |
| Log | `/var/log/ahamove-worker.log` |
| Error log | `/var/log/ahamove-worker-error.log` |
| Poll interval | 30 giay |
| Backend canister | `5trsv-sqaaa-aaaab-qhcoq-cai` |

---

## Cach 1 — Trien khai tu dong (khuyen nghi)

Chay script tu may tinh ca nhan (can co SSH key hoac password VPS):

```bash
# Tu thu muc goc cua repo
chmod +x scripts/deploy-ahamove-worker.sh
./scripts/deploy-ahamove-worker.sh
```

Script se tu dong:
1. Kiem tra dieu kien (SSH, file worker)
2. Tao thu muc `/opt/ahamove-worker/`
3. Tao `package.json` voi dung dependencies
4. Copy `ahamove-worker.js` len VPS
5. Cai dat npm dependencies
6. Khoi dong voi PM2
7. Cau hinh PM2 startup (tu khoi dong sau reboot)
8. Tao snippet nginx
9. Kiem tra health check

---

## Cach 2 — Trien khai thu cong

### Buoc 1 — SSH vao VPS

```bash
ssh root@103.149.170.47
```

### Buoc 2 — Tao thu muc va package.json

```bash
mkdir -p /opt/ahamove-worker
cd /opt/ahamove-worker

cat > package.json << 'EOF'
{
  "name": "ahamove-worker",
  "version": "1.0.0",
  "description": "AhaMove shipper status polling worker for TableOrder",
  "main": "ahamove-worker.js",
  "private": true,
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
EOF
```

### Buoc 3 — Copy file worker len VPS

Tu **may tinh ca nhan** (khong phai VPS), chay:

```bash
scp src/frontend/public/ahamove-worker.js root@103.149.170.47:/opt/ahamove-worker/ahamove-worker.js
```

### Buoc 4 — Cai dat dependencies

```bash
cd /opt/ahamove-worker
npm install --production
```

Kiem tra sau khi cai:

```bash
ls node_modules/@dfinity/agent   # phai ton tai
ls node_modules/node-fetch       # phai ton tai
```

### Buoc 5 — Test chay thu

```bash
cd /opt/ahamove-worker
node ahamove-worker.js
# Nhan Ctrl+C de dung sau khi thay log
```

Ket qua mong muon:
```
[ahamove-worker] 2026-06-05T... [INFO] Starting AhaMove shipper worker
[ahamove-worker] 2026-06-05T... [INFO] Backend canister: 5trsv-sqaaa-aaaab-qhcoq-cai
[ahamove-worker] 2026-06-05T... [INFO] Health-check server listening on port 3002
[ahamove-worker] 2026-06-05T... [INFO] Polling for active AhaMove orders...
[ahamove-worker] 2026-06-05T... [INFO] Orders to sync: 0
```

### Buoc 6 — Chay voi PM2

```bash
# Cai PM2 neu chua co
npm install -g pm2

# Khoi dong worker
pm2 start /opt/ahamove-worker/ahamove-worker.js \
  --name ahamove-worker \
  --log /var/log/ahamove-worker.log \
  --error /var/log/ahamove-worker-error.log \
  --time \
  --restart-delay 5000 \
  --max-restarts 10

# Luu de auto-restart
pm2 save

# Cau hinh startup sau reboot
pm2 startup systemd -u root --hp /root
# Chay lenh duoc in ra man hinh
```

### Buoc 7 — Cau hinh nginx

Xem file `scripts/nginx-config-snippet.txt` de biet chinh xac doan can them.

Tom tat nhanh:

```bash
# Tao snippet
nanon /etc/nginx/snippets/ahamove-worker.conf
# Dan noi dung location block tu nginx-config-snippet.txt

# Them include vao server block
nano /etc/nginx/sites-enabled/bkav-proxy
# Them dong: include /etc/nginx/snippets/ahamove-worker.conf;

# Test va reload
nginx -t && systemctl reload nginx
```

---

## Kiem tra sau trien khai

### Kiem tra PM2

```bash
pm2 list
pm2 status ahamove-worker
```

Trang thai mong muon: `online`

### Kiem tra port

```bash
curl http://127.0.0.1:3002/
# Ket qua: ahamove-worker OK
```

### Kiem tra qua nginx

```bash
curl https://proxy.bunbohue65.vn/ahamove-health
# Ket qua: ahamove-worker OK
```

### Xem log

```bash
# Log real-time
pm2 logs ahamove-worker

# 50 dong gan nhat
pm2 logs ahamove-worker --lines 50

# Log file truc tiep
tail -f /var/log/ahamove-worker.log
tail -f /var/log/ahamove-worker-error.log
```

---

## Cap nhat worker khi co code moi

```bash
# Tu may tinh ca nhan
scp src/frontend/public/ahamove-worker.js root@103.149.170.47:/opt/ahamove-worker/ahamove-worker.js

# SSH vao VPS, restart PM2
ssh root@103.149.170.47 'pm2 restart ahamove-worker'
```

---

## Cac lenh PM2 thuong dung

| Lenh | Tac dung |
|---|---|
| `pm2 list` | Xem danh sach tat ca worker |
| `pm2 status ahamove-worker` | Xem trang thai worker nay |
| `pm2 restart ahamove-worker` | Restart worker |
| `pm2 stop ahamove-worker` | Dung worker |
| `pm2 delete ahamove-worker` | Xoa worker khoi PM2 |
| `pm2 logs ahamove-worker` | Xem log real-time |
| `pm2 monit` | Dashboard PM2 real-time |

---

## Xu ly loi thuong gap

### Worker khong start — loi "Cannot find module '@dfinity/agent'"

```bash
cd /opt/ahamove-worker
rm -rf node_modules package-lock.json
npm install --production
pm2 restart ahamove-worker
```

### Worker start nhung log "AhaMove API key not configured"

Nguyen nhan: Backend chua duoc cau hinh API Key AhaMove.

Giai phap: Vao **Ho so doanh nghiep → tab Giao hang**, nhap API Key AhaMove, luu lai.

### Worker log loi "AhaMove API HTTP 401"

Nguyen nhan: API Key khong dung hoac da het han.

Giai phap: Kiem tra lai API Key trong trang cau hinh AhaMove.

### Worker log loi "fetch is not a function"

Nguyen nhan: `node-fetch` khong duoc cai hoac phien ban khong tuong thich.

Giai phap:
```bash
cd /opt/ahamove-worker
npm install node-fetch@2
pm2 restart ahamove-worker
```

### Port 3002 bi chiem dung

```bash
# Kiem tra process dang dung port
lsof -i :3002

# Neu la process la, kill no
kill -9 <PID>

# Restart worker
pm2 restart ahamove-worker
```

### PM2 khong tu khoi dong sau reboot

```bash
pm2 startup systemd -u root --hp /root
# Thuc thi lenh duoc in ra
pm2 save
```

---

## So sanh cac worker tren VPS

| Worker | Port | PM2 name | Thu muc |
|---|---|---|---|
| BKAV Invoice | 3000 | `bkav-worker` | `/opt/bkav-worker/` |
| **AhaMove Shipper** | **3002** | **`ahamove-worker`** | **`/opt/ahamove-worker/`** |

---

## Chuc nang worker

1. **Poll canister moi 30 giay** — Goi `getAhamoveWorkerConfig()` lay danh sach don hang can theo doi
2. **Goi AhaMove API v3** — `GET /v3/orders/{id}` lay trang thai tai xe moi nhat
3. **Cap nhat ve canister** — Goi `receiveAhamoveWebhook(orderId, status, driverInfo)` voi thong tin moi
4. **Dedup** — Khong gui lai neu trang thai khong thay doi
5. **Retry** — Tu dong retry 3 lan voi delay tang dan neu gap loi tam thoi
6. **Health check** — HTTP server tren port 3002, tra ve `200 OK`

---

## Luong du lieu

```
AhaMove API v3
  |
  | GET /v3/orders/{ahamoveOrderId}
  v
ahamove-worker (Node.js, port 3002)
  |
  | receiveAhamoveWebhook(orderId, status, driverInfo)
  v
Backend canister (5trsv-sqaaa-aaaab-qhcoq-cai)
  |
  | cap nhat driverInfo, deliveryStatus
  v
Frontend DeliveryOrderPage (hien thi real-time)
```

---

*© 2026. Built with love using [caffeine.ai](https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=tableorder)*
