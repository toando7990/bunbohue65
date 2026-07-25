import {
  type BackgroundImage,
  type SuggestionConfig,
  createActor,
} from "@/backend";
import type {
  AnalyticsEntry,
  AutoPaymentApp,
  EnterpriseDeviceRecord,
  EnterpriseDeviceRole,
  EnterprisePermission,
  EnterpriseStaffPermissions,
  PaymentMethod__1,
  WeeklyAnalyticsEntry,
} from "@/backend";
import type {
  BannerImagePublic,
  DeveloperProfile,
  DynamicQRRecordPublic,
  DynamicQRStatus,
  DynamicQRStatusResult,
  OrderTrackingPublic,
  ReservationId,
  ReservationPublic,
  ReservationStatus,
  SavedRecipientInfo,
  TingeeBank,
} from "@/types";

// Re-export the dynamic QR types so consumers can import them from this
// module (useBackend) alongside the hooks that use them.
export type {
  DynamicQRRecordPublic,
  DynamicQRStatus,
  DynamicQRStatusResult,
  TingeeBank,
} from "@/types";
import type {
  MenuCategoryId,
  MenuItemId,
  OrderItem,
  OrderPublic,
  OrderStatus,
  RestaurantId,
  StaffRole,
  TableId,
} from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── Developer Profile ───────────────────────────────────────────────────────
// ─── Background Images ───────────────────────────────────────────────────────

export function useListBackgroundImages() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<BackgroundImage[]>({
    queryKey: ["backgroundImages"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listBackgroundImages();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUploadBackgroundImage() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      url,
      fileName,
    }: { url: string; fileName: string }) => {
      if (!actor) throw new Error("No actor");
      return actor.uploadBackgroundImage(url, fileName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backgroundImages"] });
    },
  });
}

export function useDeleteBackgroundImage() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteBackgroundImage(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backgroundImages"] });
    },
  });
}

// ─── Suggestion Config ────────────────────────────────────────────────────────

export function useGetSuggestionConfig() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<SuggestionConfig | null>({
    queryKey: ["suggestionConfig"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getSuggestionConfig();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSetSuggestionConfig() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: SuggestionConfig) => {
      if (!actor) throw new Error("No actor");
      return actor.setSuggestionConfig(config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestionConfig"] });
    },
  });
}

export function useGetDeveloperProfile() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<DeveloperProfile | null>({
    queryKey: ["developerProfile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getDeveloperProfile();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUpsertDeveloperProfile() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      businessOwnerPrincipalId,
      email,
    }: {
      businessOwnerPrincipalId: Principal;
      email: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.upsertDeveloperProfile(businessOwnerPrincipalId, email);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["developerProfile"] });
    },
  });
}

// ─── Restaurant ──────────────────────────────────────────────────────────────

export function useRestaurant(id: RestaurantId | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["restaurant", id?.toString()],
    queryFn: async () => {
      if (!actor || id === null) return null;
      return actor.getRestaurant(id);
    },
    enabled: !!actor && !isFetching && id !== null,
  });
}

export function useMyRestaurants() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["myRestaurants"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listMyRestaurants();
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── Categories ──────────────────────────────────────────────────────────────

export function useCategories(restaurantId: RestaurantId | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["categories", restaurantId?.toString()],
    queryFn: async () => {
      if (!actor || restaurantId === null) return [];
      return actor.listCategories(restaurantId);
    },
    enabled: !!actor && !isFetching && restaurantId !== null,
  });
}

// ─── Menu Items ───────────────────────────────────────────────────────────────

export function useMenuItems(restaurantId: RestaurantId | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["menuItems", restaurantId?.toString()],
    queryFn: async () => {
      if (!actor || restaurantId === null) return [];
      return actor.listMenuItems(restaurantId);
    },
    enabled: !!actor && !isFetching && restaurantId !== null,
  });
}

export function useMenuItemsByCategory(
  restaurantId: RestaurantId | null,
  categoryId: MenuCategoryId | null,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["menuItems", restaurantId?.toString(), categoryId?.toString()],
    queryFn: async () => {
      if (!actor || restaurantId === null || categoryId === null) return [];
      return actor.listMenuItemsByCategory(restaurantId, categoryId);
    },
    enabled:
      !!actor && !isFetching && restaurantId !== null && categoryId !== null,
  });
}

// ─── Tables ──────────────────────────────────────────────────────────────────

export function useTables(restaurantId: RestaurantId | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["tables", restaurantId?.toString()],
    queryFn: async () => {
      if (!actor || restaurantId === null) return [];
      return actor.listTables(restaurantId);
    },
    enabled: !!actor && !isFetching && restaurantId !== null,
  });
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export function useOrders(restaurantId: RestaurantId | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<OrderPublic[]>({
    queryKey: ["orders", restaurantId?.toString()],
    queryFn: async () => {
      if (!actor || restaurantId === null) return [];
      const result = await actor.listOrdersByRestaurant(restaurantId);
      if (result.__kind__ === "err") throw new Error("Không có quyền truy cập");
      return result.ok;
    },
    enabled: !!actor && !isFetching && restaurantId !== null,
    refetchInterval: 5_000,
  });
}

export function useActiveOrders(
  restaurantId: RestaurantId | null,
  dateFilter?: string,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<OrderPublic[]>({
    queryKey: ["activeOrders", restaurantId?.toString(), dateFilter],
    queryFn: async () => {
      if (!actor || restaurantId === null) return [];
      const result = await actor.listActiveOrdersByRestaurant(
        restaurantId,
        dateFilter ?? null,
      );
      if (result.__kind__ === "err") throw new Error("Không có quyền truy cập");
      return result.ok;
    },
    enabled: !!actor && !isFetching && restaurantId !== null,
    refetchInterval: 5_000,
  });
}

export function useOrdersByTable(
  restaurantId: RestaurantId | null,
  tableIdentifier: string | null,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<OrderPublic[]>({
    queryKey: ["ordersByTable", restaurantId?.toString(), tableIdentifier],
    queryFn: async () => {
      if (!actor || restaurantId === null || !tableIdentifier) return [];
      const result = await actor.listOrdersByTable(
        restaurantId,
        tableIdentifier,
      );
      if (result.__kind__ === "err") throw new Error("Không có quyền truy cập");
      return result.ok;
    },
    enabled:
      !!actor && !isFetching && restaurantId !== null && !!tableIdentifier,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function usePlaceOrder() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      tableIdentifier,
      items,
      notes,
      vatRequest,
      vatInfo,
    }: {
      restaurantId: RestaurantId;
      tableIdentifier: string;
      items: OrderItem[];
      notes?: string;
      vatRequest?: boolean;
      vatInfo?: {
        taxCode?: string | null;
        buyerName: string;
        address: string;
        email: string;
        accountNo?: string | null;
      } | null;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.placeOrder(
        restaurantId,
        tableIdentifier,
        items,
        notes ?? null,
        vatRequest ?? false,
        vatInfo
          ? {
              taxCode: vatInfo.taxCode || undefined,
              buyerName: vatInfo.buyerName,
              address: vatInfo.address,
              email: vatInfo.email,
              accountNo: vatInfo.accountNo || undefined,
            }
          : null,
      );
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["activeOrders", restaurantId.toString()],
      });
    },
  });
}

export function useUpdateOrderStatus() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      restaurantId: _restaurantId,
    }: {
      orderId: bigint;
      status: OrderStatus;
      restaurantId: RestaurantId;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateOrderStatus(orderId, status);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["activeOrders", restaurantId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["orders", restaurantId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["deliveryOrders", restaurantId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["enterpriseDeliveryOrders"],
      });
    },
  });
}

export function useCreateRestaurant() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createRestaurant(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myRestaurants"] });
    },
  });
}

export function useCreateCategory() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      name,
      position,
    }: {
      restaurantId: RestaurantId;
      name: string;
      position: bigint;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createCategory(restaurantId, name, position);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["categories", restaurantId.toString()],
      });
    },
  });
}

export function useUpdateCategory() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      id,
      name,
      position,
    }: {
      restaurantId: RestaurantId;
      id: MenuCategoryId;
      name: string;
      position: bigint;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateCategory(restaurantId, id, name, position);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["categories", restaurantId.toString()],
      });
    },
  });
}

export function useDeleteCategory() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      id,
    }: {
      restaurantId: RestaurantId;
      id: MenuCategoryId;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteCategory(restaurantId, id);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["categories", restaurantId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["menuItems", restaurantId.toString()],
      });
    },
  });
}

