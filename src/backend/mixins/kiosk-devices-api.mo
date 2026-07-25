// Kiosk Device Management API mixin — register, activate, list, revoke, and verify fixed devices
import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";
import Int "mo:core/Int";
import CommonTypes "../types/common";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import TokenGenerator "../lib/TokenGenerator";

mixin (
  devices         : Map.Map<Text, CommonTypes.DeviceRecord>,
  activationIndex : Map.Map<Text, Text>,
  deviceCounter   : { var count : Nat },
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  getBusinessOwnerPrincipalId : () -> Principal,
) {
  // --- Permission helpers ---

  func kioskHasDeviceManagementPermission(caller : Principal) : Bool {
    if (caller == getBusinessOwnerPrincipalId()) return true;
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


  // --- Token / Code generation helpers ---

  // Generate a 64-char hex device token from Time + counter
  func generateDeviceToken() : Text {
    deviceCounter.count += 1;
    TokenGenerator.generateHexToken(Time.now(), deviceCounter.count);
  };

  // Generate a 6-char uppercase alphanumeric activation code
  func generateActivationCode() : Text {
    deviceCounter.count += 1;
    TokenGenerator.generateActivationCode(Time.now() + deviceCounter.count);
  };

  // Generate a unique device ID
  func generateDeviceId() : Text {
    deviceCounter.count += 1;
    let t = Int.abs(Time.now());
    let c = deviceCounter.count;
    "dev-" # TokenGenerator.natToHex(t) # "-" # TokenGenerator.natToHex(c);
  };

  // Convert internal to public (removes var field)
  func toPublic(d : CommonTypes.DeviceRecord) : CommonTypes.DeviceRecordPublic {
    {
      deviceId       = d.deviceId;
      restaurantId   = d.restaurantId;
      role           = d.role;
      deviceName     = d.deviceName;
      deviceToken    = d.deviceToken;
      activationCode = d.activationCode;
      codeExpiry     = d.codeExpiry;
      status         = d.status;
      createdAt      = d.createdAt;
      lastUsedAt     = d.lastUsedAt;
    };
  };

  // --- Public API ---

  /// Generate a 6-char activation code for a new fixed device.
  /// Returns the code; the device is registered as pending until activateDevice is called.
  public shared ({ caller }) func registerDevice(
    restaurantId : Nat,
    role         : CommonTypes.StaffRole,
    deviceName   : Text,
  ) : async { #ok : { activationCode : Text; deviceId : Text }; #err : Text } {
    if (not kioskHasDeviceManagementPermission(caller)) {
      return #err("Không có quyền thực hiện thao tác này");
    };
    // Only allow supported roles for device assignment
    switch (role) {
      case (#Cashier or #Delivery or #Admin) {
        return #err("Role not supported for device assignment");
      };
      case _ {};
    };
    // Enforce 1 device per role per restaurant: reject only if the SAME role already has an active device
    for ((_, d) in devices.entries()) {
      if (d.restaurantId == restaurantId and d.role == role and d.status == #active) {
        return #err("Vai trò này đã có thiết bị đang hoạt động");
      };
    };
    let code     = generateActivationCode();
    let deviceId = generateDeviceId();
    let now      = Time.now();
    let expiry   = now + 10 * 60 * 1_000_000_000; // 10 minutes in nanoseconds
    let record : CommonTypes.DeviceRecord = {
      deviceId;
      restaurantId;
      role;
      deviceName;
      deviceToken    = ""; // not yet activated
      activationCode = code;
      codeExpiry     = expiry;
      status         = #revoked; // pending state — not yet active
      createdAt      = now;
      var lastUsedAt = now;
    };
    devices.add(deviceId, record);
    activationIndex.add(code, deviceId);
    #ok({ activationCode = code; deviceId });
  };

  /// Activate a device using its 6-char activation code.
  /// Returns deviceToken + restaurantId + role + deviceName on success.
  public func activateDevice(
    activationCode : Text,
    intendedRole   : ?CommonTypes.StaffRole,
  ) : async {
    #ok : { deviceToken : Text; restaurantId : Nat; role : CommonTypes.StaffRole; deviceName : Text };
    #err : { #expired; #alreadyUsed; #deviceAlreadyHasRole; #notFound; #roleMismatch : Text; #internal : Text }
  } {
    switch (activationIndex.get(activationCode)) {
      case null {
        // Code not in index — either never existed or already consumed
        var wasUsed = false;
        for ((_, d) in devices.entries()) {
          if (d.activationCode == activationCode and d.status == #active) {
            wasUsed := true;
          };
        };
        if (wasUsed) { #err(#alreadyUsed) } else { #err(#notFound) };
      };
      case (?deviceId) {
        switch (devices.get(deviceId)) {
          case null { #err(#internal("Device record not found")) };
          case (?existing) {
            if (Time.now() >= existing.codeExpiry) {
              activationIndex.remove(activationCode);
              return #err(#expired);
            };
            // Check: does this restaurantId already have an active device with this same deviceId record?
            // (same device trying to activate twice)
            if (existing.status == #active and existing.deviceToken != "") {
              return #err(#deviceAlreadyHasRole);
            };
            // Check intended role matches the code's actual role
            switch (intendedRole) {
              case (?intended) {
                let roleMatch = switch (intended, existing.role) {
                  case (#Kitchen,    #Kitchen)    true;
                  case (#Waiter,     #Waiter)     true;
                  case (#KioskOrder, #KioskOrder) true;
                  case _                          false;
                };
                if (not roleMatch) {
                  let roleName = switch (existing.role) {
                    case (#Kitchen)    "Bếp";
                    case (#Waiter)     "Phục vụ";
                    case (#KioskOrder) "Kiosk";
                    case _             "Không xác định";
                  };
                  return #err(#roleMismatch("Mã kích hoạt này được dùng cho vai trò " # roleName # ". Vui lòng chọn vai trò đúng hoặc tạo mã mới."));
                };
              };
              case null {}; // no role check requested
            };
            let token = generateDeviceToken();
            let activated : CommonTypes.DeviceRecord = {
              deviceId       = existing.deviceId;
              restaurantId   = existing.restaurantId;
              role           = existing.role;
              deviceName     = existing.deviceName;
              deviceToken    = token;
              activationCode = "";   // clear code after use
              codeExpiry     = 0;    // clear expiry after use
              status         = #active;
              createdAt      = existing.createdAt;
              var lastUsedAt = Time.now();
            };
            devices.add(deviceId, activated);
            activationIndex.remove(activationCode);
            #ok({
              deviceToken  = token;
              restaurantId = existing.restaurantId;
              role         = existing.role;
              deviceName   = existing.deviceName;
            });
          };
        };
      };
    };
  };

  /// List all devices (active and revoked) for a restaurant, sorted newest first.
  public shared ({ caller }) func listDevices(
    restaurantId : Nat,
  ) : async { #ok : [CommonTypes.DeviceRecordPublic]; #err : Text } {
    if (not kioskHasDeviceManagementPermission(caller)) {
      return #err("Không có quyền thực hiện thao tác này");
    };
    let result = List.empty<CommonTypes.DeviceRecordPublic>();
    for ((_, d) in devices.entries()) {
      if (d.restaurantId == restaurantId) {
        result.add(toPublic(d));
      };
    };
    // Sort by createdAt descending
    let arr = result.toArray();
    let sorted = arr.sort(func(a : CommonTypes.DeviceRecordPublic, b : CommonTypes.DeviceRecordPublic) : { #less; #equal; #greater } {
      Int.compare(b.createdAt, a.createdAt);
    });
    #ok(sorted);
  };

  /// Revoke a device so it can no longer authenticate.
  public shared ({ caller }) func revokeDevice(
    deviceId : Text,
  ) : async { #ok; #err : Text } {
    if (not kioskHasDeviceManagementPermission(caller)) {
      return #err("Không có quyền thực hiện thao tác này");
    };
    switch (devices.get(deviceId)) {
      case null { #err("Device not found") };
      case (?existing) {
        // Also clean up activation index if there's a pending code
        if (existing.activationCode != "") {
          activationIndex.remove(existing.activationCode);
        };
        devices.remove(deviceId);
        #ok;
      };
    };
  };

  /// Verify a device token. Returns restaurant info on success; updates lastUsedAt.
  public func verifyDeviceToken(
    deviceToken : Text,
  ) : async { #ok : { restaurantId : Nat; role : CommonTypes.StaffRole; deviceName : Text }; #err : Text } {
    // Linear scan — device count per deployment is small (< a few dozen)
    var found : ?CommonTypes.DeviceRecord = null;
    for ((_, d) in devices.entries()) {
      if (d.deviceToken == deviceToken) {
        found := ?d;
      };
    };
    switch (found) {
      case null { #err("Device token not found") };
      case (?d) {
        switch (d.status) {
          case (#revoked) { #err("Device has been revoked") };
          case (#active) {
            d.lastUsedAt := Time.now();
            #ok({
              restaurantId = d.restaurantId;
              role         = d.role;
              deviceName   = d.deviceName;
            });
          };
        };
      };
    };
  };
};
