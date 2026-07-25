// Enterprise Staff Permissions API mixin — manage enterprise-level staff access by Principal ID
import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import CommonTypes "../types/common";

mixin (
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  getBusinessOwnerPrincipalId : () -> Principal,
) {

  func entStaffIsOwner(caller : Principal) : Bool {
    caller == getBusinessOwnerPrincipalId();
  };

  /// Add a staff member (business owner only). Staff starts with no permissions.
  public shared ({ caller }) func addEnterpriseStaff(
    principalId : Principal,
  ) : async { #ok; #err : Text } {
    if (not entStaffIsOwner(caller)) return #err("Unauthorized");
    switch (enterpriseStaffPermissions.get(principalId)) {
      case (?_) { return #err("Staff already exists") };
      case null {
        enterpriseStaffPermissions.add(principalId, { principalId; permissions = [] });
        #ok;
      };
    };
  };

  /// Remove a staff member (business owner only).
  public shared ({ caller }) func removeEnterpriseStaff(
    principalId : Principal,
  ) : async { #ok; #err : Text } {
    if (not entStaffIsOwner(caller)) return #err("Unauthorized");
    enterpriseStaffPermissions.remove(principalId);
    #ok;
  };

  /// Grant a single permission to a staff member (business owner only).
  public shared ({ caller }) func grantEnterprisePermission(
    principalId : Principal,
    permission  : CommonTypes.EnterprisePermission,
  ) : async { #ok; #err : Text } {
    if (not entStaffIsOwner(caller)) return #err("Unauthorized");
    let existing = switch (enterpriseStaffPermissions.get(principalId)) {
      case (?e) e;
      case null { return #err("Staff not found — add them first") };
    };
    // Idempotent: only add if not already present
    let alreadyHas = existing.permissions.find(
      func(p : CommonTypes.EnterprisePermission) : Bool {
        switch (p, permission) {
          case (#EnterpriseDelivery, #EnterpriseDelivery) true;
          case (#CustomerSupport, #CustomerSupport) true;
          case (#Accounting, #Accounting) true;
          case (#DeviceManagement, #DeviceManagement) true;
          case _ false;
        };
      }
    );
    if (alreadyHas != null) return #ok;
    let perms = List.fromArray<CommonTypes.EnterprisePermission>(existing.permissions);
    perms.add(permission);
    enterpriseStaffPermissions.add(principalId, { principalId; permissions = perms.toArray() });
    #ok;
  };

  /// Revoke a single permission from a staff member (business owner only).
  public shared ({ caller }) func revokeEnterprisePermission(
    principalId : Principal,
    permission  : CommonTypes.EnterprisePermission,
  ) : async { #ok; #err : Text } {
    if (not entStaffIsOwner(caller)) return #err("Unauthorized");
    let existing = switch (enterpriseStaffPermissions.get(principalId)) {
      case (?e) e;
      case null { return #err("Staff not found") };
    };
    let updated = List.fromArray<CommonTypes.EnterprisePermission>(existing.permissions);
    updated.retain(
      func(p : CommonTypes.EnterprisePermission) : Bool {
        switch (p, permission) {
          case (#EnterpriseDelivery, #EnterpriseDelivery) false;
          case (#CustomerSupport, #CustomerSupport) false;
          case (#Accounting, #Accounting) false;
          case (#DeviceManagement, #DeviceManagement) false;
          case _ true;
        };
      }
    );
    enterpriseStaffPermissions.add(principalId, { principalId; permissions = updated.toArray() });
    #ok;
  };

  /// List all enterprise staff with their permissions (business owner only).
  public shared ({ caller }) func listEnterpriseStaff() : async { #ok : [CommonTypes.EnterpriseStaffPermissions]; #err : Text } {
    if (not entStaffIsOwner(caller)) return #err("Unauthorized");
    let result = List.empty<CommonTypes.EnterpriseStaffPermissions>();
    for ((_, entry) in enterpriseStaffPermissions.entries()) {
      result.add(entry);
    };
    #ok(result.toArray());
  };

  /// Check if a given principal has a specific permission. Business owner always returns true.
  public shared func hasEnterprisePermission(
    principalId : Principal,
    permission  : CommonTypes.EnterprisePermission,
  ) : async Bool {
    if (principalId == getBusinessOwnerPrincipalId()) return true;
    switch (enterpriseStaffPermissions.get(principalId)) {
      case null false;
      case (?entry) {
        let found = entry.permissions.find(
          func(p : CommonTypes.EnterprisePermission) : Bool {
            switch (p, permission) {
              case (#EnterpriseDelivery, #EnterpriseDelivery) true;
              case (#CustomerSupport, #CustomerSupport) true;
              case (#Accounting, #Accounting) true;
              case (#DeviceManagement, #DeviceManagement) true;
              case _ false;
            };
          }
        );
        found != null;
      };
    };
  };

  /// Get the caller's own enterprise permissions.
  public shared ({ caller }) func getMyEnterprisePermissions() : async [CommonTypes.EnterprisePermission] {
    if (caller == getBusinessOwnerPrincipalId()) {
      // Owner implicitly has all permissions
      return [#EnterpriseDelivery, #CustomerSupport, #Accounting, #DeviceManagement] : [CommonTypes.EnterprisePermission];
    };
    switch (enterpriseStaffPermissions.get(caller)) {
      case null [];
      case (?entry) entry.permissions;
    };
  };
};