export function useCreateMenuItem() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      categoryId,
      name,
      description,
      price,
      imageUrl,
      available,
      unit,
    }: {
      restaurantId: RestaurantId;
      categoryId: MenuCategoryId;
      name: string;
      description: string;
      price: bigint;
      imageUrl?: string;
      available: boolean;
      unit?: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createMenuItem(
        restaurantId,
        categoryId,
        name,
        description,
        price,
        imageUrl ?? null,
        available,
        unit?.trim() ? unit.trim() : null,
      );
    },
    onSuccess: (_data, { restaurantId, categoryId }) => {
      queryClient.invalidateQueries({
        queryKey: ["menuItems", restaurantId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["menuItems", restaurantId.toString(), categoryId.toString()],
      });
    },
  });
}

export function useUpdateMenuItem() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      id,
      name,
      description,
      price,
      imageUrl,
      available,
      unit,
    }: {
      restaurantId: RestaurantId;
      id: MenuItemId;
      name: string;
      description: string;
      price: bigint;
      imageUrl?: string;
      available: boolean;
      unit?: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateMenuItem(
        restaurantId,
        id,
        name,
        description,
        price,
        imageUrl ?? null,
        available,
        unit?.trim() ? unit.trim() : null,
      );
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["menuItems", restaurantId.toString()],
      });
    },
  });
}

export function useDeleteMenuItem() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      id,
    }: {
      restaurantId: RestaurantId;
      id: MenuItemId;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteMenuItem(restaurantId, id);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["menuItems", restaurantId.toString()],
      });
    },
  });
}

export function useSetMenuItemAvailability() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      id,
      available,
    }: {
      restaurantId: RestaurantId;
      id: MenuItemId;
      available: boolean;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.setMenuItemAvailability(restaurantId, id, available);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["menuItems", restaurantId.toString()],
      });
    },
  });
}

export function useCreateTable() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      tableNumber,
    }: {
      restaurantId: RestaurantId;
      tableNumber: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createTable(restaurantId, tableNumber);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["tables", restaurantId.toString()],
      });
    },
  });
}

export function useDeleteTable() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      id,
    }: {
      restaurantId: RestaurantId;
      id: TableId;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteTable(restaurantId, id);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["tables", restaurantId.toString()],
      });
    },
  });
}

export function useAddStaffMember() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      staffId,
      role,
    }: {
      restaurantId: RestaurantId;
      staffId: Principal;
      role: StaffRole;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.addStaffMember(restaurantId, staffId, role);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["restaurant", restaurantId.toString()],
      });
    },
  });
}

export function useClearCompletedOrders() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (restaurantId: RestaurantId) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.clearCompletedOrders(restaurantId);
      if (result.__kind__ === "err") throw new Error("Không có quyền truy cập");
      return result.ok;
    },
    onSuccess: (_data, restaurantId) => {
      queryClient.invalidateQueries({
        queryKey: ["orders", restaurantId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["activeOrders", restaurantId.toString()],
      });
    },
  });
}

export function useUpdateRestaurantProfile() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      stripeEnabled,
      bannerImageUrl,
      tableServiceHours,
      deliveryServiceHours,
      brand1Name,
      brand2Name,
      brand3Name,
      brand4Name,
      brand5Name,
    }: {
      restaurantId: RestaurantId;
      stripeEnabled?: boolean;
      bannerImageUrl?: string;
      tableServiceHours?: string;
      deliveryServiceHours?: string;
      brand1Name?: string;
      brand2Name?: string;
      brand3Name?: string;
      brand4Name?: string;
      brand5Name?: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateRestaurantProfile(restaurantId, {
        stripeEnabled,
        bannerImageUrl,
        tableServiceHours,
        deliveryServiceHours,
        brand1Name,
        brand2Name,
        brand3Name,
        brand4Name,
        brand5Name,
      });
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["restaurant", restaurantId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["myRestaurants"],
      });
      queryClient.invalidateQueries({
        queryKey: ["tables", restaurantId.toString()],
      });
    },
  });
}

// ─── Business Profile (business-level: businessName/address/email/domain/
//     brandLogo/tingeeVA — shared across all restaurants) ──────────────────────

export interface BusinessProfileInfo {
  businessName: string | null;
  address: string | null;
  email: string | null;
  domain: string | null;
  brandLogo: string | null;
  tingeeVA: string | null;
  tingeeBankBin: string | null;
  tingeeMerchantId: string | null;
}

/**
 * Fetches business-level profile info (businessName, address, email, domain,
 * brandLogo, tingeeVA). These fields are shared across all restaurants of the
 * business — they are NOT per-restaurant. The backend returns each field as
 * an optional Text; this hook normalizes them to `string | null`.
 */
export function useGetBusinessProfileInfo() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<BusinessProfileInfo>({
    queryKey: ["businessProfileInfo"],
    queryFn: async () => {
      if (!actor)
        return {
          businessName: null,
          address: null,
          email: null,
          domain: null,
          brandLogo: null,
          tingeeVA: null,
          tingeeBankBin: null,
          tingeeMerchantId: null,
        };
      const result = await actor.getBusinessProfileInfo();
      const r = Array.isArray(result) ? result[0] : result;
      return {
        businessName: r?.businessName ?? null,
        address: r?.address ?? null,
        email: r?.email ?? null,
        domain: r?.domain ?? null,
        brandLogo: r?.brandLogo ?? null,
        tingeeVA: r?.tingeeVA ?? null,
        tingeeBankBin: r?.tingeeBankBin ?? null,
        tingeeMerchantId: r?.tingeeMerchantId ?? null,
      };
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000,
  });
}

/**
 * Patches business-level profile fields (businessName, address, email, domain,
 * brandLogo, tingeeVA). Pass only the fields you want to change. Invalidates
 * the `["businessProfileInfo"]` query on success so the display refreshes.
 */
export function useUpdateBusinessProfile() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: {
      businessName?: string;
      address?: string;
      email?: string;
      domain?: string;
      brandLogo?: string;
      tingeeVA?: string;
      tingeeBankBin?: string;
      tingeeMerchantId?: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.updateBusinessProfile(patch);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businessProfileInfo"] });
    },
  });
}
export function useDeleteRestaurant() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (restaurantId: RestaurantId) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteRestaurant(restaurantId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myRestaurants"] });
    },
  });
}

export function useUpdateRestaurantName() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      name,
    }: {
      restaurantId: RestaurantId;
      name: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateRestaurantName(restaurantId, name);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["restaurant", restaurantId.toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["myRestaurants"] });
    },
  });
}

export function useUpdateRestaurantStripeKeys() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      publishableKey,
      secretKey,
    }: {
      restaurantId: RestaurantId;
      publishableKey: string;
      secretKey: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateRestaurantStripeKeys(
        restaurantId,
        publishableKey,
        secretKey,
      );
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["restaurant", restaurantId.toString()],
      });
    },
  });
}

export function useCreateReservation() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async ({
      restaurantId,
      customerName,
      customerPhone,
      partySize,
      date,
      timeSlot,
      durationMinutes,
      notes,
      customerEmail,
    }: {
      restaurantId: RestaurantId;
      customerName: string;
      customerPhone: string;
      partySize: bigint;
      date: string;
      timeSlot: string;
      durationMinutes: bigint;
      notes?: string;
      customerEmail?: string;
    }): Promise<ReservationId> => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createReservation(
        restaurantId,
        customerName,
        customerPhone,
        partySize,
        date,
        timeSlot,
        durationMinutes,
        null,
        notes ?? null,
        customerEmail ?? null,
      );
    },
  });
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export function useGetDailyAnalytics(
  restaurantId: bigint | null,
  startDate: string,
  endDate: string,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<AnalyticsEntry[] | null>({
    queryKey: ["dailyAnalytics", restaurantId?.toString(), startDate, endDate],
    queryFn: async () => {
      if (!actor || restaurantId === null || !startDate || !endDate)
        return null;
      return actor.getDailyAnalytics(restaurantId, startDate, endDate);
    },
    enabled:
      !!actor &&
      !isFetching &&
      restaurantId !== null &&
      !!startDate &&
      !!endDate,
  });
}

export function useGetWeeklyAnalytics(
  restaurantId: bigint | null,
  startWeek: string,
  endWeek: string,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<WeeklyAnalyticsEntry[] | null>({
    queryKey: ["weeklyAnalytics", restaurantId?.toString(), startWeek, endWeek],
    queryFn: async () => {
      if (!actor || restaurantId === null || !startWeek || !endWeek)
        return null;
      return actor.getWeeklyAnalytics(restaurantId, startWeek, endWeek);
    },
    enabled:
      !!actor &&
      !isFetching &&
      restaurantId !== null &&
      !!startWeek &&
      !!endWeek,
  });
}

