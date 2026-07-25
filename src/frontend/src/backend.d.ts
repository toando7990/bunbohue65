import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface AnalyticsEntry {
    totalOrders: bigint;
    date: string;
    totalRevenue: bigint;
}
export interface RetryPolicy {
    backoffMultiplier: number;
    baseDelayMs: bigint;
    maxRetries: bigint;
    maxDelayMs: bigint;
}
export interface PendingAhamoveBookingItem {
    customerName: string;
    customerPhone: string;
    pickupLat?: number;
    pickupLng?: number;
    orderCode: string;
    dropoffLat?: number;
    dropoffLng?: number;
    orderId: string;
    restaurantId: bigint;
    pickupAddress: string;
    totalAmount: bigint;
    restaurantName: string;
    dropoffAddress: string;
    serviceId: string;
}
export interface BusinessProfilePatch {
    domain?: string;
    tingeeMerchantId?: string;
    tingeeBankBin?: string;
    businessName?: string;
    email?: string;
    tingeeVA?: string;
    address?: string;
    brandLogo?: string;
}
export interface MasterMenuCategory {
    id: bigint;
    name: string;
    position: bigint;
}
export interface AhamoveWorkerConfig {
    ordersToSync: Array<{
        ahamoveOrderId: string;
        orderId: string;
    }>;
    apiKey: string;
    mobile: string;
    isTestMode: boolean;
}
export interface WorkerStatus {
    workerId: string;
    alive: boolean;
    lastHeartbeatAt: bigint;
}
export interface CodSettings {
    codLimit: bigint;
    isCodAllowed: boolean;
}
export interface CreateMasterCategoryRequest {
    name: string;
    position: bigint;
}
export interface Cell {
    value: Value;
    name: string;
}
export interface EnterpriseDeviceRecord {
    deviceToken: string;
    status: Variant_Active_Revoked;
    role: EnterpriseDeviceRole;
    codeExpiry?: bigint;
    deviceId: string;
    deviceName: string;
    activationCode?: string;
    registeredAt: bigint;
}
export interface TingeeBank {
    bankBin: string;
    bankCode: string;
    bankLogo: string;
    bankName: string;
    shortName: string;
}
export interface VatInfo {
    accountNo?: string;
    email: string;
    address: string;
    buyerName: string;
    taxCode?: string;
}
export interface SavedRecipientInfo {
    recipientPhone: string;
    locationName: string;
    recipientName: string;
}
export interface PendingDynamicQRItem {
    idempotencyKey: string;
    qrId: string;
    orderCode: string;
    orderId: OrderId;
    operation: PendingDynamicQROp;
    amount: bigint;
    billId: string;
}
export type DeviceId = string;
export interface BusinessBankDetails {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
}
export interface MenuCategory {
    id: MenuCategoryId;
    name: string;
    restaurantId: RestaurantId;
    position: bigint;
}
export interface SuggestionConfig {
    maxDrinks: bigint;
    maxAddOns: bigint;
    suggestionsEnabled: boolean;
}
export interface MasterMenuItem {
    id: bigint;
    categoryId: bigint;
    name: string;
    unit?: string;
    description: string;
    isActive: boolean;
    imageUrl?: string;
    price: bigint;
    position: bigint;
}
export interface KioskBill {
    total: bigint;
    paymentMethod: PaymentMethod;
    changeDue: bigint;
    restaurantPhone: string;
    thankYouMsg: string;
    createdAt: string;
    itemCount: bigint;
    orderCode: string;
    website: string;
    amountPaid: bigint;
    invoiceInfo?: BkavInvoiceInfo;
    logoUrl: string;
    restaurantAddr: string;
    restaurantName: string;
    tableName?: string;
    items: Array<BillItem>;
    vatAmount: bigint;
    vatRate: bigint;
    subtotal: bigint;
}
export interface PendingInvoiceItem {
    buyerAddress: string;
    customerCompanyName?: string;
    createdAt: bigint;
    isDemo: boolean;
    orderId: OrderId;
    restaurantId: RestaurantId;
    customerCompanyAddress?: string;
    totalAmount: bigint;
    items: Array<OrderItem>;
    buyerName: string;
    isRetailInvoice: boolean;
    customerTaxCode?: string;
    vatInfo?: VatInfo;
}
export interface StaffMember {
    staffId: Principal;
    role: StaffRole;
}
export interface MenuItem {
    id: MenuItemId;
    categoryId: MenuCategoryId;
    name: string;
    unit?: string;
    description: string;
    available: boolean;
    restaurantId: RestaurantId;
    imageUrl?: string;
    price: bigint;
}
export interface DynamicQRWorkerConfig {
    clientId: string;
    secretToken: string;
    bankBin: string;
    merchantId: string;
    workerPrincipal: string;
    vaAccountNumber: string;
}
export interface TransactionInfo {
    transactionCode?: string;
    paymentMethod?: string;
    reference?: string;
    bankCode?: string;
    amount?: bigint;
    paidAt?: string;
}
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export interface ShipperBookingResult {
    provider: string;
    shippingFee?: bigint;
    shipperPhone?: string;
    distanceKm?: number;
    shipperName?: string;
}
export interface Table {
    id: TableId;
    tableNumber: string;
    restaurantId: RestaurantId;
    qrCodeUrl: string;
}
export type MenuCategoryId = bigint;
export interface DynamicQRStatusCallback {
    status: DynamicQRStatus;
    totalAmountPaid: bigint;
    transactionInfos: Array<TransactionInfo>;
    orderId: OrderId;
}
export interface DynamicQRDeletedCallback {
    orderId: OrderId;
}
export interface DeviceRecordPublic {
    deviceToken: string;
    status: Variant_active_revoked;
    lastUsedAt: bigint;
    createdAt: bigint;
    role: StaffRole;
    restaurantId: bigint;
    codeExpiry: bigint;
    deviceId: DeviceId;
    deviceName: string;
    activationCode: string;
}
export type TableId = bigint;
export interface CodOrderResponse {
    status: OrderStatus;
    orderCode: string;
    orderId: OrderId;
    message: string;
    totalAmount: bigint;
}
export interface UpdateMasterCategoryRequest {
    name?: string;
    position?: bigint;
}
export type Timestamp = bigint;
export interface OrderTrackingPublic {
    paymentConfirmedAt?: Timestamp;
    maCQT?: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    deliveryLat?: number;
    deliveryLng?: number;
    ahamoveOrderId?: string;
    shippingStatus?: ShippingStatus;
    shippingFee?: bigint;
    invoiceNo?: string;
    shipperPhone?: string;
    dispatchNote?: string;
    orderType: OrderType;
    orderId: OrderId;
    shippingProvider?: string;
    invoiceDate?: string;
    invoicePdfUrl?: string;
    maTraCuu?: string;
    driverInfo?: DriverInfo;
    findingDriverSince?: bigint;
    invoiceStatus: InvoiceStatus;
    shipperName?: string;
}
export type PaymentMethod = {
    __kind__: "Card";
    Card: null;
} | {
    __kind__: "Cash";
    Cash: null;
} | {
    __kind__: "BankTransfer";
    BankTransfer: null;
} | {
    __kind__: "Other";
    Other: string;
};
export interface BkavInvoiceInfo {
    issueDate: string;
    lookupCode: string;
    cqtCode: string;
    totalAfterTax: bigint;
    invoiceNo: string;
    vatAmount: bigint;
    vatRate: bigint;
}
export interface OrderItem {
    name: string;
    unit?: string;
    itemNote?: string;
    quantity: bigint;
    price: bigint;
    menuItemId: MenuItemId;
}
export interface BackgroundImage {
    id: bigint;
    url: string;
    fileName: string;
    isDefault: boolean;
    uploadedAt: bigint;
}
export interface ReservationPublic {
    id: ReservationId;
    customerName: string;
    status: ReservationStatus;
    customerPhone: string;
    date: string;
    createdAt: Timestamp;
    tableId?: TableId;
    restaurantId: RestaurantId;
    durationMinutes: bigint;
    notes?: string;
    partySize: bigint;
    customerEmail?: string;
    timeSlot: string;
}
export interface DynamicQRStatusResult {
    status: DynamicQRStatus;
    totalAmountPaid?: bigint;
    transactionInfos?: string;
}
export type RestaurantId = bigint;
export interface OrderPublic {
    id: OrderId;
    paymentConfirmedAt?: Timestamp;
    maCQT?: string;
    customerName?: string;
    status: OrderStatus;
    deliveryAddress?: string;
    paymentStatus: PaymentStatus;
    paymentMethod?: PaymentMethod__1;
    customerPhone?: string;
    paymentMethodLabel: string;
    createdAt: Timestamp;
    ahamoveOrderId?: string;
    shippingStatus?: ShippingStatus;
    tableIdentifier: string;
    shippingTransferStatus: ShippingTransferStatus;
    shippingFee?: bigint;
    invoiceNo?: string;
    orderCode?: string;
    shipperPhone?: string;
    dispatchNote?: string;
    orderType: OrderType;
    shippingProvider?: string;
    restaurantId: RestaurantId;
    invoiceDate?: string;
    invoicePdfUrl?: string;
    maTraCuu?: string;
    notes?: string;
    stripePaymentIntentId?: string;
    isCod: boolean;
    items: Array<OrderItem>;
    driverInfo?: DriverInfo;
    findingDriverSince?: bigint;
    paidAt?: Timestamp;
    invoiceStatus: InvoiceStatus;
    vatInfo?: VatInfo;
    subtotal?: bigint;
    shipperName?: string;
}
export interface BannerImagePublic {
    id: bigint;
    sortOrder: bigint;
    imageUrl: string;
}
export interface BankDetails {
    accountHolderName: string;
    bankName: string;
    totalAmount: bigint;
    accountNumber: string;
}
export type MenuItemId = bigint;
export interface TingeeBanksCallback {
    banks: Array<TingeeBank>;
}
export interface DynamicQRGeneratedCallback {
    qrString: string;
    idempotencyKey: string;
    qrId: string;
    orderId: OrderId;
    billId: string;
}
export interface DeveloperProfile {
    email: string;
    developerPrincipalId: Principal;
    businessOwnerPrincipalId: Principal;
}
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export interface OrderItem__2 {
    name: string;
    quantity: bigint;
    price: bigint;
    menuItemId: MenuItemId;
}
export interface BillItem {
    total: bigint;
    name: string;
    quantity: bigint;
    price: bigint;
}
export interface RestaurantPublic {
    id: RestaurantId;
    brand2Name?: string;
    tableServiceHours?: string;
    ownerId: Principal;
    brand4Name?: string;
    name: string;
    deliveryServiceHours?: string;
    brand1Name?: string;
    stripeEnabled: boolean;
    staffMembers: Array<StaffMember>;
    coordinateLatitude?: number;
    stripePublishableKey?: string;
    address: string;
    deliveryRadiusKm?: bigint;
    brand3Name?: string;
    autoPaymentConfirmationApp: AutoPaymentApp;
    bannerImageUrl?: string;
    brand5Name?: string;
    coordinateLongitude?: number;
    autoPaymentConfirmationEnabled: boolean;
}
export interface AhamoveConfig {
    apiKey: string;
    mobile?: string;
    isTestMode: boolean;
}
export interface WorkerStatusResponse {
    retryPolicy: RetryPolicy;
    workers: Array<WorkerStatus>;
}
export interface DynamicQRRecordPublic {
    status: DynamicQRStatus;
    qrString: string;
    expiresAt?: Timestamp;
    idempotencyKey: string;
    totalAmountPaid: bigint;
    createdAt: Timestamp;
    qrId: string;
    transactionInfos: Array<TransactionInfo>;
    orderId: OrderId;
    billId: string;
}
export interface WeeklyAnalyticsEntry {
    totalOrders: bigint;
    totalRevenue: bigint;
    weekStart: string;
}
export type ReservationId = bigint;
export interface UpdateMasterMenuItemRequest {
    categoryId?: bigint;
    name?: string;
    unit?: string;
    description?: string;
    imageUrl?: string;
    price?: bigint;
    position?: bigint;
}
export interface BusinessProfileUpdate {
    codSettings?: CodSettings | null;
    brand2Name?: string;
    tableServiceHours?: string;
    brand4Name?: string;
    shippingFeeMode?: ShippingFeeMode;
    deliveryServiceHours?: string;
    brand1Name?: string;
    stripeSecretKey?: string;
    stripeEnabled?: boolean;
    coordinateLatitude?: number;
    sepayApiToken?: string;
    autoShipperEnabled?: boolean;
    stripePublishableKey?: string;
    deliveryRadiusKm?: bigint;
    brand3Name?: string;
    autoPaymentConfirmationApp?: AutoPaymentApp;
    bannerImageUrl?: string;
    sepayEnabled?: boolean;
    brand5Name?: string;
    coordinateLongitude?: number;
    autoPaymentConfirmationEnabled?: boolean;
}
export interface HttpResponse {
    body: Uint8Array;
    headers: Array<[string, string]>;
    upgrade?: boolean;
    status_code: number;
}
export interface CreateMasterMenuItemRequest {
    categoryId: bigint;
    name: string;
    unit?: string;
    description: string;
    imageUrl?: string;
    price: bigint;
    position: bigint;
}
export interface CodOrderRequest {
    deliveryAddress: string;
    deliveryLat: number;
    deliveryLng: number;
    recipientPhone: string;
    restaurantId: RestaurantId;
    notes?: string;
    items: Array<OrderItem__2>;
    recipientName: string;
}
export interface DispatchCenterOrder {
    status: OrderStatus;
    deliveryAddress: string;
    recipientPhone: string;
    createdAt: Timestamp;
    shippingFee?: bigint;
    orderCode: string;
    orderId: OrderId;
    restaurantId: RestaurantId;
    totalAmount: bigint;
    restaurantName: string;
    notes?: string;
    isCod: boolean;
    items: Array<OrderItem__2>;
    recipientName: string;
}
export interface DriverInfo {
    eta?: bigint;
    lat?: number;
    lng?: number;
    vehiclePlate: string;
    name: string;
    phone: string;
}
export interface RestaurantLocationUpdate {
    coordinateLatitude?: number;
    address?: string;
    deliveryRadiusKm?: bigint;
    coordinateLongitude?: number;
}
export interface HttpRequest {
    url: string;
    method: string;
    body: Uint8Array;
    headers: Array<[string, string]>;
}
export type OrderId = bigint;
export interface EnterpriseStaffPermissions {
    permissions: Array<EnterprisePermission>;
    principalId: Principal;
}
export enum AutoPaymentApp {
    Sepay = "Sepay",
    None = "None",
    Tingee = "Tingee"
}
export enum DynamicQRStatus {
    deleted = "deleted",
    expired = "expired",
    pending = "pending",
    paid = "paid"
}
export enum EnterpriseDeviceRole {
    CustomerSupport = "CustomerSupport",
    EnterpriseDelivery = "EnterpriseDelivery",
    Accounting = "Accounting"
}
export enum EnterprisePermission {
    DeviceManagement = "DeviceManagement",
    CustomerSupport = "CustomerSupport",
    EnterpriseDelivery = "EnterpriseDelivery",
    Accounting = "Accounting"
}
export enum InvoiceStatus {
    Error_ = "Error",
    Issued = "Issued",
    NotRequested = "NotRequested",
    Pending = "Pending"
}
export enum OrderStatus {
    Delivered = "Delivered",
    WaitingDriverPayment = "WaitingDriverPayment",
    FindingDriver = "FindingDriver",
    Ready = "Ready",
    WaitingDriver = "WaitingDriver",
    PaymentPending = "PaymentPending",
    Preparing = "Preparing",
    Cancelled = "Cancelled",
    PendingApproval = "PendingApproval",
    DispatchCenter = "DispatchCenter",
    Completed = "Completed",
    Pending = "Pending"
}
export enum OrderType {
    DeliveryOrder = "DeliveryOrder",
    TableOrder = "TableOrder"
}
export enum PaymentMethod__1 {
    Cod = "Cod",
    CreditCard = "CreditCard",
    CustomerOnline = "CustomerOnline",
    CashierTerminal = "CashierTerminal",
    Stripe = "Stripe",
    BankTransfer = "BankTransfer",
    TingeeQR = "TingeeQR",
    SepayQR = "SepayQR",
    ApplePay = "ApplePay"
}
export enum PaymentStatus {
    Failed = "Failed",
    SepayExpired = "SepayExpired",
    Paid = "Paid",
    SepayPending = "SepayPending",
    TingeeExpired = "TingeeExpired",
    WaitingDriverPayment = "WaitingDriverPayment",
    TingeePending = "TingeePending",
    Unpaid = "Unpaid",
    TingeePaid = "TingeePaid",
    SepayPaid = "SepayPaid",
    Pending = "Pending"
}
export enum PendingDynamicQROp {
    status = "status",
    delete_ = "delete",
    generate = "generate"
}
export enum ReservationStatus {
    Arrived = "Arrived",
    Confirmed = "Confirmed",
    Cancelled = "Cancelled",
    Pending = "Pending"
}
export enum ShippingFeeMode {
    RestaurantPays = "RestaurantPays",
    CustomerPays = "CustomerPays"
}
export enum ShippingStatus {
    Delivering = "Delivering",
    SearchingShipper = "SearchingShipper",
    PickedUp = "PickedUp",
    ShipperAccepted = "ShipperAccepted",
    DeliveryFailed = "DeliveryFailed"
}
export enum ShippingTransferStatus {
    notStarted = "notStarted",
    pending = "pending",
    completed = "completed",
    notRequired = "notRequired",
    failed = "failed"
}
export enum StaffRole {
    Cashier = "Cashier",
    Kitchen = "Kitchen",
    Delivery = "Delivery",
    Admin = "Admin",
    KioskOrder = "KioskOrder",
    Waiter = "Waiter"
}
export enum Variant_Active_Revoked {
    Active = "Active",
    Revoked = "Revoked"
}
export enum Variant_NotFound_Unauthorized {
    NotFound = "NotFound",
    Unauthorized = "Unauthorized"
}
export enum Variant_NotFound_Unauthorized_NotTingeePending_AlreadyPaid_AmountMismatch {
    NotFound = "NotFound",
    Unauthorized = "Unauthorized",
    NotTingeePending = "NotTingeePending",
    AlreadyPaid = "AlreadyPaid",
    AmountMismatch = "AmountMismatch"
}
export enum Variant_NotFound_WrongRestaurant_Unauthorized {
    NotFound = "NotFound",
    WrongRestaurant = "WrongRestaurant",
    Unauthorized = "Unauthorized"
}
export enum Variant_StripeNotEnabled_NotFound_Unauthorized {
    StripeNotEnabled = "StripeNotEnabled",
    NotFound = "NotFound",
    Unauthorized = "Unauthorized"
}
export enum Variant_Unauthorized {
    Unauthorized = "Unauthorized"
}
export enum Variant_WrongStatus_NotFound_Unauthorized {
    WrongStatus = "WrongStatus",
    NotFound = "NotFound",
    Unauthorized = "Unauthorized"
}
export enum Variant_active_revoked {
    active = "active",
    revoked = "revoked"
}
export interface backendInterface {
    activateDevice(activationCode: string, intendedRole: StaffRole | null): Promise<{
        __kind__: "ok";
        ok: {
            deviceToken: string;
            role: StaffRole;
            restaurantId: bigint;
            deviceName: string;
        };
    } | {
        __kind__: "err";
        err: {
            __kind__: "alreadyUsed";
            alreadyUsed: null;
        } | {
            __kind__: "expired";
            expired: null;
        } | {
            __kind__: "internal";
            internal: string;
        } | {
            __kind__: "deviceAlreadyHasRole";
            deviceAlreadyHasRole: null;
        } | {
            __kind__: "notFound";
            notFound: null;
        } | {
            __kind__: "roleMismatch";
            roleMismatch: string;
        };
    }>;
    activateEnterpriseDevice(activationCode: string, intendedRole: EnterpriseDeviceRole | null): Promise<{
        __kind__: "ok";
        ok: {
            deviceToken: string;
            role: string;
            deviceId: string;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    addBannerImage(imageUrl: string): Promise<bigint | null>;
    addEnterpriseStaff(principalId: Principal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    addStaffMember(restaurantId: RestaurantId, staffId: Principal, role: StaffRole): Promise<boolean>;
    assignCodDriver(orderId: OrderId, driverPrincipal: Principal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    bookAhamoveShipper(orderId: string): Promise<{
        __kind__: "ok";
        ok: {
            status: string;
            fare: bigint;
            ahamoveOrderId: string;
            distanceKm: number;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    bookDriverForCodOrder(orderId: OrderId): Promise<{
        __kind__: "ok";
        ok: {
            status: string;
            fare: bigint;
            ahamoveOrderId: string;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    bookShipper(orderId: OrderId, restaurantId: RestaurantId): Promise<{
        __kind__: "ok";
        ok: ShipperBookingResult;
    } | {
        __kind__: "err";
        err: string;
    }>;
    cancelOrder(orderId: OrderId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: Variant_WrongStatus_NotFound_Unauthorized;
    }>;
    cancelReservation(id: ReservationId): Promise<boolean>;
    checkCodAllowed(orderTotal: bigint): Promise<boolean>;
    checkFindingDriverTimeout(): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    clearCompletedOrders(restaurantId: RestaurantId): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    confirmAhamoveBooking(orderId: OrderId, ahamoveOrderId: string, fare: bigint, status: string): Promise<{
        __kind__: "ok";
        ok: {
            status: string;
            fare: bigint;
            ahamoveOrderId: string;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    confirmDynamicQRDeleted(payload: DynamicQRDeletedCallback): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    confirmDynamicQRGenerated(payload: DynamicQRGeneratedCallback): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    confirmDynamicQRStatus(payload: DynamicQRStatusCallback): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    confirmPayment(orderId: OrderId, paymentIntentId: string): Promise<{
        __kind__: "ok";
        ok: boolean;
    } | {
        __kind__: "err";
        err: Variant_NotFound_Unauthorized;
    }>;
    confirmPaymentByCashier(orderId: OrderId, restaurantId: RestaurantId): Promise<{
        __kind__: "ok";
        ok: boolean;
    } | {
        __kind__: "err";
        err: Variant_NotFound_WrongRestaurant_Unauthorized;
    }>;
    confirmPaymentByTingeeStatus(orderId: OrderId, totalAmountPaid: bigint, transactionCode: string | null): Promise<{
        __kind__: "ok";
        ok: boolean;
    } | {
        __kind__: "err";
        err: Variant_NotFound_Unauthorized_NotTingeePending_AlreadyPaid_AmountMismatch;
    }>;
    confirmReservation(id: ReservationId): Promise<boolean>;
    confirmTingeeBanks(payload: TingeeBanksCallback): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createCategory(restaurantId: RestaurantId, name: string, position: bigint): Promise<MenuCategoryId>;
    createCodOrder(request: CodOrderRequest): Promise<CodOrderResponse>;
    createMasterCategory(req: CreateMasterCategoryRequest): Promise<{
        __kind__: "ok";
        ok: MasterMenuCategory;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createMasterMenuItem(req: CreateMasterMenuItemRequest): Promise<{
        __kind__: "ok";
        ok: MasterMenuItem;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createMenuItem(restaurantId: RestaurantId, categoryId: MenuCategoryId, name: string, description: string, price: bigint, imageUrl: string | null, available: boolean, unit: string | null): Promise<MenuItemId>;
    createPaymentIntent(orderId: OrderId, method: PaymentMethod__1, restaurantId: RestaurantId): Promise<{
        __kind__: "ok";
        ok: {
            bankDetails?: BankDetails;
            orderId: OrderId;
            totalAmount: bigint;
            currency: string;
            publishableKey?: string;
        };
    } | {
        __kind__: "err";
        err: Variant_StripeNotEnabled_NotFound_Unauthorized;
    }>;
    createReservation(restaurantId: RestaurantId, customerName: string, customerPhone: string, partySize: bigint, date: string, timeSlot: string, durationMinutes: bigint, tableId: TableId | null, notes: string | null, customerEmail: string | null): Promise<ReservationId>;
    createRestaurant(name: string): Promise<RestaurantId>;
    createTable(restaurantId: RestaurantId, tableNumber: string): Promise<TableId>;
    deleteBackgroundImage(id: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteBannerImage(id: bigint): Promise<boolean>;
    deleteCategory(restaurantId: RestaurantId, id: MenuCategoryId): Promise<boolean>;
    deleteDynamicQR(orderId: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteMasterCategory(id: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteMasterMenuItem(id: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteMenuItem(restaurantId: RestaurantId, id: MenuItemId): Promise<boolean>;
    deleteRestaurant(restaurantId: RestaurantId): Promise<boolean>;
    deleteTable(restaurantId: RestaurantId, id: TableId): Promise<boolean>;
    execute(qJson: string): Promise<Result>;
    findNearestRestaurant(lat: number, lng: number): Promise<bigint | null>;
    generateDynamicQR(orderId: string, regenerateNonce: bigint | null): Promise<{
        __kind__: "ok";
        ok: DynamicQRRecordPublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
    generateInvoiceCallbackSecret(): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAhamoveConfig(): Promise<AhamoveConfig | null>;
    getAhamoveOrderStatus(orderId: OrderId): Promise<{
        __kind__: "ok";
        ok: {
            orderStatus: OrderStatus;
            ahamoveOrderId?: string;
            shippingStatus?: ShippingStatus;
            shippingFee?: bigint;
            shipperPhone?: string;
            shippingProvider?: string;
            driverInfo?: DriverInfo;
            shipperName?: string;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAhamoveWorkerConfig(): Promise<{
        __kind__: "ok";
        ok: AhamoveWorkerConfig;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getBannerImages(): Promise<Array<BannerImagePublic>>;
    getBkavInvoiceConfig(): Promise<{
        realGuid?: string;
        realToken?: string;
        demoInvoiceSerial: string;
        prodInvoiceSerial: string;
        invoiceCallbackSecret?: string;
        useDemo: boolean;
        invoiceSerial: string;
        workerPrincipal?: string;
        demoGuid?: string;
        invoiceForm: string;
        demoToken?: string;
        realApiUrl?: string;
        vatRate: bigint;
    }>;
    getBusinessBankDetails(deviceToken: string | null): Promise<BusinessBankDetails | null>;
    getBusinessLogoUrl(): Promise<string>;
    getBusinessProfileInfo(): Promise<{
        domain?: string;
        tingeeMerchantId?: string;
        tingeeBankBin?: string;
        businessName?: string;
        email?: string;
        tingeeVA?: string;
        address?: string;
        brandLogo?: string;
    }>;
    getCodDispatchOrders(): Promise<{
        __kind__: "ok";
        ok: Array<DispatchCenterOrder>;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    getCodSettings(): Promise<CodSettings | null>;
    /**
     * / Returns the current canister cycle balance.
     */
    getCycles(): Promise<bigint>;
    getDailyAnalytics(restaurantId: RestaurantId, startDate: string, endDate: string): Promise<Array<AnalyticsEntry> | null>;
    getDeveloperProfile(): Promise<DeveloperProfile | null>;
    getDispatchCenterOrders(): Promise<{
        __kind__: "ok";
        ok: Array<DispatchCenterOrder>;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    getDynamicQRStatus(orderId: string): Promise<{
        __kind__: "ok";
        ok: DynamicQRStatusResult;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getDynamicQRWorkerConfig(): Promise<DynamicQRWorkerConfig>;
    getInvoiceCallbackSecret(enterpriseId: string): Promise<string | null>;
    getInvoiceInfo(orderId: OrderId): Promise<{
        __kind__: "ok";
        ok: {
            maCQT?: string;
            errorMessage?: string;
            invoiceNo?: string;
            invoiceDate?: string;
            invoiceStatus: string;
        } | null;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    getInvoiceProvider(): Promise<string>;
    getInvoiceWorkerConfig(): Promise<{
        partnerToken: string;
        realGuid: string;
        realToken: string;
        bkavDemoEndpoint: string;
        partnerGUID: string;
        demoInvoiceSerial: string;
        bkavProdEndpoint: string;
        prodInvoiceSerial: string;
        invoiceCallbackSecret: string;
        useDemo: boolean;
        invoiceSerial: string;
        workerPrincipal: string;
        demoGuid: string;
        invoiceForm: string;
        demoToken: string;
        vatRate: number;
    }>;
    getMenuItem(id: MenuItemId): Promise<MenuItem | null>;
    getMyEnterprisePermissions(): Promise<Array<EnterprisePermission>>;
    getMyRestaurantFilter(): Promise<{
        __kind__: "ok";
        ok: Array<RestaurantId> | null;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    getOrder(id: OrderId): Promise<OrderPublic | null>;
    getOrderForTracking(orderId: OrderId): Promise<OrderTrackingPublic | null>;
    getOrderPaymentStatus(orderId: OrderId): Promise<{
        paymentConfirmedAt?: Timestamp;
        paymentStatus: PaymentStatus;
    } | null>;
    getPaymentStatus(orderId: OrderId): Promise<{
        __kind__: "ok";
        ok: PaymentStatus | null;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    getPendingAhamoveBookings(): Promise<Array<PendingAhamoveBookingItem>>;
    getPendingCodPayments(): Promise<Array<{
        orderTotal: bigint;
        shippingFee: bigint;
        orderCode: string;
    }> | null>;
    getPendingDynamicQRs(): Promise<Array<PendingDynamicQRItem>>;
    getPendingInvoices(): Promise<Array<PendingInvoiceItem>>;
    getPublicDeveloperProfile(developerPrincipalId: Principal): Promise<DeveloperProfile | null>;
    getRestaurant(id: RestaurantId): Promise<RestaurantPublic | null>;
    getRestaurantOverrides(restaurantId: bigint): Promise<Array<bigint>>;
    getRestaurantStripePublishableKey(restaurantId: RestaurantId): Promise<string | null>;
    getRetryPolicy(): Promise<RetryPolicy>;
    getSavedRecipientInfo(): Promise<SavedRecipientInfo | null>;
    /**
     * / Returns the current schema version of the canister's data model.
     */
    getSchemaVersion(): Promise<bigint>;
    getSellerInfo(): Promise<{
        phone?: string;
        taxCode?: string;
    }>;
    getStaffRole(restaurantId: RestaurantId, staffId: Principal): Promise<StaffRole | null>;
    getSuggestionConfig(): Promise<SuggestionConfig>;
    getTable(id: TableId): Promise<Table | null>;
    getTingeeBanks(): Promise<{
        __kind__: "ok";
        ok: Array<TingeeBank>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getTingeeConfig(): Promise<{
        clientId: string;
        secretToken: string;
        orderPrefix: string;
    } | null>;
    getTingeeConfigForDevice(token: string): Promise<{
        clientId: string;
        secretToken: string;
        orderPrefix: string;
    } | null>;
    getWebhookEndpointInfo(): Promise<string>;
    getWeeklyAnalytics(restaurantId: RestaurantId, startWeek: string, endWeek: string): Promise<Array<WeeklyAnalyticsEntry> | null>;
    getWorkerStatus(): Promise<WorkerStatusResponse>;
    grantEnterprisePermission(principalId: Principal, permission: EnterprisePermission): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    handleInvoiceCallback(body: Uint8Array, headers: Array<[string, string]>): Promise<{
        status: number;
        body: Uint8Array;
    }>;
    hasEnterprisePermission(principalId: Principal, permission: EnterprisePermission): Promise<boolean>;
    hasInvoiceCallbackSecret(): Promise<boolean>;
    hasTingeeClientIdConfigured(): Promise<boolean>;
    hasTingeeConfigured(): Promise<boolean>;
    hasTingeeSecretToken(restaurantId: RestaurantId): Promise<boolean>;
    hasTingeeSecretTokenConfigured(): Promise<boolean>;
    http_request(req: HttpRequest): Promise<HttpResponse>;
    http_request_update(req: HttpRequest): Promise<HttpResponse>;
    isEnterpriseDeliveryStaff(): Promise<boolean>;
    listActiveOrdersByRestaurant(restaurantId: RestaurantId, dateFilter: string | null): Promise<{
        __kind__: "ok";
        ok: Array<OrderPublic>;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    listAllOrdersForAccounting(restaurantId: RestaurantId): Promise<{
        __kind__: "ok";
        ok: Array<OrderPublic>;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    listAllRestaurants(): Promise<Array<RestaurantPublic>>;
    listBackgroundImages(): Promise<Array<BackgroundImage>>;
    listCategories(restaurantId: RestaurantId): Promise<Array<MenuCategory>>;
    listDeliveryOrders(restaurantId: RestaurantId, dateFilter: string | null): Promise<{
        __kind__: "ok";
        ok: Array<OrderPublic>;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    listDeliveryOrdersEnterprise(dateFilter: string | null): Promise<{
        __kind__: "ok";
        ok: Array<OrderPublic>;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    listDeliveryOrdersForKitchen(restaurantId: RestaurantId, dateFilter: string | null): Promise<{
        __kind__: "ok";
        ok: Array<OrderPublic>;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    listDevices(restaurantId: bigint): Promise<{
        __kind__: "ok";
        ok: Array<DeviceRecordPublic>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    listEnterpriseDevices(): Promise<{
        __kind__: "ok";
        ok: Array<EnterpriseDeviceRecord>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    listEnterpriseStaff(): Promise<{
        __kind__: "ok";
        ok: Array<EnterpriseStaffPermissions>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    listMasterCategories(): Promise<Array<MasterMenuCategory>>;
    listMasterMenuItems(): Promise<Array<MasterMenuItem>>;
    listMenuItems(restaurantId: RestaurantId): Promise<Array<MenuItem>>;
    listMenuItemsByCategory(restaurantId: RestaurantId, categoryId: MenuCategoryId): Promise<Array<MenuItem>>;
    listMyRestaurants(): Promise<Array<RestaurantPublic>>;
    listOrdersByRestaurant(restaurantId: RestaurantId): Promise<{
        __kind__: "ok";
        ok: Array<OrderPublic>;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    listOrdersByStatus(restaurantId: RestaurantId, status: OrderStatus): Promise<{
        __kind__: "ok";
        ok: Array<OrderPublic>;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    listOrdersByTable(restaurantId: RestaurantId, tableIdentifier: string): Promise<{
        __kind__: "ok";
        ok: Array<OrderPublic>;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    listReservationsByRestaurant(restaurantId: RestaurantId): Promise<Array<ReservationPublic>>;
    listRestaurantsNearby(latitude: number, longitude: number): Promise<Array<RestaurantId>>;
    listTables(restaurantId: RestaurantId): Promise<Array<Table>>;
    markTingeeExpired(orderId: OrderId): Promise<{
        __kind__: "ok";
        ok: boolean;
    } | {
        __kind__: "err";
        err: Variant_NotFound_Unauthorized;
    }>;
    placeDeliveryOrder(restaurantId: RestaurantId, items: Array<OrderItem>, notes: string | null, deliveryAddress: string, customerName: string, customerPhone: string, vatRequest: boolean, vatInfo: VatInfo | null, shippingFee: bigint | null, deliveryLat: number | null, deliveryLng: number | null, isCod: boolean): Promise<{
        __kind__: "ok";
        ok: {
            orderCode?: string;
            orderId: OrderId;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    placeOrder(restaurantId: RestaurantId, tableIdentifier: string, items: Array<OrderItem>, notes: string | null, vatRequest: boolean, vatInfo: VatInfo | null): Promise<{
        orderCode?: string;
        orderId: OrderId;
    }>;
    postWorkerHeartbeat(workerId: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    printKioskBill(orderId: OrderId): Promise<KioskBill | null>;
    receiveAhamoveWebhook(orderId: string, newStatus: string, driverInfo: DriverInfo | null, signature: string, requestBody: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    /**
     * / Returns the current schema version of the canister's data model.
     */
    receiveTingeeWebhook(body: Uint8Array, headers: Array<[string, string]>): Promise<string>;
    registerDevice(restaurantId: bigint, role: StaffRole, deviceName: string): Promise<{
        __kind__: "ok";
        ok: {
            deviceId: string;
            activationCode: string;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    registerEnterpriseDevice(role: EnterpriseDeviceRole, deviceName: string): Promise<{
        __kind__: "ok";
        ok: {
            deviceId: string;
            activationCode: string;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    reissueBkavInvoice(orderId: OrderId): Promise<string>;
    removeEnterpriseStaff(principalId: Principal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    removeStaffMember(restaurantId: RestaurantId, staffId: Principal): Promise<boolean>;
    retryBookShipper(orderId: string): Promise<{
        __kind__: "ok";
        ok: {
            fare: bigint;
            ahamoveOrderId: string;
            distanceKm: number;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    revokeDevice(deviceId: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    revokeEnterpriseDevice(deviceId: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    revokeEnterprisePermission(principalId: Principal, permission: EnterprisePermission): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveAhamoveConfig(config: AhamoveConfig): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveBkavCommonConfig(demoSerial: string | null, prodSerial: string | null, form: string | null, useDemo: boolean, vatRate: bigint, workerPrincipal: string | null): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveInvoiceProvider(provider: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveMyRestaurantFilter(restaurantIds: Array<RestaurantId>): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    saveRealBkavConfig(guid: string, token: string, apiUrl: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveRecipientInfo(recipientName: string, recipientPhone: string, locationName: string): Promise<void>;
    saveSellerInfo(taxCode: string, phone: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveTingeeClientId(clientId: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveTingeeConfig(clientId: string, secretToken: string, orderPrefix: string): Promise<void>;
    saveTingeeSecretToken(token: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    schema(): Promise<string>;
    setCodSettings(settings: CodSettings | null): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setMasterMenuItemActive(id: bigint, isActive: boolean): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setMenuItemAvailability(restaurantId: RestaurantId, id: MenuItemId, available: boolean): Promise<boolean>;
    setRestaurantItemOverride(restaurantId: bigint, masterItemId: bigint, isAvailable: boolean): Promise<void>;
    setRetryPolicy(maxRetries: bigint, baseDelayMs: bigint, maxDelayMs: bigint, backoffMultiplier: number): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setSuggestionConfig(config: SuggestionConfig): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    settleTable(restaurantId: RestaurantId, tableIdentifier: string): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    updateAutoPaymentConfirmationSettings(restaurantId: RestaurantId, enabled: boolean, app: AutoPaymentApp): Promise<boolean>;
    updateBannerImage(id: bigint, imageUrl: string, sortOrder: bigint): Promise<boolean>;
    updateBusinessBankDetails(accountNumber: string, bankName: string, accountHolderName: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateBusinessLogoUrl(url: string): Promise<boolean>;
    updateBusinessProfile(patch: BusinessProfilePatch): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateCategory(restaurantId: RestaurantId, id: MenuCategoryId, name: string, position: bigint): Promise<boolean>;
    updateMasterCategory(id: bigint, req: UpdateMasterCategoryRequest): Promise<{
        __kind__: "ok";
        ok: MasterMenuCategory;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateMasterMenuItem(id: bigint, req: UpdateMasterMenuItemRequest): Promise<{
        __kind__: "ok";
        ok: MasterMenuItem;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateMenuItem(restaurantId: RestaurantId, id: MenuItemId, name: string, description: string, price: bigint, imageUrl: string | null, available: boolean, unit: string | null): Promise<boolean>;
    updateOrderStatus(id: OrderId, newStatus: OrderStatus): Promise<{
        __kind__: "ok";
        ok: boolean;
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
    updateReservationStatus(id: ReservationId, newStatus: ReservationStatus): Promise<boolean>;
    updateRestaurantLocation(restaurantId: RestaurantId, update: RestaurantLocationUpdate): Promise<boolean>;
    updateRestaurantName(restaurantId: RestaurantId, name: string): Promise<boolean>;
    updateRestaurantProfile(restaurantId: RestaurantId, update: BusinessProfileUpdate): Promise<boolean>;
    updateRestaurantStripeKeys(restaurantId: RestaurantId, publishableKey: string, secretKey: string): Promise<boolean>;
    updateShipperStatus(orderId: OrderId, shipperName: string, shipperPhone: string, shippingStatus: ShippingStatus): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateShippingTransferStatus(orderId: string, status: ShippingTransferStatus): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateTable(restaurantId: RestaurantId, id: TableId, tableNumber: string): Promise<boolean>;
    uploadBackgroundImage(url: string, fileName: string): Promise<{
        __kind__: "ok";
        ok: BackgroundImage;
    } | {
        __kind__: "err";
        err: string;
    }>;
    upsertDeveloperProfile(businessOwnerPrincipalId: Principal, email: string): Promise<DeveloperProfile>;
    verifyDeviceToken(deviceToken: string): Promise<{
        __kind__: "ok";
        ok: {
            role: StaffRole;
            restaurantId: bigint;
            deviceName: string;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    verifyEnterpriseDeviceToken(deviceToken: string): Promise<EnterpriseDeviceRole | null>;
    verifyOrderForBooking(orderId: OrderId): Promise<{
        __kind__: "ok";
        ok: {
            status: string;
            valid: boolean;
            restaurantId?: string;
        };
    } | {
        __kind__: "err";
        err: Variant_Unauthorized;
    }>;
}
