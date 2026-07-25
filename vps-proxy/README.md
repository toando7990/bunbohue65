# VPS Proxy — Tingee + Ahamove Workers

VPS proxy server + workers cho Tingee Dynamic QR và Ahamove booking. Chạy trên
VPS, gọi external APIs (Tingee, Ahamove) và callback về IC canister qua
`@dfinity/agent` + `Ed25519KeyIdentity`.

## Kiến trúc

```
                    ┌─────────────────────────────────────────────┐
                    │              VPS Proxy Server               │
                    │  (vps-proxy-server.js, Express, port 3000)    │
                    │                                             │
   IC Canister ────►│  /tingee-generate  ──► api.tingee.vn         │
   (HTTP outcall)   │  /tingee-banks     ──► api.tingee.vn         │
                    │  /tingee-status    ──► api.tingee.vn         │
                    │  /tingee-delete    ──► api.tingee.vn         │
                    │  /ahamove-book     ──► api.ahamove.com       │
                    │  /webhook/tingee   ──► canister (forward)    │
                    │  /webhook/ahamove  ──► canister (forward)    │
                    └─────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────┐
                    │           Tingee Worker                      │
                    │  (tingee-worker.js, poll loop 15s)           │
                    │                                             │
   IC Canister ◄───►│  getPendingDynamicQRs()  (query)            │
   (poll + update)  │  getDynamicQRWorkerConfig() (query)          │
                    │                                             │
                    │  #generate → api.tingee.vn/generate-dynamic-qr
                    │             → confirmDynamicQRGenerated()    │
                    │  #status   → api.tingee.vn/get-status-dynamic-qr
                    │             → confirmDynamicQRStatus()       │
                    │  #delete   → api.tingee.vn/delete-dynamic-qr │
                    │             → confirmDynamicQRDeleted()       │
                    └─────────────────────────────────────────────┘
                                       │
                                       ▼
                          api.tingee.vn (HMAC-SHA512)

                    ┌─────────────────────────────────────────────┐
                    │          Ahamove Worker                      │
                    │  (ahamove-worker.js, poll loop 15s)          │
                    │                                             │
   IC Canister ◄───►│  getPendingAhamoveBookings() (query)         │
   (poll + update)  │  getAhamoveWorkerConfig() (query, variant)    │
                    │                                             │
                    │  → api.ahamove.com/v1/order/create           │
                    │  → confirmAhamoveBooking(orderId,            │
                    │      ahamoveOrderId, fare, status)            │
                    └─────────────────────────────────────────────┘
                                       │
                                       ▼
                          api.ahamove.com (Bearer apiKey)
```

## Cài đặt

### 1. Cài đặt dependencies

```bash
cd /opt/vps-proxy
npm install
```

### 2. Cấu hình environment variables

Tạo file `.env` hoặc export các biến môi trường:

```bash
# Bắt buộc
export CANISTER_ID="52szj-eyaaa-aaaab-qhcpa-cai"

# Tùy chọn (có giá trị mặc định)
export IC_HOST="https://icp0.io"
export POLL_INTERVAL_MS="15000"
export LOG_LEVEL="info"
export WORKER_IDENTITY_PATH="./worker-identity.json"
export PORT="3000"  # cho vps-proxy-server.js
```

### 3. Chạy

```bash
# Proxy server (Express, port 3000)
npm run start:proxy
# hoặc: node ../vps-proxy-server.js

# Tingee worker (poll loop)
npm run start:tingee
# hoặc: node tingee-worker.js

# Ahamove worker (poll loop)
npm run start:ahamove
# hoặc: node ahamove-worker.js
```

### 4. Chạy với PM2 (daemon)

```bash
npm install -g pm2

pm2 start ../vps-proxy-server.js --name vps-proxy
pm2 start tingee-worker.js --name tingee-worker
pm2 start ahamove-worker.js --name ahamove-worker

pm2 save
pm2 startup
```

## Routes (vps-proxy-server.js)

| Method | Path              | Mô tả                                          |
|--------|-------------------|------------------------------------------------|
| POST   | `/bkav-prod`      | Forward BKAV production (có sẵn)               |
| POST   | `/bkav-demo`      | Forward BKAV demo (có sẵn)                      |
| GET    | `/bkav-result/:key` | Lấy số HĐ sau consensus (có sẵn)            |
| POST   | `/tingee-generate`| Forward Tingee generate-dynamic-qr (có sẵn)    |
| GET    | `/tingee-banks`   | Forward Tingee get-banks (mới)                 |
| POST   | `/tingee-status`  | Forward Tingee get-status-dynamic-qr (mới)     |
| POST   | `/tingee-delete`  | Forward Tingee delete-dynamic-qr (mới)         |
| POST   | `/ahamove-book`   | Forward Ahamove order/create (mới)             |
| POST   | `/webhook/tingee` | Nhận webhook Tingee → forward canister (mới)   |
| POST   | `/webhook/ahamove`| Nhận webhook Ahamove → forward canister (mới)  |
| GET    | `/health`         | Health check (có sẵn)                          |
| GET    | `/tingee-health`  | Tingee health check (có sẵn)                   |
| GET    | `/cache-stats`    | Cache stats (có sẵn)                           |

## Tingee Signature (HMAC-SHA512)

Worker ký HMAC-SHA512 cho mỗi request Tingee:

```
payload = HMAC-SHA512(secretToken, timestamp + ':' + bodyJson)
```

- **POST**: `bodyJson = JSON.stringify(body)`
- **GET**: `bodyJson = '{}'`

