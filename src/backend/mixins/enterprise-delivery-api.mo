// Enterprise delivery API mixin — cross-restaurant delivery management for authorized enterprise staff
import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import OrderLib "../lib/orders";
import CommonTypes "../types/common";
import OrderTypes "../types/order";
import RestaurantManager "../RestaurantManager";

mixin (
  orders             : Map.Map<OrderLib.OrderId, OrderLib.Order>,
  orderState         : { var nextOrderId : OrderLib.OrderId },
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  staffRestaurantFilter : Map.Map<Principal, [CommonTypes.RestaurantId]>,
  getBusinessOwnerPrincipalId : () -> Principal,
  restaurantState    : RestaurantManager.State,
) {

  // Check if caller is the business owner
  func entDelivIsOwner(caller : Principal) : Bool {
    caller == getBusinessOwnerPrincipalId();
  };

  // Check if caller is an authorized enterprise delivery staff member
  // Uses the populated enterpriseStaffPermissions map (not the empty legacy set)
  func isEnterpriseStaff(caller : Principal) : Bool {
    if (entDelivIsOwner(caller)) return true;
    switch (enterpriseStaffPermissions.get(caller)) {
      case null false;
      case (?entry) {
        let found = entry.permissions.find(
          func(p : CommonTypes.EnterprisePermission) : Bool {
            switch p { case (#EnterpriseDelivery) true; case _ false };
          }
        );
        found != null;
      };
    };
  };

  // Returns whether the caller is an authorized enterprise delivery staff member
  public shared ({ caller }) func isEnterpriseDeliveryStaff() : async Bool {
    isEnterpriseStaff(caller);
  };

  // Enterprise staff saves their restaurant filter selection.
  // An empty array means "all restaurants".
  public shared ({ caller }) func saveMyRestaurantFilter(restaurantIds : [CommonTypes.RestaurantId]) : async { #ok; #err : { #Unauthorized } } {
    if (not isEnterpriseStaff(caller)) return #err(#Unauthorized);
    staffRestaurantFilter.add(caller, restaurantIds);
    #ok;
  };

  // Enterprise staff retrieves their saved restaurant filter selection.
  // Returns null if no filter has been saved yet.
  public shared ({ caller }) func getMyRestaurantFilter() : async { #ok : ?[CommonTypes.RestaurantId]; #err : { #Unauthorized } } {
    if (not isEnterpriseStaff(caller)) return #err(#Unauthorized);
    #ok(staffRestaurantFilter.get(caller));
  };

  // Returns delivery orders for the enterprise delivery center.
  // Staff with #EnterpriseDelivery permission see ALL orders (no restaurant filter).
  // Other staff see orders filtered by their saved restaurant selection.
  // Only authorized enterprise delivery staff may call this.
  public shared ({ caller }) func listDeliveryOrdersEnterprise(
    dateFilter : ?Text,
  ) : async { #ok : [OrderLib.OrderPublic]; #err : { #Unauthorized } } {
    if (not isEnterpriseStaff(caller)) return #err(#Unauthorized);
    // Check if caller has #EnterpriseDelivery permission — if yes, bypass restaurant filter
    let hasEnterpriseDelivery = switch (enterpriseStaffPermissions.get(caller)) {
      case null false;
      case (?entry) {
        let found = entry.permissions.find(
          func(p : CommonTypes.EnterprisePermission) : Bool {
            switch p { case (#EnterpriseDelivery) true; case _ false };
          }
        );
        found != null;
      };
    };
    let allowedRestaurants : ?[CommonTypes.RestaurantId] = if (hasEnterpriseDelivery) {
      null // No filter — show all orders
    } else {
      staffRestaurantFilter.get(caller)
    };
    let manager = OrderLib.OrderManager(orders, orderState, "", "");
    let results = manager.listDeliveryOrdersEnterpriseCentral(
      allowedRestaurants,
      dateFilter,
    );
    #ok(results);
  };
};
