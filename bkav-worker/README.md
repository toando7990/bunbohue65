# BKAV Invoice Worker

Worker Node.js chạy trên VPS FPT để tự động phát hành hóa đơn điện tử BKAV cho đơn hàng từ IC Canister.

## Kiến trúc

```
[IC Canister] ←──poll── [BKAV Worker] ←──SOAP──→ [BKAV API]
     ↑                                              │
     └────────────callback──────────────────────────┘
```

## Luồng hoạt động

1. **Poll** canister mỗi 15 giây để lấy danh sách đơn hàng cần phát hành hóa đơn
2. **Gọi BKAV API** qua SOAP để phát hành hóa đơn
3. **Ghi kết quả** về canister qua callback API với `X-Invoice-Signature` header

## Cài đặt

### 1. Cài đặt dependencies

```bash
cd /opt/bkav-worker
npm install
```

### 2. Cấu hình environment variables

Tạo file `.env` hoặc export các biến môi trường:

```bash
# Bắt buộc
export CANISTER_ID="cnpfs-uqaaa-aaaaf-qgsnq-cai"
export INVOICE_CALLBACK_SECRET="your-secret-here"  # Copy từ Hồ sơ doanh nghiệp > BKAV > Invoice Callback Secret

# Tùy chọn (có giá trị mặc định)
export IC_HOST="https://icp0.io"
export POLL_INTERVAL_MS="15000"
export MAX_RETRIES="3"
export RETRY_DELAY_MS="5000"
export REQUEST_TIMEOUT_MS="30000"
```

### 3. Chạy worker

```bash
# Chạy trực tiếp
npm start

# Hoặc dùng PM2 để chạy daemon
pm2 start bkav-worker.js --name bkav-worker
pm2 save
pm2 startup
```

## Cấu trúc file

```
bkav-worker/
├── package.json      # Dependencies
├── bkav-worker.js    # Main worker script
└── README.md         # Hướng dẫn này
```

## API Reference

### Hàm chính

#### `startWorker()`
Khởi động worker, bắt đầu poll canister.

#### `stopWorker()`
Dừng worker, clear interval.

#### `buildBkavSoapRequest(invoiceData, config)`
Build SOAP request cho BKAV API.

**Parameters:**
- `invoiceData` (Object): Thông tin hóa đơn
  - `buyerName`: Tên người mua
  - `buyerTaxCode`: MST người mua
  - `buyerAddress`: Địa chỉ người mua
  - `buyerPhone`: SĐT người mua
  - `buyerEmail`: Email người mua
  - `paymentMethod`: Phương thức thanh toán
  - `items` (Array): Danh sách sản phẩm
  - `totalAmount`: Tổng tiền
  - `vatAmount`: Tiền VAT
- `config` (Object): Cấu hình BKAV
  - `partnerGUID`: Partner GUID
  - `partnerToken`: Partner Token
  - `endpoint`: URL endpoint BKAV

#### `parseBkavResponse(xmlResponse)`
Parse response từ BKAV API.

**Returns:**
```javascript
{
  success: boolean,
  invoiceNo: string | null,
  invoiceDate: string | null,
  message: string,
  error: string | null
}
```

## Xử lý lỗi

Worker tự động retry tối đa 3 lần khi gặp lỗi tạm thời:

- Network timeout
- BKAV API unavailable
- IC canister timeout

Sau 3 lần retry, worker sẽ:
1. Đánh dấu đơn hàng là `invoice_error`
2. Ghi log lỗi chi tiết
3. Tiếp tục xử lý đơn hàng tiếp theo

## Bảo mật

### Callback Authentication

Tất cả callback từ worker về canister đều sử dụng `X-Invoice-Signature` header với giá trị `INVOICE_CALLBACK_SECRET` (Bearer token).
Canister so sánh trực tiếp giá trị header với secret đã lưu (constant-time comparison).

**Lấy secret:**
1. Vào Hồ sơ doanh nghiệp > tab BKAV
2. Copy giá trị **Invoice Callback Secret**
3. Set biến môi trường: `export INVOICE_CALLBACK_SECRET="<giá trị vừa copy>"`

> ⚠️ `INVOICE_CALLBACK_SECRET` **không** lấy từ canister qua query call (query call không xác thực, mọi người đều đọc được).
> Phải set thủ công làm biến môi trường trên VPS.