// ─── Reservations ───────────────────────────────────────────────────────────

export function useCreatePaymentIntent() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async ({
      orderId,
      method,
      restaurantId,
    }: {
      orderId: bigint;
      method: string;
      restaurantId: bigint;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.createPaymentIntent(
        orderId,
        method as unknown as PaymentMethod__1,
        restaurantId,
      );
      if (result.__kind__ === "err") throw new Error("Payment intent failed");
      return result.ok;
    },
  });
}

export function useConfirmPayment() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      paymentIntentId,
    }: {
      orderId: bigint;
      paymentIntentId: string;
      restaurantId?: bigint;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.confirmPayment(orderId, paymentIntentId);
      if (result.__kind__ === "err")
        throw new Error("Payment confirmation failed");
      return result.ok;
    },
    onSuccess: (_data, { restaurantId }) => {
      if (restaurantId) {
        queryClient.invalidateQueries({
          queryKey: ["orders", restaurantId.toString()],
        });
        queryClient.invalidateQueries({
          queryKey: ["activeOrders", restaurantId.toString()],
        });
      }
    },
  });
}

export function useConfirmPaymentByCashier() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      restaurantId,
    }: {
      orderId: bigint;
      restaurantId: bigint;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.confirmPaymentByCashier(orderId, restaurantId);
      if (result.__kind__ === "err")
        throw new Error("Payment confirmation failed");
      return result.ok;
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["orders", restaurantId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["activeOrders", restaurantId.toString()],
      });
    },
  });
}

export function useListReservationsByRestaurant(
  restaurantId: RestaurantId | null,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<ReservationPublic[]>({
    queryKey: ["reservations", restaurantId?.toString()],
    queryFn: async () => {
      if (!actor || restaurantId === null) return [];
      return actor.listReservationsByRestaurant(restaurantId);
    },
    enabled: !!actor && !isFetching && restaurantId !== null,
    refetchInterval: 30_000,
  });
}

export function useConfirmReservation() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
    }: {
      id: ReservationId;
      restaurantId: RestaurantId;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.confirmReservation(id);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["reservations", restaurantId.toString()],
      });
    },
  });
}

export function useCancelReservation() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
    }: {
      id: ReservationId;
      restaurantId: RestaurantId;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.cancelReservation(id);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["reservations", restaurantId.toString()],
      });
    },
  });
}

export function useUpdateReservationStatus() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: ReservationId;
      status: ReservationStatus;
      restaurantId: RestaurantId;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateReservationStatus(id, status);
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["reservations", restaurantId.toString()],
      });
    },
  });
}

export function useGetOrderPaymentStatus(orderId: bigint | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["orderPaymentStatus", orderId?.toString()],
    queryFn: async () => {
      if (!actor || orderId === null) return null;
      return actor.getOrderPaymentStatus(orderId);
    },
    enabled: !!actor && !isFetching && orderId !== null,
    refetchInterval: 2_000,
  });
}

// ─── Delivery Orders ─────────────────────────────────────────────────────────
// ─── Enterprise Delivery ─────────────────────────────────────────────────────

export function useIsEnterpriseDeliveryStaff() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<boolean>({
    queryKey: ["isEnterpriseDeliveryStaff"],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isEnterpriseDeliveryStaff();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useListDeliveryOrdersEnterprise(dateFilter?: string) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["enterpriseDeliveryOrders", dateFilter],
    queryFn: async () => {
      if (!actor) return { __kind__: "ok" as const, ok: [] };
      return actor.listDeliveryOrdersEnterprise(dateFilter ?? null);
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10_000,
  });
}

export function useGetMyRestaurantFilter() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["myRestaurantFilter"],
    queryFn: async () => {
      if (!actor) return { __kind__: "ok" as const, ok: null };
      return actor.getMyRestaurantFilter();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveMyRestaurantFilter() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (restaurantIds: bigint[]) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.saveMyRestaurantFilter(restaurantIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myRestaurantFilter"] });
    },
  });
}

export function usePlaceDeliveryOrder() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      items,
      notes,
      deliveryAddress,
      customerName,
      customerPhone,
      vatRequest,
      vatInfo,
      shippingFee,
      deliveryLat,
      deliveryLng,
      isCod,
    }: {
      restaurantId: RestaurantId;
      items: OrderItem[];
      notes?: string;
      deliveryAddress: string;
      customerName: string;
      customerPhone: string;
      vatRequest: boolean;
      vatInfo: {
        taxCode?: string | null;
        buyerName: string;
        address: string;
        email: string;
        accountNo?: string | null;
      } | null;
      shippingFee?: bigint;
      deliveryLat?: number | null;
      deliveryLng?: number | null;
      isCod?: boolean;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.placeDeliveryOrder(
        restaurantId,
        items,
        notes ?? null,
        deliveryAddress,
        customerName,
        customerPhone,
        vatRequest,
        vatInfo
          ? {
              taxCode: vatInfo.taxCode || undefined,
              buyerName: vatInfo.buyerName,
              address: vatInfo.address,
              email: vatInfo.email,
              accountNo: vatInfo.accountNo || undefined,
            }
          : null,
        shippingFee ?? null,
        deliveryLat ?? null,
        deliveryLng ?? null,
        isCod ?? false,
      );
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["deliveryOrders", restaurantId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["enterpriseDeliveryOrders"],
      });
    },
  });
}

export function getTodayDateString(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export function useListDeliveryOrders(
  restaurantId: RestaurantId | null,
  dateFilter?: string,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<import("@/types").OrderPublic[]>({
    queryKey: ["deliveryOrders", restaurantId?.toString(), dateFilter],
    queryFn: async () => {
      if (!actor || restaurantId === null) return [];
      const result = await actor.listDeliveryOrders(
        restaurantId,
        dateFilter ?? null,
      );
      if (result.__kind__ === "err") throw new Error("Không có quyền truy cập");
      return result.ok;
    },
    enabled: !!actor && !isFetching && restaurantId !== null,
    refetchInterval: 5_000,
  });
}

export function useAllRestaurants() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["allRestaurants"],
    queryFn: async () => {
      if (!actor) return [];
      // listMyRestaurants returns all restaurants in this canister
      // (public endpoint — no auth required for customer-facing delivery flow)
      return actor.listMyRestaurants();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function usePublicRestaurants() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["publicRestaurants"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listAllRestaurants();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useGetRestaurantStripePublishableKey(
  restaurantId: bigint | null,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["stripePublishableKey", restaurantId?.toString()],
    queryFn: async () => {
      if (!actor || restaurantId === null) return null;
      return actor.getRestaurantStripePublishableKey(restaurantId);
    },
    enabled: !!actor && !isFetching && restaurantId !== null,
  });
}

export function useGetWebhookEndpointInfo() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<string>({
    queryKey: ["webhookEndpointInfo"],
    queryFn: async () => {
      if (!actor) return "";
      return actor.getWebhookEndpointInfo();
    },
    enabled: !!actor && !isFetching,
    staleTime: 300_000,
  });
}

// ─── Tingee ───────────────────────────────────────────────────────────────────

export interface TingeeConfig {
  clientId: string;
  secretToken: string;
  orderPrefix: string;
}

export function useGetTingeeConfig() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<TingeeConfig | null>({
    queryKey: ["tingeeConfig"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getTingeeConfig();
    },
    enabled: !!actor && !isFetching,
  });
}

/**
 * Fetches Tingee config for a kiosk device using its device token.
 *
 * Reads the device token from localStorage (key format
 * `deviceToken_{restaurantId}_kioskorder`, where `restaurantId` is stored under
 * `deviceRestaurantId_kioskorder` — same pattern as StaffAccessGuard).
 *
 * Uses a DEDICATED queryKey `["tingeeConfigForDevice"]` to avoid cache leakage
 * with the owner-context `["tingeeConfig"]` query used by OrderPage.
 */
export function useGetTingeeConfigForDevice() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<TingeeConfig | null>({
    queryKey: ["tingeeConfigForDevice"],
    queryFn: async () => {
      if (!actor) return null;
      const restaurantId = localStorage.getItem(
        "deviceRestaurantId_kioskorder",
      );
      if (!restaurantId) return null;
      const deviceToken = localStorage.getItem(
        `deviceToken_${restaurantId}_kioskorder`,
      );
      if (!deviceToken) return null;
      return actor.getTingeeConfigForDevice(deviceToken);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveTingeeConfig() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      clientId: string;
      secretToken: string;
      orderPrefix: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.saveTingeeConfig(
        params.clientId,
        params.secretToken,
        params.orderPrefix,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tingeeConfig"] });
      queryClient.invalidateQueries({ queryKey: ["tingeeConfigured"] });
    },
  });
}

