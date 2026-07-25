import { CustomerLayout } from "@/Layout";
import { Button } from "@/components/ui/button";
import { useCreateReservation } from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import { useSearch } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Clock, Users, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseIdParam(val: unknown): bigint | null {
  if (typeof val === "string" && val.trim() !== "") {
    try {
      return BigInt(val);
    } catch {
      return null;
    }
  }
  return null;
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 22; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 22) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();
const DURATION_OPTIONS = [30, 60, 90, 120];
const TODAY = new Date().toISOString().split("T")[0];

// ─── Success View ─────────────────────────────────────────────────────────────

interface SuccessViewProps {
  reservationId: bigint;
  name: string;
  phone: string;
  date: string;
  timeSlot: string;
  partySize: number;
  durationMinutes: number;
  onReset: () => void;
}

function SuccessView({
  reservationId,
  name,
  phone,
  date,
  timeSlot,
  partySize,
  durationMinutes,
  onReset,
}: SuccessViewProps) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      data-ocid="reservation.success_state"
      className="flex flex-col items-center gap-5 py-10 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-accent/15 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-accent" />
      </div>
      <div>
        <h2 className="font-display text-3xl italic text-foreground mb-2">
          {t.reservation.successTitle}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t.reservation.successDesc}
        </p>
      </div>

      <div className="w-full bg-card border border-border rounded-2xl p-5 text-left space-y-3">
        <h3 className="font-semibold text-sm text-foreground">
          {t.reservation.successDetails}
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {t.reservation.bookingRef}
            </p>
            <p className="font-mono font-semibold text-foreground">
              #{reservationId.toString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {t.reservation.fullName}
            </p>
            <p className="font-medium text-foreground">{name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {t.reservation.phone}
            </p>
            <p className="font-medium text-foreground">{phone}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {t.reservation.partySize}
            </p>
            <p className="font-medium text-foreground">
              {partySize} {t.reservation.partySizeLabel}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {t.reservation.date}
            </p>
            <p className="font-medium text-foreground">{date}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {t.reservation.timeSlot}
            </p>
            <p className="font-medium text-foreground">
              {timeSlot} — {durationMinutes} {t.reservation.minutesSuffix}
            </p>
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onReset}
        data-ocid="reservation.new_booking_button"
        className="w-full"
      >
        {t.reservation.tryAnotherTime}
      </Button>
    </motion.div>
  );
}

// ─── Conflict View ────────────────────────────────────────────────────────────

interface ConflictViewProps {
  onReset: () => void;
}

function ConflictView({ onReset }: ConflictViewProps) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      data-ocid="reservation.conflict_state"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
        <X className="w-10 h-10 text-destructive" />
      </div>
      <div>
        <h2 className="font-display text-2xl italic text-foreground mb-2">
          {t.reservation.conflictTitle}
        </h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
          {t.reservation.conflictDesc}
        </p>
      </div>
      <Button
        type="button"
        onClick={onReset}
        data-ocid="reservation.retry_button"
        className="w-full max-w-xs"
      >
        {t.reservation.tryAnotherTime}
      </Button>
    </motion.div>
  );
}

// ─── Reservation Form ─────────────────────────────────────────────────────────

type FormState = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  partySize: number;
  date: string;
  timeSlot: string;
  durationMinutes: number;
  notes: string;
};

