import { AdminLayout } from "@/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useRestaurant,
  useUpdateRestaurantLocation,
  useUpdateRestaurantName,
} from "@/hooks/useBackend";
import { useLanguage } from "@/i18n";
import { useParams } from "@tanstack/react-router";
import { MapPin, Navigation, Store } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function RestaurantSettingsPage() {
  const { restaurantId } = useParams({ strict: false }) as {
    restaurantId: string;
  };
  const rid = BigInt(restaurantId);
  const { t } = useLanguage();
  const rs = t.restaurantSettings;

  const { data: restaurant, isLoading } = useRestaurant(rid);
  const updateName = useUpdateRestaurantName();
  const updateLocation = useUpdateRestaurantLocation();

  const [restaurantName, setRestaurantName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [storedRadiusKm, setStoredRadiusKm] = useState<bigint | undefined>(
    undefined,
  );
  const [radiusKm, setRadiusKm] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const _geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (restaurant && !initialized) {
      setRestaurantName(restaurant.name ?? "");
      setLatitude(
        restaurant.coordinateLatitude != null
          ? String(restaurant.coordinateLatitude)
          : "",
      );
      setLongitude(
        restaurant.coordinateLongitude != null
          ? String(restaurant.coordinateLongitude)
          : "",
      );
      setStoredRadiusKm(
        restaurant.deliveryRadiusKm != null
          ? BigInt(restaurant.deliveryRadiusKm)
          : undefined,
      );
      setRadiusKm(
        restaurant.deliveryRadiusKm !== undefined &&
          restaurant.deliveryRadiusKm !== null
          ? String(restaurant.deliveryRadiusKm)
          : "",
      );
      // Read address from backend (source of truth)
      setAddress(restaurant.address ?? "");
      setInitialized(true);
    }
  }, [restaurant, initialized]);

  const handleGeocode = useCallback(async () => {
    const q = address.trim();
    if (!q) return;
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
      );
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data.length > 0) {
        setLatitude(data[0].lat);
        setLongitude(data[0].lon);
      } else {
        toast.error("Không tìm được tọa độ cho địa chỉ này");
      }
    } catch {
      toast.error("Lỗi khi tra cứu tọa độ");
    } finally {
      setGeocoding(false);
    }
  }, [address]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const nameTrimmed = restaurantName.trim();
      if (nameTrimmed) {
        await updateName.mutateAsync({ restaurantId: rid, name: nameTrimmed });
      }
      const lat =
        latitude.trim() !== "" ? Number.parseFloat(latitude) : undefined;
      const lng =
        longitude.trim() !== "" ? Number.parseFloat(longitude) : undefined;
      await updateLocation.mutateAsync({
        restaurantId: rid,
        coordinateLatitude: lat,
        coordinateLongitude: lng,
        deliveryRadiusKm:
          radiusKm.trim() !== "" && Number.parseFloat(radiusKm) >= 0
            ? BigInt(Math.round(Number.parseFloat(radiusKm)))
            : storedRadiusKm !== undefined
              ? storedRadiusKm
              : BigInt(0),
        address: address.trim() || undefined,
      });
      toast.success(rs.nameSaved);
    } catch {
      toast.error(rs.nameError);
    } finally {
      setSaving(false);
    }
  };

  const currentName = restaurant?.name ?? "";

  if (isLoading) {
    return (
      <AdminLayout restaurantId={restaurantId} restaurantName={currentName}>
        <div className="max-w-2xl space-y-6">
          <div>
            <h2 className="font-display text-2xl text-foreground">
              {rs.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{rs.subtitle}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout restaurantId={restaurantId} restaurantName={currentName}>
      <div data-ocid="restaurant-settings.page" className="max-w-2xl space-y-6">
        <div>
          <h2 className="font-display text-2xl text-foreground">{rs.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{rs.subtitle}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          {/* Restaurant Name */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-4 w-4 text-primary" />
              <Label htmlFor="rs-name" className="font-semibold text-sm">
                {rs.restaurantName}
              </Label>
            </div>
            <Input
              id="rs-name"
              placeholder={rs.restaurantNamePlaceholder}
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              data-ocid="restaurant-settings.name_input"
            />
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-primary" />
              <Label htmlFor="rs-address" className="font-semibold text-sm">
                Địa chỉ nhà hàng
              </Label>
            </div>
            <Input
              id="rs-address"
              placeholder="Số nhà, tên đường, phường, quận, thành phố"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              data-ocid="restaurant-settings.address_input"
            />
          </div>

          {/* Lat / Lng */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rs-lat">Vĩ độ (Latitude)</Label>
              <Input
                id="rs-lat"
                type="number"
                step="any"
                placeholder="10.762622"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                data-ocid="restaurant-settings.latitude_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-lng">Kinh độ (Longitude)</Label>
              <Input
                id="rs-lng"
                type="number"
                step="any"
                placeholder="106.660172"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                data-ocid="restaurant-settings.longitude_input"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Tọa độ dùng để tính phí giao hàng chính xác hơn
          </p>

          {/* Delivery radius */}
          <div className="space-y-1.5">
            <Label htmlFor="rs-radius">Bán kính giao hàng (km)</Label>
            <Input
              id="rs-radius"
              type="number"
              min={0}
              placeholder="5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
              data-ocid="restaurant-settings.radius_input"
            />
            <p className="text-xs text-muted-foreground">
              Nhập 0 để không giới hạn
            </p>
          </div>

          {/* Geocode button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGeocode}
            disabled={geocoding || !address.trim()}
            className="gap-2"
            data-ocid="restaurant-settings.geocode_button"
          >
            <Navigation className="h-3.5 w-3.5" />
            {geocoding ? "Đang tra cứu..." : "↗ Cập nhật tọa độ theo địa chỉ"}
          </Button>

          {/* Save */}
          <div className="pt-3 border-t border-border">
            <Button
              type="button"
              onClick={handleSave}
              disabled={
                saving || updateName.isPending || updateLocation.isPending
              }
              data-ocid="restaurant-settings.save_button"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