export function useHasTingeeConfigured() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<boolean>({
    queryKey: ["tingeeConfigured"],
    queryFn: async () => {
      if (!actor) return false;
      return actor.hasTingeeConfigured();
    },
    enabled: !!actor && !isFetching,
  });
}

/**
 * Fetches the list of banks supported by Tingee via the backend's
 * `getTingeeBanks()` http-outcall path (Tingee get-banks). The backend
 * forwards the request to the VPS proxy (TINGEE_PROXY_BASE) with an
 * HMAC-SHA512 signature and returns the parsed bank list.
 *
 * Returns `{ banks: TingeeBank[]; cached: boolean }` on success:
 * - `banks` — the list of supported banks (BIN, code, name, logo, shortName).
 *   Empty array when the actor is not ready yet.
 * - `cached` — `false` for a fresh fetch from Tingee. The backend does not
 *   currently surface a cache flag, so this is always `false` from the
 *   frontend's perspective; the field exists so consumers can render a
 *   cache indicator without a contract change if the backend adds it later.
 *
 * On backend error (`#err`), the query throws with the backend's error
 * message so React Query surfaces it via `isError` / `error`.
 *
 * Query key: `["tingeeBanks"]`. `enabled` defaults to `true` (gated only by
 * actor readiness), matching the pattern of the other Tingee config hooks
 * (`useGetTingeeConfig`, `useHasTingeeConfigured`).
 *
 * Per user preference, the consumer MUST NOT auto-fill the chosen BIN into
 * the Bank BIN field — the user explicitly selects a bank and presses Lưu.
 */
export function useGetTingeeBanks() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<{ banks: TingeeBank[]; cached: boolean }>({
    queryKey: ["tingeeBanks"],
    queryFn: async () => {
      if (!actor) return { banks: [], cached: false };
      const result = await actor.getTingeeBanks();
      if (result.__kind__ === "ok" && result.ok && result.ok.length > 0) {
        return { banks: result.ok, cached: false };
      }
      const resp = await fetch("https://proxy.bunbohue65.vn/tingee-banks");
      const banks = (await resp.json()) as TingeeBank[];
      await actor.confirmTingeeBanks({ banks });
      return { banks, cached: false };
    },
    enabled: !!actor && !isFetching,
    // Cache for the entire session — the first click fetches, subsequent
    // clicks reuse the cached list without re-calling the backend. The user
    // can still force a refetch via the "Thử lại" button on error.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
}

// ─── Dynamic QR (Tingee http-outcalls) ─────────────────────────────────────────

/**
 * Generates a dynamic QR for the given order via the backend's
 * http-outcalls path (Tingee generate-dynamic-qr). The backend computes a
 * deterministic idempotencyKey and stores the secretToken — the frontend
 * only receives the public `DynamicQRRecordPublic` (qrId, qrString, status,
 * billId, idempotencyKey, orderId, createdAt, expiresAt).
 *
 * Pass the order id as a string (the backend accepts Text). For an initial
 * generate pass `regenerateNonce: null` (or omit it). For a regenerate pass
 * the incrementing counter minted by the panel so the backend appends
 * `:regen:n` to the idempotencyKey and bypasses the VPS 10-min cache. On
 * success the hook returns the parsed `DynamicQRRecordPublic`. On error it
 * throws with the backend's error message.
 */
export function useGenerateDynamicQR() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      regenerateNonce = null,
    }: {
      orderId: string;
      regenerateNonce?: bigint | null;
    }): Promise<DynamicQRRecordPublic> => {
      if (!actor) throw new Error("Actor not ready");
      const resp = await fetch("https://proxy.bunbohue65.vn/tingee-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, regenerateNonce }),
      });
      if (!resp.ok) {
        throw new Error(
          "Không thể kết nối đến dịch vụ thanh toán — vui lòng thử lại sau vài giây",
        );
      }
      const data = (await resp.json()) as {
        qrId: string;
        qrString: string;
        billId: string;
        idempotencyKey: string;
      };
      const confirmResult = await actor.confirmDynamicQRGenerated({
        qrString: data.qrString,
        idempotencyKey: data.idempotencyKey,
        qrId: data.qrId,
        orderId: BigInt(orderId),
        billId: data.billId,
      });
      if (confirmResult.__kind__ === "err") throw new Error(confirmResult.err);
      const record: DynamicQRRecordPublic = {
        qrId: data.qrId,
        qrString: data.qrString,
        billId: data.billId,
        idempotencyKey: data.idempotencyKey,
        orderId: BigInt(orderId),
        status: "pending" as const,
        createdAt: BigInt(Date.now()),
        expiresAt: BigInt(Date.now() + 86_400_000),
      };
      await queryClient.invalidateQueries({
        queryKey: ["dynamicQrStatus", orderId],
      });
      return record;
    },
  });
}

/**
 * Polls the dynamic QR status for the given order id. Polling runs every 5
 * seconds while the status is `pending` and stops (refetchInterval falsy)
 * once the status transitions to `paid`, `expired`, or `deleted`. The query
 * is disabled entirely when `orderId` is null/empty or the actor is not
 * ready.
 *
 * Returns the current `DynamicQRStatusResult` (status + totalAmountPaid +
 * transactionInfos) or null while loading / disabled. Consumers should read
 * `data.status` for the polled status and `data.totalAmountPaid` for the
 * get-status fallback confirm path (used when the webhook hasn't fired).
 * `transactionInfos` is for đối soát / display only, never confirmation.
 */
export function useGetDynamicQRStatus(orderId: string | null | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<DynamicQRStatusResult | null>({
    queryKey: ["dynamicQrStatus", orderId ?? ""],
    queryFn: async () => {
      if (!orderId) return null;
      if (!actor) return null;
      const result = await actor.getDynamicQRStatus(orderId);
      if (result.__kind__ === "err") throw new Error(result.err);
      const ok = result.ok;
      return {
        status: ok.status as DynamicQRStatus,
        totalAmountPaid: ok.totalAmountPaid ?? null,
        transactionInfos: ok.transactionInfos ?? null,
      };
    },
    enabled: !!actor && !isFetching && !!orderId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Only keep polling while the QR is pending. Once it transitions to
      // paid/expired/deleted we stop the interval.
      return data?.status === "pending" ? 5_000 : false;
    },
  });
}

/**
 * Deletes (cancels) a pending dynamic QR for the given order id. The
 * backend marks the QR record as `deleted` so subsequent status polls
 * return `deleted`. Invalidates the dynamic QR status query on success so
 * the UI refreshes immediately.
 */
export function useDeleteDynamicQR() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string): Promise<void> => {
      if (!actor) throw new Error("Actor not ready");
      await fetch("https://proxy.bunbohue65.vn/tingee-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const result = await actor.confirmDynamicQRDeleted({
        orderId: BigInt(orderId),
      });
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({
        queryKey: ["dynamicQrStatus", orderId],
      });
    },
  });
}

/**
 * Fallback payment confirmation via Tingee get-status. Called by
 * {@link DynamicQRPanel} when `useGetDynamicQRStatus` reports a fully-paid
 * QR (status `paid` with a `totalAmountPaid`) but the webhook hasn't fired
 * yet. The backend re-validates the amount against the order total and
 * runs the side-effects (BKAV invoice + AhaMove booking) BEFORE setting
 * `#TingeePaid`, so this hook is idempotent — a late webhook arriving
 * afterwards is a no-op thanks to the `#TingeePaid` lock.
 *
 * - `orderId` — numeric order id (bigint) the QR was generated for.
 * - `totalAmountPaid` — the paid amount reported by Tingee get-status
 *   (`data.totalAmountPaid`). The backend rejects partial / sai mệnh giá
 *   payments with `AmountMismatch`.
 * - `transactionCode` — optional Tingee transaction code extracted from
 *   `transactionInfos` for reconciliation; pass `null` when absent.
 *
 * Returns `true` on success. Throws with a localized-ish error message on
 * `NotFound` / `Unauthorized` / `NotTingeePending` / `AlreadyPaid` /
 * `AmountMismatch`.
 */
