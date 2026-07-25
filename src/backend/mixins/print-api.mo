import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Option "mo:core/Option";
import Principal "mo:core/Principal";
import Print "../lib/print";
import PrintTypes "../types/print";
import OrderTypes "../types/order";
import CommonTypes "../types/common";
import RestaurantManager "../RestaurantManager";
import BusinessProfileLib "../lib/business-profile";

mixin (
  orders : Map.Map<CommonTypes.OrderId, OrderTypes.Order>,
  bpState : BusinessProfileLib.State,
  restaurantState : RestaurantManager.State,
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  getBusinessOwnerPrincipalId : () -> Principal,
) {
  // Check if caller is an authorized enterprise staff member (owner or any
  // enterprise-permission holder). Mirrors the enterprise-delivery-api pattern.
  func printIsEnterpriseStaff(caller : Principal) : Bool {
    if (caller == getBusinessOwnerPrincipalId()) return true;
    switch (enterpriseStaffPermissions.get(caller)) {
      case null false;
      case (?entry) {
        entry.permissions.size() > 0;
      };
    };
  };

  // Returns the kiosk bill (order items + restaurant info) for the given order.
  // Enterprise-staff only — orderId is sequential Nat and trivially enumerable.
  public shared ({ caller }) func printKioskBill(orderId : CommonTypes.OrderId) : async ?PrintTypes.KioskBill {
    if (not printIsEnterpriseStaff(caller)) return null;
    let orderOpt = orders.get(orderId);
    switch (orderOpt) {
      case null { null };
      case (?order) {
        let restaurantOpt = RestaurantManager.getRestaurant(restaurantState, order.restaurantId);
        switch (restaurantOpt) {
          case null { null };
          case (?restaurant) {
            let name = restaurant.name;
            let addr = switch (bpState.profile.address) {
              case null { "" };
              case (?a) { a };
            };
            let phone = bpState.profile.phone.get("");
            ?Print.buildKioskBill(order, bpState.profile, name, addr, phone);
          };
        };
      };
    };
  };
};
