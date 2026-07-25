// ─── Translation keys ────────────────────────────────────────────────────────

export type Language = "vi" | "en";

export interface Translations {
  // Navigation
  nav: {
    menu: string;
    cart: string;
    orders: string;
    admin: string;
    signIn: string;
    signOut: string;
    myRestaurants: string;
  };

  // Common
  common: {
    loading: string;
    error: string;
    retry: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    confirm: string;
    close: string;
    back: string;
    search: string;
    all: string;
    available: string;
    unavailable: string;
    yes: string;
    no: string;
    noResults: string;
    required: string;
    optional: string;
    total: string;
    subtotal: string;
    quantity: string;
    note: string;
    name: string;
    description: string;
    price: string;
    status: string;
    actions: string;
    createNew: string;
    viewAll: string;
    refresh: string;
  };

  // Homepage
  home: {
    hero: {
      title: string;
      subtitle: string;
      ctaAdmin: string;
      ctaOrder: string;
    };
    steps: {
      title: string;
      scan: { title: string; desc: string };
      choose: { title: string; desc: string };
      enjoy: { title: string; desc: string };
    };
    features: {
      title: string;
      qr: { title: string; desc: string };
      realtime: { title: string; desc: string };
      multilang: { title: string; desc: string };
      admin: { title: string; desc: string };
    };
  };

  // Order / Customer
  order: {
    tableLabel: string;
    noMenu: string;
    noItems: string;
    addToCart: string;
    added: string;
    cartEmpty: string;
    cartTitle: string;
    checkout: string;
    placeOrder: string;
    orderPlaced: string;
    orderPlacedDesc: string;
    continueBrowsing: string;
    viewOrders: string;
    viewHistory: string;
    itemNote: string;
    itemNotePlaceholder: string;
    specialInstructions: string;
    specialInstructionsPlaceholder: string;
    remove: string;
    yourOrders: string;
    noOrders: string;
    orderNumber: string;
    placedAt: string;
    items: string;
    remoteOrder: string;
    enterTable: string;
    tableNumber: string;
    tableNumberPlaceholder: string;
    confirmTable: string;
  };

  // Admin – login
  adminLogin: {
    title: string;
    subtitle: string;
    signInButton: string;
    signingIn: string;
    description: string;
  };

  // Admin – dashboard
  dashboard: {
    title: string;
    subtitle: string;
    createRestaurant: string;
    restaurantNamePlaceholder: string;
    creating: string;
    noRestaurants: string;
    noRestaurantsDesc: string;
    manageOrders: string;
    manageMenu: string;
    manageTables: string;
    address: string;
    addressPlaceholder: string;
    getLocation: string;
    locationSet: string;
    viewOnMap: string;
  };

  // Admin – menu editor
  menuEditor: {
    title: string;
    addCategory: string;
    categoryName: string;
    categoryNamePlaceholder: string;
    addItem: string;
    editItem: string;
    itemName: string;
    itemNamePlaceholder: string;
    itemDescription: string;
    itemDescriptionPlaceholder: string;
    itemPrice: string;
    itemPricePlaceholder: string;
    itemImage: string;
    itemImagePlaceholder: string;
    markAvailable: string;
    markUnavailable: string;
    deleteItem: string;
    confirmDelete: string;
    noCategories: string;
    noCategoriesDesc: string;
    noItems: string;
    noItemsDesc: string;
    saveChanges: string;
    savingChanges: string;
    position: string;
    uploadImage: string;
    uploading: string;
    removeImage: string;
    imageFileTooLarge: string;
    imageNotSquare: string;
  };

  // Customer – order history
  history: {
    title: string;
    subtitle: string;
    noOrders: string;
    noOrdersDesc: string;
    backToMenu: string;
    ordersCount: string;
  };

  // Admin – business profile
  businessProfile: {
    title: string;
    subtitle: string;
    mainMenuLabel: string;
    logo: string;
    logoUrl: string;
    businessName: string;
    businessNamePlaceholder: string;
    address: string;
    addressPlaceholder: string;
    email: string;
    emailPlaceholder: string;
    domain: string;
    domainPlaceholder: string;
    orderingDomain: string;
    orderingDomainPlaceholder: string;
    orderingDomainHint: string;
    orderingDomainDeliveryLabel: string;
    orderingDomainDeliveryLinkLabel: string;
    copyLink: string;
    saveProfile: string;
    saving: string;
    profileSaved: string;
    profileError: string;
    profileLink: string;
    noRestaurant: string;
    // Bank
    bankSection: string;
    accountNumber: string;
    accountNumberPlaceholder: string;
    bankName: string;
    bankNamePlaceholder: string;
    accountHolderName: string;
    accountHolderNamePlaceholder: string;
    // Stripe
    stripeSection: string;
    stripeToggle: string;
    stripeDisabledNote: string;
    stripePublishableKey: string;
    stripePublishableKeyHelp: string;
    stripeSecretKey: string;
    stripeSecretKeyHelp: string;
    saveStripeKeys: string;
    savingStripeKeys: string;
    stripeKeysSaved: string;
    stripeKeysError: string;
    // Delete
    deleteRestaurant: string;
    deleteRestaurantConfirmTitle: string;
    deleteRestaurantConfirmDesc: string;
  };

  // Admin – restaurant settings
  restaurantSettings: {
    title: string;
    subtitle: string;
    navLabel: string;
    restaurantName: string;
    restaurantNamePlaceholder: string;
    bannerImage: string;
    bannerImageHint: string;
    tableServiceHours: string;
    tableServiceHoursPlaceholder: string;
    deliveryServiceHours: string;
    deliveryServiceHoursPlaceholder: string;
    saveSettings: string;
    saving: string;
    settingsSaved: string;
    settingsError: string;
    nameSaved: string;
    nameError: string;
    // Delivery location
    locationSection: string;
    locationLatitude: string;
    locationLatitudePlaceholder: string;
    locationLongitude: string;
    locationLongitudePlaceholder: string;
    deliveryRadius: string;
    deliveryRadiusPlaceholder: string;
    deliveryRadiusHint: string;
    useCurrentLocation: string;
    detectingLocation: string;
    locationDetected: string;
    locationError: string;
    saveLocation: string;
    locationSaved: string;
    locationSaveError: string;
    mapPreview: string;
    // Staff access
    staffAccess: {
      sectionTitle: string;
      sectionDesc: string;
      gpsRadiusLabel: string;
      gpsRadiusHint: string;
      saveRadius: string;
      savingRadius: string;
      radiusSaved: string;
      radiusError: string;
      noToken: string;
      createToken: string;
      createNewToken: string;
      creating: string;
      tokenCreated: string;
      tokenError: string;
      copyLink: string;
      copied: string;
      saveQrCode: string;
      confirmRevoke: string;
    };
  };

  // Admin – tables
  tables: {
    title: string;
    addTable: string;
    tableNumber: string;
    tableNumberPlaceholder: string;
    qrCode: string;
    downloadQR: string;
    deleteTable: string;
    confirmDelete: string;
    noTables: string;
    noTablesDesc: string;
    scanInstruction: string;
    tableId: string;
    copyLink: string;
    linkCopied: string;
  };

