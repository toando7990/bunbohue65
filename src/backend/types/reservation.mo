// Reservation domain types
import CommonTypes "common";

module {
  public type ReservationId = Nat;

  public type ReservationStatus = {
    #Pending;
    #Confirmed;
    #Arrived;
    #Cancelled;
  };

  public type Reservation = {
    id : ReservationId;
    restaurantId : CommonTypes.RestaurantId;
    customerName : Text;
    customerPhone : Text;
    partySize : Nat;
    date : Text;
    timeSlot : Text;
    durationMinutes : Nat;
    tableId : ?CommonTypes.TableId;
    var status : ReservationStatus;
    notes : ?Text;
    customerEmail : ?Text;
    createdAt : CommonTypes.Timestamp;
  };
};
