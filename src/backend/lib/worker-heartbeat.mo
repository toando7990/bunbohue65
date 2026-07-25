// Worker heartbeat domain logic — heartbeat tracking + retry policy storage.
//
// State shape (durable, stable):
//   - heartbeats   : Map.Map<WorkerId, WorkerHeartbeat>  (per-worker lastHeartbeatAt)
//   - retryPolicy  : RetryPolicy                          (single owner-configurable policy)
//
// The ahamove worker (workerId = "ahamove") is the only tracked worker in
// this build. The map is keyed by Text so bkav/tingee can be added later
// without a state-shape change.
import Map "mo:core/Map";
import Int "mo:core/Int";
import Time "mo:core/Time";
import WorkerHeartbeatTypes "../types/worker-heartbeat";

module {
  public type WorkerId        = WorkerHeartbeatTypes.WorkerId;
  public type RetryPolicy     = WorkerHeartbeatTypes.RetryPolicy;
  public type WorkerHeartbeat = WorkerHeartbeatTypes.WorkerHeartbeat;
  public type WorkerStatus    = WorkerHeartbeatTypes.WorkerStatus;

  public type State = {
    heartbeats   : Map.Map<WorkerId, WorkerHeartbeat>;
    var retryPolicy : RetryPolicy;
  };

  /// The user-approved default retry policy.
  public func defaultRetryPolicy() : RetryPolicy = {
    maxRetries        = 3;
    baseDelayMs       = 5000;
    maxDelayMs        = 60000;
    backoffMultiplier = 2.0;
  };

  /// Empty initial state — used by the migration chain to seed the new
  /// stable var on fresh install / upgrade.
  public func empty() : State = {
    heartbeats    = Map.empty();
    var retryPolicy = defaultRetryPolicy();
  };

  // ── Retry policy ──────────────────────────────────────────────────────────

  public func getRetryPolicy(state : State) : RetryPolicy {
    state.retryPolicy;
  };

  /// Overwrite the retry policy. Caller (mixin) is responsible for owner auth.
  /// No partial-update — every field is replaced atomically.
  public func setRetryPolicy(
    state              : State,
    maxRetries         : Nat,
    baseDelayMs        : Nat,
    maxDelayMs         : Nat,
    backoffMultiplier  : Float,
  ) {
    state.retryPolicy := {
      maxRetries;
      baseDelayMs;
      maxDelayMs;
      backoffMultiplier;
    };
  };

  // ── Heartbeat tracking ─────────────────────────────────────────────────────

  /// Record a heartbeat for the given worker. Creates the entry on first call.
  public func postHeartbeat(state : State, workerId : WorkerId, now : Int) {
    switch (state.heartbeats.get(workerId)) {
      case (?hb) { hb.lastHeartbeatAt := now };
      case null {
        state.heartbeats.add(workerId, { var lastHeartbeatAt = now });
      };
    };
  };

  /// Read the lastHeartbeatAt for a worker; 0 when never seen.
  public func getLastHeartbeatAt(state : State, workerId : WorkerId) : Int {
    switch (state.heartbeats.get(workerId)) {
      case (?hb) hb.lastHeartbeatAt;
      case null 0;
    };
  };

  /// Build the serializable per-worker status list for the dashboard.
  /// `stalenessThresholdNs` is in nanoseconds (e.g. 60s = 60_000_000_000).
  /// A worker is `alive` when its lastHeartbeatAt is non-zero AND
  /// (now - lastHeartbeatAt) <= stalenessThresholdNs.
  public func buildWorkerStatuses(
    state                  : State,
    now                    : Int,
    stalenessThresholdNs   : Int,
  ) : [WorkerStatus] {
    state.heartbeats.entries()
      .map(func((workerId, hb) : (WorkerId, WorkerHeartbeat)) : WorkerStatus {
        let alive = hb.lastHeartbeatAt > 0 and (now - hb.lastHeartbeatAt) <= stalenessThresholdNs;
        {
          workerId        = workerId;
          lastHeartbeatAt = hb.lastHeartbeatAt;
          alive           = alive;
        };
      })
      .toArray();
  };
};
