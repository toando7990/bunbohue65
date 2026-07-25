// Table API mixin — exposes public table management endpoints
import TableManager "../TableManager";
import RestaurantManager "../RestaurantManager";
import CommonTypes "../types/common";
import TableTypes "../types/table";

mixin (
  tableState      : TableManager.State,
  restaurantState : RestaurantManager.State,
) {

  // Create a table — caller must be owner or admin
  public shared ({ caller }) func createTable(
    restaurantId : CommonTypes.RestaurantId,
    tableNumber  : Text,
  ) : async CommonTypes.TableId {
    assert RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller);
    TableManager.createTable(tableState, restaurantId, tableNumber);
  };

  // Update a table's number — caller must be owner or admin
  public shared ({ caller }) func updateTable(
    restaurantId : CommonTypes.RestaurantId,
    id           : CommonTypes.TableId,
    tableNumber  : Text,
  ) : async Bool {
    assert RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller);
    TableManager.updateTable(tableState, id, tableNumber);
  };

  // Delete a table — caller must be owner or admin
  public shared ({ caller }) func deleteTable(
    restaurantId : CommonTypes.RestaurantId,
    id           : CommonTypes.TableId,
  ) : async Bool {
    assert RestaurantManager.isOwnerOrAdmin(restaurantState, restaurantId, caller);
    TableManager.deleteTable(tableState, id);
  };

  // Get a table by id — public
  public query func getTable(id : CommonTypes.TableId) : async ?TableTypes.Table {
    TableManager.getTable(tableState, id);
  };

  // List tables for a restaurant — public
  public query func listTables(
    restaurantId : CommonTypes.RestaurantId
  ) : async [TableTypes.Table] {
    TableManager.listTablesByRestaurant(tableState, restaurantId);
  };
};
