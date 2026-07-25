import { AdminLayout } from "@/Layout";
import { AutoPaymentApp, createActor } from "@/backend";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetAhamoveConfig,
  useGetBusinessBankDetails,
  useGetBusinessProfileInfo,
  useGetCodSettings,
  useGetTingeeBanks,
  useGetTingeeConfig,
  useGetWebhookEndpointInfo,
  useHasTingeeConfigured,
  useMyRestaurants,
  useSaveAhamoveConfig,
  useSaveTingeeConfig,
  useSetCodSettings,
  useUpdateAutoPaymentConfirmationSettings,
  useUpdateBusinessBankDetails,
  useUpdateBusinessProfile,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import { useActor } from "@caffeineai/core-infrastructure";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  ImageIcon,
  Landmark,
  Link2,
  Loader2,
  Mail,
  MapPin,
  MinusCircle,
  Phone,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  Upload,
  User,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { resizeImage } from "../utils/imageUtils";

interface ProfileForm {
  businessName: string;
  address: string;
  email: string;
  domain: string;
  brandLogo: string;
  accountNumber: string;
  bankName: string;
  accountHolderName: string;
  taxCode: string;
  phone: string;
}

const blank = (): ProfileForm => ({
  businessName: "",
  address: "",
  email: "",
  domain: "",
  brandLogo: "",
  accountNumber: "",
  bankName: "",
  accountHolderName: "",
  taxCode: "",
  phone: "",
});

