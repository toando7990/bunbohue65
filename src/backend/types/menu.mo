// Menu domain types
import CommonTypes "common";

module {
  public type MenuCategory = {
    id : CommonTypes.MenuCategoryId;
    restaurantId : CommonTypes.RestaurantId;
    name : Text;
    position : Nat;
  };

  public type MenuItem = {
    id : CommonTypes.MenuItemId;
    restaurantId : CommonTypes.RestaurantId;
    categoryId : CommonTypes.MenuCategoryId;
    name : Text;
    description : Text;
    price : Nat; // smallest currency unit
    imageUrl : ?Text;
    available : Bool;
    unit : ?Text;  // unit of measure (e.g. "tô", "đĩa", "phần", "ly")
  };
};