const defaultForm: FormState = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  partySize: 2,
  date: TODAY,
  timeSlot: "12:00",
  durationMinutes: 60,
  notes: "",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReservationPage() {
  const search = useSearch({ strict: false }) as { restaurantId?: string };
  const { t } = useLanguage();
  const restaurantId = parseIdParam(search.restaurantId);

  const [form, setForm] = useState<FormState>(defaultForm);
  const [status, setStatus] = useState<"idle" | "success" | "conflict">("idle");
  const [confirmedId, setConfirmedId] = useState<bigint>(0n);

  const createReservation = useCreateReservation();

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId) return;
    try {
      const id = await createReservation.mutateAsync({
        restaurantId,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        partySize: BigInt(form.partySize),
        date: form.date,
        timeSlot: form.timeSlot,
        durationMinutes: BigInt(form.durationMinutes),
        notes: form.notes.trim() || undefined,
      });
      if (id === 0n) {
        setStatus("conflict");
      } else {
        setConfirmedId(id);
        setStatus("success");
      }
    } catch {
      setStatus("conflict");
    }
  }

  function handleReset() {
    setStatus("idle");
    setForm(defaultForm);
    createReservation.reset();
  }

  // No restaurant ID in URL
  if (!restaurantId) {
    return (
      <CustomerLayout>
        <div
          data-ocid="reservation.no_restaurant.error_state"
          className="flex flex-col items-center justify-center gap-4 py-24 text-center"
        >
          <span className="text-4xl">🔗</span>
          <h2 className="font-display text-2xl italic text-foreground">
            {t.common.error}
          </h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            {t.reservation.noRestaurant}
          </p>
        </div>
      </CustomerLayout>
    );
  }

  if (status === "success") {
    return (
      <CustomerLayout>
        <SuccessView
          reservationId={confirmedId}
          name={form.customerName}
          phone={form.customerPhone}
          date={form.date}
          timeSlot={form.timeSlot}
          partySize={form.partySize}
          durationMinutes={form.durationMinutes}
          onReset={handleReset}
        />
      </CustomerLayout>
    );
  }

  if (status === "conflict") {
    return (
      <CustomerLayout>
        <ConflictView onReset={handleReset} />
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div data-ocid="reservation.page" className="flex flex-col gap-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center pt-2"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
            <CalendarDays className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl italic text-foreground">
            {t.reservation.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t.reservation.subtitle}
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          data-ocid="reservation.form"
          noValidate
        >
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="res-name"
              className="text-sm font-medium text-foreground"
            >
              {t.reservation.fullName}{" "}
              <span className="text-destructive">*</span>
            </label>
            <input
              id="res-name"
              type="text"
              required
              value={form.customerName}
              onChange={(e) => setField("customerName", e.target.value)}
              placeholder={t.reservation.fullNamePlaceholder}
              data-ocid="reservation.name.input"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="res-phone"
              className="text-sm font-medium text-foreground"
            >
              {t.reservation.phone} <span className="text-destructive">*</span>
            </label>
            <input
              id="res-phone"
              type="tel"
              required
              value={form.customerPhone}
              onChange={(e) => setField("customerPhone", e.target.value)}
              placeholder={t.reservation.phonePlaceholder}
              data-ocid="reservation.phone.input"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="res-email"
              className="text-sm font-medium text-foreground"
            >
              {t.reservation.email}
            </label>
            <input
              id="res-email"
              type="email"
              value={form.customerEmail}
              onChange={(e) => setField("customerEmail", e.target.value)}
              placeholder={t.reservation.emailPlaceholder}
              data-ocid="reservation.email.input"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>

          {/* Date + Party Size row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="res-date"
                className="text-sm font-medium text-foreground flex items-center gap-1"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {t.reservation.date} <span className="text-destructive">*</span>
              </label>
              <input
                id="res-date"
                type="date"
                required
                min={TODAY}
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
                data-ocid="reservation.date.input"
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="res-party"
                className="text-sm font-medium text-foreground flex items-center gap-1"
              >
                <Users className="w-3.5 h-3.5" />
                {t.reservation.partySize}{" "}
                <span className="text-destructive">*</span>
              </label>
              <input
                id="res-party"
                type="number"
                required
                min={1}
                max={20}
                value={form.partySize}
                onChange={(e) =>
                  setField(
                    "partySize",
                    Math.max(1, Math.min(20, Number(e.target.value))),
                  )
                }
                data-ocid="reservation.party_size.input"
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
            </div>
          </div>

          {/* Time + Duration row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="res-time"
                className="text-sm font-medium text-foreground flex items-center gap-1"
              >
                <Clock className="w-3.5 h-3.5" />
                {t.reservation.timeSlot}{" "}
                <span className="text-destructive">*</span>
              </label>
              <select
                id="res-time"
                required
                value={form.timeSlot}
                onChange={(e) => setField("timeSlot", e.target.value)}
                data-ocid="reservation.time_slot.select"
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="res-duration"
                className="text-sm font-medium text-foreground"
              >
                {t.reservation.duration}
              </label>
              <select
                id="res-duration"
                value={form.durationMinutes}
                onChange={(e) =>
                  setField("durationMinutes", Number(e.target.value))
                }
                data-ocid="reservation.duration.select"
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} {t.reservation.minutesSuffix}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="res-notes"
              className="text-sm font-medium text-foreground"
            >
              {t.reservation.notes}
            </label>
            <textarea
              id="res-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder={t.reservation.notesPlaceholder}
              data-ocid="reservation.notes.textarea"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none"
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={
              createReservation.isPending ||
              !form.customerName.trim() ||
              !form.customerPhone.trim() ||
              !form.date ||
              !form.timeSlot
            }
            data-ocid="reservation.submit_button"
            className="w-full py-3 font-medium"
          >
            {createReservation.isPending
              ? t.reservation.submitting
              : t.reservation.submitButton}
          </Button>

          {createReservation.isError && (
            <p
              data-ocid="reservation.error_state"
              className="text-xs text-destructive text-center"
            >
              {t.common.error}
            </p>
          )}
        </motion.form>
      </div>
    </CustomerLayout>
  );
}
