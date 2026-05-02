import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ImagePlus, X, Image as ImageIcon } from "lucide-react";
import { useProjectStore } from "../../store/useProjectStore";
import { readImageBase64 } from "../../lib/tauri";

export function ImagePicker() {
  const { backgroundImage, setBackgroundImage } = useProjectStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch the image as Base64 to bypass any Tauri v2 file scope restrictions
  useEffect(() => {
    if (!backgroundImage) {
      setPreviewUrl(null);
      return;
    }
    let isMounted = true;
    readImageBase64(backgroundImage)
      .then((b64) => {
        if (isMounted) setPreviewUrl(b64);
      })
      .catch((err) => {
        console.error("Failed to load image preview:", err);
        if (isMounted) setPreviewUrl(null);
      });
    return () => {
      isMounted = false;
    };
  }, [backgroundImage]);

  const handleSelectImage = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        title: "Select Background Image",
        filters: [
          {
            name: "Images",
            extensions: ["jpg", "jpeg", "png", "bmp", "webp"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setBackgroundImage(selected);
      }
    } catch (err) {
      console.error("Image picker error:", err);
    }
  }, [setBackgroundImage]);

  const handleClear = useCallback(() => {
    setBackgroundImage(null);
  }, [setBackgroundImage]);

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ImageIcon size={14} className="text-[var(--color-accent)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Background Image
        </span>
      </div>

      {/* Preview / Picker */}
      {backgroundImage ? (
        <div className="relative group">
          <div
            className="w-full aspect-video rounded-xl overflow-hidden border-2 border-[var(--color-border)] bg-[var(--color-surface-0)] flex items-center justify-center"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Background"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.innerHTML = `
                    <div class="flex flex-col items-center gap-2 text-[var(--color-text-muted)]">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <span class="text-xs">Image selected</span>
                    </div>
                  `;
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-[var(--color-text-muted)]">
                <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Loading preview...</span>
              </div>
            )}
          </div>

          {/* Clear button */}
          <button
            className="absolute top-2 right-2 btn btn-icon btn-danger btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleClear}
            title="Remove image"
          >
            <X size={14} />
          </button>

          {/* File path */}
          <p className="text-[10px] text-[var(--color-text-muted)] mt-2 truncate">
            {backgroundImage.split(/[/\\]/).pop()}
          </p>
        </div>
      ) : (
        <button
          className="w-full aspect-video rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] bg-[var(--color-surface-0)] flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer"
          onClick={handleSelectImage}
        >
          <ImagePlus
            size={32}
            strokeWidth={1.5}
            className="text-[var(--color-text-muted)]"
          />
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Select Background
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              JPG, PNG, WebP • Used as video background
            </p>
          </div>
        </button>
      )}

      {/* Info box */}
      <div className="bg-[var(--color-surface-0)] rounded-lg p-3 border border-[var(--color-border)]">
        <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
          This image will be used as the static video background. It will be automatically scaled to match your chosen output resolution.
        </p>
      </div>
    </div>
  );
}
