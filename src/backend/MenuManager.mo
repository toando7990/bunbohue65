// MenuManager — standalone module class for menu domain logic
// Stores categories and items in Map keyed by their IDs
import Map "mo:core/Map";
import Iter "mo:core/Iter";
import CommonTypes "types/common";
import MenuTypes "types/menu";

module {
  public type MenuCategory = MenuTypes.MenuCategory;
  public type MenuItem     = MenuTypes.MenuItem;

  public type State = {
    categories    : Map.Map<CommonTypes.MenuCategoryId, MenuCategory>;
    items         : Map.Map<CommonTypes.MenuItemId, MenuItem>;
    counters      : { var nextCategoryId : Nat; var nextItemId : Nat };
  };

  public func empty() : State = {
    categories = Map.empty();
    items      = Map.empty();
    counters   = { var nextCategoryId = 1; var nextItemId = 1 };
  };

  // ── Categories ────────────────────────────────────────────────────────────

  public func createCategory(
    state      : State,
    restaurantId : CommonTypes.RestaurantId,
    name       : Text,
    position   : Nat,
  ) : CommonTypes.MenuCategoryId {
    let id = state.counters.nextCategoryId;
    state.counters.nextCategoryId += 1;
    let cat : MenuCategory = { id; restaurantId; name; position };
    state.categories.add(id, cat);
    id;
  };

  public func updateCategory(
    state    : State,
    id       : CommonTypes.MenuCategoryId,
    name     : Text,
    position : Nat,
  ) : Bool {
    switch (state.categories.get(id)) {
      case null false;
      case (?cat) {
        state.categories.add(id, { cat with name; position });
        true;
      };
    };
  };

  public func deleteCategory(
    state : State,
    id    : CommonTypes.MenuCategoryId,
  ) : Bool {
    switch (state.categories.get(id)) {
      case null false;
      case (?_) {
        state.categories.remove(id);
        true;
      };
    };
  };

  public func getCategory(
    state : State,
    id    : CommonTypes.MenuCategoryId,
  ) : ?MenuCategory {
    state.categories.get(id);
  };

  public func listCategoriesByRestaurant(
    state        : State,
    restaurantId : CommonTypes.RestaurantId,
  ) : [MenuCategory] {
    state.categories.values()
      |> _.filter(func(c : MenuCategory) : Bool { c.restaurantId == restaurantId })
      |> _.toArray();
  };

  // ── Items ─────────────────────────────────────────────────────────────────

  public func createItem(
    state        : State,
    restaurantId : CommonTypes.RestaurantId,
    categoryId   : CommonTypes.MenuCategoryId,
    name         : Text,
    description  : Text,
    price        : Nat,
    imageUrl     : ?Text,
    available    : Bool,
    unit         : ?Text,
  ) : CommonTypes.MenuItemId {
    let id = state.counters.nextItemId;
    state.counters.nextItemId += 1;
    let item : MenuItem = { id; restaurantId; categoryId; name; description; price; imageUrl; available; unit };
    state.items.add(id, item);
    id;
  };

  public func updateItem(
    state       : State,
    id          : CommonTypes.MenuItemId,
    name        : Text,
    description : Text,
    price       : Nat,
    imageUrl    : ?Text,
    available   : Bool,
    unit        : ?Text,
  ) : Bool {
    switch (state.items.get(id)) {
      case null false;
      case (?item) {
        state.items.add(id, { item with name; description; price; imageUrl; available; unit });
        true;
      };
    };
  };

  public func deleteItem(
    state : State,
    id    : CommonTypes.MenuItemId,
  ) : Bool {
    switch (state.items.get(id)) {
      case null false;
      case (?_) {
        state.items.remove(id);
        true;
      };
    };
  };

  public func setItemAvailability(
    state     : State,
    id        : CommonTypes.MenuItemId,
    available : Bool,
  ) : Bool {
    switch (state.items.get(id)) {
      case null false;
      case (?item) {
        state.items.add(id, { item with available });
        true;
      };
    };
  };

  public func getItem(
    state : State,
    id    : CommonTypes.MenuItemId,
  ) : ?MenuItem {
    state.items.get(id);
  };

  public func listItemsByRestaurant(
    state        : State,
    restaurantId : CommonTypes.RestaurantId,
  ) : [MenuItem] {
    state.items.values()
      |> _.filter(func(i : MenuItem) : Bool { i.restaurantId == restaurantId })
      |> _.toArray();
  };

  public func listItemsByCategory(
    state        : State,
    restaurantId : CommonTypes.RestaurantId,
    categoryId   : CommonTypes.MenuCategoryId,
  ) : [MenuItem] {
    state.items.values()
      |> _.filter(func(i : MenuItem) : Bool {
           i.restaurantId == restaurantId and i.categoryId == categoryId
         })
      |> _.toArray();
  };
};
