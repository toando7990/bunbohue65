// Menu API mixin — exposes public menu management endpoints
import MenuManager "../MenuManager";
import RestaurantManager "../RestaurantManager";
import CommonTypes "../types/common";
import MenuTypes "../types/menu";

mixin (
  menuState       : MenuManager.State,
  restaurantState : RestaurantManager.State,
) {

  // ── Categories ────────────────────────────────────────────────────────────

  // Create a menu category — caller must be owner or admin
  public shared ({ caller }) func createCategory(
    restaurantId : CommonTypes.RestaurantId,
    name : Text,
    position : Nat,
  ) : async CommonTypes.MenuCategoryId {
    assert RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller);
    MenuManager.createCategory(menuState, restaurantId, name, position);
  };

  // Update a menu category — caller must be owner or admin
  public shared ({ caller }) func updateCategory(
    restaurantId : CommonTypes.RestaurantId,
    id : CommonTypes.MenuCategoryId,
    name : Text,
    position : Nat,
  ) : async Bool {
    assert RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller);
    MenuManager.updateCategory(menuState, id, name, position);
  };

  // Delete a menu category — caller must be owner or admin
  public shared ({ caller }) func deleteCategory(
    restaurantId : CommonTypes.RestaurantId,
    id : CommonTypes.MenuCategoryId,
  ) : async Bool {
    assert RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller);
    MenuManager.deleteCategory(menuState, id);
  };

  // List categories for a restaurant — public
  public query func listCategories(
    restaurantId : CommonTypes.RestaurantId
  ) : async [MenuTypes.MenuCategory] {
    MenuManager.listCategoriesByRestaurant(menuState, restaurantId);
  };

  // ── Items ─────────────────────────────────────────────────────────────────

  // Create a menu item — caller must be owner or admin
  public shared ({ caller }) func createMenuItem(
    restaurantId : CommonTypes.RestaurantId,
    categoryId : CommonTypes.MenuCategoryId,
    name : Text,
    description : Text,
    price : Nat,
    imageUrl : ?Text,
    available : Bool,
    unit : ?Text,
  ) : async CommonTypes.MenuItemId {
    assert RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller);
    MenuManager.createItem(menuState, restaurantId, categoryId, name, description, price, imageUrl, available, unit);
  };

  // Update a menu item — caller must be owner or admin
  public shared ({ caller }) func updateMenuItem(
    restaurantId : CommonTypes.RestaurantId,
    id : CommonTypes.MenuItemId,
    name : Text,
    description : Text,
    price : Nat,
    imageUrl : ?Text,
    available : Bool,
    unit : ?Text,
  ) : async Bool {
    assert RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller);
    MenuManager.updateItem(menuState, id, name, description, price, imageUrl, available, unit);
  };

  // Delete a menu item — caller must be owner or admin
  public shared ({ caller }) func deleteMenuItem(
    restaurantId : CommonTypes.RestaurantId,
    id : CommonTypes.MenuItemId,
  ) : async Bool {
    assert RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller);
    MenuManager.deleteItem(menuState, id);
  };

  // Set item availability — caller must be owner or admin
  public shared ({ caller }) func setMenuItemAvailability(
    restaurantId : CommonTypes.RestaurantId,
    id : CommonTypes.MenuItemId,
    available : Bool,
  ) : async Bool {
    assert RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller);
    MenuManager.setItemAvailability(menuState, id, available);
  };

  // Get a single menu item — public
  public query func getMenuItem(id : CommonTypes.MenuItemId) : async ?MenuTypes.MenuItem {
    MenuManager.getItem(menuState, id);
  };

  // List all items for a restaurant — public
  public query func listMenuItems(
    restaurantId : CommonTypes.RestaurantId
  ) : async [MenuTypes.MenuItem] {
    MenuManager.listItemsByRestaurant(menuState, restaurantId);
  };

  // List items for a specific category — public
  public query func listMenuItemsByCategory(
    restaurantId : CommonTypes.RestaurantId,
    categoryId : CommonTypes.MenuCategoryId,
  ) : async [MenuTypes.MenuItem] {
    MenuManager.listItemsByCategory(menuState, restaurantId, categoryId);
  };
};
