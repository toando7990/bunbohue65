// Dynamic QR domain logic — Tingee dynamic QR (http-outcalls) integration.
// VA (virtual account) is read from BusinessProfile; secretToken stays in the
// canister. idempotencyKey is computed deterministically from orderCode so the
// same order yields the same key across replicas and on retry.
import Map "mo:core/Map";
import Time "mo:core/Time";
import CommonTypes "../types/common";
import DynamicQRTypes "../types/dynamic-qr";
import OrderTypes "../types/order";
import Hmac "./hmac";

module {
  public type OrderId            = CommonTypes.OrderId;
  public type Timestamp          = CommonTypes.Timestamp;
  public type DynamicQRRecord   = DynamicQRTypes.DynamicQRRecord;
  public type DynamicQRStatus   = DynamicQRTypes.DynamicQRStatus;
  public type DynamicQRRecordPublic = DynamicQRTypes.DynamicQRRecordPublic;
  public type Order             = OrderTypes.Order;

  // ── Idempotency key ─────────────────────────────────────────────────────────
  // Deterministic, hash-based key computed from orderCode (and an optional
  // regenerate nonce). Stable across replicas (pure function of its inputs —
  // no Time.now(), no randomness). Uses HMAC-SHA256 with a fixed canister
  // secret prefix so the key is reproducible on every replica and on retry,
  // while not being a bare hash of public data (defends against cross-canister
  // idempotency-key collisions when orderCodes are predictable).
  //
  // The optional `regenerateNonce` is appended to the HMAC message so a
  // regenerate call (same orderCode, new nonce) yields a DIFFERENT key than
  // the original generate. Without this, regenerate would recompute the SAME
  // key from the unchanged orderCode → the VPS 10-min cache would return the
  // SAME expired QR. The nonce is an incrementing counter minted by the
  // frontend on each regenerate click (passed through generateDynamicQR).
  // When null (the default generate path), the key is computed from orderCode
  // alone — preserving backward compat with existing stored records.
  public func deterministicIdempotencyKey(orderCode : Text, regenerateNonce : ?Nat) : Text {
    // Fixed canister secret prefix. This is NOT a security secret — its only
    // purpose is to namespace the idempotency key space so predictable
    // orderCodes (e.g. "BBH000001") don't collide with any external system
    // that might hash the same orderCode. The key is deterministic for the
    // same (orderCode, nonce) on every replica, which is the requirement.
    let canisterSecret = "bunbohue65-dynamic-qr-idem-v1";
    let key = canisterSecret.encodeUtf8();
    // Append the nonce (when present) to the HMAC message so regenerate
    // produces a distinct key. Use a separator that cannot appear in a
    // decimal Nat text to avoid ambiguity.
    let msg = switch (regenerateNonce) {
      case null orderCode;
      case (?n) orderCode # ":regen:" # n.toText();
    };
    Hmac.toHex(Hmac.hmacSha256(key, msg.encodeUtf8()));
  };

  // ── Dynamic QR record storage ───────────────────────────────────────────────
  // Map keyed by orderId → DynamicQRRecord. One active QR per order.

  // Insert or replace the dynamic QR record for an orderId.
  public func upsertRecord(
    store : Map.Map<OrderId, DynamicQRRecord>,
    orderId : OrderId,
    record : DynamicQRRecord,
  ) : () {
    store.add(orderId, record);
  };

  // Look up the dynamic QR record for an orderId.
  public func getRecord(
    store : Map.Map<OrderId, DynamicQRRecord>,
    orderId : OrderId,
  ) : ?DynamicQRRecord {
    store.get(orderId);
  };

  // Convert the stored (mutable) record to its immutable public view.
  public func toPublic(record : DynamicQRRecord) : DynamicQRRecordPublic {
    {
      qrId             = record.qrId;
      qrString         = record.qrString;
      status           = record.status;
      billId           = record.billId;
      idempotencyKey   = record.idempotencyKey;
      orderId          = record.orderId;
      createdAt        = record.createdAt;
      expiresAt        = record.expiresAt;
      totalAmountPaid  = record.totalAmountPaid;
      transactionInfos = record.transactionInfos;
    };
  };

  // Update the status of a stored dynamic QR record in place.
  public func setStatus(
    store : Map.Map<OrderId, DynamicQRRecord>,
    orderId : OrderId,
    status : DynamicQRStatus,
  ) : Bool {
    switch (store.get(orderId)) {
      case null false;
      case (?record) {
        record.status := status;
        true;
      };
    };
  };

  // Update the payment-detail var fields of a stored dynamic QR record in
  // place. Populated from the Tingee get-status response
  // (data.billInfo.totalAmountPaid and data.transactionInfos). Per project
  // policy, transactionInfos is for ĐỐI SOÁT (reconciliation) ONLY — this
  // helper just stores the values; it does NOT confirm payment. Returns false
  // if no record exists for orderId.
  public func updateStatusDetail(
    store : Map.Map<OrderId, DynamicQRRecord>,
    orderId : OrderId,
    totalAmountPaid : Nat,
    transactionInfos : [DynamicQRTypes.TransactionInfo],
  ) : Bool {
    switch (store.get(orderId)) {
      case null false;
      case (?record) {
        record.totalAmountPaid := totalAmountPaid;
        record.transactionInfos := transactionInfos;
        true;
      };
    };
  };

  // Mark a stored dynamic QR record as #expired in place. Used when the user
  // regenerates a QR after the previous one expired without payment: the old
  // record is marked #expired (so its final state is observable for ĐỐI SOÁT),
  // then the new generate call upserts a fresh record for the same orderId
  // (Map.add overwrites the old entry). Per doNotBuild there is NO automatic
  // background expiry handler — this is only called from the explicit
  // regenerate path. Returns false if no record exists for orderId.
  public func markExpired(
    store : Map.Map<OrderId, DynamicQRRecord>,
    orderId : OrderId,
  ) : Bool {
    setStatus(store, orderId, #expired);
  };

  // Remove the dynamic QR record for an orderId (used by deleteDynamicQR).
  public func removeRecord(
    store : Map.Map<OrderId, DynamicQRRecord>,
    orderId : OrderId,
  ) : Bool {
    switch (store.get(orderId)) {
      case null false;
      case (?_) {
        store.remove(orderId);
        true;
      };
    };
  };

  // ── Webhook backward-compat: billId lookup ──────────────────────────────────
  // Look up an Order by its Tingee billId. Used by receiveTingeeWebhook as the
  // fallback match when orderCode is absent (try orderCode first, billId
  // second). Scans the dynamic QR store for a record matching billId, then
  // resolves the underlying Order via the orders map.
  public func getOrderByBillId(
    store : Map.Map<OrderId, DynamicQRRecord>,
    orders : Map.Map<OrderId, Order>,
    billId : Text,
  ) : ?Order {
    switch (store.entries().find(func((_, r) : (OrderId, DynamicQRRecord)) : Bool { r.billId == billId })) {
      case null null;
      case (?(_, record)) orders.get(record.orderId);
    };
  };
};