export default function BusinessProfilePage() {
  const { t } = useLanguage();
  const bp = t.businessProfile;

  const { data: restaurants, isLoading } = useMyRestaurants();

  // Business-level profile info (businessName, address, email, domain,
  // brandLogo, bankCode). These fields are shared across all restaurants of
  // the business — they are NOT per-restaurant. The restaurant selector was
  // removed because the 5 fields now live at the business level.
  const businessProfileInfo = useGetBusinessProfileInfo();
  const businessProfileData = businessProfileInfo.data;
  const updateBusinessProfile = useUpdateBusinessProfile();

  const updateBankDetails = useUpdateBusinessBankDetails();
  const { data: businessBankData } = useGetBusinessBankDetails();

  const [form, setForm] = useState<ProfileForm>(blank());
  const { actor } = useActor(createActor);
  const [initialized, setInitialized] = useState(false);

  const { data: tingeeConfig } = useGetTingeeConfig();

  // Sync loaded Tingee config into local state. The backend returns the
  // stored clientId/secretToken/orderPrefix; accountNumber/bankName are
  // read-through from the 'Thông tin ngân hàng' form fields, so they are
  // not synced here.
  useEffect(() => {
    if (tingeeConfig) {
      setTingeeClientId(tingeeConfig.clientId ?? "");
      setTingeeSecretToken(tingeeConfig.secretToken ?? "");
      setTingeeOrderPrefix(tingeeConfig.orderPrefix ?? "BBHVIV");
    }
  }, [tingeeConfig]);

  // Sync the Tingee Virtual Account (VA) from the business profile info.
  // The VA is stored at the business-profile level (not in the Tingee
  // config blob) so it is synced from businessProfileInfo, mirroring the
  // tingeeOrderPrefix input pattern (state + useEffect sync + save button).
  useEffect(() => {
    if (businessProfileInfo.data?.tingeeVA != null) {
      setTingeeVA(businessProfileInfo.data.tingeeVA);
    }
  }, [businessProfileInfo.data?.tingeeVA]);

  // Sync Tingee Bank BIN from the business profile info.
  useEffect(() => {
    if (businessProfileInfo.data?.tingeeBankBin != null) {
      setTingeeBankBin(businessProfileInfo.data.tingeeBankBin);
    }
  }, [businessProfileInfo.data?.tingeeBankBin]);

  // Sync Tingee Merchant ID from the business profile info.
  useEffect(() => {
    if (businessProfileInfo.data?.tingeeMerchantId != null) {
      setTingeeMerchantId(businessProfileInfo.data.tingeeMerchantId);
    }
  }, [businessProfileInfo.data?.tingeeMerchantId]);

  // Tingee / auto-payment state
  const updateAutoPayment = useUpdateAutoPaymentConfirmationSettings();
  const [autoPaymentApp, setAutoPaymentApp] = useState<AutoPaymentApp>(
    AutoPaymentApp.Tingee,
  );
  const [autoPaymentSubTab, setAutoPaymentSubTab] =
    useState<"tingee">("tingee");
  const [tingeeClientId, setTingeeClientId] = useState("");
  const [tingeeSecretToken, setTingeeSecretToken] = useState("");
  const [tingeeOrderPrefix, setTingeeOrderPrefix] = useState("BBHVIV");
  // Tingee Virtual Account (VA) — entered manually by the owner, stored at
  // the business-profile level. When non-empty, the customer-facing payment
  // flow renders the dynamic QR panel (DynamicQRPanel) alongside the static
  // TingeeQRPanel.
  const [tingeeVA, setTingeeVA] = useState("");
  const [isSavingTingeeVA, setIsSavingTingeeVA] = useState(false);
  // Tingee Bank BIN / Merchant ID — entered manually by the owner, stored at
  // the business-profile level. Required to enable the Tingee dynamic-QR
  // flow alongside the VA.
  const [tingeeBankBin, setTingeeBankBin] = useState("");
  const [isSavingTingeeBankBin, setIsSavingTingeeBankBin] = useState(false);
  const [tingeeMerchantId, setTingeeMerchantId] = useState("");
  const [isSavingTingeeMerchantId, setIsSavingTingeeMerchantId] =
    useState(false);

  // Tingee bank lookup — a collapsible section placed right after the Bank
  // BIN input + save button. The user clicks "Xem danh sách ngân hàng" to
  // fetch the bank list (cached for the session via staleTime: Infinity in
  // useGetTingeeBanks). Picking a bank only fills the Bank BIN input — the
  // user must still press "Lưu Bank BIN" themselves (no auto-submit).
  const [showTingeeBankLookup, setShowTingeeBankLookup] = useState(false);
  const [tingeeBankSearch, setTingeeBankSearch] = useState("");
  const [tingeeBankLogoErrors, setTingeeBankLogoErrors] = useState<
    Record<string, boolean>
  >({});
  const tingeeBanksQuery = useGetTingeeBanks();

  // Tingee production config (no test/prod split, no useTest switch).
  // Tingee now has its own tingeeOrderPrefix (default BBHVIV).
  // accountNumber/bankName/accountHolderName are read-through from the
  // 'Thông tin ngân hàng' section above — not saved here.
  const saveTingeeConfigMutation = useSaveTingeeConfig();
  const { data: hasTingeeConfigured } = useHasTingeeConfigured();
  const { data: webhookEndpointInfo } = useGetWebhookEndpointInfo();
  const [showTingeeSecretToken, setShowTingeeSecretToken] = useState(false);
  const [tingeeConnectionStatus, setTingeeConnectionStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [tingeeConnectionError, setTingeeConnectionError] = useState("");

  // Invoice provider & BKAV state
  const [invoiceProvider, setInvoiceProvider] = useState<"BKAV">("BKAV");
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [prodInvoiceSerial, setProdInvoiceSerial] = useState("");
  const [bkavInvoiceForm, setBkavInvoiceForm] = useState("");
  const [bkavVatRate, setBkavVatRate] = useState<number>(10);
  const [isSavingBkavCommon, setIsSavingBkavCommon] = useState(false);
  const [cyclesBalance, setCyclesBalance] = useState<bigint | null>(null);

  // Worker Principal state — owner can only overwrite, never clear.
  // `currentWorkerPrincipal` mirrors the backend-persisted value (readonly
  // display). `workerPrincipalInput` is the editable field the owner pastes a
  // new principal into; an empty input means "keep the existing value".
  const [currentWorkerPrincipal, setCurrentWorkerPrincipal] = useState<
    string | undefined
  >(undefined);
  const [workerPrincipalInput, setWorkerPrincipalInput] = useState("");
  const [isSavingWorkerPrincipal, setIsSavingWorkerPrincipal] = useState(false);

  // NEW BKAV state — production only (sandbox removed)
  const [realGuidError, setRealGuidError] = useState("");

  const [realGuid, setRealGuid] = useState("");
  const [realToken, setRealToken] = useState("");
  const [realApiUrl, setRealApiUrl] = useState("");
  const [showRealGuid, setShowRealGuid] = useState(false);
  const [showRealToken, setShowRealToken] = useState(false);
  const [isSavingReal, setIsSavingReal] = useState(false);

  // AhaMove real config state (production only — sandbox removed)
  const [ahamoveApiKey, setAhamoveApiKey] = useState("");
  const [ahamoveMobile, setAhamoveMobile] = useState("");
  const [showAhamoveApiKey, setShowAhamoveApiKey] = useState(false);
  const [ahamoveConnectionStatus, setAhamoveConnectionStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [ahamoveConnectionError, setAhamoveConnectionError] = useState("");
  const [isSavingAhamove, setIsSavingAhamove] = useState(false);
  const { data: ahamoveConfig } = useGetAhamoveConfig();
  const saveAhamoveConfigMutation = useSaveAhamoveConfig();

  // COD settings state
  const { data: codSettingsData } = useGetCodSettings();
  const setCodSettings = useSetCodSettings();
  const [isCodAllowed, setIsCodAllowed] = useState(false);
  const [codLimit, setCodLimit] = useState(100000);
  const [isSavingCod, setIsSavingCod] = useState(false);

  const navigate = useNavigate();

  const fetchSellerInfo = useCallback(async () => {
    if (!actor) return;
    try {
      const info = await actor.getSellerInfo();
      if (info) {
        setForm((f) => ({
          ...f,
          taxCode: info.taxCode ?? "",
          phone: info.phone ?? "",
        }));
      }
    } catch {
      // ignore
    }
  }, [actor]);

  // Sync the 5 business-level profile fields (businessName, address, email,
  // domain, brandLogo) from the business profile info. Bank details
  // (accountNumber/bankName/accountHolderName) are layered on top by the
  // businessBankData effect below. The `!initialized` guard ensures the
  // form only syncs once when data first loads; afterwards the form is the
  // source of truth for edits.
  useEffect(() => {
    if (businessProfileData && !initialized) {
      setForm((prev) => ({
        ...prev,
        businessName: businessProfileData.businessName ?? "",
        address: businessProfileData.address ?? "",
        email: businessProfileData.email ?? "",
        domain: businessProfileData.domain ?? "",
        brandLogo: businessProfileData.brandLogo ?? "",
      }));
      setAutoPaymentApp(AutoPaymentApp.Tingee);
      setInitialized(true);
    }
  }, [businessProfileData, initialized]);

  useEffect(() => {
    if (businessBankData && initialized) {
      setForm((f) => ({
        ...f,
        accountNumber: businessBankData.accountNumber ?? "",
        bankName: businessBankData.bankName ?? "",
        accountHolderName: businessBankData.accountHolderName ?? "",
      }));
    }
  }, [businessBankData, initialized]);

  const loadBkavConfig = useCallback(async () => {
    if (!actor) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = await (actor as any).getBkavInvoiceConfig();
      if (config) {
        setRealGuid(config.realGuid ?? "");
        setRealToken(config.realToken ?? "");
        setRealApiUrl(config.realApiUrl ?? "");
        setProdInvoiceSerial(config.prodInvoiceSerial ?? "");
        setBkavInvoiceForm(config.invoiceForm ?? "");
        setBkavVatRate(
          typeof config.vatRate === "bigint"
            ? Number(config.vatRate)
            : typeof config.vatRate === "number"
              ? config.vatRate
              : 10,
        );
        // Sync the persisted worker principal into the readonly display.
        // The editable input is intentionally left empty — the owner only
        // pastes a new value when they want to overwrite.
        setCurrentWorkerPrincipal(config.workerPrincipal ?? undefined);
        setWorkerPrincipalInput("");
      }
    } catch {
      // ignore
    }
  }, [actor]);

  const fetchCyclesBalance = useCallback(async () => {
    if (!actor) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (actor as any).getCycles();
      if (typeof result === "bigint") {
        setCyclesBalance(result);
      } else if (typeof result === "number") {
        setCyclesBalance(BigInt(result));
      }
    } catch {
      // silently ignore — method may not exist
    }
  }, [actor]);

  const fetchInvoiceProvider = useCallback(async () => {
    if (!actor) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (actor as any).getInvoiceProvider();
      if (result === "BKAV") {
        setInvoiceProvider("BKAV");
      } else {
        setInvoiceProvider("BKAV");
      }
    } catch {
      setInvoiceProvider("BKAV");
    }
  }, [actor]);

  useEffect(() => {
    loadBkavConfig();
  }, [loadBkavConfig]);

  useEffect(() => {
    fetchInvoiceProvider();
  }, [fetchInvoiceProvider]);

  useEffect(() => {
    fetchCyclesBalance();
  }, [fetchCyclesBalance]);

  useEffect(() => {
    fetchSellerInfo();
  }, [fetchSellerInfo]);

  // Sync AhaMove config
  useEffect(() => {
    if (ahamoveConfig) {
      setAhamoveApiKey(ahamoveConfig.apiKey ?? "");
      setAhamoveMobile(ahamoveConfig.mobile ?? "");
    }
  }, [ahamoveConfig]);

  // Sync COD settings
  useEffect(() => {
    if (codSettingsData) {
      setIsCodAllowed(codSettingsData.isCodAllowed ?? false);
      setCodLimit(
        typeof codSettingsData.codLimit === "bigint"
          ? Number(codSettingsData.codLimit)
          : typeof codSettingsData.codLimit === "number"
            ? codSettingsData.codLimit
            : 100000,
      );
    }
  }, [codSettingsData]);

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessProfileData) return;

    let allSucceeded = true;

    try {
      await updateBusinessProfile.mutateAsync({
        businessName: form.businessName.trim() || undefined,
        address: form.address.trim() || undefined,
        email: form.email.trim() || undefined,
        domain: form.domain.trim() || undefined,
        brandLogo: form.brandLogo || undefined,
      });
    } catch (err) {
      allSucceeded = false;
      toast.error(
        `${bp.profileError} — ${err instanceof Error ? err.message : "business profile"}`,
      );
    }

    try {
      if (actor) {
        await actor.saveSellerInfo(form.taxCode.trim(), form.phone.trim());
      }
    } catch (err) {
      allSucceeded = false;
      toast.error(
        `${bp.profileError} — ${err instanceof Error ? err.message : "seller info"}`,
      );
    }

    try {
      await updateBankDetails.mutateAsync({
        accountNumber: form.accountNumber.trim(),
        bankName: form.bankName.trim(),
        accountHolderName: form.accountHolderName.trim(),
      });
    } catch (err) {
      allSucceeded = false;
      toast.error(
        `${bp.profileError} — ${err instanceof Error ? err.message : "bank details"}`,
      );
    }

    if (allSucceeded) {
      toast.success(bp.profileSaved);
    }
  };

  const handleSaveAppSelection = async () => {
    if (!restaurants || restaurants.length === 0) return;
    try {
      await Promise.all(
        restaurants.map((restaurant) =>
          updateAutoPayment.mutateAsync({
            restaurantId: restaurant.id,
            enabled: true,
            app: autoPaymentApp,
          }),
        ),
      );
      toast.success("Đã lưu chọn app xác nhận cho tất cả nhà hàng");
    } catch (err) {
      console.error("Save app selection failed:", err);
      toast.error(
        "Lưu thất bại cho một hoặc nhiều nhà hàng. Vui lòng thử lại.",
      );
    }
  };

  const handleSaveInvoiceProvider = async () => {
    if (!actor) return;
    setIsSavingProvider(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (actor as any).saveInvoiceProvider(invoiceProvider);
      toast.success(`Đã lưu nhà cung cấp hóa đơn: ${invoiceProvider}`);
    } catch (err) {
      console.error("Save invoice provider failed:", err);
      toast.error("Lưu nhà cung cấp thất bại. Vui lòng thử lại.");
    } finally {
      setIsSavingProvider(false);
    }
  };

  const handleSaveTingeeConfig = async () => {
    if (!tingeeClientId.trim()) {
      toast.error("Vui lòng nhập Client ID");
      return;
    }
    try {
      await saveTingeeConfigMutation.mutateAsync({
        clientId: tingeeClientId.trim(),
        secretToken: tingeeSecretToken,
        orderPrefix: tingeeOrderPrefix.trim(),
      });
      toast.success("Đã lưu cấu hình Tingee");
    } catch {
      toast.error("Lỗi khi lưu cấu hình Tingee");
    }
  };

  const handleSaveTingeeVA = async () => {
    setIsSavingTingeeVA(true);
    try {
      await updateBusinessProfile.mutateAsync({
        tingeeVA: tingeeVA.trim(),
      });
      toast.success("Đã lưu Virtual Account (VA) Tingee");
    } catch (err) {
      console.error("Save Tingee VA failed:", err);
      toast.error(
        `Lỗi khi lưu VA — ${err instanceof Error ? err.message : "vui lòng thử lại"}`,
      );
    } finally {
      setIsSavingTingeeVA(false);
    }
  };

  const handleSaveTingeeBankBin = async () => {
    setIsSavingTingeeBankBin(true);
    try {
      await updateBusinessProfile.mutateAsync({
        tingeeBankBin: tingeeBankBin.trim(),
      });
      toast.success("Đã lưu Bank BIN Tingee");
    } catch (err) {
      console.error("Save Tingee Bank BIN failed:", err);
      toast.error(
        `Lỗi khi lưu Bank BIN — ${err instanceof Error ? err.message : "vui lòng thử lại"}`,
      );
    } finally {
      setIsSavingTingeeBankBin(false);
    }
  };

  const handleSaveTingeeMerchantId = async () => {
    setIsSavingTingeeMerchantId(true);
    try {
      await updateBusinessProfile.mutateAsync({
        tingeeMerchantId: tingeeMerchantId.trim(),
      });
      toast.success("Đã lưu Merchant ID Tingee");
    } catch (err) {
      console.error("Save Tingee Merchant ID failed:", err);
      toast.error(
        `Lỗi khi lưu Merchant ID — ${err instanceof Error ? err.message : "vui lòng thử lại"}`,
      );
    } finally {
      setIsSavingTingeeMerchantId(false);
    }
  };

  const handleTestTingeeConnection = async () => {
    if (!webhookEndpointInfo) {
      setTingeeConnectionStatus("error");
      setTingeeConnectionError(
        "Không lấy được webhook URL. Vui lòng kiểm tra kết nối canister.",
      );
      return;
    }
    setTingeeConnectionStatus("testing");
    setTingeeConnectionError("");
    try {
      // Ping the Tingee webhook endpoint with an empty body to verify the
      // canister is reachable and the webhook route responds. A non-200
      // status or network error surfaces a clear failure message.
      const response = await fetch(webhookEndpointInfo, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      });
      if (response.ok) {
        setTingeeConnectionStatus("success");
      } else {
        const errText = await response.text();
        setTingeeConnectionStatus("error");
        setTingeeConnectionError(
          errText || `Webhook trả về mã ${response.status}`,
        );
      }
    } catch (e) {
      setTingeeConnectionStatus("error");
      setTingeeConnectionError(
        e instanceof Error ? e.message : "Không kết nối được webhook Tingee",
      );
    }
  };

  const handleSaveReal = async () => {
    if (!actor) return;
    // Validate GUID
    if (realGuid.trim().length > 0 && realGuid.trim().length < 5) {
      setRealGuidError("GUID không hợp lệ, phải là UUID đầy đủ");
      toast.error("GUID Production không hợp lệ");
      return;
    }
    setRealGuidError("");
    setIsSavingReal(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (actor as any).saveRealBkavConfig(
        realGuid,
        realToken,
        realApiUrl,
      );
      if ("ok" in result) {
        toast.success("Đã lưu cấu hình Chạy Thật");
        await loadBkavConfig();
      } else {
        toast.error(`Lỗi: ${result.err}`);
      }
    } catch (_e) {
      toast.error("Lỗi kết nối");
    } finally {
      setIsSavingReal(false);
    }
  };

  const handleSaveBkavCommon = async () => {
    if (!actor) return;
    await doSaveBkavCommon();
  };

  const doSaveBkavCommon = async () => {
    if (!actor) return;
    setIsSavingBkavCommon(true);
    try {
      // Pass the editable workerPrincipalInput to the backend. An empty string
      // is sent as null so the backend keeps the existing principal (it only
      // overwrites on a non-null/non-empty value). The owner cannot clear the
      // principal from this UI.
      const workerPrincipalArg =
        workerPrincipalInput.trim().length > 0
          ? workerPrincipalInput.trim()
          : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (actor as any).saveBkavCommonConfig(
        prodInvoiceSerial,
        bkavInvoiceForm,
        Number(bkavVatRate),
        workerPrincipalArg,
      );
      // Result is a Candid variant: { ok: null } | { err: Text }.
      // Guard against both object and string-encoded shapes.
      const isOk =
        (result && typeof result === "object" && "ok" in result) ||
        result === "ok";
      if (isOk) {
        toast.success(
          "Đã lưu cài đặt chung. Hóa đơn thật sẽ được phát hành với khách hàng.",
        );
        // Re-sync UI with the value the backend actually persisted.
        await loadBkavConfig();
      } else {
        // Save failed — surface a clear error and re-sync from backend.
        const errMsg =
          result && typeof result === "object" && "err" in result
            ? String(result.err)
            : "Lưu thất bại, vui lòng thử lại.";
        toast.error(`Lỗi: ${errMsg}`);
        await loadBkavConfig();
      }
    } catch (_e) {
      toast.error("Lỗi kết nối");
      // On exception we cannot trust the local state — re-sync from backend.
      await loadBkavConfig();
    } finally {
      setIsSavingBkavCommon(false);
    }
  };

  const handleSaveWorkerPrincipal = async () => {
    if (!actor) return;
    const trimmed = workerPrincipalInput.trim();
    if (trimmed.length === 0) {
      // Empty input is intentional "keep existing" — but the owner pressed the
      // dedicated save button, so explain that empty does not clear.
      toast.info(
        "Không thể xoá Worker Principal. Để trống input sẽ giữ nguyên principal hiện tại khi lưu Cài đặt chung.",
      );
      return;
    }
    setIsSavingWorkerPrincipal(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (actor as any).saveBkavCommonConfig(
        prodInvoiceSerial,
        bkavInvoiceForm,
        Number(bkavVatRate),
        trimmed,
      );
      const isOk =
        (result && typeof result === "object" && "ok" in result) ||
        result === "ok";
      if (isOk) {
        toast.success("Đã lưu Worker Principal mới");
        // Reload so the readonly label reflects the newly persisted principal
        // and the editable input is reset.
        await loadBkavConfig();
      } else {
        const errMsg =
          result && typeof result === "object" && "err" in result
            ? String(result.err)
            : "Lưu Worker Principal thất bại.";
        toast.error(`Lỗi: ${errMsg}`);
      }
    } catch (_e) {
      toast.error("Lỗi kết nối khi lưu Worker Principal");
    } finally {
      setIsSavingWorkerPrincipal(false);
    }
  };

  return (
    <AdminLayout>
      <div data-ocid="business-profile.page" className="max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h2 className="font-display text-2xl text-foreground">{bp.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{bp.subtitle}</p>
        </div>

        {/* Tingee not configured warning — shown when the restaurant has
            selected Tingee as the auto-payment QR provider but Tingee is
            not yet configured (clientId/secretToken empty). We do NOT
            auto-fallback to Tingee; instead we surface a clear, actionable
            warning so the owner configures Tingee before it can be used. */}
        {!isLoading &&
          businessProfileData &&
          autoPaymentApp === AutoPaymentApp.Tingee &&
          hasTingeeConfigured === false && (
            <div
              data-ocid="business-profile.tingeeNotConfigured_warning"
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3"
              role="alert"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800">
                    Cảnh báo: Chưa cấu hình Tingee
                  </p>
                  <p className="text-sm text-amber-700">
                    Bạn đã chọn Tingee làm ứng dụng xác nhận chuyển khoản tự
                    động, nhưng Tingee chưa được cấu hình (thiếu Client ID /
                    Secret Token). Vui lòng hoàn tất cấu hình Tingee trong tab
                    “Xác nhận CK tự động” trước khi sử dụng. Hệ thống sẽ không
                    tự động chuyển sang Tingee.
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* No restaurant state */}
        {!isLoading && !businessProfileData && (
          <div
            data-ocid="business-profile.no_restaurant"
            className="rounded-xl bg-muted/40 border border-border p-6 text-sm text-muted-foreground"
          >
            {bp.noRestaurant}
          </div>
        )}

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-1 h-auto bg-muted/50 p-1">
            <TabsTrigger
              value="info"
              className="text-xs sm:text-sm px-2 py-1.5"
            >
              Thông tin doanh nghiệp
            </TabsTrigger>
            <TabsTrigger
              value="payment"
              className="text-xs sm:text-sm px-2 py-1.5"
            >
              Xác nhận CK tự động
            </TabsTrigger>
            <TabsTrigger
              value="invoice"
              className="text-xs sm:text-sm px-2 py-1.5"
            >
              Hoá đơn điện tử
            </TabsTrigger>
            <TabsTrigger
              value="delivery"
              className="text-xs sm:text-sm px-2 py-1.5"
            >
              Ứng dụng giao hàng
            </TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-6 mt-0">
            {/* Form card */}
            {(isLoading || businessProfileData) && (
              <div className="bg-card border border-border rounded-xl p-6">
                {isLoading ? (
                  <div className="space-y-5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-32 rounded" />
                        <Skeleton className="h-10 w-full rounded-md" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Business Name */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bp-businessName"
                        className="flex items-center gap-1.5"
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {bp.businessName}
                      </Label>
                      <Input
                        id="bp-businessName"
                        placeholder={bp.businessNamePlaceholder}
                        value={form.businessName}
                        onChange={(e) => set("businessName", e.target.value)}
                        data-ocid="business-profile.businessName_input"
                      />
                    </div>

                    {/* Address */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bp-address"
                        className="flex items-center gap-1.5"
                      >
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {bp.address}
                      </Label>
                      <Input
                        id="bp-address"
                        placeholder={bp.addressPlaceholder}
                        value={form.address}
                        onChange={(e) => set("address", e.target.value)}
                        data-ocid="business-profile.address_input"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bp-email"
                        className="flex items-center gap-1.5"
                      >
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {bp.email}
                      </Label>
                      <Input
                        id="bp-email"
                        type="email"
                        placeholder={bp.emailPlaceholder}
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                        data-ocid="business-profile.email_input"
                      />
                    </div>

                    {/* Tax Code */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bp-taxCode"
                        className="flex items-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        Mã số thuế (Tax Code)
                      </Label>
                      <Input
                        id="bp-taxCode"
                        placeholder="Nhập mã số thuế doanh nghiệp"
                        value={form.taxCode}
                        onChange={(e) => set("taxCode", e.target.value)}
                        data-ocid="business-profile.taxCode_input"
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bp-phone"
                        className="flex items-center gap-1.5"
                      >
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        Điện thoại (Phone)
                      </Label>
                      <Input
                        id="bp-phone"
                        placeholder="Nhập số điện thoại doanh nghiệp"
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        data-ocid="business-profile.phone_input"
                      />
                    </div>

                    {/* Domain */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bp-domain"
                        className="flex items-center gap-1.5"
                      >
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        {bp.domain}
                      </Label>
                      <Input
                        id="bp-domain"
                        placeholder={bp.domainPlaceholder}
                        value={form.domain}
                        onChange={(e) => set("domain", e.target.value)}
                        data-ocid="business-profile.domain_input"
                      />
                    </div>

                    {/* Brand Logo */}
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        Logo thương hiệu
                      </Label>
                      <div className="flex items-center gap-3">
                        {form.brandLogo && (
                          <img
                            src={form.brandLogo}
                            alt="Brand logo preview"
                            className="h-16 w-16 rounded-md object-contain border border-border bg-muted"
                          />
                        )}
                        <label
                          htmlFor="bp-brandLogo"
                          className="cursor-pointer inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent transition-colors"
                          data-ocid="business-profile.brandLogo_upload_button"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Tải lên logo
                        </label>
                        <input
                          id="bp-brandLogo"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const resized = await resizeImage(
                              file,
                              400,
                              400,
                              0.85,
                            );
                            set("brandLogo", resized);
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Hình ảnh logo hiển thị trên trang đặt món (tối đa
                        400×400px)
                      </p>
                    </div>

                    {/* Bank Account Section */}
                    <Separator className="my-2" />
                    <div className="flex items-center gap-2 pb-1">
                      <Landmark className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm text-foreground">
                        {bp.bankSection}
                      </h3>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bp-accountNumber"
                        className="flex items-center gap-1.5"
                      >
                        <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                        {bp.accountNumber}
                      </Label>
                      <Input
                        id="bp-accountNumber"
                        placeholder={bp.accountNumberPlaceholder}
                        value={form.accountNumber}
                        onChange={(e) => set("accountNumber", e.target.value)}
                        data-ocid="business-profile.accountNumber_input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bp-bankName"
                        className="flex items-center gap-1.5"
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {bp.bankName}
                      </Label>
                      <Input
                        id="bp-bankName"
                        placeholder={bp.bankNamePlaceholder}
                        value={form.bankName}
                        onChange={(e) => set("bankName", e.target.value)}
                        data-ocid="business-profile.bankName_input"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bp-accountHolderName"
                        className="flex items-center gap-1.5"
                      >
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {bp.accountHolderName}
                      </Label>
                      <Input
                        id="bp-accountHolderName"
                        placeholder={bp.accountHolderNamePlaceholder}
                        value={form.accountHolderName}
                        onChange={(e) =>
                          set("accountHolderName", e.target.value)
                        }
                        data-ocid="business-profile.accountHolderName_input"
                      />
                    </div>

                    {/* Submit */}
                    <div className="pt-2 border-t border-border">
                      <Button
                        type="submit"
                        disabled={
                          updateBusinessProfile.isPending ||
                          !businessProfileData
                        }
                        data-ocid="business-profile.save_button"
                      >
                        {updateBusinessProfile.isPending
                          ? bp.saving
                          : bp.saveProfile}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </TabsContent>
          <TabsContent value="payment" className="space-y-6 mt-0">
            {/* Auto-payment confirmation (Tingee sub-tab) */}
            {!isLoading && businessProfileData && (
              <div
                className="bg-card rounded-xl border border-border p-6 space-y-4"
                data-ocid="business-profile.auto_payment_section"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Xác nhận chuyển khoản tự động
                  </h3>
                </div>

                {/* App selector */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    Chọn ứng dụng xác nhận:
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="autoPaymentApp"
                        checked={autoPaymentApp === AutoPaymentApp.Tingee}
                        onChange={() => {
                          setAutoPaymentApp(AutoPaymentApp.Tingee);
                          setAutoPaymentSubTab("tingee");
                        }}
                        className="h-4 w-4 text-primary"
                        data-ocid="business-profile.autoPaymentApp_tingee"
                      />
                      <span className="text-sm text-foreground">Tingee</span>
                    </label>
                  </div>

                  {/* Inline warning when Tingee is selected but not
                      configured. We do not auto-fallback to Tingee — the
                      owner must configure Tingee first. The save button
                      below is disabled until Tingee is configured so the
                      selection cannot be persisted in a broken state. */}
                  {autoPaymentApp === AutoPaymentApp.Tingee &&
                    hasTingeeConfigured === false && (
                      <div
                        data-ocid="business-profile.tingeeNotConfigured_inline_warning"
                        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5"
                        role="alert"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-amber-800">
                              Tingee chưa được cấu hình
                            </p>
                            <p className="text-xs text-amber-700">
                              Vui lòng nhập Client ID, Secret Token, số tài
                              khoản và ngân hàng trong mục “Tingee” bên dưới rồi
                              bấm “Lưu cấu hình Tingee” trước khi lưu chọn ứng
                              dụng. Hệ thống sẽ không tự chuyển sang Tingee.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveAppSelection}
                    disabled={
                      updateAutoPayment.isPending ||
                      (autoPaymentApp === AutoPaymentApp.Tingee &&
                        hasTingeeConfigured === false)
                    }
                    data-ocid="business-profile.saveAppSelection_button"
                  >
                    {updateAutoPayment.isPending
                      ? "Đang lưu..."
                      : "Lưu chọn app xác nhận"}
                  </Button>
                  {autoPaymentApp === AutoPaymentApp.Tingee &&
                    hasTingeeConfigured === false && (
                      <p className="text-xs text-amber-600">
                        Nút lưu bị khoá cho đến khi Tingee được cấu hình đầy đủ.
                      </p>
                    )}
                </div>

                <Separator className="my-2" />

                {/* Sub-tab switcher — Tingee only */}
                <div className="flex gap-0 border border-border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAutoPaymentSubTab("tingee")}
                    data-ocid="business-profile.autoPayment_subtab_tingee"
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      autoPaymentSubTab === "tingee"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-accent"
                    }`}
                  >
                    Tingee
                  </button>
                </div>

                {/* Tingee sub-tab panel — production config */}
                {autoPaymentSubTab === "tingee" && (
                  <div className="space-y-4 pt-1">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold text-base">
                          Cấu hình Tingee
                        </h3>
                        {hasTingeeConfigured ? (
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            ✅ Đã cấu hình
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            ⚠️ Chưa cấu hình
                          </span>
                        )}
                      </div>

                      {/* Client ID */}
                      <div className="space-y-1">
                        <Label>Client ID</Label>
                        <Input
                          value={tingeeClientId}
                          onChange={(e) => setTingeeClientId(e.target.value)}
                          placeholder="Tingee Client ID (x-client-id)"
                          data-ocid="business-profile.tingeeClientId_input"
                        />
                        <p className="text-xs text-muted-foreground">
                          Lấy trong hồ sơ doanh nghiệp Tingee
                        </p>
                      </div>

                      {/* Secret Token — password toggle */}
                      <div className="space-y-1">
                        <Label>Secret Token</Label>
                        <div className="relative">
                          <Input
                            type={showTingeeSecretToken ? "text" : "password"}
                            value={tingeeSecretToken}
                            onChange={(e) =>
                              setTingeeSecretToken(e.target.value)
                            }
                            placeholder="Nhập Secret Token từ Tingee"
                            autoComplete="new-password"
                            className="pr-10"
                            data-ocid="business-profile.tingeeSecretToken_input"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-2 text-muted-foreground"
                            onClick={() => setShowTingeeSecretToken((v) => !v)}
                            aria-label={
                              showTingeeSecretToken
                                ? "Ẩn Secret Token"
                                : "Hiện Secret Token"
                            }
                            data-ocid="business-profile.tingeeSecretToken_toggle"
                          >
                            {showTingeeSecretToken ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Secret Token được lưu bảo mật — không hiển thị lại sau
                          khi lưu. Để trống nếu không muốn thay đổi.
                        </p>
                      </div>

                      {/* Order Prefix */}
                      <div className="space-y-1">
                        <Label>Prefix mã đơn</Label>
                        <Input
                          value={tingeeOrderPrefix}
                          onChange={(e) => setTingeeOrderPrefix(e.target.value)}
                          placeholder="BBHVIV"
                          data-ocid="business-profile.tingeeOrderPrefix_input"
                        />
                        <p className="text-xs text-muted-foreground">
                          Tiền tố cho mã đơn hàng gửi sang Tingee (mặc định
                          BBHVIV).
                        </p>
                      </div>

                      {/* Virtual Account (VA) — manual entry, stored at the
                          business-profile level. When non-empty, the
                          customer-facing payment flow renders the dynamic QR
                          panel (DynamicQRPanel) alongside the static
                          TingeeQRPanel. */}
                      <div className="space-y-1">
                        <Label>Virtual Account (VA) Tingee</Label>
                        <Input
                          value={tingeeVA}
                          onChange={(e) => setTingeeVA(e.target.value)}
                          placeholder="Nhập số Virtual Account từ Tingee"
                          data-ocid="business-profile.tingeeVA_input"
                        />
                        <p className="text-xs text-muted-foreground">
                          Số tài khoản ảo (VA) do Tingee cấp. Khi điền, hệ thống
                          sẽ tạo mã QR động cho khách hàng thay vì QR tĩnh.
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleSaveTingeeVA}
                          disabled={isSavingTingeeVA}
                          data-ocid="business-profile.saveTingeeVA_button"
                        >
                          {isSavingTingeeVA ? "Đang lưu..." : "Lưu VA"}
                        </Button>
                      </div>

                      {/* Bank BIN Tingee — manual entry, stored at the
                          business-profile level. Required to enable the
                          Tingee dynamic-QR flow. */}
                      <div className="space-y-1">
                        <Label>Bank BIN Tingee</Label>
                        <Input
                          value={tingeeBankBin}
                          onChange={(e) => setTingeeBankBin(e.target.value)}
                          placeholder="Nhập mã BIN từ Tingee"
                          data-ocid="business-profile.tingeeBankBin_input"
                        />
                        <p className="text-xs text-muted-foreground">
                          Mã BIN của ngân hàng do Tingee cấp, dùng để tạo QR
                          động. Bắt buộc để bật luồng QR động Tingee.
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleSaveTingeeBankBin}
                          disabled={isSavingTingeeBankBin}
                          data-ocid="business-profile.saveTingeeBankBin_button"
                        >
                          {isSavingTingeeBankBin
                            ? "Đang lưu..."
                            : "Lưu Bank BIN"}
                        </Button>
                      </div>

                      {/* Tra cứu ngân hàng Tingee — placed immediately after
                          the Bank BIN input + save button. The user clicks
                          "Xem danh sách ngân hàng" to fetch the bank list
                          (cached for the session). Picking a bank only fills
                          the Bank BIN input above — the user must still press
                          "Lưu Bank BIN" themselves. */}
                      <div
                        className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
                        data-ocid="business-profile.tingeeBankLookup_section"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">
                              Tra cứu ngân hàng Tingee
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowTingeeBankLookup((v) => !v)}
                            disabled={
                              tingeeBanksQuery.isLoading ||
                              tingeeBanksQuery.isFetching
                            }
                            data-ocid="business-profile.tingeeBankLookup_toggle_button"
                          >
                            {tingeeBanksQuery.isLoading ||
                            tingeeBanksQuery.isFetching
                              ? "Đang tải..."
                              : showTingeeBankLookup
                                ? "Ẩn danh sách"
                                : "Xem danh sách ngân hàng"}
                          </Button>
                        </div>

                        {showTingeeBankLookup && (
                          <div
                            className="space-y-3"
                            data-ocid="business-profile.tingeeBankLookup_panel"
                          >
                            {/* Loading state */}
                            {(tingeeBanksQuery.isLoading ||
                              tingeeBanksQuery.isFetching) && (
                              <div
                                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-3 text-sm text-muted-foreground"
                                data-ocid="business-profile.tingeeBankLookup_loading_state"
                              >
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Đang tải danh sách ngân hàng...</span>
                              </div>
                            )}

                            {/* Error state */}
                            {tingeeBanksQuery.isError && (
                              <div
                                className="space-y-2 rounded-md border border-red-200 bg-red-50 px-3 py-3"
                                data-ocid="business-profile.tingeeBankLookup_error_state"
                                role="alert"
                              >
                                <div className="flex items-start gap-2">
                                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium text-destructive">
                                      Không tải được danh sách ngân hàng
                                    </p>
                                    <p className="text-xs text-destructive/80">
                                      {tingeeBanksQuery.error instanceof Error
                                        ? tingeeBanksQuery.error.message
                                        : "Đã xảy ra lỗi. Vui lòng thử lại."}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => tingeeBanksQuery.refetch()}
                                  disabled={tingeeBanksQuery.isFetching}
                                  data-ocid="business-profile.tingeeBankLookup_retry_button"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                  Thử lại
                                </Button>
                              </div>
                            )}

                            {/* Success state — search + table */}
                            {tingeeBanksQuery.data &&
                              !tingeeBanksQuery.isFetching && (
                                <div className="space-y-2">
                                  {/* Search input */}
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                      type="text"
                                      value={tingeeBankSearch}
                                      onChange={(e) =>
                                        setTingeeBankSearch(e.target.value)
                                      }
                                      placeholder="Tìm theo tên, mã ngân hàng hoặc BIN..."
                                      className="pl-8"
                                      data-ocid="business-profile.tingeeBankLookup_search_input"
                                    />
                                  </div>

                                  {tingeeBanksQuery.data.banks.length === 0 ? (
                                    <div
                                      className="rounded-md border border-border bg-card px-3 py-4 text-center text-sm text-muted-foreground"
                                      data-ocid="business-profile.tingeeBankLookup_empty_state"
                                    >
                                      Không tìm thấy ngân hàng nào
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto rounded-md border border-border bg-card">
                                      <table className="w-full text-sm">
                                        <thead className="bg-muted/50 sticky top-0">
                                          <tr className="text-left text-xs text-muted-foreground">
                                            <th className="px-3 py-2 font-medium">
                                              BIN
                                            </th>
                                            <th className="px-3 py-2 font-medium">
                                              Mã ngân hàng
                                            </th>
                                            <th className="px-3 py-2 font-medium">
                                              Tên ngân hàng
                                            </th>
                                            <th className="px-3 py-2 font-medium">
                                              Logo
                                            </th>
                                            <th className="px-3 py-2 font-medium text-right">
                                              Hành động
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                          {tingeeBanksQuery.data.banks
                                            .filter((bank) => {
                                              const q = tingeeBankSearch
                                                .trim()
                                                .toLowerCase();
                                              if (!q) return true;
                                              return (
                                                bank.bankBin
                                                  .toLowerCase()
                                                  .includes(q) ||
                                                bank.bankCode
                                                  .toLowerCase()
                                                  .includes(q) ||
                                                bank.bankName
                                                  .toLowerCase()
                                                  .includes(q) ||
                                                bank.shortName
                                                  .toLowerCase()
                                                  .includes(q)
                                              );
                                            })
                                            .map((bank, idx) => {
                                              const logoBroken =
                                                tingeeBankLogoErrors[
                                                  bank.bankBin
                                                ] === true;
                                              return (
                                                <tr
                                                  key={bank.bankBin}
                                                  data-ocid={`business-profile.tingeeBankLookup_row.${idx}`}
                                                  className="hover:bg-accent/40"
                                                >
                                                  <td className="px-3 py-2 font-mono text-xs text-foreground whitespace-nowrap">
                                                    {bank.bankBin}
                                                  </td>
                                                  <td className="px-3 py-2 text-foreground whitespace-nowrap">
                                                    {bank.bankCode}
                                                  </td>
                                                  <td className="px-3 py-2 text-foreground min-w-0">
                                                    <div className="break-words">
                                                      {bank.bankName}
                                                    </div>
                                                    {bank.shortName &&
                                                      bank.shortName !==
                                                        bank.bankCode && (
                                                        <div className="text-xs text-muted-foreground">
                                                          {bank.shortName}
                                                        </div>
                                                      )}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    {bank.bankLogo &&
                                                    !logoBroken ? (
                                                      <img
                                                        src={bank.bankLogo}
                                                        alt={`Logo ${bank.bankName}`}
                                                        className="h-7 w-7 rounded object-contain bg-muted border border-border"
                                                        onError={() =>
                                                          setTingeeBankLogoErrors(
                                                            (prev) => ({
                                                              ...prev,
                                                              [bank.bankBin]: true,
                                                            }),
                                                          )
                                                        }
                                                      />
                                                    ) : (
                                                      <div
                                                        className="flex h-7 w-7 items-center justify-center rounded bg-muted border border-border"
                                                        aria-label={`Không có logo ${bank.bankName}`}
                                                      >
                                                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                      </div>
                                                    )}
                                                  </td>
                                                  <td className="px-3 py-2 text-right">
                                                    <Button
                                                      type="button"
                                                      variant="secondary"
                                                      size="sm"
                                                      onClick={() => {
                                                        setTingeeBankBin(
                                                          bank.bankBin,
                                                        );
                                                        toast.success(
                                                          `Đã điền BIN ${bank.bankBin} (${bank.shortName || bank.bankCode}). Bấm "Lưu Bank BIN" để lưu.`,
                                                        );
                                                      }}
                                                      data-ocid={`business-profile.tingeeBankLookup_useBin_button.${idx}`}
                                                    >
                                                      Dùng BIN này
                                                    </Button>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                        )}
                      </div>

                      {/* Merchant ID Tingee — manual entry, stored at the
                          business-profile level. Required to enable the
                          Tingee dynamic-QR flow. */}
                      <div className="space-y-1">
                        <Label>Merchant ID Tingee</Label>
                        <Input
                          value={tingeeMerchantId}
                          onChange={(e) => setTingeeMerchantId(e.target.value)}
                          placeholder="Nhập Merchant ID từ Tingee"
                          data-ocid="business-profile.tingeeMerchantId_input"
                        />
                        <p className="text-xs text-muted-foreground">
                          Mã merchant do Tingee cấp, dùng để tạo QR động. Bắt
                          buộc để bật luồng QR động Tingee.
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleSaveTingeeMerchantId}
                          disabled={isSavingTingeeMerchantId}
                          data-ocid="business-profile.saveTingeeMerchantId_button"
                        >
                          {isSavingTingeeMerchantId
                            ? "Đang lưu..."
                            : "Lưu Merchant ID"}
                        </Button>
                      </div>

                      {/* Read-only bank info — synced from Thông tin ngân hàng */}
                      <div
                        className="rounded-md border border-border bg-muted/40 p-3 space-y-2"
                        data-ocid="business-profile.tingeeBankInfoReadonly"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">
                            Thông tin tài khoản nhận tiền
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-muted-foreground">
                              Số tài khoản
                            </span>
                            <span className="font-medium text-foreground text-right break-all">
                              {form.accountNumber || "—"}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-muted-foreground">
                              Tên ngân hàng
                            </span>
                            <span className="font-medium text-foreground text-right break-words">
                              {form.bankName || "—"}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-muted-foreground">
                              Chủ tài khoản
                            </span>
                            <span className="font-medium text-foreground text-right break-words">
                              {form.accountHolderName || "—"}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                          Được lấy từ phần Thông tin ngân hàng ở trên.
                        </p>
                      </div>

                      {/* Save button */}
                      <div className="space-y-1.5">
                        <Button
                          onClick={handleSaveTingeeConfig}
                          disabled={saveTingeeConfigMutation.isPending}
                          data-ocid="business-profile.saveTingeeConfig_button"
                        >
                          {saveTingeeConfigMutation.isPending
                            ? "Đang lưu..."
                            : "Lưu cấu hình Tingee"}
                        </Button>
                      </div>
                    </div>

                    {/* Webhook URL + connection test */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <p className="text-sm font-medium text-foreground">
                        Webhook Tingee
                      </p>
                      <div className="space-y-1.5">
                        <Label>Webhook URL</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={webhookEndpointInfo ?? ""}
                            readOnly
                            className="bg-muted font-mono text-sm flex-1"
                            data-ocid="business-profile.tingeeWebhookUrl_input"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (webhookEndpointInfo) {
                                navigator.clipboard.writeText(
                                  webhookEndpointInfo,
                                );
                                toast.success("Đã sao chép Webhook URL");
                              }
                            }}
                            disabled={!webhookEndpointInfo}
                            data-ocid="business-profile.copyTingeeWebhook_button"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Dán URL này vào cấu hình webhook trên Tingee để nhận
                          thông báo thanh khoản tự động.
                        </p>
                      </div>

                      {/* Test connection */}
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleTestTingeeConnection}
                          disabled={
                            tingeeConnectionStatus === "testing" ||
                            !webhookEndpointInfo
                          }
                          data-ocid="business-profile.tingeeTestConnection_button"
                        >
                          {tingeeConnectionStatus === "testing" ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Đang kiểm tra...
                            </>
                          ) : (
                            <>Kiểm tra kết nối</>
                          )}
                        </Button>
                        {tingeeConnectionStatus === "success" && (
                          <div
                            data-ocid="business-profile.tingeeConnection_success_state"
                            className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-green-800">
                                Kết nối webhook Tingee thành công
                              </p>
                              <p className="text-xs text-green-700 mt-0.5">
                                Webhook URL phản hồi đúng.
                              </p>
                            </div>
                          </div>
                        )}
                        {tingeeConnectionStatus === "error" && (
                          <div
                            data-ocid="business-profile.tingeeConnection_error_state"
                            className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2"
                          >
                            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-destructive">
                                Kết nối thất bại
                              </p>
                              <p className="text-xs text-destructive/80 mt-0.5">
                                {tingeeConnectionError ||
                                  "Không kết nối được webhook Tingee"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
          <TabsContent value="invoice" className="space-y-6 mt-0">
            {/* Invoice Provider + BKAV Section */}
            {!isLoading && businessProfileData && (
              <div
                className="bg-card rounded-xl border border-border p-6 space-y-4"
                data-ocid="business-profile.invoice_section"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Hóa đơn điện tử
                  </h3>
                </div>

                {/* Provider selector */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    Nhà cung cấp hóa đơn điện tử:
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="invoiceProvider"
                        checked={invoiceProvider === "BKAV"}
                        onChange={() => setInvoiceProvider("BKAV")}
                        className="h-4 w-4 text-primary"
                        data-ocid="business-profile.invoiceProvider_bkav"
                      />
                      <span className="text-sm text-foreground">
                        BKAV eHoadon
                      </span>
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveInvoiceProvider}
                    disabled={isSavingProvider}
                    data-ocid="business-profile.saveInvoiceProvider_button"
                  >
                    {isSavingProvider ? "Đang lưu..." : "Lưu nhà cung cấp"}
                  </Button>
                </div>

                <Separator className="my-2" />

                {/* BKAV config */}
                {invoiceProvider === "BKAV" && (
                  <div
                    className="space-y-4"
                    data-ocid="business-profile.bkav_invoice_section"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-foreground">
                        Cấu hình hóa đơn điện tử BKAV
                      </h4>
                      {cyclesBalance !== null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            Cycles hiện tại của canister:
                          </span>
                          {cyclesBalance >= 1_000_000_000_000n ? (
                            <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                              {(Number(cyclesBalance) / 1e12).toFixed(2)} T
                              cycles
                            </span>
                          ) : cyclesBalance >= 1_000_000_000n ? (
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              {(Number(cyclesBalance) / 1e9).toFixed(2)} B
                              cycles
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="h-3 w-3" />
                              {(Number(cyclesBalance) / 1e6).toFixed(0)} M
                              cycles
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-6">
                      {/* GROUP 2 — Cấu hình Chạy Thật (Production) */}
                      <div className="border rounded-lg p-4 space-y-4">
                        <h3 className="font-semibold text-base">
                          Cấu hình Chạy Thật (Production)
                        </h3>
                        <div className="space-y-2">
                          <label className="text-sm font-medium block">
                            Mã đối tác (PartnerGUID - username)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type={showRealGuid ? "text" : "password"}
                              className={`flex-1 border rounded px-3 py-2 text-sm ${realGuidError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                              value={realGuid}
                              onChange={(e) => {
                                setRealGuid(e.target.value);
                                if (
                                  e.target.value.trim().length >= 5 ||
                                  e.target.value.trim().length === 0
                                ) {
                                  setRealGuidError("");
                                }
                              }}
                              placeholder="Nhập UUID đầy đủ, ví dụ: 12345678-1234-1234-1234-123456789abc"
                            />
                            <button
                              type="button"
                              className="px-3 py-2 border rounded text-sm whitespace-nowrap"
                              onClick={() => setShowRealGuid((v) => !v)}
                              data-ocid="bkav.real_guid_toggle"
                            >
                              {showRealGuid ? "Ẩn" : "Hiện"}
                            </button>
                          </div>
                          {realGuidError && (
                            <p className="text-xs text-red-600 mt-1">
                              {realGuidError}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium block">
                            Token đối tác (PartnerToken - password)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type={showRealToken ? "text" : "password"}
                              className="flex-1 border rounded px-3 py-2 text-sm"
                              value={realToken}
                              onChange={(e) => setRealToken(e.target.value)}
                              placeholder="Nhập PartnerToken từ BKAV"
                            />
                            <button
                              type="button"
                              className="px-3 py-2 border rounded text-sm whitespace-nowrap"
                              onClick={() => setShowRealToken((v) => !v)}
                            >
                              {showRealToken ? "Ẩn" : "Hiện"}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium block">
                            URL API Production
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded px-3 py-2 text-sm"
                            value={realApiUrl}
                            onChange={(e) => setRealApiUrl(e.target.value)}
                            placeholder="https://ws.ehoadon.vn/WSPublicEhoadon.asmx"
                          />
                        </div>
                        <button
                          type="button"
                          className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50"
                          onClick={handleSaveReal}
                          disabled={isSavingReal}
                        >
                          {isSavingReal
                            ? "Đang lưu..."
                            : "Lưu cấu hình Chạy Thật"}
                        </button>
                      </div>

                      {/* GROUP 3 — Cài đặt chung */}
                      <div className="border rounded-lg p-4 space-y-4">
                        <h3 className="font-semibold text-base">
                          Cài đặt chung
                        </h3>

                        <div className="space-y-2">
                          <label className="text-sm font-medium block">
                            Ký hiệu HĐ Production
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded px-3 py-2 text-sm"
                            value={prodInvoiceSerial}
                            onChange={(e) =>
                              setProdInvoiceSerial(e.target.value)
                            }
                            placeholder="VD: C26MAA"
                            data-ocid="business-profile.prodInvoiceSerial_input"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium block">
                            Mẫu hoá đơn (InvoiceForm)
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded px-3 py-2 text-sm"
                            value={bkavInvoiceForm}
                            onChange={(e) => setBkavInvoiceForm(e.target.value)}
                            placeholder="ví dụ: 01GTKT0/001"
                            data-ocid="business-profile.invoiceForm_input"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium block">
                            Thuế suất GTGT
                          </label>
                          <select
                            className="w-full border rounded px-3 py-2 text-sm"
                            value={bkavVatRate}
                            onChange={(e) =>
                              setBkavVatRate(Number(e.target.value))
                            }
                            data-ocid="business-profile.vatRate_select"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={8}>8%</option>
                            <option value={10}>10%</option>
                            <option value={15}>15%</option>
                          </select>
                        </div>

                        <button
                          className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50"
                          onClick={handleSaveBkavCommon}
                          disabled={isSavingBkavCommon}
                          data-ocid="business-profile.saveBkavCommon_button"
                        >
                          {isSavingBkavCommon
                            ? "Đang lưu..."
                            : "Lưu cài đặt chung"}
                        </button>
                      </div>
                    </div>

                    {/* GROUP 4 — Worker Config Section */}
                    <div className="mt-6 border-t pt-6">
                      <Card data-ocid="business-profile.worker_section">
                        <CardHeader>
                          <CardTitle>Worker</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            Quản lý worker principal, heartbeat và retry policy
                          </p>
                          <Button
                            type="button"
                            onClick={() => navigate({ to: "/admin/worker" })}
                            data-ocid="business-profile.manageWorker_button"
                          >
                            Quản lý Worker
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
          <TabsContent value="delivery" className="space-y-6 mt-0">
            <Card data-ocid="business-profile.ahamove_section">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    AhaMove
                  </CardTitle>
                  {ahamoveConfig?.apiKey ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      ✅ Đã cấu hình
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      Chưa cấu hình
                    </span>
                  )}
                </div>
                <CardDescription>
                  Tích hợp AhaMove để đặt tài xế giao hàng tự động
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ahamove-apikey">API Key (Server Key)</Label>
                  <div className="relative">
                    <Input
                      id="ahamove-apikey"
                      type={showAhamoveApiKey ? "text" : "password"}
                      value={ahamoveApiKey}
                      onChange={(e) => setAhamoveApiKey(e.target.value)}
                      placeholder="Nhập API Key từ AhaMove"
                      className="pr-10"
                      autoComplete="new-password"
                      data-ocid="business-profile.ahamoveApiKey_input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAhamoveApiKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={
                        showAhamoveApiKey ? "Ẩn API Key" : "Hiện API Key"
                      }
                    >
                      {showAhamoveApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lấy Server Key từ portal AhaMove đối tác
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ahamove-mobile">
                    Số điện thoại tài khoản AhaMove
                  </Label>
                  <Input
                    id="ahamove-mobile"
                    type="text"
                    value={ahamoveMobile}
                    onChange={(e) => setAhamoveMobile(e.target.value)}
                    placeholder="84xxxxxxxxx"
                    data-ocid="business-profile.ahamoveMobile_input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Số điện thoại đăng ký tài khoản AhaMove (định dạng quốc tế,
                    ví dụ: 84912345678)
                  </p>
                </div>

                {/* Connection test */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <p className="text-sm font-medium text-foreground">
                    Kiểm tra kết nối
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        !ahamoveApiKey.trim() ||
                        ahamoveConnectionStatus === "testing"
                      }
                      data-ocid="business-profile.ahamoveTestConnection_button"
                      onClick={async () => {
                        setAhamoveConnectionStatus("testing");
                        setAhamoveConnectionError("");
                        try {
                          // Test connection by calling proxy directly — any response means AhaMove API is reachable
                          const response = await fetch(
                            "https://proxy.bunbohue65.vn/ahamove-estimate-public",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                path: [
                                  {
                                    lat: 10.7769,
                                    lng: 106.7009,
                                    address: "10 Lê Lai, Quận 1, TP.HCM",
                                    name: "Test",
                                    mobile: "0900000000",
                                  },
                                  {
                                    lat: 10.775,
                                    lng: 106.7,
                                    address: "20 Lê Lai, Quận 1, TP.HCM",
                                    name: "Test Dropoff",
                                    mobile: "0900000001",
                                  },
                                ],
                                serviceId: "SGN-BIKE",
                                payment_method: "CASH_BY_RECIPIENT",
                              }),
                            },
                          );
                          if (response.ok) {
                            const data = await response.json();
                            if (
                              typeof data.total_price === "number" &&
                              data.total_price >= 0
                            ) {
                              setAhamoveConnectionStatus("success");
                            } else {
                              // response.ok but total_price invalid → AhaMove
                              // (or the VPS proxy) signalled failure. Surface
                              // the real cause verbatim, mirroring the booking
                              // error v398 pattern (useBookAhamoveDirect throws
                              // data.error as-is). Prefer data.error, then
                              // data.message, then the raw JSON body, so the
                              // user sees the actual reason instead of a
                              // generic "Phản hồi không hợp lệ".
                              const realCause =
                                (typeof data?.error === "string" &&
                                  data.error.length > 0 &&
                                  data.error) ||
                                (typeof data?.message === "string" &&
                                  data.message.length > 0 &&
                                  data.message) ||
                                (typeof data?.err === "string" &&
                                  data.err.length > 0 &&
                                  data.err) ||
                                "";
                              setAhamoveConnectionStatus("error");
                              setAhamoveConnectionError(
                                realCause
                                  ? `Phản hồi từ AhaMove không hợp lệ: ${realCause}`
                                  : `Phản hồi từ AhaMove không hợp lệ: ${JSON.stringify(data)}`,
                              );
                            }
                          } else {
                            const errText = await response.text();
                            // Show the real upstream cause verbatim (or near
                            // verbatim). Keep a short friendly hint for the
                            // common 401/API-key case but always append the
                            // original text so nothing is hidden, matching the
                            // v398 "show real cause" approach.
                            const isAuthError =
                              errText.includes("401") ||
                              errText.includes("Unauthorized") ||
                              errText.includes("authentication") ||
                              errText.includes("API key") ||
                              errText.includes("api_key") ||
                              errText.includes("token");
                            setAhamoveConnectionStatus("error");
                            setAhamoveConnectionError(
                              isAuthError
                                ? `API Key không hợp lệ hoặc đã hết hạn — ${errText || "không có chi tiết từ AhaMove"}`
                                : errText ||
                                    "Không nhận được phản hồi từ AhaMove",
                            );
                          }
                        } catch (e) {
                          setAhamoveConnectionStatus("error");
                          setAhamoveConnectionError(
                            e instanceof Error ? e.message : "Lỗi kết nối",
                          );
                        }
                      }}
                    >
                      {ahamoveConnectionStatus === "testing" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Đang kiểm tra...
                        </>
                      ) : (
                        <>Kiểm tra kết nối AhaMove</>
                      )}
                    </Button>
                  </div>
                  {ahamoveConnectionStatus === "success" && (
                    <div
                      data-ocid="business-profile.ahamoveConnection_success_state"
                      className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2"
                    >
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-800">
                          Kết nối AhaMove production thành công
                        </p>
                        <p className="text-xs text-green-700 mt-0.5">
                          Endpoint: https://partner-api.ahamove.com/v3
                        </p>
                      </div>
                    </div>
                  )}
                  {ahamoveConnectionStatus === "error" && (
                    <div
                      data-ocid="business-profile.ahamoveConnection_error_state"
                      className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2"
                    >
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-destructive">
                          Kết nối thất bại
                        </p>
                        <p className="text-xs text-destructive/80 mt-0.5">
                          {ahamoveConnectionError ||
                            "Không kết nối được với AhaMove"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* COD info notice */}
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
                  <span className="text-blue-500 text-base mt-0.5">ℹ️</span>
                  <p className="text-sm text-blue-700">
                    Phí vận chuyển được tài xế thu trực tiếp từ khách hàng khi
                    giao hàng (COD mode). Không cần cấu hình thêm.
                  </p>
                </div>

                {/* Integrated features list */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <p className="text-sm font-medium text-foreground">
                    Chức năng đã tích hợp AhaMove
                  </p>
                  <ul
                    className="space-y-2"
                    data-ocid="business-profile.ahamove_features_list"
                  >
                    {(
                      [
                        {
                          label:
                            "Tính phí vận chuyển động (gọi API /v3/orders/estimates khi khách nhập địa chỉ)",
                          confirmed: true,
                        },
                        {
                          label:
                            "Đặt tài xế tự động sau thanh toán Tingee (gọi /v3/orders/create)",
                          confirmed: true,
                        },
                        {
                          label:
                            "Cập nhật trạng thái đơn hàng qua webhook (/v3/webhook)",
                          confirmed: true,
                        },
                        {
                          label: "Worker poll trạng thái đơn hàng mỗi 30 giây",
                          confirmed: true,
                        },
                        {
                          label:
                            "Hóa đơn BKAV chỉ phát hành cho tiền hàng (không gồm phí ship)",
                          confirmed: true,
                        },
                        {
                          label:
                            "Môi trường production: https://partner-api.ahamove.com/v3",
                          confirmed: true,
                        },
                      ] as { label: string; confirmed: boolean }[]
                    ).map((feature) => (
                      <li
                        key="key={feature.label}"
                        className="flex items-start gap-2"
                      >
                        {feature.confirmed ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        ) : (
                          <MinusCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        )}
                        <span
                          className={`text-sm ${feature.confirmed ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {feature.label}
                          {!feature.confirmed && (
                            <span className="ml-1 text-xs">
                              (chưa test thật)
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  disabled={!ahamoveApiKey.trim() || isSavingAhamove}
                  data-ocid="business-profile.ahamoveSave_button"
                  onClick={async () => {
                    setIsSavingAhamove(true);
                    try {
                      await saveAhamoveConfigMutation.mutateAsync({
                        apiKey: ahamoveApiKey.trim(),
                        mobile: ahamoveMobile.trim() || undefined,
                      });
                      toast.success("Đã lưu cấu hình AhaMove");
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Lưu thất bại",
                      );
                    } finally {
                      setIsSavingAhamove(false);
                    }
                  }}
                >
                  {isSavingAhamove ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    "Lưu cấu hình AhaMove"
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* COD Settings Card */}
            <Card data-ocid="business-profile.cod_settings_section">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    Thu hộ COD (Cash in Advance)
                  </CardTitle>
                  {codSettingsData?.isCodAllowed ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      ✅ Đã bật
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      Đã tắt
                    </span>
                  )}
                </div>
                <CardDescription>
                  Cho phép tài xế thanh toán tiền đơn hàng tại quầy trước khi
                  nhận đồ
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="cod-allowed"
                    checked={isCodAllowed}
                    onCheckedChange={setIsCodAllowed}
                    data-ocid="business-profile.codAllowed_toggle"
                  />
                  <Label htmlFor="cod-allowed">
                    {isCodAllowed
                      ? "Cho phép COD — tài xế thanh toán tại quầy"
                      : "Tắt COD — khách thanh toán trước qua Tingee"}
                  </Label>
                </div>

                {isCodAllowed && (
                  <div className="space-y-2 pl-1">
                    <Label htmlFor="cod-limit">Giới hạn COD (VNĐ)</Label>
                    <Input
                      id="cod-limit"
                      type="number"
                      value={codLimit}
                      onChange={(e) =>
                        setCodLimit(
                          e.target.value === ""
                            ? 0
                            : Math.max(0, Number.parseInt(e.target.value, 10)),
                        )
                      }
                      placeholder="100000"
                      min={0}
                      step={1000}
                      data-ocid="business-profile.codLimit_input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Chỉ cho phép COD nếu tổng tiền đơn không vượt quá giới hạn
                      này. Mặc định: 100.000đ
                    </p>
                  </div>
                )}

                {/* COD info notice */}
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
                  <span className="text-blue-500 text-base mt-0.5">ℹ️</span>
                  <p className="text-sm text-blue-700">
                    Tài xế chỉ thanh toán tiền giá trị đơn hàng tại nhà hàng và
                    thu đủ tiền hàng + phí ship từ khách hàng khi giao hàng cho
                    khách.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  disabled={isSavingCod}
                  data-ocid="business-profile.codSave_button"
                  onClick={async () => {
                    setIsSavingCod(true);
                    try {
                      await setCodSettings.mutateAsync({
                        isCodAllowed,
                        codLimit: BigInt(codLimit),
                      });
                      toast.success("Đã lưu cấu hình COD");
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Lưu thất bại",
                      );
                    } finally {
                      setIsSavingCod(false);
                    }
                  }}
                >
                  {isSavingCod ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    "Lưu cấu hình COD"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
