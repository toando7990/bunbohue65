// MasterMenuManager — enterprise-level menu domain logic
// Stores MasterMenuItems, MasterMenuCategories, and per-restaurant availability overrides.
import Map "mo:core/Map";
import Array "mo:core/Array";
import Float "mo:core/Float";
import List "mo:core/List";
import Order "mo:core/Order";
import Nat "mo:core/Nat";
import MasterMenuTypes "types/master-menu";
import RestaurantManager "RestaurantManager";

module {
  public type MasterMenuItem        = MasterMenuTypes.MasterMenuItem;
  public type MasterMenuCategory    = MasterMenuTypes.MasterMenuCategory;
  public type RestaurantMenuOverride = MasterMenuTypes.RestaurantMenuOverride;
  public type CreateMasterMenuItemRequest  = MasterMenuTypes.CreateMasterMenuItemRequest;
  public type UpdateMasterMenuItemRequest  = MasterMenuTypes.UpdateMasterMenuItemRequest;
  public type CreateMasterCategoryRequest  = MasterMenuTypes.CreateMasterCategoryRequest;
  public type UpdateMasterCategoryRequest  = MasterMenuTypes.UpdateMasterCategoryRequest;

  // Composite key for override map: (restaurantId, masterItemId)
  public type OverrideKey = (Nat, Nat);

  // Explicit compare for tuple key (required — Motoko cannot infer compare for tuples)
  func overrideKeyCompare(a : OverrideKey, b : OverrideKey) : Order.Order {
    let (ar, ai) = a;
    let (br, bi) = b;
    switch (Nat.compare(ar, br)) {
      case (#equal) Nat.compare(ai, bi);
      case other    other;
    };
  };

  public type State = {
    masterItems        : Map.Map<Nat, MasterMenuItem>;
    masterCategories   : Map.Map<Nat, MasterMenuCategory>;
    restaurantOverrides : Map.Map<OverrideKey, Bool>;
    counters           : { var nextItemId : Nat; var nextCategoryId : Nat };
  };

  public func empty() : State = {
    masterItems         = Map.empty();
    masterCategories    = Map.empty();
    restaurantOverrides = Map.empty();
    counters            = { var nextItemId = 1; var nextCategoryId = 1 };
  };

  // ── Items ─────────────────────────────────────────────────────────────────

  public func createItem(state : State, req : CreateMasterMenuItemRequest) : MasterMenuItem {
    let id = state.counters.nextItemId;
    state.counters.nextItemId += 1;
    let item : MasterMenuItem = {
      id;
      categoryId  = req.categoryId;
      name        = req.name;
      description = req.description;
      price       = req.price;
      imageUrl    = req.imageUrl;
      unit        = req.unit;
      position    = req.position;
      isActive    = true;
    };
    state.masterItems.add(id, item);
    item;
  };

  public func updateItem(
    state : State,
    id    : Nat,
    req   : UpdateMasterMenuItemRequest,
  ) : ?MasterMenuItem {
    switch (state.masterItems.get(id)) {
      case null null;
      case (?existing) {
        let updated : MasterMenuItem = {
          existing with
          categoryId  = switch (req.categoryId)  { case (?v) v; case null existing.categoryId  };
          name        = switch (req.name)        { case (?v) v; case null existing.name        };
          description = switch (req.description) { case (?v) v; case null existing.description };
          price       = switch (req.price)       { case (?v) v; case null existing.price       };
          imageUrl    = switch (req.imageUrl)    { case (?v) ?v; case null existing.imageUrl   };
          unit        = switch (req.unit)        { case (?v) ?v; case null existing.unit       };
          position    = switch (req.position)    { case (?v) v; case null existing.position    };
        };
        state.masterItems.add(id, updated);
        ?updated;
      };
    };
  };

  public func deleteItem(state : State, id : Nat) : Bool {
    switch (state.masterItems.get(id)) {
      case null false;
      case _ {
        state.masterItems.remove(id);
        // Remove all restaurant overrides for this masterItemId
        let keysToRemove = List.empty<OverrideKey>();
        for ((key, _) in state.restaurantOverrides.entries()) {
          let (_, mId) = key;
          if (mId == id) keysToRemove.add(key);
        };
        for (key in keysToRemove.values()) {
          state.restaurantOverrides.remove(overrideKeyCompare, key);
        };
        true;
      };
    };
  };

  public func setItemActive(state : State, id : Nat, isActive : Bool) : Bool {
    switch (state.masterItems.get(id)) {
      case null false;
      case (?existing) {
        let updated = { existing with isActive };
        state.masterItems.add(id, updated);
        true;
      };
    };
  };

  public func getItem(state : State, id : Nat) : ?MasterMenuItem {
    state.masterItems.get(id);
  };

  // Returns all active items sorted by position ascending
  public func listItems(state : State) : [MasterMenuItem] {
    let items = state.masterItems.values()
      |> _.filter(func(item : MasterMenuItem) : Bool { item.isActive })
      |> _.toArray();
    items.sort(func(a : MasterMenuItem, b : MasterMenuItem) : { #less; #equal; #greater } {
      if (a.position < b.position) #less
      else if (a.position > b.position) #greater
      else #equal
    });
  };

  // ── Categories ────────────────────────────────────────────────────────────

  public func createCategory(state : State, req : CreateMasterCategoryRequest) : MasterMenuCategory {
    let id = state.counters.nextCategoryId;
    state.counters.nextCategoryId += 1;
    let category : MasterMenuCategory = {
      id;
      name     = req.name;
      position = req.position;
    };
    state.masterCategories.add(id, category);
    category;
  };

  public func updateCategory(
    state : State,
    id    : Nat,
    req   : UpdateMasterCategoryRequest,
  ) : ?MasterMenuCategory {
    switch (state.masterCategories.get(id)) {
      case null null;
      case (?existing) {
        let updated : MasterMenuCategory = {
          existing with
          name     = switch (req.name)     { case (?v) v; case null existing.name     };
          position = switch (req.position) { case (?v) v; case null existing.position };
        };
        state.masterCategories.add(id, updated);
        ?updated;
      };
    };
  };

  public func deleteCategory(state : State, id : Nat) : Bool {
    switch (state.masterCategories.get(id)) {
      case null false;
      case _ {
        state.masterCategories.remove(id);
        // setItemActive false for all items in this category (Map has no mapInPlace)
        let toDeactivate = List.empty<Nat>();
        for ((itemId, item) in state.masterItems.entries()) {
          if (item.categoryId == id) toDeactivate.add(itemId);
        };
        for (itemId in toDeactivate.values()) {
          switch (state.masterItems.get(itemId)) {
            case (?item) state.masterItems.add(itemId, { item with isActive = false });
            case null {};
          };
        };
        true;
      };
    };
  };

  // Returns all categories sorted by position ascending
  public func listCategories(state : State) : [MasterMenuCategory] {
    let cats = state.masterCategories.values()
      |> _.toArray();
    cats.sort(func(a : MasterMenuCategory, b : MasterMenuCategory) : { #less; #equal; #greater } {
      if (a.position < b.position) #less
      else if (a.position > b.position) #greater
      else #equal
    });
  };

  // ── Restaurant overrides ──────────────────────────────────────────────────

  // Set availability override for a specific restaurant + master item.
  // isAvailable=true  → DELETE the override entry (item is available by default, no need to store)
  // isAvailable=false → UPSERT the override entry (item is unavailable for this restaurant)
  public func setOverride(state : State, restaurantId : Nat, masterItemId : Nat, isAvailable : Bool) {
    if (isAvailable) {
      state.restaurantOverrides.remove(overrideKeyCompare, (restaurantId, masterItemId));
    } else {
      state.restaurantOverrides.add(overrideKeyCompare, (restaurantId, masterItemId), false);
    };
  };

  // Returns masterItemIds that are marked isAvailable=false for this restaurant
  public func getOverridesForRestaurant(state : State, restaurantId : Nat) : [Nat] {
    let result = List.empty<Nat>();
    for ((key, _) in state.restaurantOverrides.entries()) {
      let (rId, itemId) = key;
      if (rId == restaurantId) result.add(itemId);
    };
    result.toArray();
  };

  // ── Nearest restaurant (haversine) ────────────────────────────────────────

  // Haversine formula — returns great-circle distance in km
  func haversineKm(lat1 : Float, lng1 : Float, lat2 : Float, lng2 : Float) : Float {
    let r     = 6371.0; // Earth radius km
    let dLat  = (lat2 - lat1) * Float.pi / 180.0;
    let dLng  = (lng2 - lng1) * Float.pi / 180.0;
    let a = Float.sin(dLat / 2.0) * Float.sin(dLat / 2.0)
          + Float.cos(lat1 * Float.pi / 180.0)
          * Float.cos(lat2 * Float.pi / 180.0)
          * Float.sin(dLng / 2.0) * Float.sin(dLng / 2.0);
    let c = 2.0 * Float.arctan2(Float.sqrt(a), Float.sqrt(1.0 - a));
    r * c;
  };

  // Returns the RestaurantId of the nearest active restaurant with known coordinates
  public func findNearestRestaurant(
    restaurantState : RestaurantManager.State,
    lat : Float,
    lng : Float,
  ) : ?Nat {
    var bestId   : ?Nat   = null;
    var bestDist : Float  = 1_000_000.0; // sentinel large value
    for (r in restaurantState.restaurants.values()) {
      switch (r.coordinateLatitude, r.coordinateLongitude) {
        case (?rLat, ?rLng) {
          let d = haversineKm(lat, lng, rLat, rLng);
          if (d < bestDist) {
            bestDist := d;
            bestId   := ?r.id;
          };
        };
        case _ {};
      };
    };
    bestId;
  };
};
