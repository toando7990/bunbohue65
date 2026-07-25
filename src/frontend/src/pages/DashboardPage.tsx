import { AdminLayout } from "@/Layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  useCreateRestaurant,
  useDeleteRestaurant,
  useMyRestaurants,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import type { RestaurantPublic } from "@/types";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChefHat,
  ClipboardList,
  Plus,
  Settings,
  Store,
  Trash2,
} from "lucide-react";
import { useState } from "react";

function RestaurantCard({
  restaurant,
  t,
}: {
  restaurant: RestaurantPublic;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const deleteRestaurant = useDeleteRestaurant();
  const navigate = useNavigate();

  const handleDelete = async () => {
    await deleteRestaurant.mutateAsync(restaurant.id);
    navigate({ to: "/admin/dashboard" });
  };

  return (
    <Card
      data-ocid={`admin.dashboard.restaurant_card.${Number(restaurant.id)}`}
      className="bg-card border-border hover:shadow-md transition-shadow"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-display">
            {restaurant.name}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm" className="gap-1.5">
            <Link
              to="/admin/restaurant/$restaurantId/orders"
              params={{ restaurantId: String(restaurant.id) }}
              data-ocid={`admin.dashboard.orders_link.${Number(restaurant.id)}`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              {t.dashboard.manageOrders}
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm" className="gap-1.5">
            <Link
              to="/admin/restaurant/$restaurantId/menu"
              params={{ restaurantId: String(restaurant.id) }}
              data-ocid={`admin.dashboard.menu_link.${Number(restaurant.id)}`}
            >
              <ChefHat className="h-3.5 w-3.5" />
              {t.dashboard.manageMenu}
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm" className="gap-1.5">
            <Link
              to="/admin/restaurant/$restaurantId/tables"
              params={{ restaurantId: String(restaurant.id) }}
              data-ocid={`admin.dashboard.tables_link.${Number(restaurant.id)}`}
            >
              <Settings className="h-3.5 w-3.5" />
              {t.dashboard.manageTables}
            </Link>
          </Button>
        </div>
        <div className="flex gap-2 pt-1 border-t border-border">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5 flex-1"
          >
            <Link
              to="/admin/restaurant/$restaurantId/settings"
              params={{ restaurantId: String(restaurant.id) }}
              data-ocid={`admin.dashboard.restaurant_settings_button.${Number(restaurant.id)}`}
            >
              <Settings className="h-3.5 w-3.5" />
              {t.restaurantSettings.navLabel}
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={deleteRestaurant.isPending}
                data-ocid={`admin.dashboard.delete_restaurant_button.${Number(restaurant.id)}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.common.delete}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent
              data-ocid={`admin.dashboard.delete_restaurant_dialog.${Number(restaurant.id)}`}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t.businessProfile.deleteRestaurantConfirmTitle}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t.businessProfile.deleteRestaurantConfirmDesc}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  data-ocid={`admin.dashboard.delete_restaurant_cancel_button.${Number(restaurant.id)}`}
                >
                  {t.common.cancel}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-ocid={`admin.dashboard.delete_restaurant_confirm_button.${Number(restaurant.id)}`}
                >
                  {t.common.delete}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: restaurants, isLoading, isError } = useMyRestaurants();
  const createRestaurant = useCreateRestaurant();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createRestaurant.mutateAsync(name.trim());
    setName("");
    setOpen(false);
  };

  return (
    <AdminLayout>
      <div data-ocid="admin.dashboard.page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl text-foreground">
              {t.dashboard.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t.dashboard.subtitle}
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-1.5"
                data-ocid="admin.dashboard.create_restaurant_button"
              >
                <Plus className="h-4 w-4" />
                {t.dashboard.createRestaurant}
              </Button>
            </DialogTrigger>
            <DialogContent data-ocid="admin.dashboard.create_restaurant_dialog">
              <DialogHeader>
                <DialogTitle>{t.dashboard.createRestaurant}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="restaurant-name">{t.common.name}</Label>
                  <Input
                    id="restaurant-name"
                    placeholder={t.dashboard.restaurantNamePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    data-ocid="admin.dashboard.restaurant_name_input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  data-ocid="admin.dashboard.create_restaurant_cancel_button"
                >
                  {t.common.cancel}
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!name.trim() || createRestaurant.isPending}
                  data-ocid="admin.dashboard.create_restaurant_submit_button"
                >
                  {createRestaurant.isPending
                    ? t.dashboard.creating
                    : t.common.createNew}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading && (
          <div
            data-ocid="admin.dashboard.loading_state"
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div
            data-ocid="admin.dashboard.error_state"
            className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive"
          >
            {t.common.error}
          </div>
        )}

        {!isLoading && !isError && restaurants && restaurants.length === 0 && (
          <div
            data-ocid="admin.dashboard.empty_state"
            className="flex flex-col items-center justify-center gap-4 py-20 text-center"
          >
            <Store className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-foreground">
                {t.dashboard.noRestaurants}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t.dashboard.noRestaurantsDesc}
              </p>
            </div>
            <Button
              onClick={() => setOpen(true)}
              className="gap-1.5"
              data-ocid="admin.dashboard.empty_create_button"
            >
              <Plus className="h-4 w-4" />
              {t.dashboard.createRestaurant}
            </Button>
          </div>
        )}

        {!isLoading && restaurants && restaurants.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {restaurants.map((r) => (
              <RestaurantCard key={String(r.id)} restaurant={r} t={t} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
