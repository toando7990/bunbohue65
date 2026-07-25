// Business profile domain logic — global profile, banner images, saved recipient info
import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Types "../types/common";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Time "mo:core/Time";
import ShipperTypes "../types/shipper";

module {
  public type BusinessProfile     = Types.BusinessProfile;
  public type BannerImage         = Types.BannerImage;
  public type SavedRecipientInfo  = Types.SavedRecipientInfo;

  public type State = {
    profile       : BusinessProfile;
    bannerImages  : List.List<BannerImage>;
    bannerCounter : { var nextId : Nat };
    savedRecipients : Map.Map<Principal, SavedRecipientInfo>;
  };

  public func empty() : State = {
    profile       = {
      var logoUrl = "";
      var businessName = null;
      var address = null;
      var email = null;
      var domain = null;
      var brandLogo = null;
      var accountNumber = null;
      var bankName = null;
      var accountHolderName = null;
      var tingeeClientId = null;
      var tingeeSecretToken = null;
      var tingeeOrderPrefix = "";
      var tingeeVA = null;
      var tingeeBankBin = null;
      var tingeeMerchantId = null;
      var invoiceProvider = "BKAV";
      var bkavInvoiceSerial = null;
      var bkavDemoInvoiceSerial = null;
      var bkavProdInvoiceSerial = null;
      var bkavInvoiceForm = null;
      var bkavEnvironment = "production";
      var bkavVatRate = 10;
      var taxCode = null;
      var phone = null;
      var invoiceCallbackSecret = null;
      var demoGuid = null;
      var demoToken = null;
      var realGuid = null;
      var realToken = null;
      var realApiUrl = null;
      var workerPrincipal = null : ?Text;
      var ahamoveApiKey = null;
      var ahamoveMobile = null;
      var codSettings = null : ?Types.CodSettings;
    };
    bannerImages  = List.empty();
    bannerCounter = { var nextId = 1 };
    savedRecipients = Map.empty();
  };

  /// Returns just the empty BusinessProfile record (the profile portion of
  /// `empty()`). Useful for re-initializing the profile without resetting
  /// banner images or saved recipients.
  public func emptyProfile() : BusinessProfile = {
    var logoUrl = "";
    var businessName = null;
    var address = null;
    var email = null;
    var domain = null;
    var brandLogo = null;
    var accountNumber = null;
    var bankName = null;
    var accountHolderName = null;
    var tingeeClientId = null;
    var tingeeSecretToken = null;
    var tingeeOrderPrefix = "";
    var tingeeVA = null;
    var tingeeBankBin = null;
    var tingeeMerchantId = null;
    var invoiceProvider = "BKAV";
    var bkavInvoiceSerial = null;
    var bkavDemoInvoiceSerial = null;
    var bkavProdInvoiceSerial = null;
    var bkavInvoiceForm = null;
    var bkavEnvironment = "production";
    var bkavVatRate = 10;
    var taxCode = null;
    var phone = null;
    var invoiceCallbackSecret = null;
    var demoGuid = null;
    var demoToken = null;
    var realGuid = null;
    var realToken = null;
    var realApiUrl = null;
    var workerPrincipal = null : ?Text;
    var ahamoveApiKey = null;
    var ahamoveMobile = null;
    var codSettings = null : ?Types.CodSettings;
  };

  /// Identity conversion — `State` is already stable-shaped. Future-proofs
  /// the stable migration: when `State` gains non-stable fields, this becomes
  /// the single place to project them out before serialization.
  public func toStable(state : State) : State = state;

  /// Wraps a BusinessProfile into a fresh State with empty banner images and
  /// saved recipients. Useful for rehydrating a State from a stored profile.
  public func fromProfile(profile : BusinessProfile) : State = {
    profile;
    bannerImages  = List.empty();
    bannerCounter = { var nextId = 1 };
    savedRecipients = Map.empty();
  };

  /// Returns true when the profile is in a default/empty state — businessName
  /// is null/empty. Used by postupgrade to decide whether to re-initialize
  /// bpStateStable.
  public func isEmpty(state : State) : Bool {
    switch (state.profile.businessName) {
      case null true;
      case (?n) n.size() == 0;
    };
  };

  // --- Business profile ---

  public func getLogoUrl(state : State) : Text {
    state.profile.logoUrl;
  };

  public func setLogoUrl(state : State, url : Text) {
    state.profile.logoUrl := url;
  };

  // --- Business identity (consolidated from per-restaurant Restaurant type) ---

  public func getBusinessName(state : State) : ?Text {
    state.profile.businessName;
  };

  public func setBusinessName(state : State, name : ?Text) {
    state.profile.businessName := name;
  };

  public func getAddress(state : State) : ?Text {
    state.profile.address;
  };

  public func setAddress(state : State, address : ?Text) {
    state.profile.address := address;
  };

  public func getEmail(state : State) : ?Text {
    state.profile.email;
  };

  public func setEmail(state : State, email : ?Text) {
    state.profile.email := email;
  };

  public func getDomain(state : State) : ?Text {
    state.profile.domain;
  };

  public func setDomain(state : State, domain : ?Text) {
    state.profile.domain := domain;
  };

  public func getBrandLogo(state : State) : ?Text {
    state.profile.brandLogo;
  };

  public func setBrandLogo(state : State, logo : ?Text) {
    state.profile.brandLogo := logo;
  };

  // --- Business bank account (shared across all restaurants for QR payment) ---

  public type BusinessBankDetails = {
    accountNumber     : Text;
    bankName          : Text;
    accountHolderName : Text;
  };

  public func getBusinessBankDetails(state : State) : ?BusinessBankDetails {
    switch (state.profile.accountNumber, state.profile.bankName, state.profile.accountHolderName) {
      case (?acct, ?bank, ?holder) ?{ accountNumber = acct; bankName = bank; accountHolderName = holder };
      case _ null;
    };
  };

  // bankCode was removed from the business profile. The "Thông tin ngân hàng"
  // group is now written atomically by a single endpoint
  // (updateBusinessBankDetails) covering the 3 remaining bank fields.
  public func setBusinessBankDetails(state : State, accountNumber : Text, bankName : Text, accountHolderName : Text) {
    state.profile.accountNumber     := ?accountNumber;
    state.profile.bankName          := ?bankName;
    state.profile.accountHolderName := ?accountHolderName;
  };

  // --- Tingee credentials (global, used for QR payment and HMAC-SHA512 webhook verification) ---

  public func getTingeeClientId(state : State) : ?Text {
    state.profile.tingeeClientId;
  };

  public func setTingeeClientId(state : State, clientId : Text) {
    if (clientId.size() > 0) {
      state.profile.tingeeClientId := ?clientId;
    };
  };

  public func getTingeeSecretToken(state : State) : ?Text {
    state.profile.tingeeSecretToken;
  };

  public func setTingeeSecretToken(state : State, token : Text) {
    state.profile.tingeeSecretToken := ?token;
  };

  public func hasTingeeSecretToken(state : State) : Bool {
    switch (state.profile.tingeeSecretToken) {
      case (?t) t.size() > 0;
      case null false;
    };
  };

  // --- Tingee configuration (production-only, no test/prod split) ---

  public type TingeeConfig = {
    clientId       : ?Text;
    secretToken    : ?Text;
    orderPrefix    : Text;
    bankBin        : ?Text;
    merchantId     : ?Text;
  };

  public func getTingeeConfig(state : State) : TingeeConfig = {
    clientId      = state.profile.tingeeClientId;
    secretToken   = state.profile.tingeeSecretToken;
    orderPrefix   = state.profile.tingeeOrderPrefix;
    bankBin       = state.profile.tingeeBankBin;
    merchantId    = state.profile.tingeeMerchantId;
  };

  public func setTingeeConfig(
    state          : State,
    clientId       : Text,
    secretToken    : Text,
    orderPrefix    : Text,
  ) {
    // Credential fields: only overwrite when non-empty (frontend clears inputs after save)
    if (clientId.size() > 0)      { state.profile.tingeeClientId      := ?clientId };
    if (secretToken.size() > 0)  { state.profile.tingeeSecretToken   := ?secretToken };
    // Order prefix — always overwrite (user may intentionally clear it)
    state.profile.tingeeOrderPrefix := orderPrefix;
  };

  public func getTingeeOrderPrefix(state : State) : Text {
    state.profile.tingeeOrderPrefix;
  };

  public func setTingeeOrderPrefix(state : State, prefix : Text) {
    state.profile.tingeeOrderPrefix := prefix;
  };

  // --- Tingee Virtual Account (VA) — manually entered by owner, used as the
  // destination VA for dynamic QR generation (http-outcalls to Tingee). ---

  public func getTingeeVA(state : State) : ?Text {
    state.profile.tingeeVA;
  };

  public func setTingeeVA(state : State, va : ?Text) {
    state.profile.tingeeVA := va;
  };

  // --- Tingee Bank BIN — manually entered by owner, used as the bankBin field
  // in the generate-dynamic-qr request body (http-outcalls to Tingee). ---

  public func getTingeeBankBin(state : State) : ?Text {
    state.profile.tingeeBankBin;
  };

  public func setTingeeBankBin(state : State, bankBin : ?Text) {
    state.profile.tingeeBankBin := bankBin;
  };

  // --- Tingee Merchant ID — manually entered by owner, used as the merchantId
  // field in the generate-dynamic-qr request body (http-outcalls to Tingee). ---

  public func getTingeeMerchantId(state : State) : ?Text {
    state.profile.tingeeMerchantId;
  };

  public func setTingeeMerchantId(state : State, merchantId : ?Text) {
    state.profile.tingeeMerchantId := merchantId;
  };

  // Default order-code prefix — reads tingeeOrderPrefix (the only remaining
  // order-prefix stable field). Used as the fallback prefix for non-Tingee
  // orders (COD, Stripe, default QR path). Falls back to "ORD" when empty.
  public func getDefaultOrderPrefix(state : State) : Text {
    let p = state.profile.tingeeOrderPrefix;
    if (p.size() > 0) p else "ORD";
  };

  public func hasTingeeConfigured(state : State) : Bool {
    switch (state.profile.tingeeClientId, state.profile.tingeeSecretToken) {
      case (?cid, ?tok) cid.size() > 0 and tok.size() > 0;
      case _ false;
    };
  };

  // --- BKAV eHoadon configuration (global) ---

  public type BkavConfig = {
    bkavInvoiceSerial     : ?Text;
    bkavDemoInvoiceSerial : ?Text;
    bkavProdInvoiceSerial : ?Text;
    bkavInvoiceForm       : ?Text;
    bkavEnvironment       : Text;
    bkavVatRate           : Nat;
    demoGuid              : ?Text;
    demoToken             : ?Text;
    realGuid              : ?Text;
    realToken             : ?Text;
    realApiUrl            : ?Text;
    workerPrincipal       : ?Text;
  };

  public func getBkavConfig(state : State) : BkavConfig = {
    bkavInvoiceSerial     = state.profile.bkavInvoiceSerial;
    bkavDemoInvoiceSerial = state.profile.bkavDemoInvoiceSerial;
    bkavProdInvoiceSerial = state.profile.bkavProdInvoiceSerial;
    bkavInvoiceForm       = state.profile.bkavInvoiceForm;
    bkavEnvironment       = state.profile.bkavEnvironment;
    bkavVatRate           = state.profile.bkavVatRate;
    demoGuid              = state.profile.demoGuid;
    demoToken             = state.profile.demoToken;
    realGuid              = state.profile.realGuid;
    realToken             = state.profile.realToken;
    realApiUrl            = state.profile.realApiUrl;
    workerPrincipal       = state.profile.workerPrincipal;
  };

  /// Save real (chạy thật / production) BKAV credentials and API URL.
  public func setRealBkavConfig(state : State, guid : Text, token : Text, apiUrl : Text) {
    state.profile.realGuid   := ?guid;
    state.profile.realToken  := ?token;
    state.profile.realApiUrl := ?apiUrl;
  };

  /// Save common BKAV settings (separate demo/prod serials, form, environment toggle, VAT rate).
  /// workerPrincipal: only overwrites the stored value when non-null AND non-empty —
  /// null or empty string preserves the existing registered principal (no clear/delete).
  public func setBkavCommonConfig(
    state            : State,
    demoSerial       : ?Text,
    prodSerial       : ?Text,
    form             : ?Text,
    useDemo          : Bool,
    vatRate          : Nat,
    workerPrincipal  : ?Text,
  ) {
    switch (demoSerial) { case (?s) { state.profile.bkavDemoInvoiceSerial := ?s }; case null {} };
    switch (prodSerial) { case (?s) { state.profile.bkavProdInvoiceSerial := ?s }; case null {} };
    switch (form)       { case (?f) { state.profile.bkavInvoiceForm       := ?f }; case null {} };
    state.profile.bkavEnvironment := if (useDemo) "dev" else "production";
    state.profile.bkavVatRate     := vatRate;
    // Only overwrite workerPrincipal when a non-empty value is provided — never clear.
    switch (workerPrincipal) {
      case (?wp) {
        if (wp.size() > 0) {
          state.profile.workerPrincipal := ?wp;
        };
      };
      case null {};
    };
  };

  /// Returns default real/production endpoint URL.
  public func getDefaultRealEndpoint() : Text {
    "https://ws.ehoadon.vn/WSPublicEhoadon.asmx";
  };

  // --- Seller identity (MST + phone for e-invoice seller fields) ---

  public type SellerInfo = {
    name         : Text;
    taxCode      : ?Text;
    phone        : ?Text;
    address      : Text;
    email        : Text;
    accountNumber : ?Text;
    bankName     : ?Text;
  };

  public func getSellerInfo(state : State) : SellerInfo = {
    name         = "";
    taxCode      = state.profile.taxCode;
    phone        = state.profile.phone;
    address      = "";
    email        = "";
    accountNumber = state.profile.accountNumber;
    bankName     = state.profile.bankName;
  };

  public func setSellerTaxCode(state : State, taxCode : Text) {
    if (taxCode.size() > 0) {
      state.profile.taxCode := ?taxCode;
    };
  };

  public func setSellerPhone(state : State, phone : Text) {
    if (phone.size() > 0) {
      state.profile.phone := ?phone;
    };
  };

  // --- Invoice callback secret (for VPS worker HMAC-SHA256 auth) ---

  public func getInvoiceCallbackSecret(state : State) : ?Text {
    state.profile.invoiceCallbackSecret;
  };

  public func setInvoiceCallbackSecret(state : State, secret : Text) {
    if (secret.size() > 0) {
      state.profile.invoiceCallbackSecret := ?secret;
    };
  };

  // --- AhaMove configuration ---

  public func getAhamoveConfig(state : State) : ?ShipperTypes.AhamoveConfig {
    switch (state.profile.ahamoveApiKey) {
      case null null;
      // isTestMode field is DEPRECATED — kept for stable compatibility; forced to false (Ahamove Sandbox removed).
      case (?key) ?{ apiKey = key; mobile = state.profile.ahamoveMobile; isTestMode = false };
    };
  };

  public func getAhamoveMobile(state : State) : ?Text {
    state.profile.ahamoveMobile;
  };

  public func setAhamoveMobile(state : State, mobile : ?Text) {
    state.profile.ahamoveMobile := mobile;
  };

  public func setAhamoveConfig(state : State, config : ShipperTypes.AhamoveConfig) {
    state.profile.ahamoveApiKey     := ?config.apiKey;
    state.profile.ahamoveMobile     := config.mobile;
    // isTestMode is DEPRECATED — no longer written to stable state (Ahamove Sandbox removed).
  };

  // --- COD (Cash in Advance) settings ---

  public func getCodSettings(state : State) : ?Types.CodSettings {
    state.profile.codSettings;
  };

  public func setCodSettings(state : State, settings : ?Types.CodSettings) {
    state.profile.codSettings := settings;
  };

  // --- Invoice provider selection ---

  public func getInvoiceProvider(state : State) : Text {
    state.profile.invoiceProvider;
  };

  public func setInvoiceProvider(state : State, provider : Text) {
    state.profile.invoiceProvider := provider;
  };

  // --- Banner images ---

  public func getBannerImages(state : State) : [BannerImage] {
    state.bannerImages.toArray();
  };

  public func addBannerImage(state : State, imageUrl : Text) : Nat {
    let id = state.bannerCounter.nextId;
    state.bannerCounter.nextId += 1;
    let sortOrder = state.bannerImages.size();
    state.bannerImages.add({ id; var imageUrl; var sortOrder });
    id;
  };

  public func updateBannerImage(
    state     : State,
    id        : Nat,
    imageUrl  : Text,
    sortOrder : Nat,
  ) : Bool {
    switch (state.bannerImages.find(func(b : BannerImage) : Bool { b.id == id })) {
      case null false;
      case (?banner) {
        banner.imageUrl  := imageUrl;
        banner.sortOrder := sortOrder;
        true;
      };
    };
  };

  public func deleteBannerImage(state : State, id : Nat) : Bool {
    let sizeBefore = state.bannerImages.size();
    let kept = state.bannerImages.filter(func(b : BannerImage) : Bool { b.id != id });
    state.bannerImages.clear();
    for (b in kept.values()) { state.bannerImages.add(b) };
    state.bannerImages.size() < sizeBefore;
  };

  // --- Saved recipient info ---

  public func getSavedRecipientInfo(state : State, caller : Principal) : ?SavedRecipientInfo {
    state.savedRecipients.get(caller);
  };

  public func saveRecipientInfo(state : State, caller : Principal, info : SavedRecipientInfo) {
    state.savedRecipients.add(caller, info);
  };
};
