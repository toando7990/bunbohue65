// Reservation API mixin — exposes public reservation management endpoints
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import ReservationLib "../lib/reservations";
import CommonTypes "../types/common";
import ReservationTypes "../types/reservation";

mixin (
  reservations : Map.Map<ReservationLib.ReservationId, ReservationLib.Reservation>,
  reservationState : { var nextReservationId : ReservationLib.ReservationId },
  enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>,
  getBusinessOwnerPrincipalId : () -> Principal,
) {
  // Check if caller is the business owner
  func reservationIsOwner(caller : Principal) : Bool {
    caller == getBusinessOwnerPrincipalId();
  };

  // Check if caller is an authorized enterprise staff member (owner or #EnterpriseDelivery permission)
  func reservationIsEnterpriseStaff(caller : Principal) : Bool {
    if (reservationIsOwner(caller)) return true;
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

  // Create a new reservation — anonymous (customers make reservations without login)
  public shared func createReservation(
    restaurantId : CommonTypes.RestaurantId,
    customerName : Text,
    customerPhone : Text,
    partySize : Nat,
    date : Text,
    timeSlot : Text,
    durationMinutes : Nat,
    tableId : ?CommonTypes.TableId,
    notes : ?Text,
    customerEmail : ?Text,
  ) : async ReservationLib.ReservationId {
    let mgr = ReservationLib.ReservationManager(reservations, reservationState);
    mgr.createReservation(
      restaurantId, customerName, customerPhone, partySize,
      date, timeSlot, durationMinutes, tableId, notes, customerEmail,
      Time.now(),
    );
  };

  // Confirm a pending reservation — staff only
  public shared ({ caller }) func confirmReservation(id : ReservationLib.ReservationId) : async Bool {
    if (not reservationIsEnterpriseStaff(caller)) return false;
    let mgr = ReservationLib.ReservationManager(reservations, reservationState);
    mgr.confirmReservation(id);
  };

  // Cancel a reservation — staff only
  public shared ({ caller }) func cancelReservation(id : ReservationLib.ReservationId) : async Bool {
    if (not reservationIsEnterpriseStaff(caller)) return false;
    let mgr = ReservationLib.ReservationManager(reservations, reservationState);
    mgr.cancelReservation(id);
  };

  // List all reservations for a restaurant — staff only (returns customer PII)
  public shared query ({ caller }) func listReservationsByRestaurant(
    restaurantId : CommonTypes.RestaurantId
  ) : async [ReservationLib.ReservationPublic] {
    if (not reservationIsEnterpriseStaff(caller)) return [];
    let mgr = ReservationLib.ReservationManager(reservations, reservationState);
    mgr.listReservationsByRestaurant(restaurantId);
  };

  // Update reservation status — staff only
  public shared ({ caller }) func updateReservationStatus(
    id : ReservationLib.ReservationId,
    newStatus : ReservationTypes.ReservationStatus,
  ) : async Bool {
    if (not reservationIsEnterpriseStaff(caller)) return false;
    let mgr = ReservationLib.ReservationManager(reservations, reservationState);
    mgr.updateReservationStatus(id, newStatus);
  };
};
