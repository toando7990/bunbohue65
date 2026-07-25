// Worker heartbeat + retry policy types — shared across worker domains.
//
// Scope (per dispatch): ahamove worker only. The shape is extensible to
// bkav/tingee workers later (keyed by WorkerId Text), but this build only
// tracks heartbeat for workerId = "ahamove".
module {
  /// Worker identifier. Today only "ahamove" is tracked; "bkav" / "tingee"
  /// are reserved for future builds (out of scope here).
  public type WorkerId = Text;

  /// Retry / backoff policy for the VPS worker. Defaults match the
  /// user-approved policy: maxRetries=3, baseDelayMs=5000, maxDelayMs=60000,
  /// backoffMultiplier=2.0.
  public type RetryPolicy = {
    maxRetries          : Nat;
    baseDelayMs         : Nat;
    maxDelayMs          : Nat;
    backoffMultiplier   : Float;
  };

  /// Per-worker heartbeat record stored in the heartbeat map.
  /// `lastHeartbeatAt` is in nanoseconds (Time.now()); 0 means "never seen".
  public type WorkerHeartbeat = {
    var lastHeartbeatAt : Int;
  };

  /// Single worker status row returned by getWorkerStatus() — serializable
  /// for the frontend dashboard (no var fields, no Map/Set/List).
  public type WorkerStatus = {
    workerId         : Text;
    lastHeartbeatAt  : Int;   // nanoseconds; 0 = never
    alive            : Bool;  // true when within staleness threshold
  };

  /// Full dashboard response: per-worker status + the active retry policy.
  public type WorkerStatusResponse = {
    workers      : [WorkerStatus];
    retryPolicy  : RetryPolicy;
  };
};
