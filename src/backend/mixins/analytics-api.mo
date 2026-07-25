// Analytics API mixin — exposes analytics query endpoints
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import OrderLib "../lib/orders";
import AnalyticsLib "../lib/analytics";
import CommonTypes "../types/common";
import AnalyticsTypes "../types/analytics";

mixin (
  orders : Map.Map<OrderLib.OrderId, OrderLib.Order>,
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  getBusinessOwnerPrincipalId : () -> Principal,
) {
  // Check if caller is the business owner
  func analyticsIsOwner(caller : Principal) : Bool {
    caller == getBusinessOwnerPrincipalId();
  };

  // Check if caller is an authorized enterprise staff member with #EnterpriseDelivery permission.
  // Follows the enterprise-delivery-api.mo pattern: owner OR staff with #EnterpriseDelivery.
  func analyticsIsEnterpriseStaff(caller : Principal) : Bool {
    if (analyticsIsOwner(caller)) return true;
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

  // Get daily analytics for a restaurant within a date range.
  // Returns null if the caller is not an authorized enterprise staff member.
  public shared query ({ caller }) func getDailyAnalytics(
    restaurantId : CommonTypes.RestaurantId,
    startDate : Text,
    endDate : Text,
  ) : async ?[AnalyticsTypes.AnalyticsEntry] {
    if (not analyticsIsEnterpriseStaff(caller)) return null;
    ?AnalyticsLib.AnalyticsManager(orders).getDailyAnalytics(restaurantId, startDate, endDate);
  };

  // Get weekly analytics for a restaurant within a week range.
  // Returns null if the caller is not an authorized enterprise staff member.
  public shared query ({ caller }) func getWeeklyAnalytics(
    restaurantId : CommonTypes.RestaurantId,
    startWeek : Text,
    endWeek : Text,
  ) : async ?[AnalyticsTypes.WeeklyAnalyticsEntry] {
    if (not analyticsIsEnterpriseStaff(caller)) return null;
    ?AnalyticsLib.AnalyticsManager(orders).getWeeklyAnalytics(restaurantId, startWeek, endWeek);
  };
};
