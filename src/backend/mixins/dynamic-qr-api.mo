// Dynamic QR API mixin — public endpoints for Tingee dynamic QR integration.
//
// Bkav-like architecture (per user instructions + doNotBuild + this dispatch):
//   - The canister ONLY receives webhooks and queries state. It does NOT make
//     HTTP outcalls to Tingee. All external traffic flows through the VPS proxy.
//   - generateDynamicQR ONLY marks the order's QR as #Pending (creates a
//     placeholder DynamicQRRecord with status #pending and empty qrId/qrString/
//     billId) and exposes getPendingDynamicQRs() for the VPS worker to poll.
//     The worker performs the actual Tingee generate-dynamic-qr call and posts
//     the result back via confirmDynamicQRGenerated.
//   - getDynamicQRStatus ONLY returns the state already persisted in the
//     canister (no outcall). The worker refreshes the state via
//     confirmDynamicQRStatus.
//   - deleteDynamicQR ONLY marks the stored record for deletion (no outcall).
//     The worker performs the Tingee-side delete and posts back via
//     confirmDynamicQRDeleted.
//   - getTingeeBanks ONLY returns the cached bank list persisted in the
//     canister (no outcall). The worker refreshes the cache via
//     confirmTingeeBanks.
//   - getDynamicQRWorkerConfig() — owner-or-worker auth, returns Tingee
//     credentials (clientId, secretToken, VA, bankBin, merchantId) so the
//     worker can sign Tingee requests. Mirrors getInvoiceWorkerConfig().
//   - Worker auth: callback methods (confirm*) verify caller == owner OR
//     caller == registered workerPrincipal (same model as handleInvoiceCallback).
//   - VA entered manually by owner, stored in BusinessProfile.tingeeVA.
//   - secretToken stays in the canister, NEVER exposed to frontend — only to
//     the authenticated worker via getDynamicQRWorkerConfig().
//   - idempotencyKey is computed deterministically in the canister via
//     DynamicQRLib.deterministicIdempotencyKey(orderCode) — stable across
//     replicas and reused by the worker.
//   - NO automatic QR expiry handling (doNotBuild). Expiry is set only by an
//     explicit deleteDynamicQR call or by a Tingee status response posted back
//     by the worker.
//   - NO dynamic QR analytics / reconciliation dashboard (doNotBuild).
//   - NO worker health dashboard (doNotBuild).
//   - NO configurable retry/backoff policy for the worker (doNotBuild).
//
// The pending queue is DERIVED from existing state (orders map +
// dynamicQRStore) — there is no separate pending-queue stable var, so NO
// migration is required and NO stable var is added (per requirement: preserve
// stable vars, never lose data, never repeat M0250/M0251). The Tingee bank
// list is held in a transient cache (transient var) repopulated by the worker
// via confirmTingeeBanks after each restart — it is NOT durable state.
import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import CommonTypes "../types/common";
import OrderLib "../lib/orders";
import BusinessProfileLib "../lib/business-profile";
import DynamicQRLib "../lib/dynamic-qr";
import DynamicQRTypes "../types/dynamic-qr";