Headers gửi cho Tingee:
- `x-client-id`: clientId từ `getDynamicQRWorkerConfig()`
- `x-request-timestamp`: Unix timestamp (giây)
- `x-signature`: HMAC-SHA512 hex digest
- `accept`: `application/json`
- `Content-Type`: `application/json` (cho POST)

> `secretToken` chỉ lưu trong canister (query được bởi worker vì worker có
> identity đã đăng ký). Không bao giờ log raw secretToken.

## Canister Callback Signatures

### Tingee (SINGLE RECORD args)

```motoko
confirmDynamicQRGenerated({ qrString, idempotencyKey, qrId, orderId, billId })
confirmDynamicQRStatus({ status, totalAmountPaid, transactionInfos, orderId })
confirmDynamicQRDeleted({ orderId })
```

### Ahamove (POSITIONAL args)

```motoko
confirmAhamoveBooking(orderId, ahamoveOrderId, fare, status)
```

> ⚠️ **Lưu ý quan trọng**: `confirmAhamoveBooking` dùng `codIsEnterpriseStaff`
> auth, **KHÔNG** phải `workerPrincipal`. Principal của ahamove-worker phải
> được cấp quyền `#EnterpriseDelivery` (enterprise staff) thì callback mới
> được chấp nhận. Xem phần "Auth Setup" bên dưới.

## Auth Setup

### Tingee Worker

1. Worker sinh `Ed25519KeyIdentity` lần đầu chạy, lưu `worker-identity.json`.
2. Log in ra `Worker principal: <principal-text>`.
3. Canister owner đăng ký principal này qua admin UI / canister method để
   worker được phép gọi `confirmDynamicQR*` (update call).
4. `getDynamicQRWorkerConfig()` trả về `workerPrincipal: ?Principal` — canister
   owner set principal này vào config.

### Ahamove Worker

1. Worker sinh `Ed25519KeyIdentity` lần đầu chạy, lưu `worker-identity.json`.
2. Log in ra `Worker principal: <principal-text>`.
3. **Canister owner cấp quyền `#EnterpriseDelivery` (enterprise staff)** cho
   principal này — KHÔNG phải `workerPrincipal`. Vì `confirmAhamoveBooking`
   dùng `codIsEnterpriseStaff` auth.
4. `getAhamoveWorkerConfig()` trả về variant `{ #ok: Config; #err: Text }` —
   nếu `#err`, worker sẽ skip poll và log warning.

## Worker Identity (principal cố định qua restart)

Cả hai worker dùng `Ed25519KeyIdentity` persisted:

- **File mặc định:** `./worker-identity.json` (chmod `0600`).
- **Override:** `WORKER_IDENTITY_PATH` env var.
- **Không commit vào git** — thêm vào `.gitignore`:
  ```gitignore
  worker-identity.json
  ```
- **Sao lưu:** backup file này ra nơi an toàn. Nếu mất, worker sinh identity
  mới (principal mới) → cần đăng ký lại với canister owner.

## Env Vars

| Var                   | Mặc định                  | Mô tả                          |
|-----------------------|---------------------------|--------------------------------|
| `CANISTER_ID`         | `52szj-eyaaa-aaaab-qhcpa-cai` | IC canister ID             |
| `IC_HOST`             | `https://icp0.io`         | IC host (dùng `icp0.io` cho mainnet) |
| `POLL_INTERVAL_MS`    | `15000`                   | Poll interval (ms)             |
| `LOG_LEVEL`           | `info`                    | `debug` / `info` / `warn` / `error` / `none` |
| `WORKER_IDENTITY_PATH`| `./worker-identity.json`  | Path to identity file          |
| `PORT`                | `3000`                    | Port cho vps-proxy-server.js   |

## Dedup

Cả hai worker dùng `Map` để track các orderId đã xử lý (TTL 120 giây), tránh
xử lý trùng lặp giữa các poll cycle.

- **Tingee worker**: key = `${orderId}:${operation}` (generate / status / delete).
- **Ahamove worker**: key = `orderId`.

## Retry Logic

Mỗi item retry tối đa 3 lần (configurable qua `MAX_RETRIES`), delay 5 giây giữa
các retry (`RETRY_DELAY_MS`). Sau khi hết retry:

- **Tingee worker**: log error, không callback (canister sẽ poll lại lần sau).
- **Ahamove worker**: callback `confirmAhamoveBooking(orderId, '', 0, 'FAILED')`
  để canister biết đơn thất bại.

## Troubleshooting

### Worker không poll được canister

**Kiểm tra:**
1. `IC_HOST` có đúng không (mặc định: `https://icp0.io`).
2. `CANISTER_ID` có đúng không.
3. Network từ VPS có kết nối đến IC không.
4. Worker principal đã được canister owner đăng ký chưa.

### Ahamove callback bị reject (auth error)

**Nguyên nhân:** Worker principal chưa được cấp quyền `#EnterpriseDelivery`.

**Giải pháp:**
1. Xem log worker khi khởi động: `Worker principal: <principal-text>`.
2. Canister owner cấp quyền `#EnterpriseDelivery` (enterprise staff) cho
   principal này qua admin UI / canister method.
3. Restart worker.

### Tingee signature error (401)

**Kiểm tra:**
1. `clientId` và `secretToken` từ `getDynamicQRWorkerConfig()` có đúng không.
2. Timestamp đồng bộ với server Tingee (±60s).
3. `bodyJson` cho GET phải là `'{}'`, cho POST phải là `JSON.stringify(body)`.

## License

MIT