### Dedup

Worker sử dụng Map để track các orderId đã xử lý (TTL 120 giây), tránh phát hành trùng lặp.

## Monitoring

### Logs

Worker ghi log đầy đủ với format:

```
[2024-01-15T10:30:00.000Z] [INFO] Message { data }
```

Xem logs với PM2:
```bash
pm2 logs bkav-worker
```

### Metrics

Các metrics quan trọng:
- Số đơn hàng đã xử lý
- Số hóa đơn phát hành thành công
- Số lỗi
- Thời gian phản hồi BKAV API

## Troubleshooting

### Lỗi "CANISTER_ID is required"

**Nguyên nhân:** Chưa set biến môi trường CANISTER_ID
**Giải pháp:**
```bash
export CANISTER_ID="cnpfs-uqaaa-aaaaf-qgsnq-cai"
```

### Worker không poll được canister

**Kiểm tra:**
1. IC_HOST có đúng không (mặc định: https://icp0.io)
2. CANISTER_ID có đúng không
3. Network từ VPS FPT có thể kết nối đến IC không

## Worker Identity (principal cố định qua restart)

Worker dùng một cặp khóa Ed25519 làm identity khi gọi canister IC. Identity này
phải **cố định qua các lần restart VPS** để principal không thay đổi — nếu
principal thay đổi, canister sẽ không còn nhận diện worker và các update call
sẽ bị từ chối.

### Cách hoạt động

- Lần chạy đầu tiên: worker sinh mới một `Ed25519KeyIdentity`, ghi ra file
  `worker-identity.json` (chmod `0600`), và log principal ra console.
- Các lần restart sau: worker nạp lại identity từ file → principal giữ nguyên.
- Nếu file bị hỏng hoặc không đọc được, worker sẽ sinh identity mới (principal
  mới) và ghi đè file — cần đăng ký lại principal với canister owner.

### File `worker-identity.json`

- **Đường dẫn mặc định:** `./worker-identity.json` (thư mục chạy worker).
- **Override:** set env `WORKER_IDENTITY_PATH` (đường dẫn tuyệt đối hoặc tương
  đối so với thư mục chạy worker).
- **Nội dung:** JSON chứa cặp khóa Ed25519 (private key + public key).
- **Quyền:** `0600` (chỉ owner đọc/ghi).
- **Bảo mật:** file chứa private key — **KHÔNG commit vào git**. Thêm vào
  `.gitignore`:
  ```gitignore
  worker-identity.json
  ```
- **Sao lưu:** nên backup file này ra nơi an toàn. Nếu mất, worker sẽ sinh
  identity mới và cần đăng ký lại principal với canister.

### Đăng ký principal với canister

Khi worker khởi động lần đầu (hoặc sau khi sinh identity mới), log sẽ in:

```
[bkav-worker] Worker principal: <principal-text>
[bkav-worker] Register this principal with the canister owner so the worker can be authorized.
```

Copy principal này và đăng ký với canister owner (qua admin UI hoặc canister
method tương ứng) để worker được phép thực hiện update call.

### Env `WORKER_IDENTITY_PATH` (tùy chọn)

```bash
# Mặc định: ./worker-identity.json
# Override:
export WORKER_IDENTITY_PATH="/var/lib/bkav-worker/worker-identity.json"
```

> Khi dùng PM2 hoặc systemd, nên đặt file identity ở thư mục cố định (ví dụ
> `/var/lib/bkav-worker/`) thay vì thư mục chạy worker, để tránh bị mất khi
> redeploy code.

### BKAV API trả về lỗi

**Kiểm tra:**
1. PartnerGUID và PartnerToken có đúng không
2. Endpoint URL có đúng không (demo/prod)
3. Invoice data có đầy đủ thông tin bắt buộc không

## Tích hợp với PM2

```bash
# Cài đặt PM2
npm install -g pm2

# Chạy worker
pm2 start bkav-worker.js --name bkav-worker

# Tự động khởi động lại khi reboot
pm2 startup
pm2 save

# Xem status
pm2 status

# Xem logs
pm2 logs bkav-worker

# Restart
pm2 restart bkav-worker

# Stop
pm2 stop bkav-worker
```

## License

MIT
