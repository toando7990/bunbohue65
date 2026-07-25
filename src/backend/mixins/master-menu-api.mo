// Master Menu API mixin — exposes enterprise-level menu management endpoints
import MasterMenuManager "../MasterMenuManager";
import RestaurantManager "../RestaurantManager";
import MasterMenuTypes "../types/master-menu";

mixin (
  masterMenuState : MasterMenuManager.State,
  restaurantState : RestaurantManager.State,
  getBusinessOwnerPrincipalId : () -> Principal,
) {

  // ── Helpers ───────────────────────────────────────────────────────────────

  func isBusinessOwner(caller : Principal) : Bool {
    caller == getBusinessOwnerPrincipalId()
  };

  // ── Items: public queries ─────────────────────────────────────────────────

  // List all active master menu items sorted by position — public
  public query func listMasterMenuItems() : async [MasterMenuTypes.MasterMenuItem] {
    MasterMenuManager.listItems(masterMenuState);
  };

  // ── Categories: public queries ────────────────────────────────────────────

  // List all master categories sorted by position — public
  public query func listMasterCategories() : async [MasterMenuTypes.MasterMenuCategory] {
    MasterMenuManager.listCategories(masterMenuState);
  };

  // ── Items: business owner mutations ───────────────────────────────────────

  // Create a master menu item — BusinessOwner only
  public shared ({ caller }) func createMasterMenuItem(
    req : MasterMenuTypes.CreateMasterMenuItemRequest,
  ) : async { #ok : MasterMenuTypes.MasterMenuItem; #err : Text } {
    if (not isBusinessOwner(caller)) return #err("Không có quyền truy cập");
    #ok(MasterMenuManager.createItem(masterMenuState, req));
  };

  // Update a master menu item — BusinessOwner only
  public shared ({ caller }) func updateMasterMenuItem(
    id  : Nat,
    req : MasterMenuTypes.UpdateMasterMenuItemRequest,
  ) : async { #ok : MasterMenuTypes.MasterMenuItem; #err : Text } {
    if (not isBusinessOwner(caller)) return #err("Không có quyền truy cập");
    switch (MasterMenuManager.updateItem(masterMenuState, id, req)) {
      case (?item) #ok(item);
      case null    #err("Không tìm thấy món ăn");
    };
  };

  // Delete a master menu item — BusinessOwner only
  public shared ({ caller }) func deleteMasterMenuItem(
    id : Nat,
  ) : async { #ok : (); #err : Text } {
    if (not isBusinessOwner(caller)) return #err("Không có quyền truy cập");
    if (MasterMenuManager.deleteItem(masterMenuState, id)) #ok(())
    else #err("Không tìm thấy món ăn");
  };

  // Show/hide a master menu item across all restaurants — BusinessOwner only
  public shared ({ caller }) func setMasterMenuItemActive(
    id       : Nat,
    isActive : Bool,
  ) : async { #ok : (); #err : Text } {
    if (not isBusinessOwner(caller)) return #err("Không có quyền truy cập");
    if (MasterMenuManager.setItemActive(masterMenuState, id, isActive)) #ok(())
    else #err("Không tìm thấy món ăn");
  };

  // ── Categories: business owner mutations ──────────────────────────────────

  // Create a master category — BusinessOwner only
  public shared ({ caller }) func createMasterCategory(
    req : MasterMenuTypes.CreateMasterCategoryRequest,
  ) : async { #ok : MasterMenuTypes.MasterMenuCategory; #err : Text } {
    if (not isBusinessOwner(caller)) return #err("Không có quyền truy cập");
    #ok(MasterMenuManager.createCategory(masterMenuState, req));
  };

  // Update a master category — BusinessOwner only
  public shared ({ caller }) func updateMasterCategory(
    id  : Nat,
    req : MasterMenuTypes.UpdateMasterCategoryRequest,
  ) : async { #ok : MasterMenuTypes.MasterMenuCategory; #err : Text } {
    if (not isBusinessOwner(caller)) return #err("Không có quyền truy cập");
    switch (MasterMenuManager.updateCategory(masterMenuState, id, req)) {
      case (?cat) #ok(cat);
      case null   #err("Không tìm thấy danh mục");
    };
  };

  // Delete a master category — BusinessOwner only
  public shared ({ caller }) func deleteMasterCategory(
    id : Nat,
  ) : async { #ok : (); #err : Text } {
    if (not isBusinessOwner(caller)) return #err("Không có quyền truy cập");
    if (MasterMenuManager.deleteCategory(masterMenuState, id)) #ok(())
    else #err("Không tìm thấy danh mục");
  };

  // ── Restaurant overrides ──────────────────────────────────────────────────

  // Toggle availability for a specific item in a specific restaurant — owner or admin of that restaurant
  public shared ({ caller }) func setRestaurantItemOverride(
    restaurantId : Nat,
    masterItemId : Nat,
    isAvailable  : Bool,
  ) : async () {
    assert RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller);
    MasterMenuManager.setOverride(masterMenuState, restaurantId, masterItemId, isAvailable);
  };

  // Get list of masterItemIds that are disabled for a given restaurant — public
  public query func getRestaurantOverrides(
    restaurantId : Nat,
  ) : async [Nat] {
    MasterMenuManager.getOverridesForRestaurant(masterMenuState, restaurantId);
  };

  // ── Nearest restaurant ────────────────────────────────────────────────────

  // Find the nearest active restaurant by haversine distance — public
  public query func findNearestRestaurant(
    lat : Float,
    lng : Float,
  ) : async ?Nat {
    MasterMenuManager.findNearestRestaurant(restaurantState, lat, lng);
  };
};
