// AnalyticsManager — domain logic for analytics aggregation
import Map "mo:core/Map";
import List "mo:core/List";
import CommonTypes "../types/common";
import OrderLib "orders";
import AnalyticsTypes "../types/analytics";
import Int "mo:core/Int";

module {
  // ── Date helpers ─────────────────────────────────────────────────────────

  // Returns true if y is a leap year
  func isLeap(y : Int) : Bool {
    (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0);
  };

  // Days in a given month (1-indexed)
  func daysInMonth(m : Int, y : Int) : Int {
    switch m {
      case 1 31; case 3 31; case 5 31; case 7 31;
      case 8 31; case 10 31; case 12 31;
      case 2 { if (isLeap y) 29 else 28 };
      case _ 30;
    };
  };

  // Pad a positive integer to at least `width` digits with leading zeros
  func pad(n : Int, width : Nat) : Text {
    var s = n.toText();
    var w = width;
    while (s.size() < w) {
      s := "0" # s;
      w -= 1;
    };
    s;
  };

  // Convert nanosecond timestamp (Int) to "YYYY-MM-DD" using Gregorian calendar
  func timestampToDate(ns : CommonTypes.Timestamp) : Text {
    // seconds since Unix epoch (1970-01-01)
    let secs : Int = ns / 1_000_000_000;
    var days : Int = secs / 86400;

    // Walk forward from 1970 to find year
    var y : Int = 1970;
    label yearLoop loop {
      let dy = if (isLeap y) 366 else 365;
      if (days < dy) break yearLoop;
      days -= dy;
      y += 1;
    };

    // Walk forward within year to find month
    var m : Int = 1;
    label monthLoop loop {
      let dm = daysInMonth(m, y);
      if (days < dm) break monthLoop;
      days -= dm;
      m += 1;
    };

    let d : Int = days + 1; // 1-indexed day
    pad(y, 4) # "-" # pad(m, 2) # "-" # pad(d, 2);
  };

  // Return ISO week Monday date for a nanosecond timestamp.
  // ISO week starts on Monday; week 1 is the week containing Jan 4.
  // We compute the date of the nearest preceding Monday.
  func timestampToWeekStart(ns : CommonTypes.Timestamp) : Text {
    let secs : Int = ns / 1_000_000_000;
    // Day-of-week: 0=Thu for Unix epoch (1970-01-01 was a Thursday)
    // Adjust so 0=Mon: epoch (Thu) is dow=3
    let totalDays : Int = secs / 86400;
    // (totalDays + 3) mod 7 gives 0=Mon..6=Sun
    let dow : Int = Int.abs((totalDays + 3) % 7);
    let mondayDays : Int = totalDays - dow;
    timestampToDate(mondayDays * 86400 * 1_000_000_000);
  };

  // ── Accumulator helpers ───────────────────────────────────────────────────

  type Bucket = { var totalOrders : Nat; var totalRevenue : Nat };

  func newBucket() : Bucket = { var totalOrders = 0; var totalRevenue = 0 };

  // Sum price * quantity for all items in an order
  func orderRevenue(o : OrderLib.Order) : Nat {
    var total = 0;
    for (item in o.items.values()) {
      total += item.price * item.quantity;
    };
    total;
  };

  // ── AnalyticsManager ──────────────────────────────────────────────────────

  public class AnalyticsManager(
    orders : Map.Map<OrderLib.OrderId, OrderLib.Order>,
  ) {

    public func getDailyAnalytics(
      restaurantId : CommonTypes.RestaurantId,
      startDate : Text,
      endDate : Text,
    ) : [AnalyticsTypes.AnalyticsEntry] {
      let buckets = Map.empty<Text, Bucket>();

      for (o in orders.values()) {
        if (o.restaurantId == restaurantId) {
          let date = timestampToDate(o.createdAt);
          if (date >= startDate and date <= endDate) {
            let bucket = switch (buckets.get(date)) {
              case (?b) b;
              case null {
                let b = newBucket();
                buckets.add(date, b);
                b;
              };
            };
            bucket.totalOrders += 1;
            if (o.paymentInfo.paymentStatus == #Paid) {
              bucket.totalRevenue += orderRevenue(o);
            };
          };
        };
      };

      let entries = buckets.entries()
        .map(
          func((date, b)) = {
            date;
            totalOrders = b.totalOrders;
            totalRevenue = b.totalRevenue;
          }
        )
        .toArray();

      entries.sort(func(a, b) = a.date.compare(b.date));
    };

    public func getWeeklyAnalytics(
      restaurantId : CommonTypes.RestaurantId,
      startWeek : Text,
      endWeek : Text,
    ) : [AnalyticsTypes.WeeklyAnalyticsEntry] {
      let buckets = Map.empty<Text, Bucket>();

      for (o in orders.values()) {
        if (o.restaurantId == restaurantId) {
          let week = timestampToWeekStart(o.createdAt);
          if (week >= startWeek and week <= endWeek) {
            let bucket = switch (buckets.get(week)) {
              case (?b) b;
              case null {
                let b = newBucket();
                buckets.add(week, b);
                b;
              };
            };
            bucket.totalOrders += 1;
            if (o.paymentInfo.paymentStatus == #Paid) {
              bucket.totalRevenue += orderRevenue(o);
            };
          };
        };
      };

      let entries = buckets.entries()
        .map(
          func((week, b)) = {
            weekStart = week;
            totalOrders = b.totalOrders;
            totalRevenue = b.totalRevenue;
          }
        )
        .toArray();

      entries.sort(func(a, b) = a.weekStart.compare(b.weekStart));
    };
  };
};
