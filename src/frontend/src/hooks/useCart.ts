import { create } from "zustand";
import type { CartItem } from "../types";

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (menuItemId: bigint) => void;
  updateQuantity: (menuItemId: bigint, quantity: number) => void;
  updateNote: (menuItemId: bigint, note: string) => void;
  restaurantId: bigint | null;
  setRestaurantId: (id: bigint | null) => void;
  clearCart: () => void;
  total: () => bigint;
}

export const useCart = create<CartStore>((set, get) => ({
  items: [],

  restaurantId: null,

  addItem: (incoming) => {
    const qty = incoming.quantity ?? 1;
    set((state) => {
      const existing = state.items.find(
        (i) => i.menuItemId === incoming.menuItemId,
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.menuItemId === incoming.menuItemId
              ? { ...i, quantity: i.quantity + qty }
              : i,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            menuItemId: incoming.menuItemId,
            name: incoming.name,
            price: incoming.price,
            quantity: qty,
            itemNote: incoming.itemNote,
            unit: incoming.unit,
          },
        ],
      };
    });
  },

  removeItem: (menuItemId) =>
    set((state) => ({
      items: state.items.filter((i) => i.menuItemId !== menuItemId),
    })),

  updateQuantity: (menuItemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(menuItemId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItemId === menuItemId ? { ...i, quantity } : i,
      ),
    }));
  },

  updateNote: (menuItemId, note) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItemId === menuItemId ? { ...i, itemNote: note } : i,
      ),
    })),

  setRestaurantId: (id) => set({ restaurantId: id }),

  clearCart: () => set({ items: [], restaurantId: null }),

  total: () =>
    get().items.reduce(
      (sum, item) => sum + item.price * BigInt(item.quantity),
      0n,
    ),
}));
