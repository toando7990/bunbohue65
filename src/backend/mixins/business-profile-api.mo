// Business profile API mixin — logo, banner images, saved recipient info
import Principal "mo:core/Principal";
import Types "../types/common";
import BusinessProfileLib "../lib/business-profile";
import Text "mo:core/Text";
import Random "mo:core/Random";
import Nat8 "mo:core/Nat8";
import ShipperTypes "../types/shipper";
import Debug "mo:core/Debug";

mixin (
  bpState           : BusinessProfileLib.State,
  developerPrincipalId : Principal,
  getBusinessOwnerPrincipalId : () -> Principal,
) {

  // Shared immutable public type for banner (no var fields)
  public type BannerImagePublic = {
    id        : Nat;
    imageUrl  : Text;
    sortOrder : Nat;
  };

  func toBannerPublic(b : Types.BannerImage) : BannerImagePublic = {
    id        = b.id;
    imageUrl  = b.imageUrl;
    sortOrder = b.sortOrder;
  };

  func isAuthorized(caller : Principal) : Bool {
    caller == developerPrincipalId or caller == getBusinessOwnerPrincipalId();
  };

  // --- Business profile (logo) ---

  // Public query — no auth required (customer pages need to show the logo)
  public query func getBusinessLogoUrl() : async Text {
    BusinessProfileLib.getLogoUrl(bpState);
  };

  // Only business owner or developer may update
  public shared ({ caller }) func updateBusinessLogoUrl(url : Text) : async Bool {
    if (not isAuthorized(caller)) return false;
    BusinessProfileLib.setLogoUrl(bpState, url);
    true;
  };

  // --- Banner images ---

  // Public query — customer delivery page shows banners without login
  public query func getBannerImages() : async [BannerImagePublic] {
    BusinessProfileLib.getBannerImages(bpState)
      .map(func(b) { toBannerPublic(b) });
  };

  // Only business owner or developer may manage
  public shared ({ caller }) func addBannerImage(imageUrl : Text) : async ?Nat {
    if (not isAuthorized(caller)) return null;
    ?BusinessProfileLib.addBannerImage(bpState, imageUrl);
  };

  public shared ({ caller }) func updateBannerImage(
    id        : Nat,
    imageUrl  : Text,
    sortOrder : Nat,
  ) : async Bool {
    if (not isAuthorized(caller)) return false;
    BusinessProfileLib.updateBannerImage(bpState, id, imageUrl, sortOrder);
  };

  public shared ({ caller }) func deleteBannerImage(id : Nat) : async Bool {
    if (not isAuthorized(caller)) return false;
    BusinessProfileLib.deleteBannerImage(bpState, id);
  };

  // --- Business bank account (shared across all restaurants for QR payment) ---

  // Only business owner or developer may configure the shared bank account.
  // The "Thông tin ngân hàng" group is persisted atomically with the 3 bank
  // fields via a single call to BusinessProfileLib.setBusinessBankDetails.
  // The frontend issues this call and updateBusinessProfile as two sequential
  // requests (bank info is NOT merged into the identity-patch endpoint).
  public shared ({ caller }) func updateBusinessBankDetails(
    accountNumber     : Text,
    bankName          : Text,
    accountHolderName : Text,
  ) : async { #ok; #err : Text } {
    if (not isAuthorized(caller)) return #err("Unauthorized");
    BusinessProfileLib.setBusinessBankDetails(bpState, accountNumber, bankName, accountHolderName);
    #ok;
  };

  // --- Business profile (consolidated identity fields) ---

  /// Patch the 5 business-level identity fields. Only fields the caller
  /// explicitly provides (non-null) are written; null = no change. Pattern
  /// mirrors updateBusinessBankDetails: authorize via getBusinessOwnerPrincipalId,
  /// write via BusinessProfileLib setters, return {#ok; #err}.
  /// bankCode is NO LONGER patched here — it moved to updateBusinessBankDetails
  /// (the "Thông tin ngân hàng" group). The frontend still issues both calls
  /// sequentially when the user saves the business profile form.
  public shared ({ caller }) func updateBusinessProfile(
    patch : Types.BusinessProfilePatch,
  ) : async { #ok; #err : Text } {
    if (not isAuthorized(caller)) return #err("Unauthorized");
    switch (patch.businessName) { case (?v) BusinessProfileLib.setBusinessName(bpState, ?v); case null {} };
    switch (patch.address)      { case (?v) BusinessProfileLib.setAddress(bpState, ?v);      case null {} };
    switch (patch.email)        { case (?v) BusinessProfileLib.setEmail(bpState, ?v);        case null {} };
    switch (patch.domain)       { case (?v) BusinessProfileLib.setDomain(bpState, ?v);       case null {} };
    switch (patch.brandLogo)    { case (?v) BusinessProfileLib.setBrandLogo(bpState, ?v);    case null {} };
    switch (patch.tingeeVA)        { case (?v) BusinessProfileLib.setTingeeVA(bpState, ?v);           case null {} };
    switch (patch.tingeeBankBin)   { case (?v) BusinessProfileLib.setTingeeBankBin(bpState, ?v);     case null {} };
    switch (patch.tingeeMerchantId){ case (?v) BusinessProfileLib.setTingeeMerchantId(bpState, ?v); case null {} };
    #ok;
  };

  /// Read the business-level identity fields. Authorize via
  /// getBusinessOwnerPrincipalId, read via BusinessProfileLib getters.
  /// Includes tingeeVA (Tingee Virtual Account, manually entered by owner).
  public query func getBusinessProfileInfo() : async {
    businessName      : ?Text;
    address           : ?Text;
    email             : ?Text;
    domain            : ?Text;
    brandLogo         : ?Text;
    tingeeVA          : ?Text;
    tingeeBankBin     : ?Text;
    tingeeMerchantId  : ?Text;
  } {
    {
      businessName     = BusinessProfileLib.getBusinessName(bpState);
      address          = BusinessProfileLib.getAddress(bpState);
      email            = BusinessProfileLib.getEmail(bpState);
      domain           = BusinessProfileLib.getDomain(bpState);
      brandLogo        = BusinessProfileLib.getBrandLogo(bpState);
      tingeeVA         = BusinessProfileLib.getTingeeVA(bpState);
      tingeeBankBin    = BusinessProfileLib.getTingeeBankBin(bpState);
      tingeeMerchantId = BusinessProfileLib.getTingeeMerchantId(bpState);
    };
  };

  // --- Tingee Secret Token (global, business-level) ---

  // Returns whether a Tingee Secret Token is configured — never returns the token itself for security
  public query func hasTingeeSecretTokenConfigured() : async Bool {
    BusinessProfileLib.hasTingeeSecretToken(bpState);
  };

  // Returns whether a Tingee Client ID is configured
  public query func hasTingeeClientIdConfigured() : async Bool {
    switch (BusinessProfileLib.getTingeeClientId(bpState)) {
      case (?id) id.size() > 0;
      case null false;
    };
  };

  // Save Tingee Client ID at business level — only business owner or developer
  public shared ({ caller }) func saveTingeeClientId(clientId : Text) : async { #ok; #err : Text } {
    if (not isAuthorized(caller)) return #err("Unauthorized");
    BusinessProfileLib.setTingeeClientId(bpState, clientId);
    #ok;
  };

  // Save Tingee Secret Token at business level — only business owner or developer
  public shared ({ caller }) func saveTingeeSecretToken(token : Text) : async { #ok; #err : Text } {
    if (not isAuthorized(caller)) return #err("Unauthorized");
    BusinessProfileLib.setTingeeSecretToken(bpState, token);
    #ok;
  };

  // --- BKAV eHoadon configuration ---

  /// Save real (chạy thật / production) BKAV credentials and endpoint URL.
  /// Replaces all three fields atomically — no partial-update guard.
  /// Save real (chạy thật / production) BKAV credentials and endpoint URL.
  /// Replaces all three fields atomically — no partial-update guard.
  /// Validates that guid is a proper UUID (length >= 5 to catch placeholder values like "9").
  public shared ({ caller }) func saveRealBkavConfig(
    guid   : Text,
    token  : Text,
    apiUrl : Text,
  ) : async { #ok; #err : Text } {
    if (not isAuthorized(caller)) return #err("Unauthorized");
    if (guid.size() < 5) {
      return #err("GUID không hợp lệ, phải là UUID đầy đủ");
    };
    BusinessProfileLib.setRealBkavConfig(bpState, guid, token, apiUrl);
    #ok;
  };

  /// Save common BKAV settings: separate demo/prod invoice serials, form, environment toggle, VAT rate,
  /// and worker principal. workerPrincipal is only overwritten when non-null/non-empty — passing null or
  /// empty string preserves the existing registered principal (owner cannot clear/delete it).
  public shared ({ caller }) func saveBkavCommonConfig(
    demoSerial      : ?Text,
    prodSerial      : ?Text,
    form            : ?Text,
    useDemo         : Bool,
    vatRate         : Nat,
    workerPrincipal : ?Text,
  ) : async { #ok; #err : Text } {
    if (not isAuthorized(caller)) return #err("Unauthorized");
    BusinessProfileLib.setBkavCommonConfig(bpState, demoSerial, prodSerial, form, useDemo, vatRate, workerPrincipal);
    #ok;
  };

  /// Returns full BKAV config including actual credential values and the registered worker principal.
  /// Credentials are returned as-is (stored in password-type inputs on frontend).
  /// NOTE: demo* fields are DEPRECATED — kept for stable compatibility. Bkav Sandbox has been
  /// removed; demo values are always returned neutral (null/empty, useDemo=false). Only real
  /// (production) credentials are returned with actual values.
  public query func getBkavInvoiceConfig() : async {
    demoGuid              : ?Text;
    demoToken             : ?Text;
    realGuid              : ?Text;
    realToken             : ?Text;
    realApiUrl            : ?Text;
    invoiceSerial         : Text;   // legacy field (kept for backward compat)
    demoInvoiceSerial     : Text;
    prodInvoiceSerial     : Text;
    invoiceForm           : Text;
    useDemo               : Bool;
    vatRate               : Nat;
    invoiceCallbackSecret : ?Text;
    workerPrincipal       : ?Text;
  } {
    let cfg = BusinessProfileLib.getBkavConfig(bpState);
    {
      // DEPRECATED demo fields — always neutral (Bkav Sandbox removed)
      demoGuid              = null;
      demoToken             = null;
      realGuid              = switch (cfg.realGuid) { case (?g) if (g.size() >= 5) ?g else null; case null null };
      realToken             = cfg.realToken;
      realApiUrl            = cfg.realApiUrl;
      invoiceSerial         = switch (cfg.bkavInvoiceSerial) { case (?s) s; case null "" };
      demoInvoiceSerial     = "";   // DEPRECATED — always empty (Bkav Sandbox removed)
      prodInvoiceSerial     = switch (cfg.bkavProdInvoiceSerial) { case (?s) s; case null "" };
      invoiceForm           = switch (cfg.bkavInvoiceForm) { case (?f) f; case null "" };
      useDemo               = false; // DEPRECATED — always false (Bkav Sandbox removed)
      vatRate               = cfg.bkavVatRate;
      invoiceCallbackSecret = BusinessProfileLib.getInvoiceCallbackSecret(bpState);
      workerPrincipal       = cfg.workerPrincipal;
    };
  };

  /// Save invoice provider selection (only "BKAV" is supported).
  public shared ({ caller }) func saveInvoiceProvider(provider : Text) : async { #ok; #err : Text } {
    if (not isAuthorized(caller)) return #err("Unauthorized");
    BusinessProfileLib.setInvoiceProvider(bpState, provider);
    #ok;
  };

  /// Returns the currently active invoice provider ("MISA" or "BKAV").
  public query func getInvoiceProvider() : async Text {
    BusinessProfileLib.getInvoiceProvider(bpState);
  };

  // --- Seller identity (MST + phone for e-invoice seller info) ---

  /// Returns the seller's tax code and phone stored in BusinessProfile.
  public query func getSellerInfo() : async { taxCode : ?Text; phone : ?Text } {
    let info = BusinessProfileLib.getSellerInfo(bpState);
    { taxCode = info.taxCode; phone = info.phone };
  };

  /// Saves seller tax code and phone. Empty string preserves the existing value.
  public shared ({ caller }) func saveSellerInfo(taxCode : Text, phone : Text) : async { #ok; #err : Text } {
    if (not isAuthorized(caller)) return #err("Unauthorized");
    BusinessProfileLib.setSellerTaxCode(bpState, taxCode);
    BusinessProfileLib.setSellerPhone(bpState, phone);
    #ok;
  };



  // --- Invoice Callback Secret ---

  /// Generate a new random 32-char hex secret for BKAV invoice callback authentication.
  /// Saves the secret to BusinessProfile and returns it — store this on the VPS worker.
  public shared ({ caller }) func generateInvoiceCallbackSecret() : async { #ok : Text; #err : Text } {
    if (not isAuthorized(caller)) return #err("Unauthorized");
    let seed = await Random.blob();
    let bytes = seed.toArray();
    let hexChars = ["0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f"];
    var hex = "";
    let len = if (bytes.size() < 16) bytes.size() else 16;
    var i = 0;
    while (i < len) {
      let b = bytes[i].toNat();
      hex := hex # hexChars[b / 16] # hexChars[b % 16];
      i += 1;
    };
    BusinessProfileLib.setInvoiceCallbackSecret(bpState, hex);
    #ok(hex);
  };

  /// Returns whether an invoice callback secret is configured (not the secret itself).
  public query func hasInvoiceCallbackSecret() : async Bool {
    switch (BusinessProfileLib.getInvoiceCallbackSecret(bpState)) {
      case null false;
      case (?s) s.size() > 0;
    };
  };

  /// Returns the actual invoice callback secret for display in the business profile UI.
  /// Only authorized callers (owner or developer) may retrieve the secret value.
  public shared ({ caller }) func getInvoiceCallbackSecret(enterpriseId : Text) : async ?Text {
    ignore enterpriseId; // enterpriseId reserved for future multi-tenant use; auth is caller-based
    if (not isAuthorized(caller)) return null;
    BusinessProfileLib.getInvoiceCallbackSecret(bpState);
  };

  // --- Saved recipient info ---

  public shared ({ caller }) func getSavedRecipientInfo() : async ?Types.SavedRecipientInfo {
    BusinessProfileLib.getSavedRecipientInfo(bpState, caller);
  };

  public shared ({ caller }) func saveRecipientInfo(
    recipientName  : Text,
    recipientPhone : Text,
    locationName   : Text,
  ) : async () {
    let info : Types.SavedRecipientInfo = {
      recipientName;
      recipientPhone;
      locationName;
    };
    BusinessProfileLib.saveRecipientInfo(bpState, caller, info);
  };
  // --- COD (Cash in Advance) settings ---

  /// Returns the current COD settings for the delivery app.
  public query func getCodSettings() : async ?Types.CodSettings {
    BusinessProfileLib.getCodSettings(bpState);
  };

  /// Save COD settings — toggle COD on/off and set per-order limit.
  /// Pass null to disable COD entirely.
  public shared ({ caller }) func setCodSettings(settings : ?Types.CodSettings) : async { #ok; #err : Text } {
    if (not isAuthorized(caller)) return #err("Unauthorized");
    BusinessProfileLib.setCodSettings(bpState, settings);
    #ok;
  };

  // --- AhaMove configuration ---

  /// Save AhaMove API configuration at business level.
  /// Trường mobile là số điện thoại tài khoản AhaMove dùng để lấy JWT token.
  public shared ({ caller }) func saveAhamoveConfig(
    config : ShipperTypes.AhamoveConfig,
  ) : async { #ok; #err : Text } {
    if (not isAuthorized(caller)) return #err("Unauthorized");
    BusinessProfileLib.setAhamoveConfig(bpState, config);
    #ok;
  };

  /// Returns the current AhaMove configuration (bao gồm số điện thoại tài khoản).
  public query func getAhamoveConfig() : async ?ShipperTypes.AhamoveConfig {
    BusinessProfileLib.getAhamoveConfig(bpState);
  };
};