  // Admin – orders
  orders: {
    title: string;
    activeOrders: string;
    allOrders: string;
    kitchenTab: string;
    waiterTab: string;
    cashierTab: string;
    deliveryOrdersTab: string;
    noActiveOrders: string;
    noOrders: string;
    orderNumber: string;
    table: string;
    placedAt: string;
    items: string;
    total: string;
    status: string;
    markPreparing: string;
    markReady: string;
    markCompleted: string;
    markDelivered: string;
    clearCompleted: string;
    confirmClear: string;
    statusPending: string;
    statusPreparing: string;
    statusReady: string;
    statusCompleted: string;
    statusCancelled: string;
    autoRefresh: string;
    readyForDelivery: string;
    noReadyOrders: string;
    tableTotal: string;
    grandTotal: string;
    noCompletedForCashier: string;
    // Delivery management sub-tabs
    deliveryPendingTab: string;
    deliveryPreparingTab: string;
    deliveryReadyTab: string;
    deliveryDeliveredTab: string;
    // Delivery management buttons
    startPreparing: string;
    markReadyForDelivery: string;
    markAsDelivered: string;
    noDeliveryOrdersInTab: string;
    deliveredBadge: string;
  };

  // Admin – waiter / delivery
  waiter: {
    navTitle: string;
  };

  // Admin – cashier
  cashier: {
    title: string;
    subtitle: string;
    grandTotal: string;
    tableCount: string;
    orderCount: string;
    settleTable: string;
    settling: string;
    settleConfirm: string;
    noCompletedOrders: string;
    noCompletedOrdersDesc: string;
    tableSubtotal: string;
    completedOrders: string;
    settledSuccess: string;
    refreshing: string;
    tableOrdersTab: string;
    deliveryOrdersTab: string;
    shippingFee: string;
    updateShippingFee: string;
    shippingFeePending: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    noDeliveryOrders: string;
    noDeliveryOrdersDesc: string;
    unpaidGroup: string;
    paidNotServedGroup: string;
    completedGroup: string;
  };

  // Payment
  payment: {
    payNow: string;
    processing: string;
    success: string;
    failed: string;
    retry: string;
    collectPayment: string;
    totalAmount: string;
    confirmPayment: string;
    alreadyPaid: string;
  };

  // Reservation
  reservation: {
    title: string;
    subtitle: string;
    fullName: string;
    fullNamePlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    partySize: string;
    date: string;
    timeSlot: string;
    duration: string;
    notes: string;
    notesPlaceholder: string;
    submitButton: string;
    submitting: string;
    successTitle: string;
    successDesc: string;
    successDetails: string;
    conflictTitle: string;
    conflictDesc: string;
    tryAnotherTime: string;
    noRestaurant: string;
    backToMenu: string;
    minutesSuffix: string;
    partySizeLabel: string;
    bookingRef: string;
  };

  // Developer Profile
  developerProfile: {
    title: string;
    subtitle: string;
    mainMenuLabel: string;
    developerPrincipalId: string;
    developerPrincipalIdHint: string;
    businessOwnerPrincipalId: string;
    businessOwnerPrincipalIdPlaceholder: string;
    email: string;
    emailPlaceholder: string;
    copy: string;
    copied: string;
    saveProfile: string;
    saving: string;
    profileSaved: string;
    profileError: string;
    principalInvalid: string;
    // Access guard
    accessDeniedTitle: string;
    accessDeniedMessage: string;
    yourPrincipalId: string;
    logout: string;
  };

  // Analytics
  analytics: {
    title: string;
    subtitle: string;
    totalOrders: string;
    totalRevenue: string;
    noData: string;
    date: string;
    week: string;
    orders: string;
    revenue: string;
    weekLabel: string;
    byDay: string;
    byWeek: string;
    from: string;
    to: string;
    reset: string;
  };

  // Units
  units: {
    weight: string;
    weightSmall: string;
    volume: string;
    volumeSmall: string;
    serving: string;
  };

  // Banner images
  banner: {
    images: string;
    addImage: string;
    imageUrl: string;
    delete: string;
    noImages: string;
  };

  // Delivery ordering
  delivery: {
    step1Title: string;
    step2Title: string;
    step3Title: string;
    step4Title: string;
    deliveryAddress: string;
    addressPlaceholder: string;
    detectLocation: string;
    detectingLocation: string;
    locationDetected: string;
    locationError: string;
    orEnterManually: string;
    customerName: string;
    customerNamePlaceholder: string;
    customerPhone: string;
    customerPhonePlaceholder: string;
    contactInfo: string;
    continueToRestaurant: string;
    selectRestaurant: string;
    selectRestaurantDesc: string;
    noRestaurantsAvailable: string;
    continueToMenu: string;
    backToAddress: string;
    backToRestaurant: string;
    orderSummary: string;
    shippingFee: string;
    shippingFeePending: string;
    grandTotal: string;
    placeDeliveryOrder: string;
    placeOrderFailed: string;
    orderPlaced: string;
    orderPlacedDesc: string;
    deliveryingTo: string;
    pendingShippingNote: string;
    proceedToCheckout: string;
    addressRequired: string;
    nameRequired: string;
    phoneRequired: string;
    locationName: string;
    useMyLocation: string;
    savedSuccess: string;
    saveInfo: string;
    // Delivery history
    historyTitle: string;
    historySubtitle: string;
    historyEmpty: string;
    historyEmptyDesc: string;
    historyBack: string;
    historyOrdersCount: string;
    historyRestaurant: string;
    historyDeliveryTo: string;
    historyViewHistory: string;
    // Address step
    enterYourAddress: string;
    useCurrentLocation: string;
    orTypeAddress: string;
    confirmLocation: string;
    skipLocation: string;
    deliveryRadiusOk: string;
    deliveryRadiusOver: string;
    kmAway: string;
    noDelivery: string;
    // Delivery order management
    copyAddress: string;
    addressCopied: string;
    callCustomer: string;
    qrCodeTitle: string;
    qrCodeExpand: string;
  };
}

// ─── Vietnamese ───────────────────────────────────────────────────────────────