export function useConfirmPaymentByTingeeStatus() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      totalAmountPaid,
      transactionCode,
    }: {
      orderId: bigint;
      totalAmountPaid: bigint;
      transactionCode?: string | null;
    }): Promise<boolean> => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.confirmPaymentByTingeeStatus(
        orderId,
        totalAmountPaid,
        transactionCode ?? null,
      );
      if (result.__kind__ === "err") {
        const errKind = (result.err as { __kind__?: string }).__kind__;
        const msg =
          errKind === "AmountMismatch"
            ? "Sai mệnh giá thanh toán"
            : errKind === "AlreadyPaid"
              ? "Đơn hàng đã được thanh toán"
              : errKind === "NotTingeePending"
                ? "Đơn hàng không ở trạng thái chờ Tingee"
                : errKind === "Unauthorized"
                  ? "Không có quyền truy cập"
                  : errKind === "NotFound"
                    ? "Không tìm thấy đơn hàng"
                    : "Xác nhận thanh toán thất bại";
        throw new Error(msg);
      }
      return result.ok;
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({
        queryKey: ["dynamicQrStatus", orderId.toString()],
      });
    },
  });
}

/**
 * Marks a Tingee pending order as expired. Called by {@link DynamicQRPanel}
 * when `useGetDynamicQRStatus` reports status `expired` (the QR expired
 * before payment). The backend sets `#TingeeExpired` so a subsequent
 * `useGenerateDynamicQR` can regenerate a fresh QR for the same order
 * (the regenerate flow is owned by the panel, not this hook).
 *
 * - `orderId` — numeric order id (bigint) the QR was generated for.
 *
 * Returns `true` on success. Throws on `NotFound` / `Unauthorized`.
 */
export function useMarkTingeeExpired() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: bigint): Promise<boolean> => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.markTingeeExpired(orderId);
      if (result.__kind__ === "err") {
        const errKind = (result.err as { __kind__?: string }).__kind__;
        const msg =
          errKind === "Unauthorized"
            ? "Không có quyền truy cập"
            : errKind === "NotFound"
              ? "Không tìm thấy đơn hàng"
              : "Đánh dấu hết hạn thất bại";
        throw new Error(msg);
      }
      return result.ok;
    },
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({
        queryKey: ["dynamicQrStatus", orderId.toString()],
      });
    },
  });
}

// ─── Business Bank Details ─────────────────────────────────────────────────────

export interface BusinessBankDetails {
  accountNumber: string;
  bankName: string;
  accountHolderName: string;
}

/**
 * Fetches bank details for the given restaurant (used as the business-level
 * payment account — all restaurants share the business bank account).
 *
 * The backend signature changed from `getBusinessBankDetails()` to
 * `getBusinessBankDetails(deviceToken: string | null)`. When a kiosk device
 * token is available in localStorage (key `deviceToken_{restaurantId}_kioskorder`,
 * with `restaurantId` under `deviceRestaurantId_kioskorder` — same pattern as
 * StaffAccessGuard), it is passed so the backend uses the device-scoped path.
 * Otherwise `null` is passed and the backend falls back to the owner /
 * enterprise-staff path (used by OrderPage and DeliveryOrderPage in
 * customer-facing contexts).
 *
 * The queryKey `["businessBankDetails"]` is intentionally kept unchanged for
 * backward compatibility with existing consumers.
 */
export function useGetBusinessBankDetails() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<BusinessBankDetails | null>({
    queryKey: ["businessBankDetails"],
    queryFn: async () => {
      if (!actor) return null;
      let deviceToken: string | null = null;
      try {
        const restaurantId = localStorage.getItem(
          "deviceRestaurantId_kioskorder",
        );
        if (restaurantId) {
          deviceToken = localStorage.getItem(
            `deviceToken_${restaurantId}_kioskorder`,
          );
        }
      } catch {
        deviceToken = null;
      }
      const result = await actor.getBusinessBankDetails(deviceToken);
      if (!result)
        return { accountNumber: "", bankName: "", accountHolderName: "" };
      const details = Array.isArray(result) ? result[0] : result;
      if (!details)
        return { accountNumber: "", bankName: "", accountHolderName: "" };
      return {
        accountNumber: details.accountNumber,
        bankName: details.bankName,
        accountHolderName: details.accountHolderName,
      };
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000,
  });
}

/**
 * Saves business bank details (account number, bank name, account holder).
 * All three params are required Text on the backend; pass empty strings to
 * clear a field. Invalidates the business bank details query on success so
 * the display refreshes.
 */
export function useUpdateBusinessBankDetails() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      accountNumber,
      bankName,
      accountHolderName,
    }: {
      accountNumber: string;
      bankName: string;
      accountHolderName: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.updateBusinessBankDetails(
        accountNumber,
        bankName,
        accountHolderName,
      );
      if (
        result &&
        typeof result === "object" &&
        "__kind__" in result &&
        result.__kind__ === "err"
      ) {
        const errMsg =
          "err" in result
            ? String((result as { err: unknown }).err)
            : "Bank details update failed";
        throw new Error(errMsg);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businessBankDetails"] });
      queryClient.invalidateQueries({ queryKey: ["businessProfileInfo"] });
    },
  });
}

// ─── Saved Recipient Info (localStorage per-device) ─────────────────────────

const DEVICE_ID_KEY = "delivery_device_id";
function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getCustomerStorageKey(): string {
  return `delivery_customer_${getDeviceId()}`;
}

export function useSavedRecipientInfo() {
  return useQuery<SavedRecipientInfo | null>({
    queryKey: ["savedRecipientInfo", getDeviceId()],
    queryFn: () => {
      const raw = localStorage.getItem(getCustomerStorageKey());
      if (!raw) return null;
      try {
        return JSON.parse(raw) as SavedRecipientInfo;
      } catch {
        return null;
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSaveRecipientInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      recipientName,
      recipientPhone,
      locationName,
    }: {
      recipientName: string;
      recipientPhone: string;
      locationName: string;
    }) => {
      const data: SavedRecipientInfo = {
        recipientName,
        recipientPhone,
        locationName,
      };
      localStorage.setItem(getCustomerStorageKey(), JSON.stringify(data));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["savedRecipientInfo", getDeviceId()],
      });
    },
  });
}

export function useUpdateRestaurantLocation() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      coordinateLatitude,
      coordinateLongitude,
      deliveryRadiusKm,
      address,
    }: {
      restaurantId: RestaurantId;
      coordinateLatitude?: number;
      coordinateLongitude?: number;
      deliveryRadiusKm?: bigint;
      address?: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateRestaurantLocation(restaurantId, {
        coordinateLatitude,
        coordinateLongitude,
        deliveryRadiusKm,
        address,
      });
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["restaurant", restaurantId.toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["myRestaurants"] });
      queryClient.invalidateQueries({ queryKey: ["publicRestaurants"] });
    },
  });
}

// ─── Delivery Order Approval ────────────────────────────────────────────────

export function useApproveDeliveryOrder() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      restaurantId: _restaurantId,
    }: { orderId: bigint; restaurantId: bigint }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateOrderStatus(orderId, "Pending" as OrderStatus);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
      queryClient.invalidateQueries({ queryKey: ["enterpriseDeliveryOrders"] });
    },
  });
}

export function useRejectDeliveryOrder() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      _reason,
    }: { orderId: bigint; restaurantId: bigint; _reason: string }) => {
      if (!actor) throw new Error("Actor not ready");
      // Mark as Completed to remove from active delivery queues
      return actor.updateOrderStatus(orderId, "Completed" as OrderStatus);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
      queryClient.invalidateQueries({ queryKey: ["enterpriseDeliveryOrders"] });
    },
  });
}

export function formatPrice(price: bigint): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(price));
}

// Helper to convert order items from CartItem format to backend OrderItem
export function cartItemToOrderItem(
  item: import("../types").CartItem,
): OrderItem {
  return {
    menuItemId: item.menuItemId,
    name: item.name,
    price: item.price,
    quantity: BigInt(item.quantity),
    itemNote: item.itemNote,
    unit: item.unit,
  };
}

export function useUpdateAutoPaymentConfirmationSettings() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      restaurantId: bigint;
      enabled: boolean;
      app: AutoPaymentApp;
    }) => {
      if (!actor) throw new Error("Not connected");
      return await actor.updateAutoPaymentConfirmationSettings(
        params.restaurantId,
        params.enabled,
        params.app,
      );
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["restaurant", restaurantId.toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["myRestaurants"] });
    },
  });
}

