

import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";

import OQL "mo:caffeineai-oql";
import Expose "mo:caffeineai-oql/Expose";
import Entity "mo:caffeineai-oql/Entity";
import TextValue "mo:caffeineai-oql/TextValue";
import NatValue "mo:caffeineai-oql/NatValue";
import IntValue "mo:caffeineai-oql/IntValue";
import BoolValue "mo:caffeineai-oql/BoolValue";
import FloatValue "mo:caffeineai-oql/FloatValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import MapEntity "mo:caffeineai-oql/MapEntity";
import RecordValue "mo:caffeineai-oql/RecordValue";
import ListEntity "mo:caffeineai-oql/ListEntity";

import RestaurantManager "RestaurantManager";
import MenuManager "MenuManager";
import TableManager "TableManager";
import OrderLib "lib/orders";
import RestaurantsMixin "mixins/restaurant-api";
import MenuMixin "mixins/menu-api";
import TablesMixin "mixins/table-api";
import OrdersMixin "mixins/orders-api";
import ReservationLib "lib/reservations";
import ReservationsMixin "mixins/reservation-api";
import AnalyticsMixin "mixins/analytics-api";
import DeveloperMixin "mixins/developer-api";
import CommonTypes "types/common";
import BusinessProfileLib "lib/business-profile";
import BusinessProfileMixin "mixins/business-profile-api";
import RestaurantLocationMixin "mixins/restaurant-location-api";
import EnterpriseDeliveryMixin "mixins/enterprise-delivery-api";
import ShipperApiMixin "mixins/shipper-api";
import HttpMixin "mixins/http-api";
import BkavInvoiceMixin "mixins/bkav-invoice-api";
import KioskDevicesMixin "mixins/kiosk-devices-api";
import EnterpriseStaffMixin "mixins/enterprise-staff-api";
import EnterpriseDevicesMixin "mixins/enterprise-devices-api";
import MasterMenuManager "MasterMenuManager";
import MasterMenuMixin "mixins/master-menu-api";

import Cycles "mo:core/Cycles";




import TingeeApiMixin "mixins/tingee-api";
import KioskBackgroundMixin "mixins/kiosk-background-api";
  import _KBTypes "types/kiosk-background";