const vi: Translations = {
  nav: {
    menu: "Thực đơn",
    cart: "Giỏ hàng",
    orders: "Đơn hàng",
    admin: "Quản trị",
    signIn: "Đăng nhập",
    signOut: "Đăng xuất",
    myRestaurants: "Nhà hàng của tôi",
  },

  common: {
    loading: "Đang tải...",
    error: "Đã xảy ra lỗi",
    retry: "Thử lại",
    save: "Lưu",
    cancel: "Hủy",
    delete: "Xóa",
    edit: "Sửa",
    add: "Thêm",
    confirm: "Xác nhận",
    close: "Đóng",
    back: "Quay lại",
    search: "Tìm kiếm",
    all: "Tất cả",
    available: "Còn hàng",
    unavailable: "Hết hàng",
    yes: "Có",
    no: "Không",
    noResults: "Không có kết quả",
    required: "Bắt buộc",
    optional: "Tùy chọn",
    total: "Tổng cộng",
    subtotal: "Tạm tính",
    quantity: "Số lượng",
    note: "Ghi chú",
    name: "Tên",
    description: "Mô tả",
    price: "Giá",
    status: "Trạng thái",
    actions: "Thao tác",
    createNew: "Tạo mới",
    viewAll: "Xem tất cả",
    refresh: "Làm mới",
  },

  home: {
    hero: {
      title: "Gọi món thông minh",
      subtitle:
        "Quét mã QR tại bàn hoặc đặt món từ xa — nhanh chóng, tiện lợi, không cần gọi phục vụ.",
      ctaAdmin: "Quản lý nhà hàng",
      ctaOrder: "Xem thực đơn",
    },
    steps: {
      title: "Cách thức hoạt động",
      scan: {
        title: "Quét mã QR",
        desc: "Khách hàng quét mã QR tại bàn để truy cập thực đơn ngay lập tức.",
      },
      choose: {
        title: "Chọn món",
        desc: "Duyệt thực đơn, thêm vào giỏ hàng và ghi chú yêu cầu đặc biệt.",
      },
      enjoy: {
        title: "Thưởng thức",
        desc: "Đơn hàng được gửi đến bếp ngay lập tức. Chỉ cần thư giãn và chờ đợi.",
      },
    },
    features: {
      title: "Tính năng nổi bật",
      qr: {
        title: "QR tại bàn",
        desc: "Mỗi bàn có mã QR riêng. Khách quét và gọi món không cần app.",
      },
      realtime: {
        title: "Thời gian thực",
        desc: "Đơn hàng mới hiển thị ngay trên dashboard bếp, không bỏ sót.",
      },
      multilang: {
        title: "Song ngữ",
        desc: "Giao diện hỗ trợ Tiếng Việt và English cho khách quốc tế.",
      },
      admin: {
        title: "Quản trị dễ dàng",
        desc: "Quản lý thực đơn, bàn ăn và đơn hàng từ một bảng điều khiển.",
      },
    },
  },

  order: {
    tableLabel: "Bàn số",
    noMenu: "Thực đơn chưa có sẵn.",
    noItems: "Chưa có món nào trong danh mục này.",
    addToCart: "Thêm vào giỏ",
    added: "Đã thêm",
    cartEmpty: "Giỏ hàng trống",
    cartTitle: "Giỏ hàng của bạn",
    checkout: "Thanh toán",
    placeOrder: "Đặt hàng",
    orderPlaced: "Đặt hàng thành công!",
    orderPlacedDesc: "Đơn hàng của bạn đã được gửi đến bếp.",
    continueBrowsing: "Tiếp tục xem thực đơn",
    viewOrders: "Xem đơn hàng",
    viewHistory: "Lịch sử đặt món",
    itemNote: "Ghi chú món",
    itemNotePlaceholder: "Ví dụ: không hành, ít cay...",
    specialInstructions: "Yêu cầu đặc biệt",
    specialInstructionsPlaceholder: "Dị ứng thực phẩm, yêu cầu đặc biệt...",
    remove: "Xóa",
    yourOrders: "Đơn hàng của bạn",
    noOrders: "Chưa có đơn hàng nào.",
    orderNumber: "Đơn #",
    placedAt: "Đặt lúc",
    items: "món",
    remoteOrder: "Đặt món từ xa",
    enterTable: "Nhập số bàn của bạn",
    tableNumber: "Số bàn",
    tableNumberPlaceholder: "Ví dụ: 5",
    confirmTable: "Xác nhận bàn",
  },

  adminLogin: {
    title: "Đăng nhập Quản trị",
    subtitle: "Đăng nhập để quản lý nhà hàng của bạn",
    signInButton: "Đăng nhập với Internet Identity",
    signingIn: "Đang đăng nhập...",
    description: "Sử dụng Internet Identity để đăng nhập an toàn.",
  },

  dashboard: {
    title: "Nhà hàng của tôi",
    subtitle: "Quản lý nhà hàng và theo dõi đơn hàng",
    createRestaurant: "Tạo nhà hàng mới",
    restaurantNamePlaceholder: "Tên nhà hàng...",
    creating: "Đang tạo...",
    noRestaurants: "Chưa có nhà hàng nào",
    noRestaurantsDesc:
      "Tạo nhà hàng đầu tiên của bạn để bắt đầu nhận đơn hàng.",
    manageOrders: "Quản lý đơn hàng",
    manageMenu: "Quản lý thực đơn",
    manageTables: "Quản lý bàn",
    address: "Địa chỉ",
    addressPlaceholder: "Nhập địa chỉ nhà hàng...",
    getLocation: "Lấy vị trí",
    locationSet: "Đã lấy vị trí",
    viewOnMap: "Xem bản đồ",
  },

  menuEditor: {
    title: "Quản lý thực đơn",
    addCategory: "Thêm danh mục",
    categoryName: "Tên danh mục",
    categoryNamePlaceholder: "Ví dụ: Món khai vị",
    addItem: "Thêm món",
    editItem: "Sửa món",
    itemName: "Tên món",
    itemNamePlaceholder: "Ví dụ: Phở bò tái",
    itemDescription: "Mô tả",
    itemDescriptionPlaceholder: "Mô tả ngắn về món ăn",
    itemPrice: "Giá (VND)",
    itemPricePlaceholder: "Ví dụ: 85000",
    itemImage: "Hình ảnh (URL)",
    itemImagePlaceholder: "https://...",
    markAvailable: "Đánh dấu còn hàng",
    markUnavailable: "Đánh dấu hết hàng",
    deleteItem: "Xóa món",
    confirmDelete: "Bạn có chắc muốn xóa món này?",
    noCategories: "Chưa có danh mục",
    noCategoriesDesc: "Thêm danh mục đầu tiên để bắt đầu xây dựng thực đơn.",
    noItems: "Chưa có món",
    noItemsDesc: "Thêm món đầu tiên vào danh mục này.",
    saveChanges: "Lưu thay đổi",
    savingChanges: "Đang lưu...",
    position: "Thứ tự",
    uploadImage: "Tải ảnh lên",
    uploading: "Đang tải...",
    removeImage: "Xóa ảnh",
    imageFileTooLarge: "Ảnh quá lớn. Vui lòng chọn ảnh dưới 500 KB.",
    imageNotSquare:
      "Khuyến nghị dùng ảnh vuông (tỉ lệ 1:1) để hiển thị đẹp nhất.",
  },

  businessProfile: {
    title: "Hồ sơ Doanh nghiệp",
    subtitle:
      "Thông tin doanh nghiệp dùng trong mã QR và thanh toán chuyển khoản",
    mainMenuLabel: "Hồ sơ Doanh nghiệp",
    logo: "Logo doanh nghiệp",
    logoUrl: "URL logo",
    businessName: "Tên Doanh nghiệp",
    businessNamePlaceholder: "Ví dụ: Nhà hàng Phở Hà Nội",
    address: "Địa chỉ",
    addressPlaceholder: "Ví dụ: 123 Nguyễn Huệ, Q.1, TP.HCM",
    email: "Email liên hệ",
    emailPlaceholder: "Ví dụ: contact@nhahang.com",
    domain: "Tên miền",
    domainPlaceholder: "Ví dụ: nhahang.com",
    orderingDomain: "Tên miền đặt món",
    orderingDomainPlaceholder: "Ví dụ: order.nhahang.com",
    orderingDomainHint: "Tên miền này sẽ được dùng trong mã QR của bàn ăn.",
    orderingDomainDeliveryLabel: "Trang đặt món từ xa",
    orderingDomainDeliveryLinkLabel: "Đường dẫn đặt món từ xa:",
    copyLink: "Sao chép",
    saveProfile: "Lưu hồ sơ",
    saving: "Đang lưu...",
    profileSaved: "Đã lưu hồ sơ thành công!",
    profileError: "Không thể lưu hồ sơ. Vui lòng thử lại.",
    profileLink: "Hồ sơ",
    noRestaurant: "Chưa có nhà hàng. Vui lòng tạo nhà hàng trước.",
    bankSection: "Thông tin ngân hàng",
    accountNumber: "Số tài khoản",
    accountNumberPlaceholder: "Nhập số tài khoản",
    bankName: "Tên ngân hàng",
    bankNamePlaceholder: "Vd: Vietcombank, BIDV, Techcombank",
    accountHolderName: "Tên chủ tài khoản",
    accountHolderNamePlaceholder: "Nhập tên chủ tài khoản",
    stripeSection: "Thanh toán thẻ & Apple Pay (Stripe)",
    stripeToggle: "Bật thanh toán thẻ / Apple Pay",
    stripeDisabledNote:
      "Đang tắt — khách chỉ có thể thanh toán bằng chuyển khoản",
    stripePublishableKey: "Stripe Publishable Key",
    stripePublishableKeyHelp: "Bắt đầu bằng pk_live_ hoặc pk_test_",
    stripeSecretKey: "Stripe Secret Key",
    stripeSecretKeyHelp: "Giữ bí mật — không chia sẻ với bất kỳ ai",
    saveStripeKeys: "Lưu Stripe Keys",
    savingStripeKeys: "Đang lưu...",
    stripeKeysSaved: "Đã lưu Stripe Keys thành công!",
    stripeKeysError: "Không thể lưu Stripe Keys. Vui lòng thử lại.",
    deleteRestaurant: "Xóa nhà hàng",
    deleteRestaurantConfirmTitle: "Xác nhận xóa",
    deleteRestaurantConfirmDesc:
      "Bạn có chắc muốn xóa nhà hàng này? Hành động này không thể hoàn tác.",
  },

  restaurantSettings: {
    title: "Cài đặt Nhà hàng",
    subtitle: "Tên, ảnh banner và giờ phục vụ của nhà hàng này",
    navLabel: "Cài đặt Nhà hàng",
    restaurantName: "Tên nhà hàng",
    restaurantNamePlaceholder: "Nhập tên nhà hàng",
    bannerImage: "Ảnh banner nhà hàng",
    bannerImageHint: "Khuyến nghị tỉ lệ 3:1, tối đa 500KB",
    tableServiceHours: "Giờ phục vụ tại bàn",
    tableServiceHoursPlaceholder: "08:00 - 22:00",
    deliveryServiceHours: "Giờ chuyển đồ ăn",
    deliveryServiceHoursPlaceholder: "08:00 - 22:00",
    saveSettings: "Lưu cài đặt",
    saving: "Đang lưu...",
    settingsSaved: "Đã lưu cài đặt thành công!",
    settingsError: "Không thể lưu cài đặt. Vui lòng thử lại.",
    nameSaved: "Đã cập nhật tên nhà hàng!",
    nameError: "Không thể cập nhật tên. Vui lòng thử lại.",
    locationSection: "Vị trí giao hàng",
    locationLatitude: "Vĩ độ (Latitude)",
    locationLatitudePlaceholder: "Ví dụ: 21.0278",
    locationLongitude: "Kinh độ (Longitude)",
    locationLongitudePlaceholder: "Ví dụ: 105.8342",
    deliveryRadius: "Bán kính giao hàng (km)",
    deliveryRadiusPlaceholder: "Ví dụ: 5",
    deliveryRadiusHint: "Để trống hoặc nhập 0 = không giới hạn bán kính",
    useCurrentLocation: "Dùng vị trí hiện tại",
    detectingLocation: "Đang xác định vị trí...",
    locationDetected: "Đã lấy vị trí",
    locationError: "Không thể xác định vị trí. Vui lòng nhập thủ công.",
    saveLocation: "Lưu vị trí",
    locationSaved: "Đã lưu vị trí giao hàng!",
    locationSaveError: "Không thể lưu vị trí. Vui lòng thử lại.",
    mapPreview: "Xem trên bản đồ",
    staffAccess: {
      sectionTitle: "Quản lý truy cập nhân viên",
      sectionDesc:
        "Tạo link/mã QR để nhân viên truy cập trang của họ. Thiết bị phải nằm trong bán kính GPS cho phép.",
      gpsRadiusLabel: "Bán kính GPS cho phép truy cập (mét)",
      gpsRadiusHint:
        "Thiết bị nhân viên phải nằm trong bán kính này. Mặc định: 100 mét.",
      saveRadius: "Lưu bán kính",
      savingRadius: "Đang lưu...",
      radiusSaved: "Đã lưu bán kính GPS!",
      radiusError: "Không thể lưu bán kính. Vui lòng thử lại.",
      noToken: "Chưa tạo token",
      createToken: "Tạo token",
      createNewToken: "Tạo token mới",
      creating: "Đang tạo...",
      tokenCreated: "Đã tạo token mới!",
      tokenError: "Không thể tạo token. Vui lòng thử lại.",
      copyLink: "Copy link",
      copied: "Đã copy!",
      saveQrCode: "Lưu mã QR",
      confirmRevoke:
        "Token cũ sẽ bị vô hiệu hóa. Tất cả thiết bị dùng token cũ sẽ bị chặn. Bạn cần lưu và phân phát lại mã QR mới.",
    },
  },

  tables: {
    title: "Quản lý bàn",
    addTable: "Thêm bàn",
    tableNumber: "Số bàn",
    tableNumberPlaceholder: "Ví dụ: 5",
    qrCode: "Mã QR",
    downloadQR: "Tải mã QR",
    deleteTable: "Xóa bàn",
    confirmDelete: "Bạn có chắc muốn xóa bàn này?",
    noTables: "Chưa có bàn nào",
    noTablesDesc: "Thêm bàn để tạo mã QR cho khách hàng.",
    scanInstruction: "Khách hàng quét mã QR này để gọi món",
    tableId: "Mã bàn",
    copyLink: "Sao chép liên kết",
    linkCopied: "Đã sao chép!",
  },

  orders: {
    title: "Đơn hàng",
    activeOrders: "Đang xử lý",
    allOrders: "Tất cả đơn hàng",
    kitchenTab: "Bếp",
    waiterTab: "Chạy bàn",
    cashierTab: "Thu ngân",
    deliveryOrdersTab: "Đơn giao hàng",
    noActiveOrders: "Không có đơn hàng đang xử lý",
    noOrders: "Chưa có đơn hàng nào",
    orderNumber: "Đơn #",
    table: "Bàn",
    placedAt: "Thời gian đặt",
    items: "Các món",
    total: "Tổng",
    status: "Trạng thái",
    markPreparing: "Đang chuẩn bị",
    markReady: "Sẵn sàng",
    markCompleted: "Hoàn thành",
    markDelivered: "Đã mang ra",
    clearCompleted: "Xóa đơn hoàn thành",
    confirmClear: "Xóa tất cả đơn hàng đã hoàn thành?",
    statusPending: "Chờ xử lý",
    statusPreparing: "Đang chuẩn bị",
    statusReady: "Sẵn sàng",
    statusCompleted: "Hoàn thành",
    statusCancelled: "Đã hủy",
    autoRefresh: "Tự động làm mới mỗi 10 giây",
    readyForDelivery: "Sẵn sàng mang ra",
    noReadyOrders: "Không có đơn sẵn sàng",
    tableTotal: "Tổng bàn",
    grandTotal: "Tổng doanh thu",
    noCompletedForCashier: "Chưa có đơn hoàn thành",
    deliveryPendingTab: "Chờ xử lý",
    deliveryPreparingTab: "Đang chuẩn bị",
    deliveryReadyTab: "Sẵn sàng",
    deliveryDeliveredTab: "Đã giao",
    startPreparing: "Bắt đầu chuẩn bị",
    markReadyForDelivery: "Sẵn sàng giao",
    markAsDelivered: "Đã giao hàng",
    noDeliveryOrdersInTab: "Không có đơn nào",
    deliveredBadge: "Đã giao",
  },

  waiter: {
    navTitle: "Chạy bàn",
  },

  cashier: {
    title: "Thu ngân",
    subtitle: "Thanh toán các đơn hoàn thành theo bàn",
    grandTotal: "Tổng doanh thu",
    tableCount: "bàn",
    orderCount: "đơn hàng",
    settleTable: "Thanh toán / Settle",
    settling: "Đang xử lý...",
    settleConfirm: "Bạn có chắc muốn quyết toán tất cả đơn hàng?",
    noCompletedOrders: "Không có đơn hoàn thành",
    noCompletedOrdersDesc:
      'Chưa có đơn hàng nào hoàn thành. Đơn sau khi bếp đánh dấu "Hoàn thành" sẽ xuất hiện tại đây.',
    tableSubtotal: "Tạm tính bàn",
    completedOrders: "Đơn hàng",
    settledSuccess: "Đã thanh toán thành công",
    refreshing: "Đang tải...",
    tableOrdersTab: "Đơn tại bàn",
    deliveryOrdersTab: "Đơn giao hàng",
    shippingFee: "Phí vận chuyển",
    updateShippingFee: "Cập nhật phí",
    shippingFeePending: "Chưa cập nhật",
    customerName: "Tên khách hàng",
    customerPhone: "Số điện thoại",
    deliveryAddress: "Địa chỉ giao hàng",
    noDeliveryOrders: "Không có đơn giao hàng",
    noDeliveryOrdersDesc:
      "Chưa có đơn giao hàng nào. Đơn từ trang đặt món từ xa sẽ xuất hiện tại đây.",
    unpaidGroup: "Chưa thanh toán",
    paidNotServedGroup: "Đã thanh toán — chưa phục vụ",
    completedGroup: "Đã hoàn tất",
  },

  payment: {
    payNow: "Thanh toán ngay",
    processing: "Đang xử lý...",
    success: "Thanh toán thành công!",
    failed: "Thanh toán thất bại",
    retry: "Thử lại",
    collectPayment: "Thu tiền",
    totalAmount: "Số tiền cần thu",
    confirmPayment: "Xác nhận đã thu tiền",
    alreadyPaid: "Đã thanh toán",
  },

  history: {
    title: "Lịch sử đặt món",
    subtitle: "Các đơn trong phiên này",
    noOrders: "Chưa có đơn hàng",
    noOrdersDesc: "Các đơn bạn đặt sẽ xuất hiện tại đây",
    backToMenu: "Quay lại thực đơn",
    ordersCount: "đơn hàng",
  },

  reservation: {
    title: "Đặt bàn",
    subtitle: "Đặt bàn trước — nhanh chóng và tiện lợi",
    fullName: "Họ và tên",
    fullNamePlaceholder: "Ví dụ: Nguyễn Văn A",
    phone: "Số điện thoại",
    phonePlaceholder: "Ví dụ: 0901234567",
    email: "Email (tùy chọn)",
    emailPlaceholder: "Ví dụ: email@gmail.com",
    partySize: "Số người",
    date: "Ngày đặt bàn",
    timeSlot: "Giờ",
    duration: "Thời gian ngồi",
    notes: "Ghi chú",
    notesPlaceholder: "Yêu cầu đặc biệt, dị ứng thực phẩm...",
    submitButton: "Đặt bàn",
    submitting: "Đang xử lý...",
    successTitle: "Đặt bàn thành công!",
    successDesc: "Chúng tôi đã nhận yêu cầu đặt bàn của bạn.",
    successDetails: "Chi tiết đặt bàn",
    conflictTitle: "Bàn đã đầy",
    conflictDesc: "Khung giờ này đã kín chỗ. Vui lòng chọn ngày hoặc giờ khác.",
    tryAnotherTime: "Thử khung giờ khác",
    noRestaurant: "Không tìm thấy nhà hàng.",
    backToMenu: "Xem thực đơn",
    minutesSuffix: "phút",
    partySizeLabel: "người",
    bookingRef: "Mã đặt bàn",
  },

  developerProfile: {
    title: "Hồ sơ nhà phát triển",
    subtitle: "Thông tin tài khoản và kết nối doanh nghiệp",
    mainMenuLabel: "Hồ sơ nhà phát triển",
    developerPrincipalId: "Principal ID nhà phát triển",
    developerPrincipalIdHint:
      "Đây là Principal ID của bạn — chỉ đọc, không thể thay đổi.",
    businessOwnerPrincipalId: "Principal ID chủ doanh nghiệp",
    businessOwnerPrincipalIdPlaceholder: "Ví dụ: aaaaa-bbbbb-ccccc-ddddd-eee",
    email: "Email",
    emailPlaceholder: "Ví dụ: dev@example.com",
    copy: "Sao chép",
    copied: "Đã sao chép!",
    saveProfile: "Lưu hồ sơ",
    saving: "Đang lưu...",
    profileSaved: "Đã lưu hồ sơ thành công!",
    profileError: "Không thể lưu hồ sơ. Vui lòng thử lại.",
    principalInvalid: "Principal ID không hợp lệ. Vui lòng kiểm tra lại.",
    accessDeniedTitle: "Không có quyền truy cập",
    accessDeniedMessage:
      "Principal ID của bạn không được cấp quyền truy cập ứng dụng này.",
    yourPrincipalId: "Principal ID của bạn",
    logout: "Đăng xuất",
  },

  analytics: {
    title: "Thống kê",
    subtitle: "Doanh thu và đơn hàng theo ngày / tuần",
    totalOrders: "Tổng đơn hàng",
    totalRevenue: "Tổng doanh thu",
    noData: "Không có dữ liệu trong khoảng thời gian này",
    date: "Ngày",
    week: "Tuần",
    orders: "Đơn hàng",
    revenue: "Doanh thu",
    weekLabel: "Tuần",
    byDay: "Theo ngày",
    byWeek: "Theo tuần",
    from: "Từ",
    to: "Đến",
    reset: "Đặt lại",
  },

  units: {
    weight: "kg",
    weightSmall: "g",
    volume: "l",
    volumeSmall: "ml",
    serving: "phần",
  },

  banner: {
    images: "Hình ảnh quảng cáo",
    addImage: "Thêm hình ảnh",
    imageUrl: "URL hình ảnh",
    delete: "Xóa",
    noImages: "Chưa có hình ảnh quảng cáo",
  },

  delivery: {
    step1Title: "Địa chỉ & Liên hệ",
    step2Title: "Chọn nhà hàng",
    step3Title: "Chọn món",
    step4Title: "Thanh toán",
    deliveryAddress: "Địa chỉ giao hàng",
    addressPlaceholder: "Nhập địa chỉ giao hàng...",
    detectLocation: "Vị trí của tôi",
    detectingLocation: "Đang xác định vị trí...",
    locationDetected: "Đã xác định vị trí",
    locationError: "Không thể xác định vị trí. Vui lòng nhập thủ công.",
    orEnterManually: "Hoặc nhập địa chỉ thủ công",
    customerName: "Họ và tên",
    customerNamePlaceholder: "Nhập họ và tên của bạn",
    customerPhone: "Số điện thoại di động",
    customerPhonePlaceholder: "Ví dụ: 0901234567",
    contactInfo: "Thông tin liên hệ",
    continueToRestaurant: "Tiếp theo: Chọn nhà hàng",
    selectRestaurant: "Chọn nhà hàng",
    selectRestaurantDesc: "Chọn nhà hàng bạn muốn đặt món",
    noRestaurantsAvailable: "Chưa có nhà hàng nào.",
    continueToMenu: "Xem thực đơn",
    backToAddress: "Quay lại địa chỉ",
    backToRestaurant: "Quay lại nhà hàng",
    orderSummary: "Tóm tắt đơn hàng",
    shippingFee: "Phí vận chuyển",
    shippingFeePending: "Đang chờ nhà hàng cập nhật",
    grandTotal: "Tổng thanh toán",
    placeDeliveryOrder: "Đặt đơn giao hàng",
    placeOrderFailed: "Không thể đặt đơn. Vui lòng thử lại.",
    orderPlaced: "Đặt hàng thành công!",
    orderPlacedDesc: "Đơn giao hàng của bạn đã được gửi đến nhà hàng.",
    deliveryingTo: "Giao đến",
    pendingShippingNote:
      "Nhà hàng sẽ cập nhật phí vận chuyển sau khi nhận đơn.",
    proceedToCheckout: "Tiến hành thanh toán",
    addressRequired: "Vui lòng nhập địa chỉ giao hàng.",
    nameRequired: "Vui lòng nhập họ và tên.",
    phoneRequired: "Vui lòng nhập số điện thoại.",
    locationName: "Địa chỉ nhận hàng",
    useMyLocation: "Vị trí của tôi",
    savedSuccess: "Đã lưu thông tin nhận hàng",
    saveInfo: "Lưu thông tin",
    historyTitle: "Lịch sử đặt món từ xa",
    historySubtitle: "Các đơn giao hàng trong phiên này",
    historyEmpty: "Chưa có đơn giao hàng",
    historyEmptyDesc: "Các đơn đặt từ xa sẽ xuất hiện tại đây",
    historyBack: "Quay lại đặt món",
    historyOrdersCount: "đơn hàng",
    historyRestaurant: "Nhà hàng",
    historyDeliveryTo: "Giao đến",
    historyViewHistory: "Lịch sử",
    enterYourAddress: "Nhập địa chỉ của bạn",
    useCurrentLocation: "Dùng vị trí hiện tại",
    orTypeAddress: "Hoặc nhập địa chỉ thủ công",
    confirmLocation: "Xác nhận địa chỉ",
    skipLocation: "Bỏ qua",
    deliveryRadiusOk: "Có thể giao",
    deliveryRadiusOver: "Không giao đến khu vực của bạn",
    kmAway: "km",
    noDelivery: "Không giao đến khu vực của bạn",
    copyAddress: "Copy địa chỉ",
    addressCopied: "Đã copy!",
    callCustomer: "Gọi khách",
    qrCodeTitle: "Mã QR địa chỉ",
    qrCodeExpand: "Phóng to",
  },
};