export function useBookShipper() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      restaurantId,
    }: { orderId: bigint; restaurantId: bigint }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.bookShipper(orderId, restaurantId);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
      queryClient.invalidateQueries({ queryKey: ["enterpriseDeliveryOrders"] });
    },
  });
}

export function useGetDispatchCenterOrders() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["dispatchCenterOrders"],
    queryFn: async () => {
      if (!actor) return [];
      const result = await actor.getDispatchCenterOrders();
      if (result.__kind__ === "err") throw new Error("Unauthorized");
      return result.ok;
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10_000,
  });
}

export function useGetCodDispatchOrders() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["codDispatchOrders"],
    queryFn: async () => {
      if (!actor) return [];
      const result = await actor.getCodDispatchOrders();
      if (result.__kind__ === "err") throw new Error("Unauthorized");
      return result.ok;
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10_000,
  });
}

export function useCreateCodOrder() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: import("../backend").CodOrderRequest) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.createCodOrder(request);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatchCenterOrders"] });
      queryClient.invalidateQueries({ queryKey: ["codDispatchOrders"] });
      queryClient.invalidateQueries({ queryKey: ["enterpriseDeliveryOrders"] });
    },
  });
}

export function useBookDriverForCodOrder() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.bookDriverForCodOrder(orderId);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
      queryClient.invalidateQueries({ queryKey: ["enterpriseDeliveryOrders"] });
    },
  });
}

export function useReissueBkavInvoice() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.reissueBkavInvoice(orderId);
      if (result?.startsWith("Error:")) {
        throw new Error(result);
      }
      return result;
    },
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({
        queryKey: ["invoiceInfo", orderId.toString()],
      });
    },
  });
}

// ─── Device Management ───────────────────────────────────────────────────────

export function useListDevices(restaurantId: bigint | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<Array<import("@/backend").DeviceRecordPublic>>({
    queryKey: ["devices", restaurantId?.toString()],
    queryFn: async () => {
      if (!actor || restaurantId === null) return [];
      const result = await actor.listDevices(restaurantId);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok ?? result[0] ?? [];
    },
    enabled: !!actor && !isFetching && restaurantId !== null,
    refetchInterval: 10_000,
  });
}

export function useRegisterDevice() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      role,
      deviceName,
    }: {
      restaurantId: bigint;
      role: import("@/backend").StaffRole;
      deviceName: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.registerDevice(restaurantId, role, deviceName);
      // Guard: handle both runtime-trap propagation and unexpected missing fields
      if (!result)
        throw new Error(
          "Đăng ký thiết bị thất bại: không có phản hồi từ backend",
        );
      // Handle Result variant at runtime in case backend returns err variant
      const r = result as unknown as {
        __kind__?: string;
        err?: string;
        ok?: { activationCode: string; deviceId: string };
      };
      if (r.__kind__ === "err")
        throw new Error(r.err ?? "Đăng ký thiết bị thất bại");
      if (r.__kind__ === "ok" && r.ok) return r.ok;
      // Direct success object (expected shape)
      const direct = result as unknown as {
        activationCode: string;
        deviceId: string;
      };
      if (!direct.activationCode)
        throw new Error(
          "Đăng ký thiết bị thất bại: thiết bị có thể đã có vai trò hoặc đã đạt giới hạn",
        );
      return direct;
    },
    onSuccess: async (_data, { restaurantId }) => {
      await queryClient.refetchQueries({
        queryKey: ["devices", restaurantId.toString()],
      });
    },
  });
}

export function useRevokeDevice() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      deviceId,
      restaurantId: _restaurantId,
    }: {
      deviceId: string;
      restaurantId: bigint;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.revokeDevice(deviceId);
      const r = result as unknown as {
        __kind__?: string;
        err?: string;
        ok?: unknown;
      };
      if (r.__kind__ === "err")
        throw new Error(r.err ?? "Thu hồi thiết bị thất bại");
      return r.ok;
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.refetchQueries({
        queryKey: ["devices", restaurantId.toString()],
      });
      queryClient.refetchQueries({ queryKey: ["devices"] });
    },
  });
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export interface InvoiceInfo {
  invoiceStatus: "NotRequested" | "Pending" | "Issued" | "Error";
  invoiceNo?: string;
  invoiceDate?: string;
  invoicePdfUrl?: string;
  vatRequest: boolean;
}

// ─── Seller Info (taxCode, phone) ────────────────────────────────────────────

export interface SellerInfo {
  taxCode: string | null;
  phone: string | null;
}

export function useGetSellerInfo() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<SellerInfo>({
    queryKey: ["sellerInfo"],
    queryFn: async () => {
      if (!actor) return { taxCode: null, phone: null };
      try {
        const a = actor as unknown as {
          getSellerInfo?: () => Promise<{
            taxCode?: string | null;
            phone?: string | null;
          } | null>;
        };
        if (typeof a.getSellerInfo !== "function") {
          return { taxCode: null, phone: null };
        }
        const result = await a.getSellerInfo();
        if (!result) return { taxCode: null, phone: null };
        const r = Array.isArray(result) ? result[0] : result;
        return {
          taxCode: r?.taxCode ?? null,
          phone: r?.phone ?? null,
        };
      } catch {
        return { taxCode: null, phone: null };
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000,
  });
}

export function useGetInvoiceInfo(orderId: bigint | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<InvoiceInfo | null>({
    queryKey: ["invoiceInfo", orderId?.toString()],
    queryFn: async () => {
      if (!actor || orderId === null) return null;
      const result = await actor.getInvoiceInfo(orderId);
      if (result.__kind__ === "err") throw new Error("Không có quyền truy cập");
      const raw = result.ok;
      if (!raw) {
        return {
          invoiceStatus: "NotRequested",
          vatRequest: false,
        };
      }
      // Map backend string status to the InvoiceInfo union the UI expects.
      const status = raw.invoiceStatus;
      const mappedStatus: InvoiceInfo["invoiceStatus"] =
        status === "Pending"
          ? "Pending"
          : status === "Issued"
            ? "Issued"
            : status === "Error"
              ? "Error"
              : "NotRequested";
      return {
        invoiceStatus: mappedStatus,
        invoiceNo: raw.invoiceNo,
        invoiceDate: raw.invoiceDate,
        vatRequest: mappedStatus !== "NotRequested",
      };
    },
    enabled: !!actor && !isFetching && orderId !== null,
    refetchInterval: 3_000,
  });
}

export function useReissueInvoice() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as {
        reissueInvoice: (id: bigint) => Promise<unknown>;
      };
      const result = await a.reissueInvoice(orderId);
      if (
        result &&
        typeof result === "object" &&
        "__kind__" in result &&
        (result as { __kind__: string }).__kind__ === "err"
      ) {
        const errMsg = (result as unknown as { err: string }).err;
        throw new Error(errMsg);
      }
      return result;
    },
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({
        queryKey: ["invoiceInfo", orderId.toString()],
      });
    },
  });
}

// ─── Enterprise Management ───────────────────────────────────────────────────

export function useListEnterpriseStaff() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<Array<EnterpriseStaffPermissions>>({
    queryKey: ["enterpriseStaff"],
    queryFn: async () => {
      if (!actor) return [];
      const result = await actor.listEnterpriseStaff();
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetMyEnterprisePermissions() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<Array<EnterprisePermission>>({
    queryKey: ["myEnterprisePermissions"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMyEnterprisePermissions();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useListEnterpriseDevices() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<Array<EnterpriseDeviceRecord>>({
    queryKey: ["enterpriseDevices"],
    queryFn: async () => {
      if (!actor) return [];
      const result = await actor.listEnterpriseDevices();
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddEnterpriseStaff() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (principalId: Principal) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.addEnterpriseStaff(principalId);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterpriseStaff"] });
    },
  });
}

export function useRemoveEnterpriseStaff() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (principalId: Principal) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.removeEnterpriseStaff(principalId);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterpriseStaff"] });
    },
  });
}

export function useGrantEnterprisePermission() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      principalId,
      permission,
    }: {
      principalId: Principal;
      permission: EnterprisePermission;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.grantEnterprisePermission(
        principalId,
        permission,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterpriseStaff"] });
    },
  });
}

export function useRevokeEnterprisePermission() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      principalId,
      permission,
    }: {
      principalId: Principal;
      permission: EnterprisePermission;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.revokeEnterprisePermission(
        principalId,
        permission,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterpriseStaff"] });
    },
  });
}

export function useRegisterEnterpriseDevice() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      role,
      deviceName,
    }: {
      role: EnterpriseDeviceRole;
      deviceName: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.registerEnterpriseDevice(role, deviceName);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["enterpriseDevices"] });
    },
  });
}

