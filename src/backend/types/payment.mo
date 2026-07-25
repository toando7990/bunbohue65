// Payment domain types
import CommonTypes "common";

module {
  public type PaymentStatus = {
    #Unpaid;
    #Pending;
    #Paid;
    #Failed;
    #SepayPending;  // deprecated — kept for stable compatibility, no longer set by new code
    #SepayPaid;     // deprecated — kept for stable compatibility, no longer set by new code
    #SepayExpired;  // deprecated — kept for stable compatibility, no longer set by new code
    #WaitingDriverPayment; // COD order placed — waiting for AhaMove driver to arrive and pay at kiosk
    #TingeePending;  // waiting for Tingee VietQR payment confirmation
    #TingeePaid;     // confirmed paid via Tingee webhook callback
    #TingeeExpired;  // QR code expired after 15 minutes without payment
  };

  public type PaymentMethod = {
    #CustomerOnline;
    #CashierTerminal;
    #BankTransfer;
    #ApplePay;
    #CreditCard;
    #SepayQR;  // deprecated — kept for stable compatibility, no longer set by new code
    #TingeeQR;
    #Stripe;
    #Cod;
  };

  public type PaymentInfo = {
    var paymentStatus : PaymentStatus;
    var paymentMethod : ?PaymentMethod;
    var stripePaymentIntentId : ?Text;
    var paidAt : ?CommonTypes.Timestamp;
  };
};
