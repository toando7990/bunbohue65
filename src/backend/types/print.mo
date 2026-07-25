// Print types — bill printing for kiosk orders with BKAV e-invoice info
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Time "mo:core/Time";

module {
  /// A line item on the printed bill
  public type BillItem = {
    name     : Text;
    quantity : Nat;
    price    : Nat;
    total    : Nat;
  };

  /// Payment method used for the order
  public type PaymentMethod = {
    #Cash;
    #BankTransfer;
    #Card;
    #Other : Text;
  };

  /// BKAV e-invoice (HĐĐT) information to display on the bill
  public type BkavInvoiceInfo = {
    invoiceNo      : Text;
    lookupCode     : Text;
    cqtCode        : Text;
    issueDate      : Text;
    vatRate        : Nat;
    vatAmount      : Nat;
    totalAfterTax  : Nat;
  };

  /// Complete kiosk bill ready for printing
  public type KioskBill = {
    // Header
    logoUrl        : Text;
    restaurantName : Text;
    restaurantAddr : Text;
    restaurantPhone: Text;
    orderCode      : Text;
    createdAt      : Text;
    tableName      : ?Text;

    // Items
    items          : [BillItem];
    itemCount      : Nat;

    // Totals
    subtotal       : Nat;
    vatRate        : Nat;
    vatAmount      : Nat;
    total          : Nat;

    // Payment
    paymentMethod  : PaymentMethod;
    amountPaid     : Nat;
    changeDue      : Nat;

    // BKAV e-invoice
    invoiceInfo    : ?BkavInvoiceInfo;

    // Footer
    thankYouMsg    : Text;
    website        : Text;
  };
};