mixin (
  orders              : Map.Map<OrderLib.OrderId, OrderLib.Order>,
  orderState          : { var nextOrderId : OrderLib.OrderId },
  bpState             : BusinessProfileLib.State,
  dynamicQRStore      : Map.Map<OrderLib.OrderId, DynamicQRLib.DynamicQRRecord>,
  getOwner            : () -> Principal,
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
) {

  // ── Tingee bank cache (transient — repopulated by worker after restart) ────
  // Per doNotBuild / preserve-stable-vars constraint, this is NOT a stable var.
  // The worker posts the bank list via confirmTingeeBanks on startup / after
  // each poll cycle, repopulating this cache. On a fresh canister start the
  // cache is empty and getTingeeBanks returns #err until the worker posts.
  transient var tingeeBanksCache : [DynamicQRTypes.TingeeBank] = [];

  // ── Auth helpers ────────────────────────────────────────────────────────────

  func dqrIsOwner(caller : Principal) : Bool {
    caller == getOwner();
  };

  func dqrIsEnterpriseStaff(caller : Principal) : Bool {
    if (dqrIsOwner(caller)) return true;
    switch (enterpriseStaffPermissions.get(caller)) {
      case null false;
      case (?entry) {
        entry.permissions.size() > 0;
      };
    };
  };

  // Check whether the caller is the registered worker principal. Mirrors the
  // auth check in getInvoiceWorkerConfig() (bkav-invoice-api.mo): the worker
  // principal is stored in BusinessProfile.workerPrincipal as a Text. We
  // compare the caller's principal text representation directly with the
  // stored text — this avoids the M0039 "misplaced try" error (try/catch is
  // not allowed in a synchronous func body). Returns false when no worker
  // principal is registered or the stored text is empty.
  func dqrIsRegisteredWorker(caller : Principal) : Bool {
    let cfg = BusinessProfileLib.getBkavConfig(bpState);
    switch (cfg.workerPrincipal) {
      case null false;
      case (?wp) {
        if (wp.size() == 0) false else caller.toText() == wp;
      };
    };
  };

  // Combined auth: owner OR registered worker. Used by the confirm* callback
  // methods (the VPS worker posts results back; the owner can also call them
  // directly for manual reconciliation).
  func dqrIsOwnerOrWorker(caller : Principal) : Bool {
    dqrIsOwner(caller) or dqrIsRegisteredWorker(caller);
  };

  // ── Public API ──────────────────────────────────────────────────────────────

  // Generate a dynamic QR for an order. In the Bkav-like architecture this
  // ONLY marks the order's QR as #Pending — it does NOT call Tingee. It creates
  // a placeholder DynamicQRRecord (status #pending, empty qrId/qrString/billId)
  // and computes the deterministic idempotencyKey so the worker can reuse it.
  // The VPS worker polls getPendingDynamicQRs(), performs the actual Tingee
  // generate-dynamic-qr call, and posts the result back via
  // confirmDynamicQRGenerated (which fills in qrId/qrString/billId).
  //
  // The optional `regenerateNonce` parameter (an incrementing counter minted by
  // the frontend on each regenerate click) is appended to the idempotencyKey
  // computation so a regenerate call yields a DIFFERENT key than the original
  // generate. null (the default generate path) preserves backward compat.
  // Authorization: enterprise staff (owner or any permission holder).
  public shared ({ caller }) func generateDynamicQR(
    orderId : Text,
    regenerateNonce : ?Nat,
  ) : async { #ok : DynamicQRLib.DynamicQRRecordPublic; #err : Text } {
    if (not dqrIsEnterpriseStaff(caller)) return #err "Unauthorized";
    // Parse orderId (Text) → OrderId (Nat). Reject non-numeric ids.
    var orderIdNat : Nat = 0;
    var valid = orderId.size() > 0;
    for (c in orderId.chars()) {
      let code = c.toNat32();
      if (code >= 48 and code <= 57) {
        orderIdNat := orderIdNat * 10 + (code.toNat() - 48);
      } else { valid := false };
    };
    if (not valid) return #err "Invalid orderId";
    let order = switch (orders.get(orderIdNat)) {
      case null { return #err "Order not found" };
      case (?o) o;
    };
    // Resolve the Tingee orderCode (used as the idempotency-key seed).
    let orderCode = switch (order.orderCode) {
      case (?c) c;
      case null { return #err "Order has no orderCode" };
    };
    // On regenerate (regenerateNonce != null), mark any existing record for
    // this order as #expired so its final state is observable for ĐỐI SOÁT.
    // The fresh upsert below overwrites the old entry (Map.add replaces).
    switch (regenerateNonce) {
      case null {};
      case (?_) { ignore DynamicQRLib.markExpired(dynamicQRStore, orderIdNat) };
    };
    let idempotencyKey = DynamicQRLib.deterministicIdempotencyKey(orderCode, regenerateNonce);
    // Create the placeholder record — status #pending, empty Tingee fields.
    // The worker fills in qrId/qrString/billId via confirmDynamicQRGenerated.
    let record : DynamicQRLib.DynamicQRRecord = {
      qrId             = "";
      qrString         = "";
      var status       = #pending;
      billId           = "";
      idempotencyKey   = idempotencyKey;
      orderId          = orderIdNat;
      createdAt        = Time.now();
      expiresAt        = null;  // no automatic expiry (doNotBuild)
      var totalAmountPaid   = 0;
      var transactionInfos  = [];
    };
    DynamicQRLib.upsertRecord(dynamicQRStore, orderIdNat, record);
    #ok (DynamicQRLib.toPublic(record));
  };

  // Query the status of a dynamic QR for an order. In the Bkav-like
  // architecture this ONLY returns the state already persisted in the canister
  // (no outcall). The worker is responsible for refreshing the state via
  // confirmDynamicQRStatus. Returns a DynamicQRStatusResult carrying the
  // stored status + totalAmountPaid + transactionInfos (raw JSON text).
  // Authorization: enterprise staff.
  public shared ({ caller }) func getDynamicQRStatus(
    orderId : Text,
  ) : async { #ok : DynamicQRTypes.DynamicQRStatusResult; #err : Text } {
    if (not dqrIsEnterpriseStaff(caller)) return #err "Unauthorized";
    var orderIdNat : Nat = 0;
    var valid = orderId.size() > 0;
    for (c in orderId.chars()) {
      let code = c.toNat32();
      if (code >= 48 and code <= 57) {
        orderIdNat := orderIdNat * 10 + (code.toNat() - 48);
      } else { valid := false };
    };
    if (not valid) return #err "Invalid orderId";
    switch (DynamicQRLib.getRecord(dynamicQRStore, orderIdNat)) {
      case null #err "No dynamic QR for this order";
      case (?record) {
        // transactionInfos is rendered as a debug_show text for ĐỐI SOÁT only.
        // totalAmountPaid is returned as ?Nat (null when 0 / not yet paid so
        // the caller can distinguish "not paid yet" from "paid with amount 0").
        let paidOpt : ?Nat = if (record.totalAmountPaid == 0) null else ?record.totalAmountPaid;
        let txInfosText : ?Text = if (record.transactionInfos.size() == 0) null else ?debug_show(record.transactionInfos);
        #ok {
          status            = record.status;
          totalAmountPaid   = paidOpt;
          transactionInfos  = txInfosText;
        };
      };
    };
  };

  // Delete a dynamic QR for an order. In the Bkav-like architecture this ONLY
  // marks the stored record for deletion (no outcall) — it flags the record so
  // getPendingDynamicQRs() returns it as a #delete operation. The worker
  // performs the Tingee-side delete and posts back via
  // confirmDynamicQRDeleted (which marks the record #deleted and removes it).
  // This is the ONLY manual path that flags a QR for deletion (no automatic
  // expiry handler — doNotBuild). Authorization: enterprise staff.
  public shared ({ caller }) func deleteDynamicQR(
    orderId : Text,
  ) : async { #ok; #err : Text } {
    if (not dqrIsEnterpriseStaff(caller)) return #err "Unauthorized";
    var orderIdNat : Nat = 0;
    var valid = orderId.size() > 0;
    for (c in orderId.chars()) {
      let code = c.toNat32();
      if (code >= 48 and code <= 57) {
        orderIdNat := orderIdNat * 10 + (code.toNat() - 48);
      } else { valid := false };
    };
    if (not valid) return #err "Invalid orderId";
    // Mark the record #deleted in place. The worker picks it up as a #delete
    // op via getPendingDynamicQRs and performs the Tingee-side delete, then
    // posts back via confirmDynamicQRDeleted (which removes the record).
    // If no record exists, there is nothing to delete — return #ok (idempotent).
    switch (DynamicQRLib.getRecord(dynamicQRStore, orderIdNat)) {
      case null #ok;
      case (?record) {
        record.status := #deleted;
        #ok;
      };
    };
  };

  // Get the list of Tingee-supported banks for the frontend bank-picker. In
  // the Bkav-like architecture this ONLY returns the cached bank list
  // persisted in the canister (no outcall). The worker refreshes the cache via
  // confirmTingeeBanks. Returns #err when no bank list has been cached yet
  // (the worker has not yet posted one). Authorization: enterprise staff.
  public shared ({ caller }) func getTingeeBanks() : async { #ok : [DynamicQRTypes.TingeeBank]; #err : Text } {
    if (not dqrIsEnterpriseStaff(caller)) return #err "Unauthorized";
    if (tingeeBanksCache.size() == 0) return #err "Bank list not yet cached";
    #ok tingeeBanksCache;
  };

  // ── Worker poll queries ─────────────────────────────────────────────────────

  // List all pending dynamic QR operations the VPS worker must perform. The
  // worker polls this query (free, no cycles cost, safe for frequent polling)
  // to discover #generate / #status / #delete operations. The pending queue is
  // DERIVED from existing state (orders map + dynamicQRStore) — there is no
  // separate pending-queue stable var. Derivation rules:
  //   - #generate : an order whose paymentMethod == #TingeeQR and whose
  //     paymentStatus == #TingeePending AND has NO DynamicQRRecord in
  //     dynamicQRStore (or whose record status == #expired and the user
  //     clicked regenerate).
  //   - #status   : a DynamicQRRecord exists with status == #pending (the
  //     worker periodically refreshes its payment status until paid/expired).
  //   - #delete   : a DynamicQRRecord flagged for deletion (deleteDynamicQR
  //     marks it; the worker performs the Tingee-side delete and posts back).
  // SECURED: requires owner OR registered worker principal (same auth model as
  // getInvoiceWorkerConfig). Non-matching callers get an empty list.
  public shared query ({ caller }) func getPendingDynamicQRs() : async [DynamicQRTypes.PendingDynamicQRItem] {
    if (not dqrIsOwnerOrWorker(caller)) return [];
    let items = List.empty<DynamicQRTypes.PendingDynamicQRItem>();
    // #generate + #status + #delete: scan the dynamicQRStore. Records with
    // status #pending that have empty qrId are #generate ops (placeholder
    // created by generateDynamicQR, worker has not yet posted the result).
    // Records with status #pending and non-empty qrId are #status ops (worker
    // should refresh payment status). Records with status #deleted are #delete
    // ops (worker should perform the Tingee-side delete).
    for ((orderId, record) in dynamicQRStore.entries()) {
      let orderCode = switch (orders.get(orderId)) {
        case (?o) switch (o.orderCode) { case (?c) c; case null "" };
        case null "";
      };
      switch (record.status) {
        case (#pending) {
          if (record.qrId.size() == 0) {
            // #generate: placeholder record, worker must call Tingee generate.
            // Compute the order total so the worker knows the QR amount.
            var orderTotal : Nat = 0;
            switch (orders.get(orderId)) {
              case null {};
              case (?o) {
                for (item in o.items.vals()) {
                  orderTotal += item.price * item.quantity;
                };
              };
            };
            items.add({
              orderId        = orderId;
              orderCode      = orderCode;
              operation      = #generate;
              qrId           = "";
              billId         = "";
              amount         = orderTotal;
              idempotencyKey = record.idempotencyKey;
            });
          } else {
            // #status: QR already generated, worker should refresh payment status.
            items.add({
              orderId        = orderId;
              orderCode      = orderCode;
              operation      = #status;
              qrId           = record.qrId;
              billId         = record.billId;
              amount         = 0;
              idempotencyKey = "";
            });
          };
        };
        case (#deleted) {
          // #delete: worker should perform the Tingee-side delete.
          items.add({
            orderId        = orderId;
            orderCode      = orderCode;
            operation      = #delete;
            qrId           = record.qrId;
            billId         = record.billId;
            amount         = 0;
            idempotencyKey = "";
          });
        };
        case (#paid) {};
        case (#expired) {};
      };
    };
    // Also scan orders for #generate ops where paymentMethod == #TingeeQR and
    // paymentStatus == #TingeePending but NO DynamicQRRecord exists yet (the
    // order was created with TingeeQR payment but generateDynamicQR was not
    // called — e.g. auto-payment flow). This covers the auto-payment path.
    for ((orderId, order) in orders.entries()) {
      let isTingeeQR = switch (order.paymentInfo.paymentMethod) {
        case null false;
        case (?m) {
          switch (m) { case (#TingeeQR) true; case (_) false };
        };
      };
      let isTingeePending = order.paymentInfo.paymentStatus == #TingeePending;
      if (isTingeeQR and isTingeePending) {
        // Skip if a record already exists (handled by the dynamicQRStore scan
        // above — either #generate placeholder or #status refresh).
        switch (dynamicQRStore.get(orderId)) {
          case null {
            let orderCode = switch (order.orderCode) { case (?c) c; case null "" };
            var orderTotal : Nat = 0;
            for (item in order.items.vals()) {
              orderTotal += item.price * item.quantity;
            };
            let idempotencyKey = if (orderCode.size() > 0) {
              DynamicQRLib.deterministicIdempotencyKey(orderCode, null);
            } else { "" };
            items.add({
              orderId        = orderId;
              orderCode      = orderCode;
              operation      = #generate;
              qrId           = "";
              billId         = "";
              amount         = orderTotal;
              idempotencyKey = idempotencyKey;
            });
          };
          case (?_) {};
        };
      };
    };
    items.toArray();
  };

  // Returns the Tingee credentials the VPS worker needs to sign Tingee API
  // requests. Auth model mirrors getInvoiceWorkerConfig() (bkav-invoice-api.mo):
  //   - caller == owner → returns real config
  //   - caller == registered workerPrincipal (non-null) → returns real config
  //   - otherwise → returns empty config (no credentials leaked)
  // secretToken is included so the worker can compute HMAC-SHA512 signatures
  // for Tingee requests (the canister no longer signs — it has no outcalls).
  // Query call — the VPS worker calls this on startup and after each poll cycle.
  public shared query ({ caller }) func getDynamicQRWorkerConfig() : async DynamicQRTypes.DynamicQRWorkerConfig {
    let cfg = BusinessProfileLib.getTingeeConfig(bpState);
    let bkavCfg = BusinessProfileLib.getBkavConfig(bpState);
    // Auth: owner OR registered worker principal. Compare caller's principal
    // text directly with the stored workerPrincipal text (avoids M0039
    // "misplaced try" — no Principal.fromText in a sync query func).
    let isRegisteredWorker = switch (bkavCfg.workerPrincipal) {
      case null false;
      case (?wp) {
        if (wp.size() == 0) false else caller.toText() == wp;
      };
    };
    if (not (dqrIsOwner(caller) or isRegisteredWorker)) {
      // Non-matching caller → return empty config (no credentials leaked).
      return {
        clientId        = "";
        secretToken     = "";
        vaAccountNumber = "";
        bankBin         = "";
        merchantId      = "";
        workerPrincipal = "";
      };
    };
    {
      clientId        = switch (cfg.clientId)    { case (?v) v; case null "" };
      secretToken     = switch (cfg.secretToken) { case (?v) v; case null "" };
      vaAccountNumber = switch (BusinessProfileLib.getTingeeVA(bpState)) { case (?v) v; case null "" };
      bankBin         = switch (cfg.bankBin)     { case (?v) v; case null "" };
      merchantId      = switch (cfg.merchantId)  { case (?v) v; case null "" };
      workerPrincipal = switch (bkavCfg.workerPrincipal) { case (?v) v; case null "" };
    };
  };

  // ── Worker callback methods (VPS worker posts results back) ─────────────────
  // Auth: caller == owner OR caller == registered workerPrincipal (same model
  // as handleInvoiceCallback). The worker posts the result of a Tingee
  // operation; the canister persists it and updates the stored
  // DynamicQRRecord.

  // Worker posts the result of a successful Tingee generate-dynamic-qr call.
  // The canister creates / updates the DynamicQRRecord for the order with the
  // returned qrId, qrString, billId (previously stored as empty placeholders by
  // generateDynamicQR). The idempotencyKey is echoed back for verification.
  public shared ({ caller }) func confirmDynamicQRGenerated(
    payload : DynamicQRTypes.DynamicQRGeneratedCallback,
  ) : async { #ok; #err : Text } {
    if (not dqrIsOwnerOrWorker(caller)) return #err "Unauthorized";
    let order = switch (orders.get(payload.orderId)) {
      case null { return #err "Order not found" };
      case (?o) o;
    };
    // Update the existing placeholder record (created by generateDynamicQR or
    // by the auto-payment #generate path). If no record exists, create one
    // from the callback (the worker may post a generate result for an order
    // that had no placeholder — e.g. auto-payment path).
    switch (dynamicQRStore.get(payload.orderId)) {
      case null {
        let record : DynamicQRLib.DynamicQRRecord = {
          qrId             = payload.qrId;
          qrString         = payload.qrString;
          var status       = #pending;
          billId           = payload.billId;
          idempotencyKey   = payload.idempotencyKey;
          orderId          = payload.orderId;
          createdAt        = Time.now();
          expiresAt        = null;
          var totalAmountPaid   = 0;
          var transactionInfos  = [];
        };
        DynamicQRLib.upsertRecord(dynamicQRStore, payload.orderId, record);
      };
      case (?existing) {
        // qrId / qrString / billId / idempotencyKey are immutable fields on
        // DynamicQRRecord, so we rebuild the record with the Tingee-returned
        // values and replace it via upsertRecord (same pattern used by the
        // null branch above and by generateDynamicQR).
        let updated : DynamicQRLib.DynamicQRRecord = {
          qrId             = payload.qrId;
          qrString         = payload.qrString;
          var status       = #pending;
          billId           = payload.billId;
          idempotencyKey   = payload.idempotencyKey;
          orderId          = existing.orderId;
          createdAt        = existing.createdAt;
          expiresAt        = existing.expiresAt;
          var totalAmountPaid   = existing.totalAmountPaid;
          var transactionInfos  = existing.transactionInfos;
        };
        // Status stays #pending (QR generated, awaiting payment). The worker
        // will refresh it via confirmDynamicQRStatus as payment progresses.
        DynamicQRLib.upsertRecord(dynamicQRStore, payload.orderId, updated);
      };
    };
    #ok;
  };

  // Worker posts the result of a Tingee get-status-dynamic-qr call. The
  // canister updates the stored record's status, totalAmountPaid, and
  // transactionInfos. Per project policy, transactionInfos is for ĐỐI SOÁT
  // ONLY — never used to confirm payment (the webhook is the primary
  // confirmation source).
  public shared ({ caller }) func confirmDynamicQRStatus(
    payload : DynamicQRTypes.DynamicQRStatusCallback,
  ) : async { #ok; #err : Text } {
    if (not dqrIsOwnerOrWorker(caller)) return #err "Unauthorized";
    switch (dynamicQRStore.get(payload.orderId)) {
      case null #err "No dynamic QR record for this order";
      case (?record) {
        record.status           := payload.status;
        record.totalAmountPaid  := payload.totalAmountPaid;
        record.transactionInfos := payload.transactionInfos;
        #ok;
      };
    };
  };

  // Worker posts the result of a successful Tingee delete-dynamic-qr call. The
  // canister marks the stored record as #deleted and removes it from the
  // store.
  public shared ({ caller }) func confirmDynamicQRDeleted(
    payload : DynamicQRTypes.DynamicQRDeletedCallback,
  ) : async { #ok; #err : Text } {
    if (not dqrIsOwnerOrWorker(caller)) return #err "Unauthorized";
    // Remove the record from the store. The record was already marked #deleted
    // by deleteDynamicQR (so getPendingDynamicQRs returned it as a #delete op);
    // the worker has now confirmed the Tingee-side delete, so we drop it.
    ignore DynamicQRLib.removeRecord(dynamicQRStore, payload.orderId);
    #ok;
  };

  // Worker posts the Tingee bank list it fetched from Tingee so the canister
  // can cache it for getTingeeBanks() queries. The canister stores the bank
  // list in a transient cache so getTingeeBanks() returns the cached list
  // without any outcall.
  public shared ({ caller }) func confirmTingeeBanks(
    payload : DynamicQRTypes.TingeeBanksCallback,
  ) : async { #ok; #err : Text } {
    if (not dqrIsOwnerOrWorker(caller)) return #err "Unauthorized";
    tingeeBanksCache := payload.banks;
    #ok;
  };
};
