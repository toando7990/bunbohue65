import { createActor } from "@/backend";
import {
  EnterprisePermission,
  InvoiceStatus,
  type OrderPublic,
  OrderType,
  PaymentStatus,
  type RestaurantPublic,
} from "@/backend";
import { EnterpriseDevicePinGuard } from "@/components/EnterpriseDevicePinGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  useGetBusinessProfileInfo,
  useGetMyEnterprisePermissions,
} from "@/hooks/useBackend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  MinusCircle,
  RefreshCw,
  ShieldX,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type DateFilter = "today" | "7days" | "30days" | "custom";
type ChannelFilter = "all" | "TableOrder" | "DeliveryOrder" | "KioskOrder";
type StatusFilter = "all" | "Issued" | "Error" | "unpaid" | "pending";

interface InvoiceFields {
  invoiceNo?: string;
  invoiceDate?: string;
  invoicePdfUrl?: string;
}

interface EnrichedOrder extends OrderPublic, InvoiceFields {
  restaurantName: string;
  restaurantAddress?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVND(amount: bigint | number): string {
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

function getOrderTotal(order: OrderPublic): bigint {
  return order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    BigInt(0),
  );
}

function isOrderUnpaid(order: OrderPublic): boolean {
  return order.paymentStatus !== PaymentStatus.Paid;
}

function getInvoiceStatusLabel(order: EnrichedOrder): React.ReactNode {
  if (isOrderUnpaid(order)) {
    return (
      <Badge variant="secondary" className="text-xs">
        Chờ thanh toán
      </Badge>
    );
  }
  if (order.invoiceStatus === InvoiceStatus.Issued) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs border-0">
        Đã phát hành
      </Badge>
    );
  }
  if (order.invoiceStatus === InvoiceStatus.Pending) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs border-0">
        Đang chờ phát hành
      </Badge>
    );
  }
  if (order.invoiceStatus === InvoiceStatus.Error_) {
    return (
      <Badge variant="destructive" className="text-xs">
        Lỗi
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      Chưa phát hành
    </Badge>
  );
}

function getChannelLabel(orderType: string): string {
  if (orderType === OrderType.TableOrder || orderType === "TableOrder")
    return "Tại bàn";
  if (orderType === OrderType.DeliveryOrder || orderType === "DeliveryOrder")
    return "Từ xa";
  return "Tại quầy";
}

function getCreatedAt(order: OrderPublic): Date {
  return new Date(Number(order.createdAt) / 1_000_000);
}

function isTodayFilter(order: OrderPublic): boolean {
  const d = getCreatedAt(order);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isWithinDays(order: OrderPublic, days: number): boolean {
  const d = getCreatedAt(order);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d >= cutoff;
}

// ─── AccessDenied ────────────────────────────────────────────────────────────

function AccessDenied({ principalId }: { principalId: string | null }) {
  const { logout } = useAuthContext();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (principalId) {
      await navigator.clipboard.writeText(principalId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full text-center shadow-md space-y-5">
        <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Không có quyền truy cập</h1>
          <p className="text-sm text-muted-foreground">
            Bạn chưa được cấp quyền vào trang này. Gửi Principal ID của bạn cho
            quản trị viên để được cấp quyền truy cập.
          </p>
        </div>
        {principalId && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              Principal ID của bạn:
            </p>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-border">
              <code className="text-xs font-mono flex-1 break-all text-left">
                {principalId}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 p-1.5 rounded-md hover:bg-background transition-colors"
                title="Sao chép"
                data-ocid="accounting_view.copy_principal_button"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-xs text-green-500 font-medium">Đã sao chép!</p>
            )}
          </div>
        )}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => logout()}
          data-ocid="accounting_view.logout_button"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </Button>
      </div>
    </div>
  );
}

// ─── Invoice Preview Modal (kept for Phát hành lại / Phát hành only) ─────

