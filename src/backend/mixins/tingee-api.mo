// Tingee QR payment integration mixin (production-only, no test/prod split).
// Webhook is received directly by the canister (no VPS worker).
// Tingee API mixin — production-only, no test/prod split, no useTest flag.
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import OrderLib "../lib/orders";
import BusinessProfileLib "../lib/business-profile";
import CommonTypes "../types/common";

mixin (
  orders              : Map.Map<OrderLib.OrderId, OrderLib.Order>,
  orderState          : { var nextOrderId : OrderLib.OrderId },
  bpState             : BusinessProfileLib.State,
  getOwner            : () -> Principal,
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  verifyDeviceToken   : shared (Text) -> async { #ok : { restaurantId : Nat; role : CommonTypes.StaffRole; deviceName : Text }; #err : Text },
) {
  // ── Config ──────────────────────────────────────────────────────────────────

  /// Returns Tingee configuration. Owner-only — exposes clientId and
  /// orderPrefix. The secretToken is masked as "••••••••" so the frontend
  /// can show whether a token is configured without revealing its value.
  /// Production-only: no test/prod split, no useTest flag.
  public shared query ({ caller }) func getTingeeConfig() : async ?{
    clientId      : Text;
    secretToken   : Text;
    orderPrefix   : Text;
  } {
    if (caller != getOwner()) return null;
    let cfg = BusinessProfileLib.getTingeeConfig(bpState);
    ?{
      clientId      = switch (cfg.clientId)      { case (?v) v; case null "" };
      secretToken   = switch (cfg.secretToken)   { case (?v) "••••••••"; case null "" };
      orderPrefix   = cfg.orderPrefix;
    };
  };

  /// Returns Tingee configuration for a verified kiosk-order device token.
  /// Verifies the device token via verifyDeviceToken (KioskDevicesMixin) and
  /// only exposes the config (clientId, masked secretToken, orderPrefix) when
  /// the device role is #KioskOrder. Returns null if the token is invalid,
  /// the device is revoked, or the role is not #KioskOrder.
  /// The secretToken is masked as "••••••••" — the device never receives the
  /// raw secret. This is the kiosk-specific path — getTingeeConfig() above
  /// remains owner-only and is unchanged for /order and /delivery-order.
  public shared func getTingeeConfigForDevice(token : Text) : async ?{
    clientId      : Text;
    secretToken   : Text;
    orderPrefix   : Text;
  } {
    switch (await verifyDeviceToken(token)) {
      case (#err(_)) return null;
      case (#ok(info)) {
        // Only kiosk-order devices may receive the Tingee config.
        switch (info.role) {
          case (#KioskOrder) {
            let cfg = BusinessProfileLib.getTingeeConfig(bpState);
            ?{
              clientId      = switch (cfg.clientId)      { case (?v) v; case null "" };
              secretToken   = switch (cfg.secretToken)   { case (?v) "••••••••"; case null "" };
              orderPrefix   = cfg.orderPrefix;
            };
          };
          case _ null;
        };
      };
    };
  };

  /// Save Tingee credentials. Owner-only.
  /// Production-only: no test/prod split, no useTest flag.
  /// Credential fields are only overwritten when non-empty (frontend clears
  /// inputs after save), so partial updates preserve existing values.
  public shared ({ caller }) func saveTingeeConfig(
    clientId      : Text,
    secretToken   : Text,
    orderPrefix   : Text,
  ) : async () {
    assert caller == getOwner();
    BusinessProfileLib.setTingeeConfig(
      bpState,
      clientId,
      secretToken,
      orderPrefix,
    );
  };

  // ── Status ───────────────────────────────────────────────────────────────────

  /// Returns whether Tingee is configured (clientId + secretToken are non-empty).
  /// Public query — used by the frontend to decide whether to show Tingee as a
  /// payment option. Does NOT expose credentials.
  public query func hasTingeeConfigured() : async Bool {
    BusinessProfileLib.hasTingeeConfigured(bpState);
  };
};
