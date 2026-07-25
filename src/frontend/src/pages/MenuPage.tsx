import { AdminLayout } from "@/Layout";
import type { MasterMenuCategory, MasterMenuItem } from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  formatPrice,
  useGetRestaurantOverrides,
  useListMasterCategories,
  useListMasterMenuItems,
  useSetRestaurantItemOverride,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import type { RestaurantId } from "@/types";
import { useParams } from "@tanstack/react-router";
import { ChefHat } from "lucide-react";

// ─── Category Section ─────────────────────────────────────────────────────────

interface CategorySectionProps {
  restaurantId: RestaurantId;
  category: MasterMenuCategory;
  items: MasterMenuItem[];
  overrides: bigint[];
  onToggle: (masterItemId: bigint, isAvailable: boolean) => void;
}

function CategorySection({
  category,
  items,
  overrides,
  onToggle,
}: CategorySectionProps) {
  const catItems = items.filter((i) => i.categoryId === category.id);

  return (
    <div
      data-ocid={`admin.menu.category.${Number(category.id)}`}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <h3 className="font-display font-semibold text-foreground truncate">
          {category.name}
        </h3>
      </div>

      {catItems.length === 0 ? (
        <div
          data-ocid={`admin.menu.category_empty.${Number(category.id)}`}
          className="px-4 py-8 text-center text-sm text-muted-foreground"
        >
          Chưa có món ăn trong danh mục này.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {catItems.map((item, idx) => {
            const isAvailable = !overrides.some((o) => o === item.id);
            return (
              <li
                key={String(item.id)}
                data-ocid={`admin.menu.item.${idx + 1}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-14 w-14 rounded-lg object-cover shrink-0 bg-muted"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <ChefHat className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {item.name}
                    </span>
                    <Badge
                      variant={isAvailable ? "default" : "secondary"}
                      className={`text-xs shrink-0 ${isAvailable ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}`}
                    >
                      {isAvailable ? "Sẵn sàng" : "Tạm hết"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
                <span className="text-sm font-medium text-foreground shrink-0">
                  {formatPrice(item.price)}
                  {item.unit ? ` / ${item.unit}` : ""}
                </span>
                <Switch
                  checked={isAvailable}
                  onCheckedChange={(v) => onToggle(item.id, v)}
                  aria-label={`${isAvailable ? "Tắt" : "Bật"} ${item.name}`}
                  data-ocid={`admin.menu.availability_switch.${idx + 1}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const { restaurantId } = useParams({ strict: false }) as {
    restaurantId: string;
  };
  const rid = BigInt(restaurantId);
  const { t } = useLanguage();

  const { data: items = [], isLoading: itemsLoading } =
    useListMasterMenuItems();
  const { data: categories = [], isLoading: catsLoading } =
    useListMasterCategories();
  const { data: overrides = [], isLoading: overridesLoading } =
    useGetRestaurantOverrides(rid);
  const setOverride = useSetRestaurantItemOverride();

  const isLoading = itemsLoading || catsLoading || overridesLoading;

  const handleToggle = (masterItemId: bigint, isAvailable: boolean) => {
    setOverride.mutate({
      restaurantId: rid,
      masterItemId,
      isAvailable,
    });
  };

  return (
    <AdminLayout restaurantId={restaurantId}>
      <div data-ocid="admin.menu.page" className="space-y-6">
        <div>
          <h2 className="font-display text-2xl text-foreground">
            Tình trạng món ăn
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t.menuEditor.noCategoriesDesc}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          Thực đơn được quản lý bởi doanh nghiệp — chỉ có thể tắt/bật trạng thái
          sẵn có của từng món.
        </div>

        {isLoading && (
          <div data-ocid="admin.menu.loading_state" className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && categories.length === 0 && (
          <div
            data-ocid="admin.menu.empty_state"
            className="flex flex-col items-center justify-center gap-4 py-20 text-center"
          >
            <ChefHat className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-foreground">
                Chưa có thực đơn tổng
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Vui lòng liên hệ quản lý doanh nghiệp.
              </p>
            </div>
          </div>
        )}

        {!isLoading && categories.length > 0 && (
          <div className="space-y-4">
            {categories.map((cat) => (
              <CategorySection
                key={String(cat.id)}
                restaurantId={rid}
                category={cat}
                items={items}
                overrides={overrides}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
