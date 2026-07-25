// Worker heartbeat API mixin — heartbeat posting + dashboard status + retry policy.
//
// Auth model (per dispatch + AGENTS.md learning):
//   - postWorkerHeartbeat: workerPrincipal auth (owner OR registered worker),
//     mirroring shipIsOwnerOrWorker (shipper-api.mo:94) / dqrIsOwnerOrWorker.
//   - getWorkerStatus / getRetryPolicy / setRetryPolicy: owner auth only.
//
// Scope: ahamove worker only (workerId = "ahamove"). The heartbeat map is
// keyed by Text so bkav/tingee can be added later without a state-shape change,
// but this build only writes/reads the "ahamove" entry.
//
// Staleness threshold: 60s (60_000_000_000 ns). A worker is `alive` when its
// last heartbeat is within 60s of now. Matches the user-approved heartbeat
// cadence (post mỗi poll cycle 15s) — 60s gives 4 missed polls before stale.
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import BusinessProfileLib "../lib/business-profile";
import WorkerHeartbeatLib "../lib/worker-heartbeat";
import WorkerHeartbeatTypes "../types/worker-heartbeat";

mixin (
  workerHeartbeatState : WorkerHeartbeatLib.State,
  bpState             : BusinessProfileLib.State,
  getBusinessOwnerPrincipalId : () -> Principal,
) {

  // 60s in nanoseconds — staleness threshold for the alive flag.
  transient let STALENESS_THRESHOLD_NS : Int = 60_000_000_000;

  // ── Auth helpers ───────────────────────────────────────────────────────────
  // Mirror shipIsOwnerOrWorker (shipper-api.mo:94): owner OR registered
  // workerPrincipal. The worker principal is stored in
  // BusinessProfile.workerPrincipal (under the Bkav config) as Text; we
  // compare caller.toText() directly (avoids Principal.fromText in a sync
  // query func — M0039).

  func hbIsOwner(caller : Principal) : Bool {
    caller == getBusinessOwnerPrincipalId();
  };

  func hbIsRegisteredWorker(caller : Principal) : Bool {
    let cfg = BusinessProfileLib.getBkavConfig(bpState);
    switch (cfg.workerPrincipal) {
      case null false;
      case (?wp) {
        if (wp.size() == 0) false else caller.toText() == wp;
      };
    };
  };

  func hbIsOwnerOrWorker(caller : Principal) : Bool {
    hbIsOwner(caller) or hbIsRegisteredWorker(caller);
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  /// Post a heartbeat for a worker. Called by the VPS worker after each poll
  /// cycle (15s cadence). Auth: owner OR registered workerPrincipal.
  ///
  /// Returns #ok on success, #err with a message on auth failure or when
  /// the workerId is empty.
  public shared ({ caller }) func postWorkerHeartbeat(
    workerId : Text,
  ) : async { #ok; #err : Text } {
    if (not hbIsOwnerOrWorker(caller)) return #err("Unauthorized");
    if (workerId.size() == 0) return #err("workerId is required");
    WorkerHeartbeatLib.postHeartbeat(workerHeartbeatState, workerId, Time.now());
    #ok;
  };

  /// Dashboard status query — owner auth only. Returns per-worker heartbeat
  /// status (lastHeartbeatAt + alive flag based on the 60s staleness
  /// threshold) plus the active retry policy. Polled by the dashboard every
  /// 10s (per user instruction).
  public shared query ({ caller }) func getWorkerStatus() : async WorkerHeartbeatTypes.WorkerStatusResponse {
    if (not hbIsOwner(caller)) {
      // Non-owner callers get an empty response — no data leaked.
      return {
        workers     = [];
        retryPolicy = WorkerHeartbeatLib.defaultRetryPolicy();
      };
    };
    let now = Time.now();
    {
      workers = WorkerHeartbeatLib.buildWorkerStatuses(
        workerHeartbeatState,
        now,
        STALENESS_THRESHOLD_NS,
      );
      retryPolicy = WorkerHeartbeatLib.getRetryPolicy(workerHeartbeatState);
    };
  };

  /// Read the active retry policy — owner auth only.
  public shared query ({ caller }) func getRetryPolicy() : async WorkerHeartbeatTypes.RetryPolicy {
    if (not hbIsOwner(caller)) {
      // Non-owner callers get the default policy — no real config leaked.
      return WorkerHeartbeatLib.defaultRetryPolicy();
    };
    WorkerHeartbeatLib.getRetryPolicy(workerHeartbeatState);
  };

  /// Overwrite the retry policy — owner auth only. All four fields are
  /// replaced atomically (no partial update).
  public shared ({ caller }) func setRetryPolicy(
    maxRetries        : Nat,
    baseDelayMs       : Nat,
    maxDelayMs        : Nat,
    backoffMultiplier : Float,
  ) : async { #ok; #err : Text } {
    if (not hbIsOwner(caller)) return #err("Unauthorized");
    WorkerHeartbeatLib.setRetryPolicy(
      workerHeartbeatState,
      maxRetries,
      baseDelayMs,
      maxDelayMs,
      backoffMultiplier,
    );
    #ok;
  };
};
