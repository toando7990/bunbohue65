# AhaMove Worker

Worker Node.js chạy trên VPS, đồng bộ trạng thái đơn hàng AhaMove với IC Canister. Worker poll AhaMove API mỗi 30 giây để cập nhật trạng thái, nhận webhook từ AhaMove, và expose các endpoint ước tính / đặt xe cho frontend.

## Kiến trúc

```
[IC Canister] ←──poll── [AhaMove Worker] ←──REST──→ [AhaMove API]
      ↑                        │
      └───receiveAhamoveWebhook─┘
                               │
                               └──HTTP server (port 3002)──→ [Frontend / Nginx]
```

## Luồng hoạt động

1. **Poll** canister mỗi 30 giây để lấy danh sách `ordersToSync` (các đơn hàng AhaMove đang active)
2. **Gọi AhaMove API** `/v3/orders/{id}` để lấy trạng thái mới nhất
3. **Callback** về canister qua `receiveAhamoveWebhook` với trạng thái đã map + thông tin tài xế
4. **Nhận webhook** từ AhaMove tại `/ahamove-webhook` và forward về canister
5. **Expose** các endpoint `/ahamove-estimate`, `/ahamove-estimate-public`, `/ahamove-book` cho frontend

## Cài đặt

### 1. Cài đặt dependencies

```bash
cd /opt/ahamove-worker
npm install
```

### 2. Cấu hình environment variables

Tạo file `.env` hoặc export các biến môi trường:

```bash
# Bắt buộc
export CANISTER_ID="cnpfs-uqaaa-aaaaf-qgsnq-cai"

# Tùy chọn (có giá trị mặc định trong code)
# IC_HOST mặc định: https://icp-api.io
# POLL_INTERVAL_MS mặc định: 30000
# MAX_RETRIES mặc định: 3
# RETRY_DELAY_MS mặc định: 5000
# PORT mặc định: 3002
```

> Lưu ý: `apiKey`, `mobile`, `isTestMode`, `ordersToSync` **không** lấy từ env var — worker tự fetch từ canister qua `getAhamoveWorkerConfig` (query call, cache 5 giây). JWT token AhaMove được worker tự fetch qua `/v3/accounts/token` và cache 23 giờ.

### 3. Chạy worker

```bash
# Chạy trực tiếp
npm start

# Hoặc dùng PM2 để chạy daemon
pm2 start ahamove-worker.js --name ahamove-worker
pm2 save
pm2 startup
```

## Cấu trúc file

```
src/vps-workers/
├── ahamove-worker.js   # Main worker script
└── README.md           # Hướng dẫn này
```

## Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| GET  | `/health` | Kiểm tra trạng thái worker |
| POST | `/ahamove-webhook` | Nhận webhook từ AhaMove (header `X-Ahamove-Signature`) |
| POST | `/ahamove-estimate` | Ước tính phí ship (book-then-cancel, yêu cầu auth) |
| POST | `/ahamove-estimate-public` | Ước tính phí ship công khai (CORS cho `https://www.bunbohue65.vn`, không cần auth) |
| POST | `/ahamove-book` | Đặt xe AhaMove (CORS cho `https://www.bunbohue65.vn`) |

### GET /health

Trả về trạng thái worker:
```json
{ "status": "ok", "timestamp": 1700000000000, "version": "1.4.3" }
```

### POST /ahamove-webhook

Nhận webhook từ AhaMove. Worker parse payload, map status, extract thông tin tài xế, và forward về canister qua `receiveAhamoveWebhook`.

**Header:** `X-Ahamove-Signature` — signature từ AhaMove, forward nguyên văn về canister để xác thực.

### POST /ahamove-estimate

Ước tính phí ship bằng cách tạo order thật rồi cancel ngay (fire-and-forget DELETE). Yêu cầu auth từ frontend.

**Request:**
```json
{
  "path": [...],
  "serviceId": "HAN-BIKE",
  "payment_method": "CASH_BY_RECIPIENT",
  "isTestMode": false
}
```

**Response:**
```json
{ "total_price": 25000, "distance": 3.5 }
```

### POST /ahamove-estimate-public

Tương tự `/ahamove-estimate` nhưng không yêu cầu auth, có CORS headers cho `https://www.bunbohue65.vn`. Dùng cho frontend gọi trực tiếp từ browser.

### POST /ahamove-book

Đặt xe AhaMove. Tạo order thật qua `/v3/orders`.

