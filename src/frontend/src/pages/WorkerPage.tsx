import { AdminLayout } from "@/Layout";
import { createActor } from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetAhamoveConfig,
  useGetBkavConfig,
  useGetRetryPolicy,
  useGetWorkerStatus,
  usePostWorkerHeartbeat,
  useSaveAhamoveConfig,
  useSaveBkavCommonConfig,
  useSetRetryPolicy,
} from "@/hooks/useBackend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHeartbeat(ts: bigint): string {
  if (!ts || ts === 0n) return "—";
  const ms = Number(ts);
  const d = new Date(ms);
  return d.toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

function secondsSince(ts: bigint): number | null {
  if (!ts || ts === 0n) return null;
  return Math.max(0, Math.floor((Date.now() - Number(ts)) / 1000));
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────

function WorkerDashboardTab() {
  const { data, isLoading, isError, refetch } = useGetWorkerStatus();
  const heartbeatMut = usePostWorkerHeartbeat();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">
            Không tải được trạng thái worker.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => refetch()}
          >
            Thử lại
          </Button>
        </CardContent>
      </Card>
    );
  }

  const workers = data?.workers ?? [];
  const retryPolicy = data?.retryPolicy;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Trạng thái Worker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có worker nào đăng ký.
            </p>
          ) : (
            workers.map((w) => {
              const secs = secondsSince(w.lastHeartbeatAt);
              const stale = !w.alive || (secs !== null && secs > 60);
              return (
                <div
                  key={w.workerId}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{w.workerId}</span>
                      <Badge variant={stale ? "destructive" : "default"}>
                        {stale ? "Stale" : "Alive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last heartbeat: {formatHeartbeat(w.lastHeartbeatAt)}
                      {secs !== null ? ` (${secs}s ago)` : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={heartbeatMut.isPending}
                    onClick={() => {
                      heartbeatMut.mutate(w.workerId, {
                        onSuccess: (res) => {
                          if ("ok" in res) {
                            toast.success(`Heartbeat sent to ${w.workerId}`);
                          } else {
                            toast.error(`Heartbeat failed: ${res.err}`);
                          }
                        },
                        onError: (e) =>
                          toast.error(`Heartbeat failed: ${String(e)}`),
                      });
                    }}
                  >
                    Ping
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retry Policy</CardTitle>
        </CardHeader>
        <CardContent>
          {retryPolicy ? (
            <RetryPolicyEditor
              key={`${retryPolicy.maxRetries}-${retryPolicy.baseDelayMs}-${retryPolicy.maxDelayMs}-${retryPolicy.backoffMultiplier}`}
              initial={retryPolicy}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Không có retry policy.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RetryPolicyEditor({
  initial,
}: {
  initial: {
    maxRetries: bigint;
    baseDelayMs: bigint;
    maxDelayMs: bigint;
    backoffMultiplier: number;
  };
}) {
  const setPolicy = useSetRetryPolicy();
  const [maxRetries, setMaxRetries] = useState(String(initial.maxRetries));
  const [baseDelayMs, setBaseDelayMs] = useState(String(initial.baseDelayMs));
  const [maxDelayMs, setMaxDelayMs] = useState(String(initial.maxDelayMs));
  const [backoffMultiplier, setBackoffMultiplier] = useState(
    String(initial.backoffMultiplier),
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="rp-maxRetries">Max retries</Label>
          <Input
            id="rp-maxRetries"
            type="number"
            value={maxRetries}
            onChange={(e) => setMaxRetries(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rp-baseDelay">Base delay (ms)</Label>
          <Input
            id="rp-baseDelay"
            type="number"
            value={baseDelayMs}
            onChange={(e) => setBaseDelayMs(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rp-maxDelay">Max delay (ms)</Label>
          <Input
            id="rp-maxDelay"
            type="number"
            value={maxDelayMs}
            onChange={(e) => setMaxDelayMs(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rp-backoff">Backoff multiplier</Label>
          <Input
            id="rp-backoff"
            type="number"
            step="0.1"
            value={backoffMultiplier}
            onChange={(e) => setBackoffMultiplier(e.target.value)}
          />
        </div>
      </div>
      <Button
        disabled={setPolicy.isPending}
        onClick={() => {
          setPolicy.mutate(
            {
              maxRetries: BigInt(maxRetries || "0"),
              baseDelayMs: BigInt(baseDelayMs || "0"),
              maxDelayMs: BigInt(maxDelayMs || "0"),
              backoffMultiplier: Number(backoffMultiplier || "0"),
            },
            {
              onError: (e) =>
                toast.error(`Lưu retry policy thất bại: ${String(e)}`),
            },
          );
        }}
      >
        {setPolicy.isPending ? "Đang lưu…" : "Lưu retry policy"}
      </Button>
    </div>
  );
}

// ─── Config Tab ───────────────────────────────────────────────────────────────

function WorkerConfigTab() {
  const bkavConfig = useGetBkavConfig();
  const ahamoveCfg = useGetAhamoveConfig();
  const saveAhamove = useSaveAhamoveConfig();
  const saveBkav = useSaveBkavCommonConfig();
  const qc = useQueryClient();
  const { actor } = useActor(createActor);

  const [workerPrincipal, setWorkerPrincipal] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [mobile, setMobile] = useState("");
  const [ahamoveWorkerCfg, setAhamoveWorkerCfg] = useState<{
    apiKey: string;
    mobile: string;
    isTestMode: boolean;
    ordersToSync: { orderId: string; ahamoveOrderId: string }[];
  } | null>(null);
  const [loadingWorkerCfg, setLoadingWorkerCfg] = useState(false);

  // Sync workerPrincipal from bkav config
  useEffect(() => {
    if (bkavConfig.data?.workerPrincipal)
      setWorkerPrincipal(bkavConfig.data.workerPrincipal);
  }, [bkavConfig.data?.workerPrincipal]);

  // Initialize ahamove apiKey/mobile from existing config (async data arrives
  // after first render — useState lazy initializer would miss it, so use an
  // effect that re-runs when ahamoveCfg.data resolves).
  useEffect(() => {
    if (ahamoveCfg.data) {
      setApiKey(ahamoveCfg.data.apiKey ?? "");
      setMobile(ahamoveCfg.data.mobile ?? "");
    }
  }, [ahamoveCfg.data]);

  const loadAhamoveWorkerConfig = async () => {
    if (!actor) return;
    setLoadingWorkerCfg(true);
    try {
      const res = await actor.getAhamoveWorkerConfig();
      if ("ok" in res) {
        setAhamoveWorkerCfg(res.ok);
      } else {
        toast.error(`Lỗi tải worker config: ${res.err}`);
      }
    } catch (e) {
      toast.error(`Lỗi tải worker config: ${String(e)}`);
    } finally {
      setLoadingWorkerCfg(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Worker Principal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Principal dùng chung cho cả 3 worker (bkav, tingee, ahamove).
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="wp-principal">Worker Principal</Label>
            <Input
              id="wp-principal"
              value={workerPrincipal}
              onChange={(e) => setWorkerPrincipal(e.target.value)}
              placeholder="principal-..."
            />
          </div>
          <Button
            disabled={saveBkav.isPending}
            onClick={() => {
              saveBkav.mutate(
                { workerPrincipal: workerPrincipal.trim() || null },
                {
                  onError: (e) =>
                    toast.error(`Lưu worker principal thất bại: ${String(e)}`),
                },
              );
            }}
          >
            {saveBkav.isPending ? "Đang lưu…" : "Lưu worker principal"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ahamove Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ah-apiKey">API Key</Label>
            <Input
              id="ah-apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ah-mobile">Mobile</Label>
            <Input
              id="ah-mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>
          <Button
            disabled={saveAhamove.isPending}
            onClick={() => {
              saveAhamove.mutate(
                { apiKey, mobile },
                {
                  onSuccess: () => {
                    toast.success("Đã lưu Ahamove config");
                    qc.invalidateQueries({ queryKey: ["ahamoveConfig"] });
                  },
                  onError: (e) =>
                    toast.error(`Lưu Ahamove config thất bại: ${String(e)}`),
                },
              );
            }}
          >
            {saveAhamove.isPending ? "Đang lưu…" : "Lưu Ahamove config"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ahamove Worker Config</CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={loadingWorkerCfg}
              onClick={loadAhamoveWorkerConfig}
            >
              {loadingWorkerCfg ? "Đang tải…" : "Tải"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {ahamoveWorkerCfg ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge
                  variant={
                    ahamoveWorkerCfg.isTestMode ? "secondary" : "default"
                  }
                >
                  {ahamoveWorkerCfg.isTestMode ? "Test mode" : "Production"}
                </Badge>
                <Badge variant="outline">
                  Orders to sync: {ahamoveWorkerCfg.ordersToSync.length}
                </Badge>
              </div>
              {ahamoveWorkerCfg.ordersToSync.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có order nào cần sync.
                </p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {ahamoveWorkerCfg.ordersToSync.map((o) => (
                    <div
                      key={o.orderId}
                      className="flex items-center justify-between gap-2 p-2 text-xs"
                    >
                      <code className="font-mono">{o.orderId}</code>
                      <span className="text-muted-foreground">→</span>
                      <code className="font-mono">{o.ahamoveOrderId}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Bấm "Tải" để load Ahamove worker config.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkerPage() {
  const [tab, setTab] = useState<"dashboard" | "config">("dashboard");

  return (
    <AdminLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Worker</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý worker dashboard và config cho bkav/tingee/ahamove.
          </p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "dashboard" | "config")}
        >
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4">
            <WorkerDashboardTab />
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            <WorkerConfigTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
