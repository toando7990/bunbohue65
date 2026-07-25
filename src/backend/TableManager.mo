// TableManager — module-function style matching MenuManager pattern
import Map "mo:core/Map";
import CommonTypes "types/common";
import TableTypes "types/table";

module {
  public type Table        = TableTypes.Table;
  public type TableId      = CommonTypes.TableId;
  public type RestaurantId = CommonTypes.RestaurantId;

  public type State = {
    tables   : Map.Map<TableId, Table>;
    counters : { var nextId : Nat };
  };

  public func empty() : State = {
    tables   = Map.empty();
    counters = { var nextId = 1 };
  };

  func buildQrUrl(restaurantId : RestaurantId, tableId : TableId) : Text {
    "/order?restaurantId=" # restaurantId.toText() # "&tableId=" # tableId.toText();
  };

  /// Create a new table for a restaurant. Returns the generated TableId.
  public func createTable(
    state          : State,
    restaurantId   : RestaurantId,
    tableNumber    : Text,
  ) : TableId {
    let id = state.counters.nextId;
    state.counters.nextId += 1;
    let table : Table = {
      id;
      restaurantId;
      tableNumber;
      qrCodeUrl = buildQrUrl(restaurantId, id);
    };
    state.tables.add(id, table);
    id;
  };

  /// Update the tableNumber (and regenerate QR URL) of an existing table. Returns true if found and updated.
  public func updateTable(
    state       : State,
    id          : TableId,
    tableNumber : Text,
  ) : Bool {
    switch (state.tables.get(id)) {
      case null false;
      case (?existing) {
        state.tables.add(id, { existing with
          tableNumber;
          qrCodeUrl = buildQrUrl(existing.restaurantId, id);
        });
        true;
      };
    };
  };

  /// Delete a table by id. Returns true if found and deleted.
  public func deleteTable(state : State, id : TableId) : Bool {
    switch (state.tables.get(id)) {
      case null false;
      case (?_) {
        state.tables.remove(id);
        true;
      };
    };
  };

  /// Get a table by id.
  public func getTable(state : State, id : TableId) : ?Table {
    state.tables.get(id);
  };

  /// Look up a table by restaurantId and tableNumber.
  public func getTableByRestaurantAndNumber(state : State, restaurantId : RestaurantId, tableNumber : Text) : ?Table {
    state.tables.values().find(func(t : Table) : Bool {
      t.restaurantId == restaurantId and t.tableNumber == tableNumber;
    });
  };

  /// List all tables belonging to a given restaurant.
  public func listTablesByRestaurant(state : State, restaurantId : RestaurantId) : [Table] {
    state.tables.values()
      |> _.filter(func(t : Table) : Bool { t.restaurantId == restaurantId })
      |> _.toArray();
  };
};
