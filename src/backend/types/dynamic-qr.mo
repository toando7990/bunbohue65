// Dynamic QR domain types — Tingee dynamic QR integration.
//
// Bkav-like architecture (per user instructions): the canister ONLY receives
// webhooks and queries state. It does NOT make HTTP outcalls to Tingee. The
// VPS worker polls the canister for pending QR operations (generate / status /
// delete / get-banks), performs the Tingee API calls, and posts the results
// back via the confirm* callback methods. The canister persists the results
// and exposes them via query methods.
//
// VA (virtual account) is entered manually by the owner and stored in
// BusinessProfile (see tingeeVA field in types/common.mo).
// secretToken stays in the canister and is NEVER exposed to the frontend —
// it is returned to the VPS worker via getDynamicQRWorkerConfig() so the
// worker can sign Tingee requests (owner-or-worker auth, like getInvoiceWorkerConfig).
// idempotencyKey is computed deterministically in the canister so the same
// orderCode always yields the same key across replicas.
import CommonTypes "common";

module {
  // Lifecycle status of a dynamic QR record.
  // NOTE: "expired" is set ONLY by an explicit deleteDynamicQR call or by a
  // Tingee status response (posted back by the worker via
  // confirmDynamicQRStatus) — there is NO automatic background expiry handler
  // (per doNotBuild).
  public type DynamicQRStatus = {
    #pending;   // QR generated, awaiting payment
    #paid;      // payment confirmed via Tingee webhook
    #expired;   // QR expired (set by Tingee status response or manual delete)
    #deleted;   // QR explicitly deleted via deleteDynamicQR
  };

  // Stored dynamic QR record — keyed by orderId in the dynamic QR map.
  // qrId is the Tingee-returned QR identifier (extracted from data.qrAccount);
  // qrString is the rendered QR payload (extracted from data.qrCode) returned
  // to the frontend. billId is the Tingee bill identifier (extracted from
  // data.billId) used for webhook backward-compat (try orderCode first, billId
  // second).
  //
  // totalAmountPaid and transactionInfos are populated from the Tingee
  // get-status response (posted back by the worker via confirmDynamicQRStatus).
  // Per project policy, transactionInfos is for ĐỐI SOÁT (reconciliation)
  // ONLY — it must NOT be used as a payment confirmation source. Payment
  // confirmation is driven by the #TingeePaid flag set by the webhook
  // (receiveTingeeWebhook), which validates totalAmountPaid against the order
  // total before setting the flag.
  public type DynamicQRRecord = {
    qrId             : Text;
    qrString         : Text;
    var status       : DynamicQRStatus;
    billId           : Text;
    idempotencyKey   : Text;
    orderId          : CommonTypes.OrderId;
    createdAt        : CommonTypes.Timestamp;
    expiresAt        : ?CommonTypes.Timestamp;
    var totalAmountPaid   : Nat;              // from data.billInfo.totalAmountPaid (VND integer)
    var transactionInfos  : [TransactionInfo]; // from data.transactionInfos — ĐỐI SOÁT ONLY
  };

  // Immutable public view of a DynamicQRRecord (the stored record has var
  // status / totalAmountPaid / transactionInfos fields and is not directly
  // shareable).
  public type DynamicQRRecordPublic = {
    qrId             : Text;
    qrString         : Text;
    status           : DynamicQRStatus;
    billId           : Text;
    idempotencyKey   : Text;
    orderId          : CommonTypes.OrderId;
    createdAt        : CommonTypes.Timestamp;
    expiresAt        : ?CommonTypes.Timestamp;
    totalAmountPaid  : Nat;
    transactionInfos : [TransactionInfo];
  };

  // Single transaction record parsed from the Tingee get-status response
  // data.transactionInfos JSON array. Used for ĐỐI SOÁT (reconciliation) ONLY —
  // never as a payment confirmation source. Field names mirror the Tingee
  // response keys; all fields are optional because Tingee may omit any of them
  // depending on payment channel / state.
  public type TransactionInfo = {
    transactionCode : ?Text;  // bank / payment gateway transaction reference
    amount           : ?Nat;   // amount paid in this transaction (VND integer)
    bankCode         : ?Text;  // bank code (e.g. "VCB", "TCB")
    paidAt           : ?Text;  // ISO-8601 timestamp string from Tingee
    paymentMethod    : ?Text;  // e.g. "VietQR", "QR" — Tingee-reported method
    reference        : ?Text;  // additional reference / gateway ref
  };

  // ── Pending QR queue item (worker poll) ────────────────────────────────────
  // Returned by getPendingDynamicQRs() — the VPS worker polls this query to
  // discover dynamic QR operations it must perform against Tingee. Each item
  // describes ONE operation the worker must execute:
  //   - #generate : the order needs a new dynamic QR (worker calls Tingee
  //     generate-dynamic-qr, then posts the result via confirmDynamicQRGenerated)
  //   - #status   : the worker should refresh the QR's payment status from
  //     Tingee (worker calls Tingee get-status-dynamic-qr, then posts the
  //     result via confirmDynamicQRStatus)
  //   - #delete   : the order's QR should be deleted from Tingee (worker calls
  //     Tingee delete-dynamic-qr, then posts the result via confirmDynamicQRDeleted)
  //
  // The pending queue is DERIVED from existing state (orders map +
  // dynamicQRStore) — there is no separate pending-queue stable var. The
  // derivation rules are:
  //   - #generate : an order whose paymentMethod == #TingeeQR and whose
  //     paymentStatus == #TingeePending AND has NO DynamicQRRecord in
  //     dynamicQRStore (or whose record status == #expired and the user
  //     clicked regenerate).
  //   - #status   : a DynamicQRRecord exists with status == #pending (the
  //     worker periodically refreshes its payment status until paid/expired).
  //   - #delete   : a DynamicQRRecord exists whose corresponding order has
  //     been cancelled / completed / the user explicitly clicked delete
  //     (deleteDynamicQR marks the record for deletion; the worker performs
  //     the Tingee-side delete and posts back).
  public type PendingDynamicQROp = {
    #generate;
    #status;
    #delete;
  };

  public type PendingDynamicQRItem = {
    orderId          : CommonTypes.OrderId;
    orderCode        : Text;          // Tingee orderCode (from order.orderCode)
    operation        : PendingDynamicQROp;
    // For #status / #delete: the stored QR's Tingee identifiers (so the worker
    // can call get-status / delete without re-deriving them). Empty for #generate.
    qrId             : Text;
    billId           : Text;
    // For #generate: the VND amount the QR should be issued for (order total).
    // 0 for #status / #delete.
    amount           : Nat;
    // For #generate: the deterministic idempotency key computed in the canister.
    // Empty for #status / #delete.
    idempotencyKey   : Text;
  };

  // ── Worker config (worker poll) ─────────────────────────────────────────────
  // Returned by getDynamicQRWorkerConfig() — the VPS worker calls this on
  // startup and after each poll cycle to get the Tingee credentials it needs to
  // sign Tingee API requests. Auth model mirrors getInvoiceWorkerConfig():
  //   - caller == owner → returns real config
  //   - caller == registered workerPrincipal (non-null) → returns real config
  //   - otherwise → returns empty config (no credentials leaked)
  // secretToken is included so the worker can compute HMAC-SHA512 signatures
  // for Tingee requests (the canister no longer signs — it has no outcalls).
  public type DynamicQRWorkerConfig = {
    clientId         : Text;   // Tingee x-client-id (BusinessProfile.tingeeClientId)
    secretToken      : Text;   // Tingee HMAC-SHA512 signing secret (BusinessProfile.tingeeSecretToken)
    vaAccountNumber  : Text;   // Tingee VA (BusinessProfile.tingeeVA)
    bankBin          : Text;   // Tingee bankBin (BusinessProfile.tingeeBankBin)
    merchantId       : Text;   // Tingee merchantId (BusinessProfile.tingeeMerchantId) — "" when not set
    workerPrincipal  : Text;   // registered worker principal text — "" when not set
  };

  // ── Worker callback payloads ───────────────────────────────────────────────
  // Posted by the VPS worker back to the canister after it performs a Tingee
  // operation. The canister persists the result and updates the stored
  // DynamicQRRecord. Auth: caller == owner OR caller == registered
  // workerPrincipal (same model as handleInvoiceCallback).

  // confirmDynamicQRGenerated payload — the worker posts the result of a
  // successful Tingee generate-dynamic-qr call. The canister creates / updates
  // the DynamicQRRecord for the order with the returned qrId, qrString, billId.
  public type DynamicQRGeneratedCallback = {
    orderId        : CommonTypes.OrderId;
    qrId           : Text;   // from data.qrAccount
    qrString       : Text;   // from data.qrCode
    billId         : Text;   // from data.billId
    idempotencyKey : Text;   // the key the canister computed (echoed back for verification)
  };

  // confirmDynamicQRStatus payload — the worker posts the result of a
  // Tingee get-status-dynamic-qr call. The canister updates the stored
  // record's status, totalAmountPaid, and transactionInfos. Per project
  // policy, transactionInfos is for ĐỐI SOÁT ONLY — never used to confirm
  // payment (the webhook is the primary confirmation source).
  public type DynamicQRStatusCallback = {
    orderId           : CommonTypes.OrderId;
    status            : DynamicQRStatus;        // mapped from data.billInfo.status
    totalAmountPaid   : Nat;                     // from data.billInfo.totalAmountPaid (VND integer)
    transactionInfos  : [TransactionInfo];      // parsed from data.transactionInfos — ĐỐI SOÁT ONLY
  };

  // confirmDynamicQRDeleted payload — the worker posts the result of a
  // successful Tingee delete-dynamic-qr call. The canister marks the stored
  // record as #deleted and removes it from the store.
  public type DynamicQRDeletedCallback = {
    orderId : CommonTypes.OrderId;
  };

  // confirmTingeeBanks payload — the worker posts the Tingee bank list it
  // fetched from Tingee so the canister can cache it for getTingeeBanks()
  // queries. The canister stores the bank list in durable state (or a
  // transient cache repopulated after each worker post) so getTingeeBanks()
  // returns the cached list without any outcall.
  public type TingeeBanksCallback = {
    banks : [TingeeBank];
  };

  // ── Tingee get-banks types ────────────────────────────────────────────────
  // TingeeBank is the public-facing bank record returned by getTingeeBanks() to
  // the frontend. Field mapping from the Tingee get-banks response:
  //   data[].bin      → bankBin    (BIN ngân hàng, e.g. "970418" cho BIDV)
  //   data[].code     → bankCode   (mã ngân hàng, e.g. "BIDV")
  //   data[].name     → bankName   (tên đầy đủ, e.g. "Ngân hàng Đầu tư và Phát triển VN")
  //   data[].shortName→ shortName  (tên viết tắt, e.g. "BIDV")
  //   data[].urlLogo  → bankLogo   (URL logo ngân hàng)
  // Tingee response có 2 cấp 'code': root code ("00" = success) và data[].code
  // (mã ngân hàng) — parse cẩn thận để không nhầm lẫn.
  public type TingeeBank = {
    bankBin   : Text;
    bankCode  : Text;
    bankName  : Text;
    bankLogo  : Text;
    shortName : Text;
  };

  // Enriched get-status result returned by getDynamicQRStatus to the frontend.
  // In the Bkav-like architecture, getDynamicQRStatus ONLY returns the state
  // already persisted in the canister (no outcall). The worker is responsible
  // for refreshing the state via confirmDynamicQRStatus. Carries the mapped
  // DynamicQRStatus plus the persisted payment-detail fields:
  //   - totalAmountPaid   : data.billInfo.totalAmountPaid (Nat, VND integer).
  //     Used by confirm logic to validate the paid amount matches the order
  //     total and to reject partial / sai-mệnh-giá payments before setting
  //     the #TingeePaid idempotent lock.
  //   - transactionInfos   : data.transactionInfos (raw JSON Text as returned
  //     by Tingee). Kept for ĐỐI SOÁT (reconciliation) ONLY — per user
  //     preference "transactionInfos chỉ đối soát, không confirm", it is NOT
  //     used to confirm payment.
  // Both fields are nullable: when Tingee omits them (e.g. status != paid),
  // they are returned as null so the caller can distinguish "not paid yet"
  // from "paid with amount 0".
  public type DynamicQRStatusResult = {
    status            : DynamicQRStatus;
    totalAmountPaid   : ?Nat;
    transactionInfos  : ?Text;
  };
};
