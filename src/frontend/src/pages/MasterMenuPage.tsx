import { AdminLayout } from "@/Layout";
import type { MasterMenuCategory, MasterMenuItem } from "@/backend";
import {
  useCreateMasterCategory,
  useCreateMasterMenuItem,
  useDeleteMasterCategory,
  useDeleteMasterMenuItem,
  useListMasterCategories,
  useListMasterMenuItems,
  useSetMasterMenuItemActive,
  useUpdateMasterCategory,
  useUpdateMasterMenuItem,
} from "@/hooks/useBackend";
import { useQueryClient } from "@tanstack/react-query";
import { Edit2, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { resizeImage } from "../utils/imageUtils";

export default function MasterMenuPage() {
  const [activeTab, setActiveTab] = useState<"items" | "categories">("items");
  const { data: items = [], isLoading: itemsLoading } =
    useListMasterMenuItems();
  const { data: categories = [], isLoading: catsLoading } =
    useListMasterCategories();
  const createItem = useCreateMasterMenuItem();
  const updateItem = useUpdateMasterMenuItem();
  const deleteItem = useDeleteMasterMenuItem();
  const toggleActive = useSetMasterMenuItemActive();
  const createCat = useCreateMasterCategory();
  const updateCat = useUpdateMasterCategory();
  const deleteCat = useDeleteMasterCategory();
  const qc = useQueryClient();

  const [itemModal, setItemModal] = useState<{
    open: boolean;
    editing?: MasterMenuItem;
  }>({ open: false });
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    price: "",
    unit: "",
    position: "0",
    imageUrl: "",
    isActive: true,
  });
  const [imgResizing, setImgResizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [catModal, setCatModal] = useState<{
    open: boolean;
    editing?: MasterMenuCategory;
  }>({ open: false });
  const [catForm, setCatForm] = useState({ name: "", position: "0" });

  const invalidateItems = () =>
    qc.invalidateQueries({ queryKey: ["masterMenuItems"] });
  const invalidateCats = () =>
    qc.invalidateQueries({ queryKey: ["masterCategories"] });

  const openAddItem = () => {
    setItemForm({
      name: "",
      description: "",
      categoryId: String(categories[0]?.id ?? ""),
      price: "",
      unit: "",
      position: String(items.length),
      imageUrl: "",
      isActive: true,
    });
    setItemModal({ open: true });
  };
  const openEditItem = (item: MasterMenuItem) => {
    setItemForm({
      name: item.name,
      description: item.description,
      categoryId: String(item.categoryId),
      price: String(item.price),
      unit: item.unit ?? "",
      position: String(item.position),
      imageUrl: item.imageUrl ?? "",
      isActive: item.isActive,
    });
    setItemModal({ open: true, editing: item });
  };

  const handleSaveItem = async () => {
    if (
      !itemForm.name.trim() ||
      !itemForm.categoryId ||
      Number(itemForm.price) <= 0
    )
      return;
    const req = {
      name: itemForm.name,
      description: itemForm.description,
      categoryId: BigInt(itemForm.categoryId),
      price: BigInt(Math.round(Number(itemForm.price))),
      unit: itemForm.unit || undefined,
      position: BigInt(Number(itemForm.position) || 0),
      imageUrl: itemForm.imageUrl || undefined,
    };
    if (itemModal.editing) {
      await updateItem.mutateAsync({ id: itemModal.editing.id, req });
    } else {
      await createItem.mutateAsync(req);
    }
    invalidateItems();
    setItemModal({ open: false });
  };

  const handleDeleteItem = async (id: bigint) => {
    if (!window.confirm("Xác nhận xóa món này khỏi thực đơn tổng?")) return;
    await deleteItem.mutateAsync(id);
    invalidateItems();
  };

  const handleToggleActive = async (item: MasterMenuItem) => {
    await toggleActive.mutateAsync({ id: item.id, isActive: !item.isActive });
    invalidateItems();
  };

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) return;
    const req = {
      name: catForm.name,
      position: BigInt(Number(catForm.position) || 0),
    };
    if (catModal.editing) {
      await updateCat.mutateAsync({ id: catModal.editing.id, req });
    } else {
      await createCat.mutateAsync(req);
    }
    invalidateCats();
    invalidateItems();
    setCatModal({ open: false });
  };

  const handleDeleteCat = async (id: bigint) => {
    if (
      !window.confirm(
        "Xác nhận xóa danh mục? Tất cả món trong danh mục này sẽ bị ẩn.",
      )
    )
      return;
    await deleteCat.mutateAsync(id);
    invalidateCats();
    invalidateItems();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgResizing(true);
    try {
      const dataUrl = await resizeImage(file, 800, 800, 0.85);
      setItemForm((f) => ({ ...f, imageUrl: dataUrl }));
    } finally {
      setImgResizing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getCatName = (categoryId: bigint) =>
    categories.find((c) => c.id === categoryId)?.name ?? String(categoryId);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Thực đơn tổng</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quản lý thực đơn chung cho toàn chuỗi Bún Bò Huế 65
          </p>
        </div>

        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setActiveTab("items")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "items" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Thực đơn ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "categories" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Danh mục ({categories.length})
          </button>
        </div>

        {activeTab === "items" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={openAddItem}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" /> Thêm món mới
              </button>
            </div>
            {itemsLoading && (
              <div className="text-center py-8 text-muted-foreground">
                Đang tải...
              </div>
            )}
            {!itemsLoading && items.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="font-medium">Chưa có món nào</p>
                <p className="text-sm mt-1">
                  Bấm "Thêm món mới" để bắt đầu xây dựng thực đơn tổng.
                </p>
              </div>
            )}
            {items.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium w-12">Ảnh</th>
                      <th className="px-3 py-2 font-medium">Tên món</th>
                      <th className="px-3 py-2 font-medium">Danh mục</th>
                      <th className="px-3 py-2 font-medium">Giá</th>
                      <th className="px-3 py-2 font-medium">Đơn vị</th>
                      <th className="px-3 py-2 font-medium">Trạng thái</th>
                      <th className="px-3 py-2 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...items]
                      .sort((a, b) => Number(a.position) - Number(b.position))
                      .map((item) => (
                        <tr
                          key={String(item.id)}
                          className="border-t hover:bg-muted/20"
                        >
                          <td className="px-3 py-2">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-10 h-10 object-cover rounded"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-base">
                                🍽️
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium">{item.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {getCatName(item.categoryId)}
                          </td>
                          <td className="px-3 py-2">
                            {Number(item.price).toLocaleString("vi-VN")} đ
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {item.unit ?? "-"}
                          </td>
                          <td className="px-3 py-2">
                            {item.isActive ? (
                              <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                Đang hiển thị
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                Đã ẩn toàn chuỗi
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditItem(item)}
                                className="p-1 rounded hover:bg-muted"
                                title="Chỉnh sửa"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(item)}
                                className="p-1 rounded hover:bg-muted"
                                title={
                                  item.isActive ? "Ẩn toàn chuỗi" : "Hiện lại"
                                }
                              >
                                {item.isActive ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 rounded hover:bg-muted text-destructive"
                                title="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "categories" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setCatForm({ name: "", position: String(categories.length) });
                  setCatModal({ open: true });
                }}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" /> Thêm danh mục
              </button>
            </div>
            {catsLoading && (
              <div className="text-center py-8 text-muted-foreground">
                Đang tải...
              </div>
            )}
            {!catsLoading && categories.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Chưa có danh mục nào.
              </div>
            )}
            {categories.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Tên danh mục</th>
                      <th className="px-3 py-2 font-medium">Thứ tự</th>
                      <th className="px-3 py-2 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...categories]
                      .sort((a, b) => Number(a.position) - Number(b.position))
                      .map((cat) => (
                        <tr
                          key={String(cat.id)}
                          className="border-t hover:bg-muted/20"
                        >
                          <td className="px-3 py-2 font-medium">{cat.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {String(cat.position)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCatForm({
                                    name: cat.name,
                                    position: String(cat.position),
                                  });
                                  setCatModal({ open: true, editing: cat });
                                }}
                                className="p-1 rounded hover:bg-muted"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCat(cat.id)}
                                className="p-1 rounded hover:bg-muted text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {itemModal.open && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setItemModal({ open: false })}
          onKeyDown={(e) => {
            if (e.key === "Escape") setItemModal({ open: false });
          }}
        >
          <div
            role="presentation"
            className="bg-background rounded-xl shadow-xl max-w-md w-full p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-lg">
              {itemModal.editing ? "Chỉnh sửa món" : "Thêm món mới"}
            </h2>
            <div className="space-y-2">
              <div>
                <label htmlFor="item-name" className="text-xs font-medium">
                  Tên món *
                </label>
                <input
                  id="item-name"
                  className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg"
                  value={itemForm.name}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Tên món ăn"
                />
              </div>
              <div>
                <label
                  htmlFor="item-description"
                  className="text-xs font-medium"
                >
                  Mô tả
                </label>
                <input
                  id="item-description"
                  className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg"
                  value={itemForm.description}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Mô tả ngắn"
                />
              </div>
              <div>
                <label
                  htmlFor="item-image-upload"
                  className="text-xs font-medium"
                >
                  Hình ảnh
                </label>
                <input
                  id="item-image-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <div className="mt-0.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imgResizing}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    {imgResizing ? "Đang xử lý..." : "Chọn ảnh"}
                  </button>
                  {itemForm.imageUrl ? (
                    <div className="relative">
                      <img
                        src={itemForm.imageUrl}
                        alt="Xem trước"
                        className="w-14 h-14 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setItemForm((f) => ({ ...f, imageUrl: "" }))
                        }
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center leading-none"
                        aria-label="Xóa ảnh"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-14 h-14 bg-muted rounded-lg border flex items-center justify-center text-xl">
                      🍽️
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="item-category" className="text-xs font-medium">
                  Danh mục *
                </label>
                <select
                  id="item-category"
                  className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg"
                  value={itemForm.categoryId}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, categoryId: e.target.value }))
                  }
                >
                  {categories.map((c) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="item-price" className="text-xs font-medium">
                    Giá (VND) *
                  </label>
                  <input
                    id="item-price"
                    type="number"
                    min="0"
                    className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg"
                    value={itemForm.price}
                    onChange={(e) =>
                      setItemForm((f) => ({ ...f, price: e.target.value }))
                    }
                    placeholder="45000"
                  />
                </div>
                <div>
                  <label htmlFor="item-unit" className="text-xs font-medium">
                    Đơn vị tính
                  </label>
                  <input
                    id="item-unit"
                    className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg"
                    value={itemForm.unit}
                    onChange={(e) =>
                      setItemForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    placeholder="tô, đĩa, phần"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="item-active"
                  checked={itemForm.isActive}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                <label htmlFor="item-active" className="text-sm">
                  Đang hiển thị trên thực đơn
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemModal({ open: false })}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                disabled={
                  createItem.isPending ||
                  updateItem.isPending ||
                  !itemForm.name.trim() ||
                  !itemForm.categoryId ||
                  Number(itemForm.price) <= 0
                }
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {createItem.isPending || updateItem.isPending
                  ? "Đang lưu..."
                  : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {catModal.open && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setCatModal({ open: false })}
          onKeyDown={(e) => {
            if (e.key === "Escape") setCatModal({ open: false });
          }}
        >
          <div
            role="presentation"
            className="bg-background rounded-xl shadow-xl max-w-sm w-full p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-lg">
              {catModal.editing ? "Chỉnh sửa danh mục" : "Thêm danh mục"}
            </h2>
            <div className="space-y-2">
              <div>
                <label htmlFor="cat-name" className="text-xs font-medium">
                  Tên danh mục *
                </label>
                <input
                  id="cat-name"
                  className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg"
                  value={catForm.name}
                  onChange={(e) =>
                    setCatForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Tên danh mục"
                />
              </div>
              <div>
                <label htmlFor="cat-position" className="text-xs font-medium">
                  Thứ tự
                </label>
                <input
                  id="cat-position"
                  type="number"
                  className="w-full mt-0.5 px-3 py-1.5 text-sm border rounded-lg"
                  value={catForm.position}
                  onChange={(e) =>
                    setCatForm((f) => ({ ...f, position: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCatModal({ open: false })}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveCat}
                disabled={
                  createCat.isPending ||
                  updateCat.isPending ||
                  !catForm.name.trim()
                }
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {createCat.isPending || updateCat.isPending
                  ? "Đang lưu..."
                  : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