export function useRevokeEnterpriseDevice() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deviceId: string) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.revokeEnterpriseDevice(deviceId);
      const r = result as unknown as {
        __kind__?: string;
        err?: string;
        ok?: unknown;
      };
      if (r.__kind__ === "err")
        throw new Error(r.err ?? "Thu hồi thiết bị thất bại");
      return r.ok;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["enterpriseDevices"] });
    },
  });
}

export function useActivateEnterpriseDevice() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async ({
      activationCode,
      intendedRole,
    }: {
      activationCode: string;
      intendedRole: EnterpriseDeviceRole;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.activateEnterpriseDevice(
        activationCode,
        intendedRole,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
  });
}

// ─── Master Menu ─────────────────────────────────────────────────────────────

export function useListMasterMenuItems() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["masterMenuItems"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listMasterMenuItems();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useListMasterCategories() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["masterCategories"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listMasterCategories();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateMasterMenuItem() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      req: Parameters<NonNullable<typeof actor>["createMasterMenuItem"]>[0],
    ) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createMasterMenuItem(req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masterMenuItems"] });
    },
  });
}

export function useUpdateMasterMenuItem() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      req,
    }: {
      id: bigint;
      req: Parameters<NonNullable<typeof actor>["updateMasterMenuItem"]>[1];
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateMasterMenuItem(id, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masterMenuItems"] });
    },
  });
}

export function useDeleteMasterMenuItem() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteMasterMenuItem(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masterMenuItems"] });
    },
  });
}

export function useSetMasterMenuItemActive() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      isActive,
    }: {
      id: bigint;
      isActive: boolean;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.setMasterMenuItemActive(id, isActive);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masterMenuItems"] });
    },
  });
}

export function useCreateMasterCategory() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      req: Parameters<NonNullable<typeof actor>["createMasterCategory"]>[0],
    ) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createMasterCategory(req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masterCategories"] });
    },
  });
}

export function useUpdateMasterCategory() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      req,
    }: {
      id: bigint;
      req: Parameters<NonNullable<typeof actor>["updateMasterCategory"]>[1];
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateMasterCategory(id, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masterCategories"] });
    },
  });
}

export function useDeleteMasterCategory() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteMasterCategory(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masterCategories"] });
      queryClient.invalidateQueries({ queryKey: ["masterMenuItems"] });
    },
  });
}

export function useSetRestaurantItemOverride() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      masterItemId,
      isAvailable,
    }: {
      restaurantId: bigint;
      masterItemId: bigint;
      isAvailable: boolean;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.setRestaurantItemOverride(
        restaurantId,
        masterItemId,
        isAvailable,
      );
    },
    onSuccess: (_data, { restaurantId }) => {
      queryClient.invalidateQueries({
        queryKey: ["restaurantOverrides", restaurantId.toString()],
      });
    },
  });
}

export function useGetRestaurantOverrides(
  restaurantId: bigint | null | undefined,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["restaurantOverrides", restaurantId?.toString()],
    queryFn: async () => {
      if (!actor || restaurantId === null || restaurantId === undefined)
        return [];
      return actor.getRestaurantOverrides(restaurantId);
    },
    enabled:
      !!actor &&
      !isFetching &&
      restaurantId !== null &&
      restaurantId !== undefined,
  });
}

export function useGenerateInvoiceCallbackSecret() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.generateInvoiceCallbackSecret();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoiceCallbackSecret"] });
    },
  });
}

export function useGetInvoiceCallbackSecret() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["invoiceCallbackSecret"],
    queryFn: async () => {
      if (!actor) return null;
      const result = await actor.getInvoiceCallbackSecret("");
      return result && typeof result === "string" && result.length > 0
        ? result
        : null;
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── AhaMove ─────────────────────────────────────────────────────────────────

export function useEstimateShippingFee() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async ({
      restaurantId,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
    }: {
      restaurantId: string;
      dropoffAddress: string;
      dropoffLat?: number;
      dropoffLng?: number;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const restaurant = await actor.getRestaurant(BigInt(restaurantId));
      if (!restaurant) throw new Error("Restaurant not found");
      const path = [
        {
          lat: Number(restaurant.coordinateLatitude ?? 0),
          lng: Number(restaurant.coordinateLongitude ?? 0),
          address: restaurant.address ?? "",
          name: restaurant.name ?? "Nhà hàng",
          mobile: "0914658365",
        },
        {
          lat: dropoffLat ?? 0,
          lng: dropoffLng ?? 0,
          address: dropoffAddress,
          name: "Khách",
          mobile: "0900000000",
        },
      ];
      const res = await fetch(
        "https://proxy.bunbohue65.vn/ahamove-estimate-public",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path,
            serviceId: "HAN-BIKE",
            payment_method: "CASH_BY_RECIPIENT",
          }),
        },
      );
      if (!res.ok) {
        throw new Error(
          "Không thể kết nối đến dịch vụ vận chuyển — vui lòng thử lại sau vài giây",
        );
      }
      const data = await res.json();
      // The VPS proxy always returns HTTP 200, even on failure. A failed
      // estimate is signalled by an `error` field and/or the absence of a
      // numeric `total_price`. Throw so React Query surfaces the error and the
      // consumer page can show its existing error / recalculate fallback UI
      // instead of silently yielding a 0 fee.
      if (
        typeof data === "object" &&
        data !== null &&
        typeof data.error === "string" &&
        data.error.length > 0
      ) {
        throw new Error(data.error);
      }
      const totalPrice = data?.total_price;
      if (
        totalPrice === undefined ||
        totalPrice === null ||
        typeof totalPrice !== "number" ||
        Number.isNaN(totalPrice)
      ) {
        throw new Error(
          "Không nhận được phí vận chuyển từ nhà cung cấp — vui lòng thử lại",
        );
      }
      return {
        shippingFee: BigInt(totalPrice),
        distanceKm: Number(data.distance ?? 0),
        isFallback: false,
      };
    },
    retry: 3,
    retryDelay: 2000,
  });
}

export function useBookAhamoveShipper() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!actor) throw new Error("Actor not ready");
      const resp = await fetch("https://proxy.bunbohue65.vn/ahamove-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!resp.ok) {
        throw new Error(
          "Không thể kết nối đến dịch vụ vận chuyển — vui lòng thử lại sau vài giây",
        );
      }
      const data = (await resp.json()) as {
        order_id: string;
        total_price: number;
        status: string;
        error?: string;
      };
      if (typeof data.error === "string" && data.error.length > 0) {
        throw new Error(data.error);
      }
      const totalPrice = data.total_price;
      if (
        totalPrice === undefined ||
        totalPrice === null ||
        typeof totalPrice !== "number" ||
        Number.isNaN(totalPrice)
      ) {
        throw new Error(
          "Không nhận được phí vận chuyển từ nhà cung cấp — vui lòng thử lại",
        );
      }
      const confirmResult = await actor.confirmAhamoveBooking(
        BigInt(orderId),
        data.order_id,
        BigInt(Math.round(totalPrice)),
        data.status,
      );
      if (confirmResult.__kind__ === "err") throw new Error(confirmResult.err);
      return {
        ahamoveOrderId: data.order_id,
        status: data.status,
        fare: BigInt(Math.round(totalPrice)),
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
      queryClient.invalidateQueries({ queryKey: ["enterpriseDeliveryOrders"] });
    },
  });
}

