import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Film, X, Video } from "lucide-react";
import { useProjectStore } from "../../store/useProjectStore";

export function OverlayVideoPicker() {
  const { overlayVideo, setOverlayVideo } = useProjectStore();

  const handleSelectVideo = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        title: "Select Video Overlay",
        filters: [
          {
            name: "Videos",
            extensions: ["mp4", "mov", "webm", "mkv", "avi"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setOverlayVideo(selected);
      }
    } catch (err) {
      console.error("Video picker error:", err);
    }
  }, [setOverlayVideo]);

  const handleClear = useCallback(() => {
    setOverlayVideo(null);
  }, [setOverlayVideo]);

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Video size={14} className="text-[var(--color-accent)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Video Overlay
        </span>
      </div>

      {/* Preview / Picker */}
      {overlayVideo ? (
        <div className="relative group">
          <div className="w-full aspect-video rounded-xl overflow-hidden border-2 border-[var(--color-border)] bg-[var(--color-surface-0)] flex flex-col items-center justify-center gap-2">
            <Film size={32} className="text-[var(--color-accent)]" />
            <span className="text-xs text-[var(--color-text-secondary)] font-medium">Video Selected</span>
          </div>

          {/* Clear button */}
          <button
            className="absolute top-2 right-2 btn btn-icon btn-danger btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleClear}
            title="Remove overlay"
          >
            <X size={14} />
          </button>

          {/* File path */}
          <p className="text-[10px] text-[var(--color-text-muted)] mt-2 truncate">
            {overlayVideo.split(/[/\\]/).pop()}
          </p>
        </div>
      ) : (
        <button
          className="w-full aspect-video rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] bg-[var(--color-surface-0)] flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer"
          onClick={handleSelectVideo}
        >
          <Film
            size={32}
            strokeWidth={1.5}
            className="text-[var(--color-text-muted)]"
          />
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Select Overlay Video
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              MP4, MOV • Used as screen-blend looping overlay
            </p>
          </div>
        </button>
      )}

      {/* Info box */}
      <div className="bg-[var(--color-surface-0)] rounded-lg p-3 border border-[var(--color-border)]">
        <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
          The selected video will be set to loop continuously and blended onto the background using "Screen" mode (black colors become transparent).
        </p>
      </div>
    </div>
  );
}
