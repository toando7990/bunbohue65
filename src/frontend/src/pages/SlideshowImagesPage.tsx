import { AdminLayout } from "@/Layout";
import { Button } from "@/components/ui/button";
import {
  useDeleteBackgroundImage,
  useListBackgroundImages,
  useUploadBackgroundImage,
} from "@/hooks/useBackend";
import { Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

export default function SlideshowImagesPage() {
  const { data: images = [], isLoading } = useListBackgroundImages();
  const uploadMutation = useUploadBackgroundImage();
  const deleteMutation = useDeleteBackgroundImage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Upload via object-storage extension: POST to /api/storage/upload
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([bytes], { type: file.type }),
        file.name,
      );
      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = (await res.json()) as { url: string };
      const result = await uploadMutation.mutateAsync({
        url,
        fileName: file.name,
      });
      if (result.__kind__ === "err") throw new Error(result.err);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: bigint) => {
    setError(null);
    try {
      const result = await deleteMutation.mutateAsync(id);
      if (result.__kind__ === "err") throw new Error(result.err);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <AdminLayout>
      <div
        className="max-w-3xl mx-auto space-y-6"
        data-ocid="slideshow_images.page"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">
            Ảnh nền slideshow
          </h1>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              data-ocid="slideshow_images.upload_button"
            />
            <Button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              data-ocid="slideshow_images.upload_button"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Đang tải..." : "Thêm ảnh"}
            </Button>
          </div>
        </div>

        {error && (
          <p
            className="text-sm text-destructive"
            data-ocid="slideshow_images.error_state"
          >
            {error}
          </p>
        )}

        {isLoading ? (
          <p
            className="text-sm text-muted-foreground"
            data-ocid="slideshow_images.loading_state"
          >
            Đang tải...
          </p>
        ) : images.length === 0 ? (
          <div
            className="border border-dashed border-border rounded-xl p-12 flex flex-col items-center gap-3 text-muted-foreground"
            data-ocid="slideshow_images.empty_state"
          >
            <p className="text-sm">
              Chưa có ảnh nào. Nhấn "Thêm ảnh" để tải lên.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img, i) => (
              <div
                key={String(img.id)}
                className="relative group rounded-xl overflow-hidden border border-border bg-muted"
                data-ocid={`slideshow_images.item.${i + 1}`}
              >
                <img
                  src={img.url}
                  alt={img.fileName}
                  className="w-full aspect-video object-cover"
                />
                <div className="p-2">
                  <p className="text-xs text-muted-foreground truncate">
                    {img.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(
                      Number(img.uploadedAt) / 1_000_000,
                    ).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <button
                  type="button"
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(img.id)}
                  aria-label="Xóa ảnh"
                  data-ocid={`slideshow_images.delete_button.${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Live preview */}
        {images.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-foreground">Xem trước</h2>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
              <SlideshowPreview images={images.map((i) => i.url)} />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function SlideshowPreview({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);

  // Simple auto-advance
  useState(() => {
    const interval = setInterval(() => {
      setIdx((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  });

  return (
    <>
      {images.map((url, i) => (
        <img
          key={url}
          src={url}
          alt="preview"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            i === idx ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </>
  );
}