// Books an AhaMove courier directly from the frontend via the VPS proxy
// (https://proxy.bunbohue65.vn/ahamove-book), then confirms the booking on the
// backend canister with actor.confirmAhamoveBooking. Mirrors the path-building
// and error-detection logic of useEstimateShippingFee, and the __kind__ unwrap
// + invalidation pattern of useBookDriverForCodOrder. OrderPublic has no
// deliveryLat/deliveryLng fields, so dropoff coordinates default to 0 (matching
// the ?? 0 fallback used for the pickup side).
export function useBookAhamoveDirect() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      const order = await actor.getOrder(orderId);
      if (!order) throw new Error("Không tìm thấy đơn hàng");
      const restaurant = await actor.getRestaurant(BigInt(order.restaurantId));
      if (!restaurant) throw new Error("Không tìm thấy nhà hàng");

      const path = [
        {
          lat: Number(restaurant.coordinateLatitude ?? 0),
          lng: Number(restaurant.coordinateLongitude ?? 0),
          address: restaurant.address ?? "",
          name: restaurant.name ?? "",
          // RestaurantPublic exposes no phone field; mirror useEstimateShippingFee
          // which hardcodes the restaurant pickup mobile.
          mobile: "0914658365",
        },
        {
          lat: 0,
          lng: 0,
          address: order.deliveryAddress ?? "",
          name: order.customerName ?? "",
          mobile: order.customerPhone ?? "",
        },
      ];

      const res = await fetch("https://proxy.bunbohue65.vn/ahamove-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          serviceId: "HAN-BIKE",
          payment_method: "CASH_BY_RECIPIENT",
          orderId: orderId.toString(),
        }),
      });
      if (!res.ok) {
        throw new Error(
          "Không thể kết nối đến dịch vụ vận chuyển — vui lòng thử lại sau vài giây",
        );
      }
      const data = await res.json();
      // The VPS proxy always returns HTTP 200, even on failure. A failed booking
      // is signalled by an `error` field and/or the absence of a numeric
      // `total_price`. Throw so React Query surfaces the error instead of
      // silently confirming a 0-fare booking on the backend.
      if (
        typeof data === "object" &&
        data !== null &&
        typeof data.error === "string" &&
        data.error.length > 0
      ) {
        throw new Error(data.error);
      }
      const totalPrice = data?.total_price;
      if (
        totalPrice === undefined ||
        totalPrice === null ||
        typeof totalPrice !== "number" ||
        Number.isNaN(totalPrice)
      ) {
        throw new Error(
          "Không nhận được phí vận chuyển từ nhà cung cấp — vui lòng thử lại",
        );
      }

      const confirmResult = await actor.confirmAhamoveBooking(
        orderId,
        data.order_id,
        BigInt(Math.round(totalPrice)),
        data.status,
      );
      if (confirmResult.__kind__ === "err") throw new Error(confirmResult.err);

      return {
        ahamoveOrderId: data.order_id,
        status: data.status,
        fare: BigInt(Math.round(totalPrice)),
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
      queryClient.invalidateQueries({ queryKey: ["enterpriseDeliveryOrders"] });
    },
    retry: 3,
    retryDelay: 2000,
  });
}

export function useSaveAhamoveConfig() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: {
      apiKey: string;
      mobile?: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      // Sandbox đã gỡ — luôn force production mode bất kể giá trị caller truyền.
      const result = await actor.saveAhamoveConfig({
        ...config,
        isTestMode: false,
      });
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ahamoveConfig"] });
    },
  });
}

export function useGetAhamoveConfig() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["ahamoveConfig"],
    queryFn: async () => {
      if (!actor) return null;
      // Sandbox đã gỡ — luôn force production mode bất kể giá trị backend trả.
      const cfg = await actor.getAhamoveConfig();
      return cfg ? { ...cfg, isTestMode: false } : cfg;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUpdateShippingTransferStatus() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: import("@/backend").ShippingTransferStatus;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.updateShippingTransferStatus(orderId, status);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrdersEnterprise"] });
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
    },
  });
}

export function useRetryBookShipper() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.retryBookShipper(orderId);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrdersEnterprise"] });
    },
  });
}

export function useFindNearestRestaurant() {
  const { actor } = useActor(createActor);
  return async (lat: number, lng: number) => {
    if (!actor) throw new Error("Actor not ready");
    return actor.findNearestRestaurant(lat, lng);
  };
}

export function useGetCodSettings() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<{
    isCodAllowed: boolean;
    codLimit: bigint;
  } | null>({
    queryKey: ["codSettings"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getCodSettings();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSetCodSettings() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      settings: { isCodAllowed: boolean; codLimit: bigint } | null,
    ) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.setCodSettings(settings);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["codSettings"] });
    },
  });
}

// ─── COD Payments ────────────────────────────────────────────────────────────

export function useGetPendingCodPayments() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<Array<{
    orderTotal: bigint;
    shippingFee: bigint;
    orderCode: string;
  }> | null>({
    queryKey: ["pendingCodPayments"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getPendingCodPayments();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5000,
  });
}

// ─── AhaMove Order Status ────────────────────────────────────────────────────

/**
 * STAFF ONLY — use useGetOrderForTracking for customer-facing tracking.
 * This hook calls the staff-gated getAhamoveOrderStatus endpoint and must
 * not be used for anonymous customer tracking views.
 */
export function useGetAhamoveOrderStatus(orderId: bigint | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["ahamoveOrderStatus", orderId?.toString()],
    queryFn: async () => {
      if (!orderId) throw new Error("No orderId");
      if (!actor) throw new Error("Actor not ready");
      return actor.getAhamoveOrderStatus(orderId);
    },
    refetchInterval: 30000,
    enabled: !!actor && !isFetching && !!orderId,
  });
}

// ─── Customer: Order Tracking (tokenless) ────────────────────────────────────

export function useGetOrderForTracking(
  orderId: bigint | undefined,
  refetchIntervalMs = 30_000,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<OrderTrackingPublic | null>({
    queryKey: ["orderForTracking", orderId?.toString()],
    queryFn: async () => {
      if (!orderId) return null;
      if (!actor) return null;
      const result = await actor.getOrderForTracking(BigInt(orderId));
      if (!result) return null;
      const r = result as unknown as {
        orderId: bigint;
        status?: { __kind__: string } | string;
        shippingStatus?: { __kind__: string } | string | null;
        shipperName?: string | null;
        shipperPhone?: string | null;
        driverInfo?: unknown;
        deliveryLat?: number | null;
        deliveryLng?: number | null;
        paymentStatus?: { __kind__: string } | string | null;
      };
      return {
        orderId: r.orderId,
        orderStatus:
          typeof r.status === "string"
            ? r.status
            : (r.status?.__kind__ ?? "unknown"),
        shippingStatus:
          typeof r.shippingStatus === "string"
            ? r.shippingStatus
            : (r.shippingStatus?.__kind__ ?? ""),
        shipperName: r.shipperName ?? null,
        shipperPhone: r.shipperPhone ?? null,
        driverInfo:
          (r.driverInfo as { lat: number; lng: number } | null) ?? null,
        deliveryLat: r.deliveryLat ?? null,
        deliveryLng: r.deliveryLng ?? null,
        invoiceInfo: undefined,
        paymentStatus:
          typeof r.paymentStatus === "string"
            ? r.paymentStatus
            : (r.paymentStatus?.__kind__ ?? undefined),
      } as OrderTrackingPublic;
    },
    enabled: !!actor && !isFetching && !!orderId,
    refetchInterval: refetchIntervalMs,
  });
}

// ─── Worker (bkav/tingee/ahamove) ─────────────────────────────────────────────

export function useGetWorkerStatus() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["workerStatus"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getWorkerStatus();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10_000,
  });
}

export function useGetRetryPolicy() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["retryPolicy"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getRetryPolicy();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSetRetryPolicy() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      maxRetries: bigint;
      baseDelayMs: bigint;
      maxDelayMs: bigint;
      backoffMultiplier: number;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.setRetryPolicy(
        v.maxRetries,
        v.baseDelayMs,
        v.maxDelayMs,
        v.backoffMultiplier,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retryPolicy"] });
      queryClient.invalidateQueries({ queryKey: ["workerStatus"] });
      toast.success("Đã lưu retry policy");
    },
    onError: (e) => toast.error(`Lưu retry policy thất bại: ${String(e)}`),
  });
}

export function useGetBkavConfig() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<{ workerPrincipal: string } | null>({
    queryKey: ["bkavConfig"],
    queryFn: async () => {
      if (!actor) return null;
      // getInvoiceWorkerConfig returns the full BKAV config including
      // workerPrincipal (owner OR workerPrincipal auth). We only surface
      // workerPrincipal here — the rest of the BKAV config is managed
      // elsewhere (BusinessProfilePage invoice tab).
      const cfg = await actor.getInvoiceWorkerConfig();
      return { workerPrincipal: cfg.workerPrincipal ?? "" };
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000,
  });
}

export function useSaveBkavCommonConfig() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { workerPrincipal: string | null }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.saveBkavCommonConfig(
        "",
        "",
        "",
        false,
        BigInt(0),
        v.workerPrincipal,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bkavConfig"] });
      queryClient.invalidateQueries({ queryKey: ["businessProfileInfo"] });
      toast.success("Đã lưu worker principal");
    },
    onError: (e) => toast.error(`Lưu worker principal thất bại: ${String(e)}`),
  });
}

export function usePostWorkerHeartbeat() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workerId: string) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.postWorkerHeartbeat(workerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workerStatus"] });
    },
  });
}