import KBLib "lib/kiosk-background";
import PrintMixin "mixins/print-api";
import _PrintLib "lib/print";
import _PrintTypes "types/print";
import CodApiMixin "mixins/cod-api";
import DynamicQRApiMixin "mixins/dynamic-qr-api";
import DynamicQRLib "lib/dynamic-qr";
import DynamicQRTypes "types/dynamic-qr";
import WorkerHeartbeatApiMixin "mixins/worker-heartbeat-api";
import WorkerHeartbeatLib "lib/worker-heartbeat";
import WorkerHeartbeatTypes "types/worker-heartbeat";






















































































































  
   
  
  
  
     actor Self {
  // Schema version tracking — bumped to 9 for adding tingeeBankBin and
  // tingeeMerchantId to the BusinessProfile type. An explicit migration
  // (migration.mo) maps over the existing BusinessProfile and initializes
  // tingeeBankBin = null and tingeeMerchantId = null on the existing record.
  // All other stable fields (including dynamicQRStore) pass through
  // unchanged.
  transient let schemaVersion : Nat = 9;

   var restaurantState : RestaurantManager.State;
   var menuState : MenuManager.State;
   var masterMenuState : MasterMenuManager.State;
   var tableState : TableManager.State;
   var orders : Map.Map<OrderLib.OrderId, OrderLib.Order>;
   var orderState : { var nextOrderId : OrderLib.OrderId };
   var dynamicQRStore : Map.Map<OrderLib.OrderId, DynamicQRLib.DynamicQRRecord>;
   var reservations : Map.Map<ReservationLib.ReservationId, ReservationLib.Reservation>;
   var reservationState : { var nextReservationId : ReservationLib.ReservationId };

   var developerProfiles : Map.Map<Principal, CommonTypes.DeveloperProfile>;
   // bpStateStable is the durable stable variable — survives canister upgrades
   // so business-profile fields persist across redeployments. Under enhanced
   // migration, stable vars carry no initializer; the migration chain in
   // src/backend/migrations/ supplies the initial (and upgraded) value.
   var bpStateStable : BusinessProfileLib.State;
  // Non-stable derived binding for read access in the actor body; existing call
  // sites using `bpState` keep working unchanged. Re-bound on every actor init
  // (including postupgrade) from the current value of bpStateStable.
  transient let bpState = bpStateStable;

  // Kiosk device state
   var kioskDevices        : Map.Map<Text, CommonTypes.DeviceRecord>;
   var kioskActivationIndex : Map.Map<Text, Text>;
   var kioskDeviceCounter  : { var count : Nat };

  // Enterprise delivery state

   var staffRestaurantFilter    : Map.Map<Principal, [CommonTypes.RestaurantId]>;

  // Enterprise staff permissions state
   var enterpriseStaffPermissions : Map.Map<Principal, CommonTypes.EnterpriseStaffPermissions>;

  // Enterprise office device state
   var enterpriseDevices      : Map.Map<Text, CommonTypes.EnterpriseDeviceRecord>;
   var enterpriseActivationIndex : Map.Map<Text, Text>;
   var enterpriseDevCounter   : { var count : Nat };
  // Kiosk background images and suggestion config state
   var kbState : _KBTypes.KioskBackgroundState;

  // Worker heartbeat + retry policy state — durable stable var. Tracks
  // lastHeartbeatAt per worker (keyed by WorkerId Text; only "ahamove" is
  // written in this build) and the owner-configurable retry policy. Seeded
  // by the migration chain (20260724_155536.mo) on fresh install / upgrade.
  var workerHeartbeatState : WorkerHeartbeatLib.State;


  // Developer principal fixed at compile time (matches the hardcoded dev ID)
  transient let DEV_PRINCIPAL = Principal.fromText("tmr4q-fxalm-yjrhb-qlmwj-5pvxj-kpc3y-gaz6a-763y4-wsfn4-e6geo-jae");

  func getBusinessOwnerPrincipalId() : Principal {
    // Fast path: profile keyed by the current DEV_PRINCIPAL.
    switch (developerProfiles.get(DEV_PRINCIPAL)) {
      case (?p) return p.businessOwnerPrincipalId;
      case null {};
    };
    // Fallback: the profile may have been upserted by an OLD developer
    // principal (upsertDeveloperProfile keys by caller, not by DEV_PRINCIPAL).
    // Scan the map for ANY existing DeveloperProfile and use its
    // businessOwnerPrincipalId so isAuthorized still matches the real owner.
    switch (developerProfiles.entries().find(func ((_, p)) = true)) {
      case (?(_, p)) p.businessOwnerPrincipalId;
      case null DEV_PRINCIPAL; // no profile at all: only developer can act
    };
  };

  include MasterMenuMixin(masterMenuState, restaurantState, getBusinessOwnerPrincipalId);
  include RestaurantsMixin(restaurantState, bpState);
  include RestaurantLocationMixin(restaurantState);
  include MenuMixin(menuState, restaurantState);
  include TablesMixin(tableState, restaurantState);
  include ReservationsMixin(reservations, reservationState, enterpriseStaffPermissions, getBusinessOwnerPrincipalId);
  include AnalyticsMixin(orders, enterpriseStaffPermissions, getBusinessOwnerPrincipalId);
  include KioskDevicesMixin(kioskDevices, kioskActivationIndex, kioskDeviceCounter, enterpriseStaffPermissions, getBusinessOwnerPrincipalId);
  include EnterpriseStaffMixin(enterpriseStaffPermissions, getBusinessOwnerPrincipalId);
  include EnterpriseDevicesMixin(enterpriseDevices, enterpriseActivationIndex, enterpriseDevCounter, enterpriseStaffPermissions, getBusinessOwnerPrincipalId);
  include KioskBackgroundMixin(kbState, getBusinessOwnerPrincipalId);
  include EnterpriseDeliveryMixin(orders, orderState, enterpriseStaffPermissions, staffRestaurantFilter, getBusinessOwnerPrincipalId, restaurantState);
  include DeveloperMixin(developerProfiles);
  include ShipperApiMixin(orders, orderState, restaurantState, bpState, enterpriseStaffPermissions, getBusinessOwnerPrincipalId);
  include WorkerHeartbeatApiMixin(workerHeartbeatState, bpState, getBusinessOwnerPrincipalId);

  include BkavInvoiceMixin(orders, orderState, bpState, enterpriseStaffPermissions, getBusinessOwnerPrincipalId);
  func bookAhamoveShipperWrapper(id : Text) : async { #ok : { ahamoveOrderId : Text; status : Text; fare : Nat }; #err : Text } {
    await bookAhamoveShipper(id);
  };
  // Wrapper: non-delivery flows always issue VAT invoice (invoiceEnabled = true)
  func issueBkavInvoiceAlways(order : OrderLib.Order) : async () {
    await issueBkavInvoice(order, order.vatRequest);
  };
  include TingeeApiMixin(orders, orderState, bpState, getBusinessOwnerPrincipalId, enterpriseStaffPermissions, verifyDeviceToken);
  include BusinessProfileMixin(bpState, DEV_PRINCIPAL, getBusinessOwnerPrincipalId);
  include PrintMixin(orders, bpState, restaurantState, enterpriseStaffPermissions, getBusinessOwnerPrincipalId);
include OrdersMixin(orders, orderState, restaurantState, bpState, enterpriseStaffPermissions, getBusinessOwnerPrincipalId, func() : async Principal { Principal.fromActor(Self) }, issueBkavInvoiceAlways, bookAhamoveShipperWrapper, verifyDeviceToken, dynamicQRStore);
  include DynamicQRApiMixin(orders, orderState, bpState, dynamicQRStore, getBusinessOwnerPrincipalId, enterpriseStaffPermissions);
  include CodApiMixin(orders, orderState, bpState, enterpriseStaffPermissions, getBusinessOwnerPrincipalId, issueBkavInvoiceAlways, bookAhamoveShipperWrapper);
  include HttpMixin(receiveTingeeWebhook, handleInvoiceCallback);

  // ── OQL data-intelligence layer ─────────────────────────────────────────
  // Exposes 22 queryable entities via schema() and execute(). Each entity
  // declares its own authorization level. The Expose mixin adds ONLY the
  // two OQL query methods — no existing state, types, or endpoints change.
  transient let anyP = Principal.fromText("aaaaa-aa"); // sample principal for schema seeding

  // Helpers: render option values as primitives with sentinel values for null,
  // so OQL's _toRow implicit conversion (which only exists for primitives:
  // Text, Nat, Int, Float, Bool, Principal) can convert them to OQL.Value.
  func optText(t : ?Text) : Text = switch t { case null ""; case (?v) v };
  func optNat(n : ?Nat) : Nat = switch n { case null 0; case (?v) v };
  func optFloat(f : ?Float) : Float = switch f { case null 0.0; case (?v) v };
  func optInt(i : ?Int) : Int = switch i { case null 0; case (?v) v };

  include Expose({
    entities = [
      // ── #public_ entities ──────────────────────────────────────────────

      // Restaurant — complex record with many ?Text/?Float/?Nat + variant fields → manual
      OQL.Entity.manual<RestaurantManager.Restaurant>("restaurant", func () = restaurantState.restaurants.values(), "Restaurant", "id")
        .payload("id", func (r) = r.id)
        .payload("name", func (r) = r.name)
        .payload("ownerId", func (r) = r.ownerId)
        .payload("stripeEnabled", func (r) = r.stripeEnabled)
        .payload("autoPaymentConfirmationEnabled", func (r) = r.autoPaymentConfirmationEnabled)
        .payload("autoPaymentConfirmationApp", func (r) = switch (r.autoPaymentConfirmationApp) { case (#None) "None"; case (#Sepay) "Sepay"; case (#Tingee) "Tingee" })
        .payload("bannerImageUrl", func (r) = optText(r.bannerImageUrl))
        .payload("tableServiceHours", func (r) = optText(r.tableServiceHours))
        .payload("deliveryServiceHours", func (r) = optText(r.deliveryServiceHours))
        .payload("brand1Name", func (r) = optText(r.brand1Name))
        .payload("brand2Name", func (r) = optText(r.brand2Name))
        .payload("brand3Name", func (r) = optText(r.brand3Name))
        .payload("brand4Name", func (r) = optText(r.brand4Name))
        .payload("brand5Name", func (r) = optText(r.brand5Name))
        .payload("coordinateLatitude", func (r) = optFloat(r.coordinateLatitude))
        .payload("coordinateLongitude", func (r) = optFloat(r.coordinateLongitude))
        .payload("deliveryRadiusKm", func (r) = optNat(r.deliveryRadiusKm))
        .payload("address", func (r) = r.address)
        .payload("autoShipperEnabled", func (r) = r.autoShipperEnabled)
        .payload("shippingFeeMode", func (r) = optText(switch (r.shippingFeeMode) { case null null; case (?m) ?(switch (m) { case (#CustomerPays) "CustomerPays"; case (#RestaurantPays) "RestaurantPays" }) }))
        .payload("driverDispatchMode", func (r) = switch (r.driverDispatchMode) { case (#InStore) "InStore"; case (#Central) "Central" })
        .public_()
        .build(),

      // MenuCategory — all-primitive record → auto-derive
      menuState.categories.toEntity("menuCategory", "MenuCategory", "id")
        .sample({ id = 0; restaurantId = 0; name = ""; position = 0 })
        .public_()
        .build(),

      // MenuItem — has ?Text fields → manual
      OQL.Entity.manual<MenuManager.MenuItem>("menuItem", func () = menuState.items.values(), "MenuItem", "id")
        .payload("id", func (i) = i.id)
        .payload("restaurantId", func (i) = i.restaurantId)
        .payload("categoryId", func (i) = i.categoryId)
        .payload("name", func (i) = i.name)
        .payload("description", func (i) = i.description)
        .payload("price", func (i) = i.price)
        .payload("imageUrl", func (i) = optText(i.imageUrl))
        .payload("available", func (i) = i.available)
        .payload("unit", func (i) = optText(i.unit))
        .public_()
        .build(),

      // MasterMenuItem — has ?Text fields → manual
      OQL.Entity.manual<MasterMenuManager.MasterMenuItem>("masterMenuItem", func () = masterMenuState.masterItems.values(), "MasterMenuItem", "id")
        .payload("id", func (i) = i.id)
        .payload("categoryId", func (i) = i.categoryId)
        .payload("name", func (i) = i.name)
        .payload("description", func (i) = i.description)
        .payload("price", func (i) = i.price)
        .payload("imageUrl", func (i) = optText(i.imageUrl))
        .payload("unit", func (i) = optText(i.unit))
        .payload("position", func (i) = i.position)
        .payload("isActive", func (i) = i.isActive)
        .public_()
        .build(),

      // MasterMenuCategory — all-primitive → auto-derive
      masterMenuState.masterCategories.toEntity("masterMenuCategory", "MasterMenuCategory", "id")
        .sample({ id = 0; name = ""; position = 0 })
        .public_()
        .build(),

      // RestaurantMenuOverride — Map<(Nat, Nat), Bool> → manual over .entries(),
      // promoting both tuple keys as fields and the Bool as isAvailable.
      OQL.Entity.manual<((Nat, Nat), Bool)>("restaurantMenuOverride", func () = masterMenuState.restaurantOverrides.entries(), "RestaurantMenuOverride", "masterItemId")
        .payload("masterItemId", func ((masterItemId, _), _) = masterItemId)
        .payload("restaurantId", func ((_, restaurantId), _) = restaurantId)
        .payload("isAvailable", func (_, isAvailable) = isAvailable)
        .controllerOnly()
        .build(),

      // Table — all-primitive → auto-derive
      tableState.tables.toEntity("table", "Table", "id")
        .sample({ id = 0; restaurantId = 0; tableNumber = ""; qrCodeUrl = "" })
        .public_()
        .build(),

      // KioskBackgroundImage — all-primitive → manual (kbState.backgroundImages is a var field,
      // so we read it live via closure rather than capturing the array at build time)
      OQL.Entity.manual<KBLib.BackgroundImage>("kioskBackgroundImage", func () = kbState.backgroundImages.values(), "BackgroundImage", "id")
        .payload("id", func (b) = b.id)
        .payload("url", func (b) = b.url)
        .payload("fileName", func (b) = b.fileName)
        .payload("uploadedAt", func (b) = b.uploadedAt)
        .payload("isDefault", func (b) = b.isDefault)
        .public_()
        .build(),

      // ── #controllerOnly entities ───────────────────────────────────────

      // Order — complex record with variants, ?Text, ?Float, ?Nat, ?Int, [OrderItem] → manual
      OQL.Entity.manual<OrderLib.Order>("order", func () = orders.values(), "Order", "id")
        .payload("id", func (o) = o.id)
        .payload("restaurantId", func (o) = o.restaurantId)
        .payload("tableIdentifier", func (o) = o.tableIdentifier)
        .payload("orderType", func (o) = switch (o.orderType) { case (#TableOrder) "TableOrder"; case (#DeliveryOrder) "DeliveryOrder" })
        .payload("deliveryAddress", func (o) = optText(o.deliveryAddress))
        .payload("deliveryLat", func (o) = optFloat(o.deliveryLat))
        .payload("deliveryLng", func (o) = optFloat(o.deliveryLng))
        .payload("customerName", func (o) = optText(o.customerName))
        .payload("customerPhone", func (o) = optText(o.customerPhone))
        .payload("itemCount", func (o) = o.items.size())
        .payload("status", func (o) = switch (o.status) {
          case (#Cancelled) "Cancelled"; case (#Completed) "Completed"; case (#Delivered) "Delivered";
          case (#DispatchCenter) "DispatchCenter"; case (#FindingDriver) "FindingDriver";
          case (#PaymentPending) "PaymentPending"; case (#Pending) "Pending"; case (#PendingApproval) "PendingApproval";
          case (#Preparing) "Preparing"; case (#Ready) "Ready"; case (#WaitingDriver) "WaitingDriver";
          case (#WaitingDriverPayment) "WaitingDriverPayment";
        })
        .payload("notes", func (o) = optText(o.notes))
        .payload("createdAt", func (o) = o.createdAt)
        .payload("paymentStatus", func (o) = switch (o.paymentInfo.paymentStatus) {
          case (#Unpaid) "Unpaid"; case (#Pending) "Pending"; case (#Paid) "Paid"; case (#Failed) "Failed";
          case (#SepayPending) "SepayPending"; case (#SepayPaid) "SepayPaid"; case (#SepayExpired) "SepayExpired";
          case (#TingeePending) "TingeePending"; case (#TingeePaid) "TingeePaid"; case (#TingeeExpired) "TingeeExpired";
          case (#WaitingDriverPayment) "WaitingDriverPayment";
        })
        .payload("paymentMethod", func (o) = optText(switch (o.paymentInfo.paymentMethod) {
          case null null; case (?m) ?(switch (m) {
            case (#CustomerOnline) "CustomerOnline"; case (#CashierTerminal) "CashierTerminal";
            case (#BankTransfer) "BankTransfer"; case (#ApplePay) "ApplePay"; case (#CreditCard) "CreditCard";
            case (#SepayQR) "SepayQR"; case (#TingeeQR) "TingeeQR"; case (#Stripe) "Stripe"; case (#Cod) "Cod";
          })
        }))
        .payload("transactionCode", func (o) = optText(o.transactionCode))
        .payload("paymentConfirmedAt", func (o) = optInt(o.paymentConfirmedAt))
        .payload("shipperName", func (o) = optText(o.shipperName))
        .payload("shipperPhone", func (o) = optText(o.shipperPhone))
        .payload("shipperOrderId", func (o) = optText(o.shipperOrderId))
        .payload("shippingFee", func (o) = optNat(o.shippingFee))
        .payload("shippingProvider", func (o) = optText(o.shippingProvider))
        .payload("shippingStatus", func (o) = optText(switch (o.shippingStatus) { case null null; case (?s) ?(switch (s) { case (#SearchingShipper) "SearchingShipper"; case (#ShipperAccepted) "ShipperAccepted"; case (#PickedUp) "PickedUp"; case (#Delivering) "Delivering"; case (#DeliveryFailed) "DeliveryFailed" }) }))
        .payload("vatRequest", func (o) = o.vatRequest)
        .payload("invoiceNo", func (o) = optText(o.invoiceNo))
        .payload("invoiceDate", func (o) = optText(o.invoiceDate))
        .payload("invoiceStatus", func (o) = switch (o.invoiceStatus) { case (#NotRequested) "NotRequested"; case (#Pending) "Pending"; case (#Issued) "Issued"; case (#Error) "Error" })
        .payload("isCod", func (o) = o.isCod)
        .payload("subtotal", func (o) = optNat(o.subtotal))
        .controllerOnly()
        .build(),

      // Reservation — has ?Text, ?TableId, variant → manual
      OQL.Entity.manual<ReservationLib.Reservation>("reservation", func () = reservations.values(), "Reservation", "id")
        .payload("id", func (r) = r.id)
        .payload("restaurantId", func (r) = r.restaurantId)
        .payload("customerName", func (r) = r.customerName)
        .payload("customerPhone", func (r) = r.customerPhone)
        .payload("partySize", func (r) = r.partySize)
        .payload("date", func (r) = r.date)
        .payload("timeSlot", func (r) = r.timeSlot)
        .payload("durationMinutes", func (r) = r.durationMinutes)
        .payload("tableId", func (r) = optNat(switch (r.tableId) { case null null; case (?t) ?t }))
        .payload("status", func (r) = switch (r.status) { case (#Pending) "Pending"; case (#Confirmed) "Confirmed"; case (#Arrived) "Arrived"; case (#Cancelled) "Cancelled" })
        .payload("notes", func (r) = optText(r.notes))
        .payload("customerEmail", func (r) = optText(r.customerEmail))
        .payload("createdAt", func (r) = r.createdAt)
        .controllerOnly()
        .build(),

      // DeveloperProfile — all-primitive (Principal has _toRow) → auto-derive
      developerProfiles.toEntity("developerProfile", "DeveloperProfile", "developerPrincipalId")
        .sample({ developerPrincipalId = anyP; businessOwnerPrincipalId = anyP; email = "" })
        .controllerOnly()
        .build(),

      // BusinessProfile — single record with many ?Text/?Nat/?CodSettings → manual
      // (iterate a 1-element array containing the live profile)
      OQL.Entity.manual<BusinessProfileLib.BusinessProfile>("businessProfile", func () = [bpState.profile].values(), "BusinessProfile", "logoUrl")
        .payload("logoUrl", func (p) = p.logoUrl)
        .payload("businessName", func (p) = optText(p.businessName))
        .payload("address", func (p) = optText(p.address))
        .payload("email", func (p) = optText(p.email))
        .payload("domain", func (p) = optText(p.domain))
        .payload("brandLogo", func (p) = optText(p.brandLogo))
        .payload("invoiceProvider", func (p) = p.invoiceProvider)
        .payload("bkavVatRate", func (p) = p.bkavVatRate)
        .payload("accountNumber", func (p) = optText(p.accountNumber))
        .payload("bankName", func (p) = optText(p.bankName))
        .payload("accountHolderName", func (p) = optText(p.accountHolderName))
        .payload("tingeeClientId", func (p) = optText(p.tingeeClientId))
        .payload("tingeeBankBin", func (p) = optText(p.tingeeBankBin))
        .payload("tingeeMerchantId", func (p) = optText(p.tingeeMerchantId))
        .payload("tingeeOrderPrefix", func (p) = p.tingeeOrderPrefix)
        .payload("bkavInvoiceSerial", func (p) = optText(p.bkavInvoiceSerial))
        .payload("bkavProdInvoiceSerial", func (p) = optText(p.bkavProdInvoiceSerial))
        .payload("bkavInvoiceForm", func (p) = optText(p.bkavInvoiceForm))
        .payload("taxCode", func (p) = optText(p.taxCode))
        .payload("phone", func (p) = optText(p.phone))
        .payload("invoiceCallbackSecret", func (p) = optText(p.invoiceCallbackSecret))
        .payload("realGuid", func (p) = optText(p.realGuid))
        .payload("realToken", func (p) = optText(p.realToken))
        .payload("realApiUrl", func (p) = optText(p.realApiUrl))
        .payload("ahamoveApiKey", func (p) = optText(p.ahamoveApiKey))
        .payload("ahamoveMobile", func (p) = optText(p.ahamoveMobile))
        .payload("workerPrincipal", func (p) = optText(p.workerPrincipal))
        .payload("codSettings", func (p) = optText(switch (p.codSettings) { case null null; case (?c) ?("isCodAllowed=" # (if (c.isCodAllowed) "true" else "false") # ",codLimit=" # c.codLimit.toText()) }))
        .controllerOnly()
        .build(),

      // BannerImage — all-primitive → auto-derive (List)
      bpState.bannerImages.toEntity("bannerImage", "BannerImage", "id")
        .sample({ id = 0; var imageUrl = ""; var sortOrder = 0 })
        .controllerOnly()
        .build(),

      // KioskDevice (DeviceRecord) — has StaffRole + status variant → manual
      OQL.Entity.manual<CommonTypes.DeviceRecord>("kioskDevice", func () = kioskDevices.values(), "DeviceRecord", "deviceId")
        .payload("deviceId", func (d) = d.deviceId)
        .payload("restaurantId", func (d) = d.restaurantId)
        .payload("role", func (d) = switch (d.role) { case (#Admin) "Admin"; case (#Kitchen) "Kitchen"; case (#Waiter) "Waiter"; case (#Cashier) "Cashier"; case (#Delivery) "Delivery"; case (#KioskOrder) "KioskOrder" })
        .payload("deviceName", func (d) = d.deviceName)
        .payload("activationCode", func (d) = d.activationCode)
        .payload("codeExpiry", func (d) = d.codeExpiry)
        .payload("status", func (d) = switch (d.status) { case (#active) "active"; case (#revoked) "revoked" })
        .payload("createdAt", func (d) = d.createdAt)
        .payload("lastUsedAt", func (d) = d.lastUsedAt)
        .controllerOnly()
        .build(),

      // KioskActivation — Map<Text, Text>, identity in key → manual, promote key
      OQL.Entity.manual<(Text, Text)>("kioskActivation", func () = kioskActivationIndex.entries(), "KioskActivation", "activationCode")
        .payload("activationCode", func ((k, _)) = k)
        .payload("deviceId", func ((_, v)) = v)
        .controllerOnly()
        .build(),

      // StaffRestaurantFilter — Map<Principal, [RestaurantId]> → manual, promote key
      OQL.Entity.manual<(Principal, [CommonTypes.RestaurantId])>("staffRestaurantFilter", func () = staffRestaurantFilter.entries(), "StaffRestaurantFilter", "principal")
        .payload("principal", func ((p, _)) = p)
        .payload("restaurantCount", func ((_, rs)) = rs.size())
        .controllerOnly()
        .build(),

      // EnterpriseStaffPermissions — has [EnterprisePermission] variant field → manual
      OQL.Entity.manual<CommonTypes.EnterpriseStaffPermissions>("enterpriseStaffPermissions", func () = enterpriseStaffPermissions.values(), "EnterpriseStaffPermissions", "principalId")
        .payload("principalId", func (s) = s.principalId)
        .payload("permissionCount", func (s) = s.permissions.size())
        .controllerOnly()
        .build(),

      // EnterpriseDevice (EnterpriseDeviceRecord) — has variant fields → manual
      OQL.Entity.manual<CommonTypes.EnterpriseDeviceRecord>("enterpriseDevice", func () = enterpriseDevices.values(), "EnterpriseDeviceRecord", "deviceId")
        .payload("deviceId", func (d) = d.deviceId)
        .payload("role", func (d) = switch (d.role) { case (#EnterpriseDelivery) "EnterpriseDelivery"; case (#CustomerSupport) "CustomerSupport"; case (#Accounting) "Accounting" })
        .payload("deviceName", func (d) = d.deviceName)
        .payload("activationCode", func (d) = optText(d.activationCode))
        .payload("codeExpiry", func (d) = optInt(d.codeExpiry))
        .payload("status", func (d) = switch (d.status) { case (#Active) "Active"; case (#Revoked) "Revoked" })
        .payload("registeredAt", func (d) = d.registeredAt)
        .controllerOnly()
        .build(),

      // EnterpriseActivation — Map<Text, Text>, identity in key → manual, promote key
      OQL.Entity.manual<(Text, Text)>("enterpriseActivation", func () = enterpriseActivationIndex.entries(), "EnterpriseActivation", "activationCode")
        .payload("activationCode", func ((k, _)) = k)
        .payload("deviceId", func ((_, v)) = v)
        .controllerOnly()
        .build(),

      // SuggestionConfig — single record, all-primitive → manual over a 1-element array
      OQL.Entity.manual<KBLib.SuggestionConfig>("suggestionConfig", func () = [kbState.suggestionConfig].values(), "SuggestionConfig", "suggestionsEnabled")
        .payload("suggestionsEnabled", func (c) = c.suggestionsEnabled)
        .payload("maxAddOns", func (c) = c.maxAddOns)
        .payload("maxDrinks", func (c) = c.maxDrinks)
        .controllerOnly()
        .build(),

      // ── #controllerOrScoped entity ─────────────────────────────────────

      // SavedRecipientInfo — owner-keyed Map<Principal, SavedRecipientInfo>;
      // promote the key as owner with #controllerOrScoped so each user reads
      // only their own saved recipient info, while the controller reads all.
      OQL.Entity.manual<(Principal, BusinessProfileLib.SavedRecipientInfo)>("savedRecipientInfo", func () = bpState.savedRecipients.entries(), "SavedRecipientInfo", "owner")
        .payload("owner", func ((p, _)) = p)
        .payload("recipientName", func ((_, r)) = r.recipientName)
        .payload("recipientPhone", func ((_, r)) = r.recipientPhone)
        .payload("locationName", func ((_, r)) = r.locationName)
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),

      // DynamicQRRecord — keyed by OrderId; expose qrId, qrString, status,
      // billId, idempotencyKey, orderId, createdAt, expiresAt, totalAmountPaid,
      // transactionInfos. Variant status and ?Timestamp expiresAt are rendered
      // as Text/Nat via helpers. transactionInfos is a [TransactionInfo] array
      // (ĐỐI SOÁT ONLY — không confirm) exposed as a count per OQL guidance
      // for collection fields. Per-table authorization: #controllerOnly —
      // sensitive payment data restricted to owner/developer only.
      OQL.Entity.manual<DynamicQRLib.DynamicQRRecord>("dynamicQRRecord", func () = dynamicQRStore.values(), "DynamicQRRecord", "qrId")
        .payload("qrId", func (q) = q.qrId)
        .payload("qrString", func (q) = q.qrString)
        .payload("status", func (q) = switch (q.status) { case (#pending) "pending"; case (#paid) "paid"; case (#expired) "expired"; case (#deleted) "deleted" })
        .payload("billId", func (q) = q.billId)
        .payload("idempotencyKey", func (q) = q.idempotencyKey)
        .payload("orderId", func (q) = q.orderId)
        .payload("createdAt", func (q) = q.createdAt)
        .payload("expiresAt", func (q) = optInt(q.expiresAt))
        .payload("totalAmountPaid", func (q) = q.totalAmountPaid)
        .payload("transactionInfosCount", func (q) = q.transactionInfos.size())
        .controllerOnly()
        .build(),

      // WorkerHeartbeat — per-worker lastHeartbeatAt + alive flag (computed
      // against the 60s staleness threshold). Owner-only (controllerOnly) —
      // sensitive operational data. The retry policy is a single record, not
      // a collection, so it is NOT exposed as a separate entity here.
      OQL.Entity.manual<(WorkerHeartbeatTypes.WorkerId, WorkerHeartbeatLib.WorkerHeartbeat)>("workerHeartbeat", func () = workerHeartbeatState.heartbeats.entries(), "WorkerHeartbeat", "workerId")
        .payload("workerId", func ((workerId, _)) = workerId)
        .payload("lastHeartbeatAt", func ((_, hb)) = hb.lastHeartbeatAt)
        .controllerOnly()
        .build(),
    ];
  });

  /// Returns the current canister cycle balance.
  public shared query func getCycles() : async Nat {
    Cycles.balance()
  };

  /// Returns the current schema version of the canister's data model.
  public query func getSchemaVersion() : async Nat {
    schemaVersion
  };

  // After an upgrade, ensure bpStateStable is non-empty. On a fresh install
  // it is initialized by its declaration; on upgrade it is set by the
  // migration function. The guard defends against an unexpected empty state.
  system func postupgrade() {
    if (BusinessProfileLib.isEmpty(bpStateStable)) {
      bpStateStable := BusinessProfileLib.empty();
    };
  };
};