// ─── English ──────────────────────────────────────────────────────────────────

const en: Translations = {
  nav: {
    menu: "Menu",
    cart: "Cart",
    orders: "Orders",
    admin: "Admin",
    signIn: "Sign In",
    signOut: "Sign Out",
    myRestaurants: "My Restaurants",
  },

  common: {
    loading: "Loading...",
    error: "An error occurred",
    retry: "Retry",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    confirm: "Confirm",
    close: "Close",
    back: "Back",
    search: "Search",
    all: "All",
    available: "Available",
    unavailable: "Unavailable",
    yes: "Yes",
    no: "No",
    noResults: "No results",
    required: "Required",
    optional: "Optional",
    total: "Total",
    subtotal: "Subtotal",
    quantity: "Quantity",
    note: "Note",
    name: "Name",
    description: "Description",
    price: "Price",
    status: "Status",
    actions: "Actions",
    createNew: "Create New",
    viewAll: "View All",
    refresh: "Refresh",
  },

  home: {
    hero: {
      title: "Smart Table Ordering",
      subtitle:
        "Scan a QR code at your table or order remotely — fast, convenient, no need to flag down a waiter.",
      ctaAdmin: "Manage Restaurant",
      ctaOrder: "Browse Menu",
    },
    steps: {
      title: "How It Works",
      scan: {
        title: "Scan QR Code",
        desc: "Guests scan the QR code at their table to instantly access the menu.",
      },
      choose: {
        title: "Choose Dishes",
        desc: "Browse the menu, add items to cart, and leave special notes.",
      },
      enjoy: {
        title: "Sit Back & Enjoy",
        desc: "Orders go straight to the kitchen. Just relax and wait.",
      },
    },
    features: {
      title: "Key Features",
      qr: {
        title: "Table QR Codes",
        desc: "Each table has its own QR code. Guests scan and order — no app needed.",
      },
      realtime: {
        title: "Real-time Updates",
        desc: "New orders appear instantly on the kitchen dashboard — never missed.",
      },
      multilang: {
        title: "Bilingual UI",
        desc: "Vietnamese and English interface for local and international guests.",
      },
      admin: {
        title: "Easy Management",
        desc: "Manage menu, tables, and orders from a single control panel.",
      },
    },
  },

  order: {
    tableLabel: "Table",
    noMenu: "Menu is not available yet.",
    noItems: "No items in this category yet.",
    addToCart: "Add to Cart",
    added: "Added",
    cartEmpty: "Your cart is empty",
    cartTitle: "Your Cart",
    checkout: "Checkout",
    placeOrder: "Place Order",
    orderPlaced: "Order placed!",
    orderPlacedDesc: "Your order has been sent to the kitchen.",
    continueBrowsing: "Continue Browsing",
    viewOrders: "View Orders",
    viewHistory: "Order History",
    itemNote: "Item note",
    itemNotePlaceholder: "e.g. no onion, less spicy...",
    specialInstructions: "Special Instructions",
    specialInstructionsPlaceholder: "Food allergies, special requests...",
    remove: "Remove",
    yourOrders: "Your Orders",
    noOrders: "No orders yet.",
    orderNumber: "Order #",
    placedAt: "Placed at",
    items: "items",
    remoteOrder: "Remote Order",
    enterTable: "Enter your table number",
    tableNumber: "Table Number",
    tableNumberPlaceholder: "e.g. 5",
    confirmTable: "Confirm Table",
  },

  adminLogin: {
    title: "Admin Login",
    subtitle: "Sign in to manage your restaurant",
    signInButton: "Sign in with Internet Identity",
    signingIn: "Signing in...",
    description: "Use Internet Identity for secure authentication.",
  },

  dashboard: {
    title: "My Restaurants",
    subtitle: "Manage your restaurants and track orders",
    createRestaurant: "Create Restaurant",
    restaurantNamePlaceholder: "Restaurant name...",
    creating: "Creating...",
    noRestaurants: "No restaurants yet",
    noRestaurantsDesc: "Create your first restaurant to start taking orders.",
    manageOrders: "Manage Orders",
    manageMenu: "Manage Menu",
    manageTables: "Manage Tables",
    address: "Address",
    addressPlaceholder: "Enter restaurant address...",
    getLocation: "Get Location",
    locationSet: "Location set",
    viewOnMap: "View on Map",
  },

  menuEditor: {
    title: "Menu Editor",
    addCategory: "Add Category",
    categoryName: "Category Name",
    categoryNamePlaceholder: "e.g. Starters",
    addItem: "Add Item",
    editItem: "Edit Item",
    itemName: "Item Name",
    itemNamePlaceholder: "e.g. Beef Pho",
    itemDescription: "Description",
    itemDescriptionPlaceholder: "Short description of the dish",
    itemPrice: "Price (VND)",
    itemPricePlaceholder: "e.g. 85000",
    itemImage: "Image (URL)",
    itemImagePlaceholder: "https://...",
    markAvailable: "Mark Available",
    markUnavailable: "Mark Unavailable",
    deleteItem: "Delete Item",
    confirmDelete: "Are you sure you want to delete this item?",
    noCategories: "No categories yet",
    noCategoriesDesc: "Add your first category to start building your menu.",
    noItems: "No items yet",
    noItemsDesc: "Add the first item to this category.",
    saveChanges: "Save Changes",
    savingChanges: "Saving...",
    position: "Position",
    uploadImage: "Upload Image",
    uploading: "Uploading...",
    removeImage: "Remove Image",
    imageFileTooLarge: "Image too large. Please choose a file under 500 KB.",
    imageNotSquare:
      "A square image (1:1 ratio) is recommended for best display.",
  },

  businessProfile: {
    title: "Business Profile",
    subtitle:
      "Business information used in QR codes and bank transfer payments",
    mainMenuLabel: "Business Profile",
    logo: "Business Logo",
    logoUrl: "Logo URL",
    businessName: "Business Name",
    businessNamePlaceholder: "e.g. Pho Hanoi Restaurant",
    address: "Address",
    addressPlaceholder: "e.g. 123 Main St, District 1, Ho Chi Minh City",
    email: "Contact Email",
    emailPlaceholder: "e.g. contact@restaurant.com",
    domain: "Domain",
    domainPlaceholder: "e.g. restaurant.com",
    orderingDomain: "Ordering Domain",
    orderingDomainPlaceholder: "e.g. order.restaurant.com",
    orderingDomainHint: "This domain will be embedded in table QR codes.",
    orderingDomainDeliveryLabel: "Remote Ordering Page",
    orderingDomainDeliveryLinkLabel: "Remote ordering link:",
    copyLink: "Copy link",
    saveProfile: "Save Profile",
    saving: "Saving...",
    profileSaved: "Profile saved successfully!",
    profileError: "Failed to save profile. Please try again.",
    profileLink: "Profile",
    noRestaurant: "No restaurant found. Please create a restaurant first.",
    bankSection: "Bank Account",
    accountNumber: "Account Number",
    accountNumberPlaceholder: "Enter account number",
    bankName: "Bank Name",
    bankNamePlaceholder: "e.g. Vietcombank, BIDV, Techcombank",
    accountHolderName: "Account Holder Name",
    accountHolderNamePlaceholder: "Enter account holder name",
    stripeSection: "Card & Apple Pay (Stripe)",
    stripeToggle: "Enable card / Apple Pay payments",
    stripeDisabledNote:
      "Currently disabled — guests can only pay via bank transfer",
    stripePublishableKey: "Stripe Publishable Key",
    stripePublishableKeyHelp: "Starts with pk_live_ or pk_test_",
    stripeSecretKey: "Stripe Secret Key",
    stripeSecretKeyHelp: "Keep secret — never share this key",
    saveStripeKeys: "Save Stripe Keys",
    savingStripeKeys: "Saving...",
    stripeKeysSaved: "Stripe Keys saved successfully!",
    stripeKeysError: "Failed to save Stripe Keys. Please try again.",
    deleteRestaurant: "Delete Restaurant",
    deleteRestaurantConfirmTitle: "Confirm Delete",
    deleteRestaurantConfirmDesc:
      "Are you sure you want to delete this restaurant? This action cannot be undone.",
  },

  restaurantSettings: {
    title: "Restaurant Settings",
    subtitle: "Name, banner image, and service hours for this restaurant",
    navLabel: "Restaurant Settings",
    restaurantName: "Restaurant Name",
    restaurantNamePlaceholder: "Enter restaurant name",
    bannerImage: "Restaurant Banner Image",
    bannerImageHint: "Recommended 3:1 ratio, max 500KB",
    tableServiceHours: "Table Service Hours",
    tableServiceHoursPlaceholder: "08:00 - 22:00",
    deliveryServiceHours: "Food Delivery Hours",
    deliveryServiceHoursPlaceholder: "08:00 - 22:00",
    saveSettings: "Save Settings",
    saving: "Saving...",
    settingsSaved: "Settings saved successfully!",
    settingsError: "Failed to save settings. Please try again.",
    nameSaved: "Restaurant name updated!",
    nameError: "Failed to update name. Please try again.",
    locationSection: "Delivery Location",
    locationLatitude: "Latitude",
    locationLatitudePlaceholder: "e.g. 21.0278",
    locationLongitude: "Longitude",
    locationLongitudePlaceholder: "e.g. 105.8342",
    deliveryRadius: "Delivery Radius (km)",
    deliveryRadiusPlaceholder: "e.g. 5",
    deliveryRadiusHint: "Leave empty or 0 = no radius restriction",
    useCurrentLocation: "Use Current Location",
    detectingLocation: "Detecting location...",
    locationDetected: "Location detected",
    locationError: "Unable to detect location. Please enter manually.",
    saveLocation: "Save Location",
    locationSaved: "Delivery location saved!",
    locationSaveError: "Failed to save location. Please try again.",
    mapPreview: "View on map",
    staffAccess: {
      sectionTitle: "Staff Access Management",
      sectionDesc:
        "Generate links/QR codes for staff to access their role pages. Devices must be within the allowed GPS radius.",
      gpsRadiusLabel: "Allowed GPS access radius (meters)",
      gpsRadiusHint:
        "Staff devices must be within this radius of the restaurant. Default: 100 meters.",
      saveRadius: "Save radius",
      savingRadius: "Saving...",
      radiusSaved: "GPS radius saved!",
      radiusError: "Failed to save radius. Please try again.",
      noToken: "No token yet",
      createToken: "Create token",
      createNewToken: "Create new token",
      creating: "Creating...",
      tokenCreated: "New token created!",
      tokenError: "Failed to create token. Please try again.",
      copyLink: "Copy link",
      copied: "Copied!",
      saveQrCode: "Save QR code",
      confirmRevoke:
        "The old token will be invalidated immediately. All devices using the old token will be blocked. You need to save and redistribute the new QR code.",
    },
  },

  tables: {
    title: "Table Management",
    addTable: "Add Table",
    tableNumber: "Table Number",
    tableNumberPlaceholder: "e.g. 5",
    qrCode: "QR Code",
    downloadQR: "Download QR",
    deleteTable: "Delete Table",
    confirmDelete: "Are you sure you want to delete this table?",
    noTables: "No tables yet",
    noTablesDesc: "Add tables to generate QR codes for guests.",
    scanInstruction: "Guests scan this QR code to place an order",
    tableId: "Table ID",
    copyLink: "Copy Link",
    linkCopied: "Copied!",
  },

  orders: {
    title: "Orders",
    activeOrders: "Active Orders",
    allOrders: "All Orders",
    kitchenTab: "Kitchen",
    waiterTab: "Waiter",
    cashierTab: "Cashier",
    deliveryOrdersTab: "Delivery Orders",
    noActiveOrders: "No active orders",
    noOrders: "No orders yet",
    orderNumber: "Order #",
    table: "Table",
    placedAt: "Placed At",
    items: "Items",
    total: "Total",
    status: "Status",
    markPreparing: "Preparing",
    markReady: "Ready",
    markCompleted: "Completed",
    markDelivered: "Delivered",
    clearCompleted: "Clear Completed",
    confirmClear: "Clear all completed orders?",
    statusPending: "Pending",
    statusPreparing: "Preparing",
    statusReady: "Ready",
    statusCompleted: "Completed",
    statusCancelled: "Cancelled",
    autoRefresh: "Auto-refreshes every 10 seconds",
    readyForDelivery: "Ready for Delivery",
    noReadyOrders: "No orders ready for delivery",
    tableTotal: "Table Total",
    grandTotal: "Grand Total",
    noCompletedForCashier: "No completed orders",
    deliveryPendingTab: "Pending",
    deliveryPreparingTab: "Preparing",
    deliveryReadyTab: "Ready",
    deliveryDeliveredTab: "Delivered",
    startPreparing: "Start Preparing",
    markReadyForDelivery: "Mark Ready",
    markAsDelivered: "Mark Delivered",
    noDeliveryOrdersInTab: "No orders",
    deliveredBadge: "Delivered",
  },

  waiter: {
    navTitle: "Delivery",
  },

  cashier: {
    title: "Cashier",
    subtitle: "Settle completed orders by table",
    grandTotal: "Grand Total",
    tableCount: "table",
    orderCount: "order",
    settleTable: "Settle Table",
    settling: "Processing...",
    settleConfirm: "Confirm settle all orders for this table?",
    noCompletedOrders: "No completed orders",
    noCompletedOrdersDesc:
      'No orders have been completed yet. Orders marked "Completed" by the kitchen will appear here.',
    tableSubtotal: "Table subtotal",
    completedOrders: "Orders",
    settledSuccess: "Settlement successful",
    refreshing: "Loading...",
    tableOrdersTab: "Table Orders",
    deliveryOrdersTab: "Delivery Orders",
    shippingFee: "Shipping Fee",
    updateShippingFee: "Update Fee",
    shippingFeePending: "Not set",
    customerName: "Customer Name",
    customerPhone: "Phone Number",
    deliveryAddress: "Delivery Address",
    noDeliveryOrders: "No delivery orders",
    noDeliveryOrdersDesc:
      "No delivery orders yet. Orders from the remote ordering page will appear here.",
    unpaidGroup: "Unpaid",
    paidNotServedGroup: "Paid — Not Served",
    completedGroup: "Completed",
  },

  payment: {
    payNow: "Pay Now",
    processing: "Processing...",
    success: "Payment successful!",
    failed: "Payment failed",
    retry: "Retry",
    collectPayment: "Collect Payment",
    totalAmount: "Amount to collect",
    confirmPayment: "Confirm Collected",
    alreadyPaid: "Paid",
  },

  history: {
    title: "Order History",
    subtitle: "Orders from this session",
    noOrders: "No orders yet",
    noOrdersDesc: "Orders you place will appear here",
    backToMenu: "Back to Menu",
    ordersCount: "orders",
  },

  reservation: {
    title: "Reserve a Table",
    subtitle: "Book ahead — quick and convenient",
    fullName: "Full Name",
    fullNamePlaceholder: "e.g. John Smith",
    phone: "Phone Number",
    phonePlaceholder: "e.g. 0901234567",
    email: "Email (optional)",
    emailPlaceholder: "e.g. email@gmail.com",
    partySize: "Party Size",
    date: "Date",
    timeSlot: "Time",
    duration: "Duration",
    notes: "Notes",
    notesPlaceholder: "Special requests, food allergies...",
    submitButton: "Reserve Table",
    submitting: "Processing...",
    successTitle: "Reservation Confirmed!",
    successDesc: "We have received your reservation request.",
    successDetails: "Booking Details",
    conflictTitle: "Fully Booked",
    conflictDesc:
      "This time slot is fully booked. Please choose a different date or time.",
    tryAnotherTime: "Try Another Time",
    noRestaurant: "Restaurant not found.",
    backToMenu: "Browse Menu",
    minutesSuffix: "min",
    partySizeLabel: "guests",
    bookingRef: "Booking Ref",
  },

  developerProfile: {
    title: "Developer Profile",
    subtitle: "Account information and business connection",
    mainMenuLabel: "Developer Profile",
    developerPrincipalId: "Developer Principal ID",
    developerPrincipalIdHint:
      "This is your Principal ID — read-only, cannot be changed.",
    businessOwnerPrincipalId: "Business Owner Principal ID",
    businessOwnerPrincipalIdPlaceholder: "e.g. aaaaa-bbbbb-ccccc-ddddd-eee",
    email: "Email",
    emailPlaceholder: "e.g. dev@example.com",
    copy: "Copy",
    copied: "Copied!",
    saveProfile: "Save Profile",
    saving: "Saving...",
    profileSaved: "Profile saved successfully!",
    profileError: "Failed to save profile. Please try again.",
    principalInvalid:
      "Invalid Principal ID format. Please check and try again.",
    accessDeniedTitle: "Access Denied",
    accessDeniedMessage:
      "Your Principal ID does not have access to this application.",
    yourPrincipalId: "Your Principal ID",
    logout: "Logout",
  },

  analytics: {
    title: "Analytics",
    subtitle: "Revenue and orders by day / week",
    totalOrders: "Total Orders",
    totalRevenue: "Total Revenue",
    noData: "No data available for this period",
    date: "Date",
    week: "Week",
    orders: "Orders",
    revenue: "Revenue",
    weekLabel: "Week",
    byDay: "By Day",
    byWeek: "By Week",
    from: "From",
    to: "To",
    reset: "Reset",
  },

  units: {
    weight: "lb",
    weightSmall: "oz",
    volume: "cup",
    volumeSmall: "fl oz",
    serving: "serving",
  },

  banner: {
    images: "Ad Images",
    addImage: "Add Image",
    imageUrl: "Image URL",
    delete: "Delete",
    noImages: "No ad images yet",
  },

  delivery: {
    step1Title: "Address & Contact",
    step2Title: "Select Restaurant",
    step3Title: "Choose Items",
    step4Title: "Payment",
    deliveryAddress: "Delivery Address",
    addressPlaceholder: "Enter delivery address...",
    detectLocation: "My Location",
    detectingLocation: "Detecting location...",
    locationDetected: "Location detected",
    locationError: "Unable to detect location. Please enter manually.",
    orEnterManually: "Or enter address manually",
    customerName: "Full Name",
    customerNamePlaceholder: "Enter your full name",
    customerPhone: "Mobile Phone",
    customerPhonePlaceholder: "e.g. 0901234567",
    contactInfo: "Contact Information",
    continueToRestaurant: "Next: Select Restaurant",
    selectRestaurant: "Select Restaurant",
    selectRestaurantDesc: "Choose a restaurant to order from",
    noRestaurantsAvailable: "No restaurants available.",
    continueToMenu: "Browse Menu",
    backToAddress: "Back to Address",
    backToRestaurant: "Back to Restaurant",
    orderSummary: "Order Summary",
    shippingFee: "Shipping Fee",
    shippingFeePending: "Pending restaurant update",
    grandTotal: "Grand Total",
    placeDeliveryOrder: "Place Delivery Order",
    placeOrderFailed: "Failed to place order. Please try again.",
    orderPlaced: "Order Placed!",
    orderPlacedDesc: "Your delivery order has been sent to the restaurant.",
    deliveryingTo: "Delivering to",
    pendingShippingNote:
      "The restaurant will update the shipping fee after receiving your order.",
    proceedToCheckout: "Proceed to Checkout",
    addressRequired: "Please enter your delivery address.",
    nameRequired: "Please enter your full name.",
    phoneRequired: "Please enter your mobile phone number.",
    locationName: "Delivery address",
    useMyLocation: "My Location",
    savedSuccess: "Delivery info saved",
    saveInfo: "Save Info",
    historyTitle: "Delivery Order History",
    historySubtitle: "Delivery orders from this session",
    historyEmpty: "No delivery orders yet",
    historyEmptyDesc: "Orders you place from this page will appear here",
    historyBack: "Back to Order",
    historyOrdersCount: "orders",
    historyRestaurant: "Restaurant",
    historyDeliveryTo: "Delivering to",
    historyViewHistory: "History",
    enterYourAddress: "Enter your address",
    useCurrentLocation: "Use current location",
    orTypeAddress: "Or type address manually",
    confirmLocation: "Confirm address",
    skipLocation: "Skip",
    deliveryRadiusOk: "Can deliver",
    deliveryRadiusOver: "Out of delivery range",
    kmAway: "km",
    noDelivery: "Does not deliver to your area",
    copyAddress: "Copy address",
    addressCopied: "Copied!",
    callCustomer: "Call customer",
    qrCodeTitle: "Address QR Code",
    qrCodeExpand: "Expand",
  },
};

export const translations: Record<Language, Translations> = { vi, en };
