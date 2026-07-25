import { AdminLayout } from "@/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateTable, useDeleteTable, useTables } from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import type { Table } from "@/types";
import { useParams } from "@tanstack/react-router";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

// ─── Table Card ───────────────────────────────────────────────────────────────

interface TableCardProps {
  table: Table;
  idx: number;
  onDelete: (id: bigint) => void;
  isDeleting: boolean;
}

function TableCard({ table, idx, onDelete, isDeleting }: TableCardProps) {
  const [copied, setCopied] = useState(false);
  const { t, language } = useLanguage();
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(table.qrCodeUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(table.qrCodeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input
    }
  };

  return (
    <Card
      data-ocid={`admin.tables.table_card.${idx}`}
      className="bg-card border-border"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center justify-between">
          <span>
            {language === "vi"
              ? `Bàn ${table.tableNumber}`
              : `Table ${table.tableNumber}`}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
            onClick={() => onDelete(table.id)}
            disabled={isDeleting}
            aria-label={`${t.tables.deleteTable} ${table.tableNumber}`}
            data-ocid={`admin.tables.delete_button.${idx}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* QR Code */}
        <div className="flex justify-center">
          <img
            src={qrImageUrl}
            alt={`${t.tables.qrCode} ${table.tableNumber}`}
            width={120}
            height={120}
            className="rounded-md border border-border bg-card p-1"
            data-ocid={`admin.tables.qr_code.${idx}`}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t.tables.copyLink}</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={table.qrCodeUrl}
            className="flex-1 min-w-0 text-xs bg-muted border border-input rounded-md px-2 py-1.5 text-foreground truncate focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label={`${t.tables.copyLink} ${table.tableNumber}`}
            data-ocid={`admin.tables.link_input.${idx}`}
          />
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 shrink-0"
            onClick={handleCopy}
            aria-label={copied ? t.tables.linkCopied : t.tables.copyLink}
            data-ocid={`admin.tables.copy_button.${idx}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-accent" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TablesPage() {
  const { restaurantId } = useParams({ strict: false }) as {
    restaurantId: string;
  };
  const rid = BigInt(restaurantId);
  const { t } = useLanguage();

  const { data: tables, isLoading, isError } = useTables(rid);
  const createTable = useCreateTable();
  const deleteTable = useDeleteTable();

  const [open, setOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");

  const handleCreate = async () => {
    if (!tableNumber.trim()) return;
    await createTable.mutateAsync({
      restaurantId: rid,
      tableNumber: tableNumber.trim(),
    });
    setTableNumber("");
    setOpen(false);
  };

  return (
    <AdminLayout restaurantId={restaurantId}>
      <div data-ocid="admin.tables.page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl text-foreground">
              {t.tables.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t.tables.scanInstruction}
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-1.5"
                data-ocid="admin.tables.add_table_button"
              >
                <Plus className="h-4 w-4" />
                {t.tables.addTable}
              </Button>
            </DialogTrigger>
            <DialogContent data-ocid="admin.tables.add_table_dialog">
              <DialogHeader>
                <DialogTitle>{t.tables.addTable}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Label htmlFor="table-number">{t.tables.tableNumber}</Label>
                <Input
                  id="table-number"
                  placeholder={t.tables.tableNumberPlaceholder}
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  data-ocid="admin.tables.table_number_input"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  data-ocid="admin.tables.cancel_button"
                >
                  {t.common.cancel}
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!tableNumber.trim() || createTable.isPending}
                  data-ocid="admin.tables.submit_button"
                >
                  {createTable.isPending ? t.common.loading : t.tables.addTable}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading && (
          <div
            data-ocid="admin.tables.loading_state"
            className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div
            data-ocid="admin.tables.error_state"
            className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive"
          >
            {t.common.error}
          </div>
        )}

        {!isLoading && !isError && tables && tables.length === 0 && (
          <div
            data-ocid="admin.tables.empty_state"
            className="flex flex-col items-center justify-center gap-4 py-20 text-center"
          >
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <span className="text-2xl">🪑</span>
            </div>
            <div>
              <p className="font-medium text-foreground">{t.tables.noTables}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t.tables.noTablesDesc}
              </p>
            </div>
            <Button
              onClick={() => setOpen(true)}
              className="gap-1.5"
              data-ocid="admin.tables.empty_create_button"
            >
              <Plus className="h-4 w-4" />
              {t.tables.addTable}
            </Button>
          </div>
        )}

        {!isLoading && tables && tables.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables.map((t_item, idx) => (
              <TableCard
                key={String(t_item.id)}
                table={t_item}
                idx={idx + 1}
                onDelete={(id) => deleteTable.mutate({ restaurantId: rid, id })}
                isDeleting={deleteTable.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
