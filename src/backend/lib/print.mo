// Print domain logic — build kiosk bills from orders and business profile
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Time "mo:core/Time";
import Option "mo:core/Option";
import Debug "mo:core/Debug";

import OrderTypes "../types/order";
import CommonTypes "../types/common";
import PrintTypes "../types/print";
import PaymentTypes "../types/payment";

module {
  public type Order       = OrderTypes.Order;
  public type OrderItem   = OrderTypes.OrderItem;
  public type OrderStatus = OrderTypes.OrderStatus;
  public type PaymentInfo = PaymentTypes.PaymentInfo;
  public type BusinessProfile = CommonTypes.BusinessProfile;
  public type KioskBill   = PrintTypes.KioskBill;
  public type BillItem    = PrintTypes.BillItem;
  public type BkavInvoiceInfo = PrintTypes.BkavInvoiceInfo;
  public type PaymentMethod = PrintTypes.PaymentMethod;

  /// Format a timestamp (nanoseconds) to Vietnamese date-time string
  public func formatTimestamp(ts : Int) : Text {
    // Simple formatting: dd/mm/yyyy hh:mm
    // For production, use a proper date library or format in frontend
    let seconds = ts / 1_000_000_000;
    let minutes = seconds / 60;
    let hours = minutes / 60;
    let _days = hours / 24;
    // This is a simplified placeholder - real implementation would use proper date math
    ""
  };

  /// Convert an OrderItem to a BillItem
  public func toBillItem(item : OrderItem) : BillItem {
    let qty = item.quantity;
    let price = item.price;
    let total = qty * price;
    {
      name     = item.name;
      quantity = qty;
      price    = price;
      total    = total;
    };
  };

  /// Determine payment method from payment info
  /// Determine payment method from payment info
  public func toPaymentMethod(paymentInfo : ?PaymentInfo) : PaymentMethod {
    switch (paymentInfo) {
      case null #Cash;
      case (?info) {
        switch (info.paymentMethod) {
          case (?#CustomerOnline) #BankTransfer;
          case (?#CashierTerminal) #Cash;
          case (?#BankTransfer) #BankTransfer;
          case (?#ApplePay) #Card;
          case (?#CreditCard) #Card;
          case (?#TingeeQR) #BankTransfer;
          case (?#Stripe) #Card;
          case (?#Cod) #Cash;
          case null #Cash;
        };
      };
    };
  };

  /// Build BKAV invoice info from order if available
  /// Build BKAV invoice info from order if available
  public func buildInvoiceInfo(order : Order, vatRate : Nat) : ?BkavInvoiceInfo {
    switch (order.invoiceNo, order.maTraCuu, order.maCQT) {
      case (?invoiceNo, ?lookupCode, ?cqtCode) {
        let subtotal = switch (order.subtotal) { case (?s) s; case null 0 };
        let vatAmount = (subtotal * vatRate) / 100;
        let totalAfterTax = subtotal + vatAmount;
        ?{
          invoiceNo     = invoiceNo;
          lookupCode    = lookupCode;
          cqtCode       = cqtCode;
          issueDate     = formatTimestamp(order.createdAt);
          vatRate       = vatRate;
          vatAmount     = vatAmount;
          totalAfterTax = totalAfterTax;
        };
      };
      case _ null;
    };
  };

  /// Build a complete KioskBill from an order and business profile
  /// Build a complete KioskBill from an order and business profile
  public func buildKioskBill(
    order : Order,
    profile : BusinessProfile,
    restaurantName : Text,
    restaurantAddr : Text,
    restaurantPhone : Text,
  ) : KioskBill {
    let items = order.items;
    let billItems = items.map(toBillItem);
    let itemCount = items.size();
    let subtotal = switch (order.subtotal) { case (?s) s; case null 0 };
    let vatRate = profile.bkavVatRate;
    let vatAmount = (subtotal * vatRate) / 100;
    let total = subtotal + vatAmount;
    let paymentMethod = toPaymentMethod(?order.paymentInfo);
    let amountPaid = total; // For now, assume full payment
    let changeDue = 0; // For now, no change calculation

    let invoiceInfo = buildInvoiceInfo(order, vatRate);

    {
      logoUrl         = profile.logoUrl;
      restaurantName  = restaurantName;
      restaurantAddr  = restaurantAddr;
      restaurantPhone = restaurantPhone;
      orderCode       = order.orderCode.get("");
      createdAt       = formatTimestamp(order.createdAt);
      tableName       = ?order.tableIdentifier;
      items           = billItems;
      itemCount       = itemCount;
      subtotal        = subtotal;
      vatRate         = vatRate;
      vatAmount       = vatAmount;
      total           = total;
      paymentMethod   = paymentMethod;
      amountPaid      = amountPaid;
      changeDue       = changeDue;
      invoiceInfo     = invoiceInfo;
      thankYouMsg     = "Cảm ơn quý khách!";
      website         = "www.bunbohue65.vn";
    };
  };
};
