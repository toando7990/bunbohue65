// Master Menu domain types — enterprise-level, no restaurantId
module {
  // A menu item owned by the enterprise (no restaurantId)
  public type MasterMenuItem = {
    id          : Nat;
    categoryId  : Nat;
    name        : Text;
    description : Text;
    price       : Nat; // smallest currency unit (VND)
    imageUrl    : ?Text;
    unit        : ?Text; // đơn vị tính e.g. "tô", "đĩa", "phần"
    position    : Nat;
    isActive    : Bool; // false = hidden from all restaurants
  };

  // A menu category owned by the enterprise (no restaurantId)
  public type MasterMenuCategory = {
    id       : Nat;
    name     : Text;
    position : Nat;
  };

  // Restaurant-level availability override — restaurant can only toggle isAvailable
  public type RestaurantMenuOverride = {
    masterItemId : Nat;
    restaurantId : Nat;
    isAvailable  : Bool;
  };

  // ── Input request types ──────────────────────────────────────────────────

  public type CreateMasterMenuItemRequest = {
    categoryId  : Nat;
    name        : Text;
    description : Text;
    price       : Nat;
    imageUrl    : ?Text;
    unit        : ?Text;
    position    : Nat;
  };

  public type UpdateMasterMenuItemRequest = {
    categoryId  : ?Nat;
    name        : ?Text;
    description : ?Text;
    price       : ?Nat;
    imageUrl    : ?Text;  // null means "no change", explicit clear not supported
    unit        : ?Text;
    position    : ?Nat;
  };

  public type CreateMasterCategoryRequest = {
    name     : Text;
    position : Nat;
  };

  public type UpdateMasterCategoryRequest = {
    name     : ?Text;
    position : ?Nat;
  };
};