function InvoicePreviewModal({
  order,
  restaurant: _restaurant,
  provider,
  vatRate: _vatRate,
  bkavConfig,
  onClose,
  onReissueSuccess,
}: {
  order: EnrichedOrder;
  restaurant: RestaurantPublic | undefined;
  provider: string;
  vatRate: number;
  bkavConfig: {
    hasPartnerGuid: boolean;
    hasPartnerToken: boolean;
    invoiceSerial: string;
    invoiceForm: string;
    environment: string;
    vatRate: number;
  } | null;
  onClose: () => void;
  onReissueSuccess: () => void;
}) {
  const { actor } = useActor(createActor);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [issuedResult, setIssuedResult] = useState<{
    invoiceNo: string;
    invoiceDate: string;
    maCqt: string;
    maTraCuu: string;
    pdfUrl: string;
  } | null>(null);

  // ── Step-by-step progress state ──────────────────────────────────────────
  type StepStatus = "pending" | "active" | "success" | "error";
  type StepState = { label: string; status: StepStatus; errorMsg?: string };
  const STEP_LABELS = [
    "Kiểm tra cấu hình BKAV",
    "Kết nối đến proxy",
    "Chuyển tiếp đến máy chủ BKAV",
    "BKAV xử lý hóa đơn",
    "Lưu kết quả",
  ];
  const initialSteps = (): StepState[] =>
    STEP_LABELS.map((label) => ({ label, status: "pending" }));

  const [issueProgress, setIssueProgress] = useState<{
    active: boolean;
    steps: StepState[];
    errorMessage: string | null;
    successData: {
      invoiceNo: string;
      invoiceDate: string;
      maCqt: string;
      maTraCuu: string;
      pdfUrl: string;
    } | null;
  }>({
    active: false,
    steps: initialSteps(),
    errorMessage: null,
    successData: null,
  });

  function attributeErrorToStep(msg: string): number {
    const lower = msg.toLowerCase();
    if (
      lower.includes("cấu hình") ||
      lower.includes("config") ||
      lower.includes("partner") ||
      lower.includes("serial") ||
      lower.includes("form")
    )
      return 0;
    if (
      lower.includes("proxy") ||
      lower.includes("kết nối") ||
      lower.includes("connect") ||
      lower.includes("dns") ||
      lower.includes("timeout")
    )
      return 1;
    if (
      lower.includes("bkav") ||
      lower.includes("server") ||
      lower.includes("ws.")
    )
      return 3;
    // catch-all: route unknown errors to proxy connection step (index 1)
    return 1;
  }

  function setStepStatus(idx: number, status: StepStatus, errMsg?: string) {
    setIssueProgress((prev) => {
      const steps = prev.steps.map((s, i) =>
        i === idx ? { ...s, status, errorMsg: errMsg } : s,
      );
      return { ...prev, steps };
    });
  }

  const unpaid = isOrderUnpaid(order);
  const _isIssued = order.invoiceStatus === InvoiceStatus.Issued;
  const isError = order.invoiceStatus === InvoiceStatus.Error_;
  const isBkav = provider.toUpperCase() === "BKAV";
  const hasBkavConfig =
    isBkav &&
    bkavConfig?.hasPartnerGuid &&
    bkavConfig?.hasPartnerToken &&
    !!bkavConfig?.invoiceSerial &&
    !!bkavConfig?.invoiceForm;

  async function handleReissue() {
    if (!actor) return;
    setLoading(true);
    setErrorMsg(null);

    // ── Connection check removed: worker handles BKAV connectivity ──────
    // Previously showed a 6-step modal checking PartnerGUID, Token, etc.
    // Now we rely on the worker to validate credentials and report errors.

    // ── Start progress overlay ───────────────────────────────────────────
    setIssueProgress({
      active: true,
      steps: initialSteps(),
      errorMessage: null,
      successData: null,
    });

    // Simulate step progression with timers
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Step 1: config check — activate immediately, complete at 300ms
    setStepStatus(0, "active");
    timers.push(
      setTimeout(() => {
        setStepStatus(0, "success");
        setStepStatus(1, "active");
      }, 300),
    );
    timers.push(
      setTimeout(() => {
        setStepStatus(2, "active");
      }, 2000),
    );
    timers.push(
      setTimeout(() => {
        setStepStatus(3, "active");
      }, 4000),
    );

    function clearTimers() {
      for (const t of timers) clearTimeout(t);
    }

    try {
      const prov = provider.toUpperCase();
      let result: string;
      if (prov === "BKAV") {
        result = await actor.reissueBkavInvoice(order.id);
        if (result.startsWith("OK:")) {
          const parts = result.split(":");
          const successData = {
            invoiceNo: parts[1] ?? "",
            invoiceDate: parts[2] ?? "",
            pdfUrl: parts[3] ?? "",
            maCqt: parts[4] ?? "",
            maTraCuu: parts[5] ?? "",
          };
          clearTimers();
          // Mark all steps up to step 4 success
          setIssueProgress((prev) => ({
            ...prev,
            steps: prev.steps.map((s) =>
              s.status === "pending" || s.status === "active"
                ? { ...s, status: "success" }
                : s,
            ),
            successData,
          }));
          setIssuedResult(successData);
          toast.success("Phát hành thành công");
          onReissueSuccess();
          setTimeout(() => {
            setIssueProgress((prev) => ({ ...prev, active: false }));
          }, 1500);
        } else {
          throw new Error(result);
        }
      } else {
        await actor.reissueBkavInvoice(order.id);
        clearTimers();
        setIssueProgress((prev) => ({
          ...prev,
          steps: prev.steps.map((s) =>
            s.status === "pending" || s.status === "active"
              ? { ...s, status: "success" }
              : s,
          ),
        }));
        toast.success("Phát hành thành công");
        onReissueSuccess();
        setTimeout(() => {
          setIssueProgress((prev) => ({ ...prev, active: false }));
          onClose();
        }, 1500);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lỗi không xác định";
      clearTimers();
      const errorStepIdx = attributeErrorToStep(msg);
      setIssueProgress((prev) => {
        const curActive = prev.steps.findIndex((s) => s.status === "active");
        const targetIdx =
          errorStepIdx >= 0 ? errorStepIdx : curActive >= 0 ? curActive : 0;
        return {
          ...prev,
          errorMessage: msg,
          steps: prev.steps.map((s, i) =>
            i === targetIdx
              ? { ...s, status: "error", errorMsg: msg }
              : s.status === "active"
                ? { ...s, status: "pending" }
                : s,
          ),
        };
      });
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Step progress icon renderer ───────────────────────────────────────
  function StepIcon({
    status,
  }: { status: "pending" | "active" | "success" | "error" }) {
    if (status === "active")
      return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    if (status === "success")
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === "error")
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    return <Circle className="h-5 w-5 text-muted-foreground/40" />;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-ocid="invoice_modal.dialog"
    >
      <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-semibold">Phát hành hóa đơn</span>
          </div>
          <button
            type="button"
            onClick={issueProgress.active ? undefined : onClose}
            className={`p-1.5 rounded-md transition-colors ${
              issueProgress.active
                ? "opacity-30 cursor-not-allowed"
                : "hover:bg-muted"
            }`}
            disabled={issueProgress.active}
            data-ocid="invoice_modal.close_button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Step progress overlay (replaces body while issuing) ─────── */}
        {issueProgress.active ? (
          <div className="space-y-4" data-ocid="invoice_modal.progress_panel">
            <div className="space-y-3">
              {issueProgress.steps.map((step, idx) => (
                <div
                  key={step.label}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all ${
                    step.status === "active"
                      ? "bg-primary/5 border border-primary/20"
                      : step.status === "success"
                        ? "bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800"
                        : step.status === "error"
                          ? "bg-destructive/5 border border-destructive/20"
                          : "border border-transparent"
                  }`}
                  data-ocid={`invoice_modal.progress_step.${idx + 1}`}
                >
                  <div className="mt-0.5 shrink-0">
                    <StepIcon status={step.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        step.status === "pending"
                          ? "text-muted-foreground"
                          : step.status === "error"
                            ? "text-destructive"
                            : "text-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                    {step.status === "error" && step.errorMsg && (
                      <p className="text-xs text-destructive/80 mt-0.5 break-words">
                        {step.errorMsg}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Success summary card */}
            {issueProgress.successData && (
              <div
                className="bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 space-y-1"
                data-ocid="invoice_modal.success_summary"
              >
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Phát hành thành công
                </div>
                <p className="text-xs text-green-800 dark:text-green-300">
                  <span className="font-medium">Số hóa đơn:</span>{" "}
                  {issueProgress.successData.invoiceNo}
                </p>
                {issueProgress.successData.maCqt && (
                  <p className="text-xs text-green-800 dark:text-green-300">
                    <span className="font-medium">Mã CQT:</span>{" "}
                    {issueProgress.successData.maCqt}
                  </p>
                )}
                {issueProgress.successData.invoiceDate && (
                  <p className="text-xs text-green-800 dark:text-green-300">
                    <span className="font-medium">Ngày:</span>{" "}
                    {issueProgress.successData.invoiceDate}
                  </p>
                )}
              </div>
            )}

            {/* Error message summary */}
            {issueProgress.errorMessage && !issueProgress.successData && (
              <div
                className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-sm text-destructive"
                data-ocid="invoice_modal.progress_error"
              >
                {issueProgress.errorMessage}
              </div>
            )}

            {/* Close button — only shown after completion */}
            {(issueProgress.successData || issueProgress.errorMessage) && (
              <div className="flex justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIssueProgress((prev) => ({ ...prev, active: false }));
                    if (issueProgress.successData) onClose();
                  }}
                  data-ocid="invoice_modal.progress_close_button"
                >
                  Đóng
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            {isBkav && !hasBkavConfig && (
              <div
                className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 text-sm text-destructive"
                data-ocid="invoice_modal.bkav_config_error"
              >
                <p>
                  Chưa cấu hình BKAV — vui lòng nhập PartnerGUID, PartnerToken,
                  InvoiceSerial và InvoiceForm trong Hồ sơ doanh nghiệp.{" "}
                  <a
                    href="/admin/business-profile"
                    className="underline font-medium"
                  >
                    → Đến trang cấu hình
                  </a>
                </p>
              </div>
            )}

            {errorMsg && (
              <div
                className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-sm text-destructive"
                data-ocid="invoice_modal.error_state"
              >
                {errorMsg}
              </div>
            )}

            {(() => {
              const invoiceErr = (
                order as unknown as { invoiceError?: string | null }
              ).invoiceError;
              const hasInvoiceError =
                isError &&
                invoiceErr != null &&
                typeof invoiceErr !== "object" &&
                String(invoiceErr).trim() !== "";
              return hasInvoiceError ? (
                <div
                  className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2 text-sm text-orange-800 dark:text-orange-300"
                  data-ocid="invoice_modal.invoice_error_detail"
                >
                  <strong>Chi tiết lỗi BKAV:</strong> {String(invoiceErr)}
                </div>
              ) : isError ? (
                <div
                  className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2 text-sm text-orange-800 dark:text-orange-300"
                  data-ocid="invoice_modal.invoice_error_detail"
                >
                  <strong>Chi tiết lỗi BKAV:</strong> Không có thông tin lỗi
                </div>
              ) : null;
            })()}

            {issuedResult ? (
              <div
                className="flex items-center gap-2 text-green-600 font-medium"
                data-ocid="invoice_modal.success_state"
              >
                <Check className="h-4 w-4" />
                Đã phát hành — Số {issuedResult.invoiceNo}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Đơn hàng:{" "}
                <span className="font-mono font-medium text-foreground">
                  DH-{order.id.toString()}
                </span>
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                data-ocid="invoice_modal.cancel_button"
              >
                Đóng
              </Button>
              {!isError && (
                <Button
                  size="sm"
                  disabled={loading || (isBkav && !hasBkavConfig)}
                  onClick={() => handleReissue()}
                  data-ocid="invoice_modal.reissue_button"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
                  />
                  Phát hành lại
                </Button>
              )}
              {unpaid && !issuedResult && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={loading || (isBkav && !hasBkavConfig)}
                  onClick={() => handleReissue()}
                  data-ocid="invoice_modal.issue_button"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-1" />
                  )}
                  Phát hành hoá đơn
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Accounting Content ─────────────────────────────────────────────────

function AccountingContent() {
  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();
  const businessProfileInfo = useGetBusinessProfileInfo();
  const businessProfileData = businessProfileInfo.data;

  const [restaurantFilter, setRestaurantFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [reissueOrder, setReissueOrder] = useState<EnrichedOrder | null>(null);
  const [, setSellerInfo] = useState<{
    taxCode?: string;
    phone?: string;
  }>({});

  const { actor: sellerActor } = useActor(createActor);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only fetch once when actor ready
  useEffect(() => {
    if (!sellerActor) return;
    sellerActor
      .getSellerInfo()
      .then((info) => setSellerInfo(info))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!sellerActor]);

  const {
    data: restaurants = [],
    isLoading: restaurantsLoading,
    isError: restaurantsError,
  } = useQuery<RestaurantPublic[]>({
    queryKey: ["accountingRestaurants"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listAllRestaurants();
    },
    enabled: !!actor && !isFetching,
  });

  const { data: invoiceProvider = "None" } = useQuery<string>({
    queryKey: ["invoiceProvider"],
    queryFn: async () => {
      if (!actor) return "None";
      return actor.getInvoiceProvider();
    },
    enabled: !!actor && !isFetching,
  });

  const { data: vatRate = 8 } = useQuery<number>({
    queryKey: ["invoiceVatRate", invoiceProvider],
    queryFn: async () => {
      if (!actor) return 8;
      const prov = invoiceProvider.toUpperCase();
      if (prov === "BKAV") {
        const cfg = await actor.getBkavInvoiceConfig();
        return Number(cfg.vatRate);
      }
      return 8;
    },
    enabled: !!actor && !isFetching,
  });

  const { data: bkavConfig = null } = useQuery<{
    hasPartnerGuid: boolean;
    hasPartnerToken: boolean;
    invoiceSerial: string;
    invoiceForm: string;
    environment: string;
    vatRate: number;
  } | null>({
    queryKey: ["bkavConfig"],
    queryFn: async () => {
      if (!actor || invoiceProvider.toUpperCase() !== "BKAV") return null;
      const cfg = await actor.getBkavInvoiceConfig();
      const hasGuid = cfg.realGuid !== undefined && cfg.realGuid !== "";
      const hasToken = cfg.realToken !== undefined && cfg.realToken !== "";
      return {
        hasPartnerGuid: hasGuid,
        hasPartnerToken: hasToken,
        invoiceSerial: cfg.invoiceSerial ?? "",
        invoiceForm: cfg.invoiceForm ?? "",
        environment: "production",
        vatRate: Number(cfg.vatRate),
      };
    },
    enabled: !!actor && !isFetching && invoiceProvider.toUpperCase() === "BKAV",
  });

  const {
    data: allOrders = [],
    isLoading: ordersLoading,
    isError: ordersError,
  } = useQuery<EnrichedOrder[]>({
    queryKey: ["accountingOrders", restaurants.map((r) => r.id.toString())],
    queryFn: async () => {
      if (!actor || restaurants.length === 0) return [];
      const baseOrders = await Promise.all(
        restaurants.map((r) =>
          actor
            .listAllOrdersForAccounting(r.id)
            .then((res: any) => (res.__kind__ === "ok" ? res.ok : []))
            .then((orders) =>
              orders.map(
                (o) =>
                  ({
                    ...o,
                    restaurantName: r.name,
                    restaurantAddress: businessProfileData?.address ?? "",
                  }) as EnrichedOrder,
              ),
            ),
        ),
      );
      const flat = baseOrders.flat();
      return flat;
    },
    enabled: !!actor && !isFetching && restaurants.length > 0,
  });

  const restaurantMap = useMemo(() => {
    const m = new Map<string, RestaurantPublic>();
    for (const r of restaurants) m.set(r.id.toString(), r);
    return m;
  }, [restaurants]);

  const filteredOrders = useMemo(() => {
    return allOrders
      .filter((o) => {
        if (
          restaurantFilter !== "all" &&
          o.restaurantId.toString() !== restaurantFilter
        )
          return false;
        if (channelFilter !== "all") {
          const ot = o.orderType as string;
          if (channelFilter === "KioskOrder" && ot !== "KioskOrder")
            return false;
          if (channelFilter === "TableOrder" && ot !== OrderType.TableOrder)
            return false;
          if (
            channelFilter === "DeliveryOrder" &&
            ot !== OrderType.DeliveryOrder
          )
            return false;
        }
        if (statusFilter !== "all") {
          if (statusFilter === "unpaid") {
            if (!isOrderUnpaid(o)) return false;
          } else if (statusFilter === "Issued") {
            if (isOrderUnpaid(o) || o.invoiceStatus !== InvoiceStatus.Issued)
              return false;
          } else if (statusFilter === "Error") {
            if (isOrderUnpaid(o) || o.invoiceStatus !== InvoiceStatus.Error_)
              return false;
          } else if (statusFilter === "pending") {
            if (isOrderUnpaid(o) || o.invoiceStatus !== InvoiceStatus.Pending)
              return false;
          }
        }
        if (dateFilter === "today") {
          if (!isTodayFilter(o)) return false;
        } else if (dateFilter === "7days") {
          if (!isWithinDays(o, 7)) return false;
        } else if (dateFilter === "30days") {
          if (!isWithinDays(o, 30)) return false;
        } else if (dateFilter === "custom" && customFrom && customTo) {
          const d = getCreatedAt(o);
          const from = new Date(customFrom);
          const to = new Date(customTo);
          to.setHours(23, 59, 59, 999);
          if (d < from || d > to) return false;
        }
        return true;
      })
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  }, [
    allOrders,
    restaurantFilter,
    channelFilter,
    statusFilter,
    dateFilter,
    customFrom,
    customTo,
  ]);

  const isLoading = restaurantsLoading || ordersLoading;
  const isError = restaurantsError || ordersError;

  function refreshOrders() {
    queryClient.invalidateQueries({ queryKey: ["accountingOrders"] });
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center py-24 gap-3"
        data-ocid="accounting_view.error_state"
      >
        <X className="h-12 w-12 text-destructive" />
        <p className="text-lg font-semibold">Lỗi tải dữ liệu</p>
        <p className="text-sm text-muted-foreground">Vui lòng thử lại sau</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      data-ocid="accounting_view.page"
    >
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Kế toán</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshOrders}
            className="gap-1.5"
            data-ocid="accounting_view.refresh_button"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {invoiceProvider.toUpperCase() === "BKAV" &&
          !(
            bkavConfig?.hasPartnerGuid &&
            bkavConfig?.hasPartnerToken &&
            !!bkavConfig?.invoiceSerial &&
            !!bkavConfig?.invoiceForm
          ) && (
            <div
              className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300"
              data-ocid="accounting_view.bkav_config_warning"
            >
              <p>
                Cấu hình BKAV chưa đầy đủ — PartnerGUID, PartnerToken,
                InvoiceSerial hoặc InvoiceForm còn trống.{" "}
                <a
                  href="/admin/business-profile"
                  className="underline font-medium"
                >
                  → Vào Hồ sơ doanh nghiệp để bổ sung cài đặt
                </a>
              </p>
            </div>
          )}

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex flex-wrap gap-3">
            <Select
              value={restaurantFilter}
              onValueChange={setRestaurantFilter}
            >
              <SelectTrigger
                className="w-48"
                data-ocid="accounting_view.restaurant_filter"
              >
                <SelectValue placeholder="Tất cả nhà hàng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả nhà hàng</SelectItem>
                {restaurants.map((r) => (
                  <SelectItem key={r.id.toString()} value={r.id.toString()}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={channelFilter}
              onValueChange={(v) => setChannelFilter(v as ChannelFilter)}
            >
              <SelectTrigger
                className="w-36"
                data-ocid="accounting_view.channel_filter"
              >
                <SelectValue placeholder="Luồng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="TableOrder">Tại bàn</SelectItem>
                <SelectItem value="DeliveryOrder">Từ xa</SelectItem>
                <SelectItem value="KioskOrder">Tại quầy</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger
                className="w-44"
                data-ocid="accounting_view.status_filter"
              >
                <SelectValue placeholder="Trạng thái HĐ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="Issued">Đã phát hành</SelectItem>
                <SelectItem value="Error">Lỗi</SelectItem>
                <SelectItem value="unpaid">Chưa thanh toán</SelectItem>
                <SelectItem value="pending">Đang chờ phát hành</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={dateFilter}
              onValueChange={(v) => setDateFilter(v as DateFilter)}
            >
              <SelectTrigger
                className="w-36"
                data-ocid="accounting_view.date_filter"
              >
                <SelectValue placeholder="Thời gian" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hôm nay</SelectItem>
                <SelectItem value="7days">7 ngày</SelectItem>
                <SelectItem value="30days">30 ngày</SelectItem>
                <SelectItem value="custom">Tùy chọn</SelectItem>
              </SelectContent>
            </Select>

            {dateFilter === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  data-ocid="accounting_view.date_from_input"
                />
                <span className="text-muted-foreground text-sm">—</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  data-ocid="accounting_view.date_to_input"
                />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Hiển thị{" "}
            <span className="font-semibold text-foreground">
              {filteredOrders.length}
            </span>{" "}
            hóa đơn
          </p>
        </div>

        {filteredOrders.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 gap-4 bg-card rounded-xl border border-border"
            data-ocid="accounting_view.empty_state"
          >
            <FileText className="h-16 w-16 text-muted-foreground/40" />
            <p className="text-lg font-semibold text-foreground">
              Không có hóa đơn nào
            </p>
            <p className="text-sm text-muted-foreground">
              Thử thay đổi bộ lọc để xem thêm kết quả
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Mã đơn
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Nhà hàng
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Luồng
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Khách hàng
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      MST
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Tổng tiền
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Trạng thái HĐ
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.map((order, idx) => {
                    const restaurant = restaurantMap.get(
                      order.restaurantId.toString(),
                    );
                    const total = getOrderTotal(order);
                    const unpaid = isOrderUnpaid(order);
                    const isIssued =
                      !unpaid && order.invoiceStatus === InvoiceStatus.Issued;
                    const isErrorRow =
                      !unpaid && order.invoiceStatus === InvoiceStatus.Error_;

                    return (
                      <tr
                        key={order.id.toString()}
                        className="hover:bg-muted/20 transition-colors"
                        data-ocid={`accounting_view.invoice.item.${idx + 1}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          DH-{order.id.toString()}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="truncate max-w-[120px] block">
                            {order.restaurantName}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {getChannelLabel(order.orderType as string)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="truncate max-w-[130px] block">
                            {order.vatInfo?.buyerName ||
                              order.customerName ||
                              "Bán cho người tiêu dùng"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                          {order.vatInfo?.taxCode ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-xs">
                          {formatVND(total)}
                        </td>
                        <td className="px-4 py-3">
                          {getInvoiceStatusLabel(order)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {isIssued && order.invoicePdfUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2"
                                asChild
                                data-ocid={`accounting_view.download_pdf_button.${idx + 1}`}
                              >
                                <a
                                  href={order.invoicePdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                  Tải PDF
                                </a>
                              </Button>
                            )}

                            {isErrorRow && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                                onClick={() =>
                                  setReissueOrder({
                                    ...order,
                                    restaurantName:
                                      restaurant?.name ?? order.restaurantName,
                                    restaurantAddress:
                                      businessProfileData?.address ?? "",
                                  })
                                }
                                data-ocid={`accounting_view.reissue_button.${idx + 1}`}
                              >
                                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                Phát hành lại
                              </Button>
                            )}

                            {unpaid && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2 text-yellow-700 dark:text-yellow-400 hover:text-yellow-800"
                                onClick={() =>
                                  setReissueOrder({
                                    ...order,
                                    restaurantName:
                                      restaurant?.name ?? order.restaurantName,
                                    restaurantAddress:
                                      businessProfileData?.address ?? "",
                                  })
                                }
                                data-ocid={`accounting_view.issue_button.${idx + 1}`}
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                Phát hành hoá đơn
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {reissueOrder && (
        <InvoicePreviewModal
          order={reissueOrder}
          restaurant={restaurantMap.get(reissueOrder.restaurantId.toString())}
          provider={invoiceProvider}
          vatRate={vatRate}
          bkavConfig={bkavConfig}
          onClose={() => {
            setReissueOrder(null);
          }}
          onReissueSuccess={refreshOrders}
        />
      )}
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function AccountingViewPage() {
  const { role, principalId } = useAuthContext();
  const { isAuthenticated, login } = useInternetIdentity();
  const { data: myPermissions } = useGetMyEnterprisePermissions();

  const isOwner = role === "business_owner" || role === "developer";
  const hasPermission = myPermissions?.some(
    (p) => p === EnterprisePermission.Accounting,
  );
  const canAccess = isOwner || hasPermission;

  if (!isAuthenticated || !principalId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-sm w-full text-center shadow-md space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Kế toán</h1>
            <p className="text-sm text-muted-foreground">
              Vui lòng đăng nhập để tiếp tục
            </p>
          </div>
          <Button
            className="w-full gap-2"
            onClick={login}
            data-ocid="accounting_view.login_button"
          >
            <LogIn className="h-4 w-4" />
            Đăng nhập để tiếp tục
          </Button>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return <AccessDenied principalId={principalId} />;
  }

  return (
    <EnterpriseDevicePinGuard requiredRole="accounting">
      <AccountingContent />
    </EnterpriseDevicePinGuard>
  );
}
