// Analytics domain types
module {
  public type AnalyticsEntry = {
    date : Text;
    totalOrders : Nat;
    totalRevenue : Nat;
  };

  public type WeeklyAnalyticsEntry = {
    weekStart : Text;
    totalOrders : Nat;
    totalRevenue : Nat;
  };
};
