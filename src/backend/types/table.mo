// Table domain types
import CommonTypes "common";

module {
  public type Table = {
    id : CommonTypes.TableId;
    restaurantId : CommonTypes.RestaurantId;
    tableNumber : Text;
    qrCodeUrl : Text;
  };
};
