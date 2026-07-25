// Enterprise Devices API mixin — register, activate, list, revoke, and verify office-based enterprise devices
import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import CommonTypes "../types/common";
import TokenGenerator "../lib/TokenGenerator";

mixin (
  enterpriseDevices    : Map.Map<Text, CommonTypes.EnterpriseDeviceRecord>,
  enterpriseActivationIndex : Map.Map<Text, Text>,
  enterpriseDevCounter : { var count : Nat },
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  getBusinessOwnerPrincipalId : () -> Principal,
) {

  // --- Auth helpers ---

  // Named entDevIsBusinessOwner to avoid duplicate when composed with EnterpriseStaffMixin
  func entDevIsBusinessOwner(caller : Principal) : Bool {
    caller == getBusinessOwnerPrincipalId();
  };

  func hasDeviceManagementPermission(caller : Principal) : Bool {
    if (entDevIsBusinessOwner(caller)) return true;
    switch (enterpriseStaffPermissions.get(caller)) {
      case null false;
      case (?entry) {
        let found = entry.permissions.find(
          func(p : CommonTypes.EnterprisePermission) : Bool {
            switch p { case (#DeviceManagement) true; case _ false };
          }
        );
        found != null;
      };
    };
  };

  // --- Token / code generation helpers (same approach as kiosk-devices) ---

  func generateEntDeviceToken() : Text {
    enterpriseDevCounter.count += 1;
    TokenGenerator.generateHexToken(Time.now(), enterpriseDevCounter.count);
  };

  func generateEntActivationCode() : Text {
    enterpriseDevCounter.count += 1;
    TokenGenerator.generateActivationCode(Time.now() + enterpriseDevCounter.count);
  };

  func generateEntDeviceId() : Text {
    enterpriseDevCounter.count += 1;
    let t = Int.abs(Time.now());
    let c = enterpriseDevCounter.count;
    "entdev-" # TokenGenerator.natToHex(t) # "-" # TokenGenerator.natToHex(c);
  };

  // Count active devices for a given role
  func countActiveForRole(role : CommonTypes.EnterpriseDeviceRole) : Nat {
    var count = 0;
    for ((_, d) in enterpriseDevices.entries()) {
      let roleMatch = switch (d.role, role) {
        case (#EnterpriseDelivery, #EnterpriseDelivery) true;
        case (#CustomerSupport, #CustomerSupport) true;
        case (#Accounting, #Accounting) true;
        case _ false;
      };
      if (roleMatch) {
        switch (d.status) {
          case (#Active) { count += 1 };
          case (#Revoked) {}; // pending-activation sentinel, not counted
        };
      };
    };
    count;
  };

  // Map role to string for activation response (internal route key)
  func roleToString(role : CommonTypes.EnterpriseDeviceRole) : Text {
    switch role {
      case (#EnterpriseDelivery) "enterprise-delivery";
      case (#CustomerSupport)    "customer-support";
      case (#Accounting)         "accounting";
    };
  };

  // Map role to Vietnamese display name for error messages
  func roleToText(role : CommonTypes.EnterpriseDeviceRole) : Text {
    switch role {
      case (#EnterpriseDelivery) "Điều phối giao hàng";
      case (#CustomerSupport)    "Giải đáp khách hàng";
      case (#Accounting)         "Kế toán";
    };
  };

  // --- Public API ---

  /// Register a new enterprise office device. Returns a 6-char activation code + deviceId.
  /// Rejects if there are already 3 active devices for the same role.
  public shared ({ caller }) func registerEnterpriseDevice(
    role       : CommonTypes.EnterpriseDeviceRole,
    deviceName : Text,
  ) : async { #ok : { activationCode : Text; deviceId : Text }; #err : Text } {
    if (not hasDeviceManagementPermission(caller)) return #err("Unauthorized");
    if (countActiveForRole(role) >= 3) {
      return #err("Maximum 3 active devices per role reached — revoke an existing device first");
    };
    let code     = generateEntActivationCode();
    let deviceId = generateEntDeviceId();
    let now      = Time.now();
    let expiry   = now + 10 * 60 * 1_000_000_000; // 10 minutes
    let record : CommonTypes.EnterpriseDeviceRecord = {
      deviceId;
      role;
      deviceName;
      deviceToken    = "";
      activationCode = ?code;
      codeExpiry     = ?expiry;
      status         = #Revoked; // pending — not yet activated
      registeredAt   = now;
    };
    enterpriseDevices.add(deviceId, record);
    enterpriseActivationIndex.add(code, deviceId);
    #ok({ activationCode = code; deviceId });
  };

  /// Activate an enterprise device using its 6-char code (public — called by the device itself).
  public func activateEnterpriseDevice(
    activationCode : Text,
    intendedRole   : ?CommonTypes.EnterpriseDeviceRole,
  ) : async { #ok : { deviceToken : Text; role : Text; deviceId : Text }; #err : Text } {
    // O(1) lookup via activation index (mirrors kiosk pattern)
    switch (enterpriseActivationIndex.get(activationCode)) {
      case null {
        // Code not in index — either never existed or already consumed
        #err("Mã kích hoạt không hợp lệ hoặc đã được sử dụng");
      };
      case (?deviceId) {
        switch (enterpriseDevices.get(deviceId)) {
          case null {
            // Stale index entry — clean up and report invalid
            enterpriseActivationIndex.remove(activationCode);
            #err("Mã kích hoạt không hợp lệ hoặc đã được sử dụng");
          };
          case (?existing) {
            let expired = switch (existing.codeExpiry) {
              case (?exp) Time.now() >= exp;
              case null false;
            };
            if (expired) {
              enterpriseActivationIndex.remove(activationCode);
              return #err("Mã kích hoạt đã hết hạn. Vui lòng tạo mã mới.");
            };
            // Check intended role matches the code's actual role
            switch (intendedRole) {
              case (?intended) {
                let roleMatch = switch (intended, existing.role) {
                  case (#EnterpriseDelivery, #EnterpriseDelivery) true;
                  case (#CustomerSupport,    #CustomerSupport)    true;
                  case (#Accounting,         #Accounting)         true;
                  case _                                          false;
                };
                if (not roleMatch) {
                  return #err("Mã kích hoạt này được dùng cho vai trò " # roleToText(existing.role) # ". Vui lòng chọn vai trò đúng hoặc tạo mã mới.");
                };
              };
              case null {}; // no role check requested
            };
            // Re-check role limit before marking active
            if (countActiveForRole(existing.role) >= 3) {
              return #err("Đã đạt giới hạn 3 thiết bị cho vai trò " # roleToText(existing.role) # ". Vui lòng thu hồi một thiết bị trước.");
            };
            let token = generateEntDeviceToken();
            let activated : CommonTypes.EnterpriseDeviceRecord = {
              deviceId       = existing.deviceId;
              role           = existing.role;
              deviceName     = existing.deviceName;
              deviceToken    = token;
              activationCode = null; // clear code after activation
              codeExpiry     = null;
              status         = #Active;
              registeredAt   = existing.registeredAt;
            };
            enterpriseDevices.add(existing.deviceId, activated);
            enterpriseActivationIndex.remove(activationCode);
            #ok({
              deviceToken = token;
              role        = roleToString(existing.role);
              deviceId    = existing.deviceId;
            });
          };
        };
      };
    };
  };

  /// List all enterprise office devices (business owner or DeviceManagement permission).
  public shared ({ caller }) func listEnterpriseDevices() : async { #ok : [CommonTypes.EnterpriseDeviceRecord]; #err : Text } {
    if (not hasDeviceManagementPermission(caller)) return #err("Unauthorized");
    let result = List.empty<CommonTypes.EnterpriseDeviceRecord>();
    for ((_, d) in enterpriseDevices.entries()) {
      result.add(d);
    };
    #ok(result.toArray());
  };

  /// Revoke an enterprise device (business owner or DeviceManagement permission).
  /// Delete an enterprise device (business owner or DeviceManagement permission).
  public shared ({ caller }) func revokeEnterpriseDevice(
    deviceId : Text,
  ) : async { #ok; #err : Text } {
    if (not hasDeviceManagementPermission(caller)) return #err("Unauthorized");
    switch (enterpriseDevices.get(deviceId)) {
      case null { #err("Device not found") };
      case (?existing) {
        // Clean up activation index if there's a pending code
        switch (existing.activationCode) {
          case (?code) { enterpriseActivationIndex.remove(code) };
          case null {};
        };
        enterpriseDevices.remove(deviceId);
        #ok;
      };
    };
  };

  /// Verify an enterprise device token and return its role (public — used by guards).
  public func verifyEnterpriseDeviceToken(
    deviceToken : Text,
  ) : async ?CommonTypes.EnterpriseDeviceRole {
    var found : ?CommonTypes.EnterpriseDeviceRecord = null;
    for ((_, d) in enterpriseDevices.entries()) {
      if (d.deviceToken == deviceToken) {
        found := ?d;
      };
    };
    switch (found) {
      case null null;
      case (?d) {
        // Defense-in-depth: only Active devices may authenticate.
        // revokeEnterpriseDevice deletes the record, so a revoked device
        // would already return null — this guard protects against any
        // future soft-revoke path that keeps the record with #Revoked.
        switch (d.status) {
          case (#Active) ?d.role;
          case (#Revoked) null;
        };
      };
    };
  };
};
