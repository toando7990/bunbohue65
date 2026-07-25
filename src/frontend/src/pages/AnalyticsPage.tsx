import { AdminLayout } from "@/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatPrice,
  useGetDailyAnalytics,
  useGetWeeklyAnalytics,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import { getRouteApi } from "@tanstack/react-router";
import { BarChart2, CalendarDays, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

const routeApi = getRouteApi("/admin/restaurant/$restaurantId/analytics");

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDefaultDailyRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { start: toDateStr(start), end: toDateStr(end) };
}

function getISOWeek(d: Date): string {
  // Returns YYYY-WNN format
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d.getTime() - startOfWeek1.getTime();
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  const year = d.getFullYear();
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getDefaultWeeklyRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7 * 7); // 8 weeks back
  return { start: getISOWeek(start), end: getISOWeek(end) };
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

interface SummaryCardsProps {
  totalOrders: bigint;
  totalRevenue: bigint;
  t: ReturnType<typeof useLanguage>["t"];
}

function SummaryCards({ totalOrders, totalRevenue, t }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <div
        data-ocid="analytics.total_orders_card"
        className="rounded-xl border border-border bg-card px-5 py-4"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart2 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t.analytics.totalOrders}
          </p>
        </div>
        <p className="font-display text-3xl font-bold text-foreground tabular-nums">
          {totalOrders.toLocaleString()}
        </p>
      </div>

      <div
        data-ocid="analytics.total_revenue_card"
        className="rounded-xl border border-border bg-card px-5 py-4"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-accent" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t.analytics.totalRevenue}
          </p>
        </div>
        <p className="font-display text-3xl font-bold text-primary tabular-nums">
          {formatPrice(totalRevenue)}
        </p>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div data-ocid="analytics.loading_state" className="space-y-4">
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      {[1, 2, 3, 4, 5].map((n) => (
        <Skeleton key={n} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}

// ─── Data Table ───────────────────────────────────────────────────────────────

interface DailyRow {
  date: string;
  totalOrders: bigint;
  totalRevenue: bigint;
}

interface WeeklyRow {
  weekStart: string;
  totalOrders: bigint;
  totalRevenue: bigint;
}

interface AnalyticsTableProps {
  mode: "daily" | "weekly";
  rows: DailyRow[] | WeeklyRow[];
  t: ReturnType<typeof useLanguage>["t"];
  language: "vi" | "en";
}

function AnalyticsTable({ mode, rows, t, language }: AnalyticsTableProps) {
  if (rows.length === 0) {
    return (
      <div
        data-ocid="analytics.table.empty_state"
        className="flex flex-col items-center gap-3 py-16 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
          <CalendarDays className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-muted-foreground text-sm">{t.analytics.noData}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-3 bg-muted/40 border-b border-border px-4 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {mode === "daily" ? t.analytics.date : t.analytics.week}
        </p>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">
          {t.analytics.orders}
        </p>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">
          {t.analytics.revenue}
        </p>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/50">
        {rows.map((row, idx) => {
          const dateKey =
            mode === "daily"
              ? (row as DailyRow).date
              : (row as WeeklyRow).weekStart;
          const label =
            mode === "daily"
              ? new Date(
                  `${(row as DailyRow).date}T00:00:00`,
                ).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                })
              : `${t.analytics.weekLabel} ${(row as WeeklyRow).weekStart.split("-W")[1]} (${(row as WeeklyRow).weekStart.split("-W")[0]})`;

          return (
            <div
              key={dateKey}
              data-ocid={`analytics.table.item.${idx + 1}`}
              className="grid grid-cols-3 px-4 py-3 hover:bg-muted/20 transition-colors"
            >
              <p className="text-sm text-foreground font-medium">{label}</p>
              <p className="text-sm text-foreground tabular-nums text-right">
                {row.totalOrders.toString()}
              </p>
              <p className="text-sm font-semibold text-primary tabular-nums text-right">
                {formatPrice(row.totalRevenue)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Analytics Page ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { restaurantId: restaurantIdStr } = routeApi.useParams();
  const restaurantId = BigInt(restaurantIdStr);
  const { t, language } = useLanguage();

  const [tab, setTab] = useState<"daily" | "weekly">("daily");

  // Daily range state
  const defaultDaily = getDefaultDailyRange();
  const [dailyStart, setDailyStart] = useState(defaultDaily.start);
  const [dailyEnd, setDailyEnd] = useState(defaultDaily.end);

  // Weekly range state
  const defaultWeekly = getDefaultWeeklyRange();
  const [weeklyStart, setWeeklyStart] = useState(defaultWeekly.start);
  const [weeklyEnd, setWeeklyEnd] = useState(defaultWeekly.end);

  const dailyQuery = useGetDailyAnalytics(
    restaurantId,
    tab === "daily" ? dailyStart : "",
    tab === "daily" ? dailyEnd : "",
  );

  const weeklyQuery = useGetWeeklyAnalytics(
    restaurantId,
    tab === "weekly" ? weeklyStart : "",
    tab === "weekly" ? weeklyEnd : "",
  );

  const dailyRows = useMemo(
    () =>
      (dailyQuery.data ?? [])
        .slice()
        .sort((a, b) => (a.date > b.date ? 1 : -1)),
    [dailyQuery.data],
  );

  const weeklyRows = useMemo(
    () =>
      (weeklyQuery.data ?? [])
        .slice()
        .sort((a, b) => (a.weekStart > b.weekStart ? 1 : -1)),
    [weeklyQuery.data],
  );

  const activeRows = tab === "daily" ? dailyRows : weeklyRows;

  const totalOrders = useMemo(
    () => activeRows.reduce((s, r) => s + r.totalOrders, 0n),
    [activeRows],
  );
  const totalRevenue = useMemo(
    () => activeRows.reduce((s, r) => s + r.totalRevenue, 0n),
    [activeRows],
  );

  const isLoading =
    tab === "daily" ? dailyQuery.isLoading : weeklyQuery.isLoading;

  return (
    <AdminLayout restaurantId={restaurantIdStr}>
      <div data-ocid="analytics.page">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2
              data-ocid="analytics.heading"
              className="font-display text-2xl text-foreground"
            >
              {t.analytics.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t.analytics.subtitle}
            </p>
          </div>
        </div>

        {/* Tab selector */}
        <div
          className="flex gap-1 mb-6 bg-muted/50 p-1 rounded-lg w-fit"
          data-ocid="analytics.tab_group"
        >
          <button
            type="button"
            onClick={() => setTab("daily")}
            data-ocid="analytics.daily_tab"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-smooth ${
              tab === "daily"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.analytics.byDay}
          </button>
          <button
            type="button"
            onClick={() => setTab("weekly")}
            data-ocid="analytics.weekly_tab"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-smooth ${
              tab === "weekly"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.analytics.byWeek}
          </button>
        </div>

        {/* Date range picker */}
        <div className="flex flex-wrap items-end gap-3 mb-6 p-4 rounded-xl border border-border bg-card">
          {tab === "daily" ? (
            <>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="daily-start"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t.analytics.from}
                </label>
                <input
                  id="daily-start"
                  type="date"
                  value={dailyStart}
                  max={dailyEnd}
                  onChange={(e) => setDailyStart(e.target.value)}
                  data-ocid="analytics.daily_start_input"
                  className="h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="daily-end"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t.analytics.to}
                </label>
                <input
                  id="daily-end"
                  type="date"
                  value={dailyEnd}
                  min={dailyStart}
                  max={toDateStr(new Date())}
                  onChange={(e) => setDailyEnd(e.target.value)}
                  data-ocid="analytics.daily_end_input"
                  className="h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = getDefaultDailyRange();
                  setDailyStart(d.start);
                  setDailyEnd(d.end);
                }}
                data-ocid="analytics.daily_reset_button"
              >
                {t.analytics.reset}
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="weekly-start"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t.analytics.from} ({t.analytics.weekLabel})
                </label>
                <input
                  id="weekly-start"
                  type="week"
                  value={weeklyStart}
                  max={weeklyEnd}
                  onChange={(e) => setWeeklyStart(e.target.value)}
                  data-ocid="analytics.weekly_start_input"
                  className="h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="weekly-end"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t.analytics.to} ({t.analytics.weekLabel})
                </label>
                <input
                  id="weekly-end"
                  type="week"
                  value={weeklyEnd}
                  min={weeklyStart}
                  onChange={(e) => setWeeklyEnd(e.target.value)}
                  data-ocid="analytics.weekly_end_input"
                  className="h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const w = getDefaultWeeklyRange();
                  setWeeklyStart(w.start);
                  setWeeklyEnd(w.end);
                }}
                data-ocid="analytics.weekly_reset_button"
              >
                {t.analytics.reset}
              </Button>
            </>
          )}
        </div>

        {/* Summary cards */}
        {!isLoading && (
          <SummaryCards
            totalOrders={totalOrders}
            totalRevenue={totalRevenue}
            t={t}
          />
        )}

        {/* Data table */}
        {isLoading ? (
          <AnalyticsSkeleton />
        ) : (
          <AnalyticsTable
            mode={tab}
            rows={activeRows}
            t={t}
            language={language}
          />
        )}
      </div>
    </AdminLayout>
  );
}