**Request:**
```json
{
  "path": [...],
  "serviceId": "HAN-BIKE",
  "payment_method": "CASH_BY_RECIPIENT",
  "remarks": "",
  "isTestMode": false
}
```

**Response:**
```json
{
  "order_id": "ABC123",
  "status": "IDLE",
  "total_price": 25000,
  "distance": 3.5
}
```

## Xử lý lỗi

Worker tự động retry tối đa 3 lần khi gặp lỗi tạm thời:

- Network timeout
- AhaMove API unavailable
- IC canister timeout

Khi gặp HTTP 401 từ AhaMove, worker reset cache JWT token và retry lại 1 lần trước khi báo lỗi.

Sau 3 lần retry, worker sẽ:
1. Bỏ qua đơn hàng lỗi đó trong cycle hiện tại
2. Ghi log lỗi chi tiết
3. Tiếp tục xử lý đơn hàng tiếp theo trong cycle kế tiếp

## Bảo mật

### CORS

Các endpoint public (`/ahamove-estimate-public`, `/ahamove-book`) có CORS headers locked origin `https://www.bunbohue65.vn`. OPTIONS preflight được handle riêng cho mỗi endpoint.

### AhaMove Auth

Worker tự quản lý JWT token AhaMove:
- Nếu `config.mobile` được set → fetch JWT qua `/v3/accounts/token` (cache 23 giờ)
- Nếu `config.mobile` trống → dùng `apiKey` trực tiếp làm Bearer (backwards compat v1.2.0)
- Auto-invalidate cache khi `apiKey` thay đổi

### Webhook Signature

Webhook từ AhaMove có header `X-Ahamove-Signature`. Worker forward nguyên văn signature + raw body về canister để canister tự xác thực.

## Monitoring

### Logs

Worker ghi log đầy đủ với format:

```
[ahamove-worker] 2024-01-15T10:30:00.000Z [INFO] Message { data }
```

Xem logs với PM2:
```bash
pm2 logs ahamove-worker
```

### Metrics

Các metrics quan trọng:
- Số đơn hàng đã poll
- Số webhook đã nhận và forward thành công
- Số lỗi AhaMove API / canister
- Thời gian phản hồi AhaMove API

## Troubleshooting

### Lỗi "CANISTER_ID is required"

**Nguyên nhân:** Chưa set biến môi trường `CANISTER_ID`
**Giải pháp:**
```bash
export CANISTER_ID="cnpfs-uqaaa-aaaaf-qgsnq-cai"
```

### Worker không poll được canister

**Kiểm tra:**
1. `CANISTER_ID` có đúng không
2. `IC_HOST` (mặc định: `https://icp-api.io`) có reachable từ VPS không
3. Canister đã deploy và method `getAhamoveWorkerConfig` tồn tại
4. `apiKey` đã được cấu hình trong Hồ sơ doanh nghiệp > tab AhaMove

### AhaMove API trả về 401

**Kiểm tra:**
1. `apiKey` và `mobile` (nếu dùng JWT) có đúng không trong Hồ sơ doanh nghiệp > tab AhaMove
2. Nếu dùng JWT: `mobile` phải đúng số điện thoại đăng ký AhaMove
3. Worker log sẽ hiển thị "resetting token cache and retrying" — kiểm tra log để xác nhận

### AhaMove API trả về lỗi khác

**Kiểm tra:**
1. `isTestMode` có đúng không (test: `partner-apistg.ahamove.com`, prod: `partner-api.ahamove.com`)
2. `serviceId` có hợp lệ cho khu vực không (ví dụ `HAN-BIKE` cho Hà Nội)
3. `path` (tọa độ pickup/dropoff) có đúng định dạng AhaMove yêu cầu

### Frontend không gọi được /ahamove-estimate-public

**Kiểm tra:**
1. Nginx proxy `/ahamove-estimate-public` trỏ đúng port worker (mặc định `3002`)
2. Origin request là `https://www.bunbohue65.vn` (CORS locked)
3. Worker đang chạy (`pm2 status ahamove-worker`)

## Tích hợp với PM2

```bash
# Cài đặt PM2
npm install -g pm2

# Chạy worker
pm2 start ahamove-worker.js --name ahamove-worker

# Tự động khởi động lại khi reboot
pm2 startup
pm2 save

# Xem status
pm2 status

# Xem logs
pm2 logs ahamove-worker

# Restart
pm2 restart ahamove-worker

# Stop
pm2 stop ahamove-worker
```

## License

MIT
