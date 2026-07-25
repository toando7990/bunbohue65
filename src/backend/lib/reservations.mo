// ReservationManager — domain logic for reservation management
import Map "mo:core/Map";
import Time "mo:core/Time";
import CommonTypes "../types/common";
import ReservationTypes "../types/reservation";

module {
  public type ReservationId = ReservationTypes.ReservationId;
  public type Reservation = ReservationTypes.Reservation;
  public type ReservationStatus = ReservationTypes.ReservationStatus;

  // Immutable snapshot for public API (Reservation has var status — not shareable)
  public type ReservationPublic = {
    id : ReservationId;
    restaurantId : CommonTypes.RestaurantId;
    customerName : Text;
    customerPhone : Text;
    partySize : Nat;
    date : Text;
    timeSlot : Text;
    durationMinutes : Nat;
    tableId : ?CommonTypes.TableId;
    status : ReservationStatus;
    notes : ?Text;
    customerEmail : ?Text;
    createdAt : CommonTypes.Timestamp;
  };

  public class ReservationManager(
    reservations : Map.Map<ReservationId, Reservation>,
    state : { var nextReservationId : ReservationId },
  ) {

    func toPublic(r : Reservation) : ReservationPublic = {
      id = r.id;
      restaurantId = r.restaurantId;
      customerName = r.customerName;
      customerPhone = r.customerPhone;
      partySize = r.partySize;
      date = r.date;
      timeSlot = r.timeSlot;
      durationMinutes = r.durationMinutes;
      tableId = r.tableId;
      status = r.status;
      notes = r.notes;
      customerEmail = r.customerEmail;
      createdAt = r.createdAt;
    };

    public func createReservation(
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
      createdAt : CommonTypes.Timestamp,
    ) : ReservationId {
      // Conflict check: same restaurant + date + timeSlot (not cancelled)
      let conflict = reservations.any(func(_id, r) {
        r.restaurantId == restaurantId and
        r.date == date and
        r.timeSlot == timeSlot and
        r.status != #Cancelled
      });
      if (conflict) { return 0 };
      let id = state.nextReservationId;
      state.nextReservationId += 1;
      let reservation : Reservation = {
        id;
        restaurantId;
        customerName;
        customerPhone;
        partySize;
        date;
        timeSlot;
        durationMinutes;
        tableId;
        var status = #Pending;
        notes;
        customerEmail;
        createdAt;
      };
      reservations.add(id, reservation);
      id;
    };

    public func confirmReservation(id : ReservationId) : Bool {
      switch (reservations.get(id)) {
        case (?r) { r.status := #Confirmed; true };
        case null false;
      };
    };

    public func cancelReservation(id : ReservationId) : Bool {
      switch (reservations.get(id)) {
        case (?r) { r.status := #Cancelled; true };
        case null false;
      };
    };

    public func listReservationsByRestaurant(restaurantId : CommonTypes.RestaurantId) : [ReservationPublic] {
      reservations.foldLeft(
        [] : [ReservationPublic],
        func(acc : [ReservationPublic], _id : ReservationId, r : Reservation) : [ReservationPublic] {
          if (r.restaurantId == restaurantId) {
            acc.concat([toPublic(r)])
          } else { acc };
        }
      );
    };

    public func updateReservationStatus(id : ReservationId, newStatus : ReservationStatus) : Bool {
      switch (reservations.get(id)) {
        case (?r) { r.status := newStatus; true };
        case null false;
      };
    };
  };
};
