import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import type { TrackItem as TrackItemType } from "../../types";
import { formatDuration } from "../../types";
import { useEffect, useRef } from "react";

interface TrackItemProps {
  track: TrackItemType;
  index: number;
  onRemove: () => void;
}

export function TrackItem({ track, index, onRemove }: TrackItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  // Draw a mini waveform based on track title hash (visual representation)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 80 * dpr;
    canvas.height = 24 * dpr;
    ctx.scale(dpr, dpr);

    // Generate pseudo-random waveform based on track ID
    const seed = hashCode(track.id);
    const bars = 32;
    const barWidth = 80 / bars;
    const centerY = 12;

    ctx.clearRect(0, 0, 80, 24);

    for (let i = 0; i < bars; i++) {
      const rng = seededRandom(seed + i);
      const height = 3 + rng * 18;
      const halfH = height / 2;

      const gradient = ctx.createLinearGradient(0, centerY - halfH, 0, centerY + halfH);
      gradient.addColorStop(0, "rgba(139, 92, 246, 0.8)");
      gradient.addColorStop(1, "rgba(139, 92, 246, 0.2)");
      ctx.fillStyle = gradient;

      ctx.fillRect(
        i * barWidth + 0.5,
        centerY - halfH,
        barWidth - 1,
        height
      );
    }
  }, [track.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`track-item group ${isDragging ? "dragging" : ""}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
      >
        <GripVertical size={16} />
      </div>

      {/* Track Number */}
      <span className="track-number">{index + 1}</span>

      {/* Track Info */}
      <div className="track-info">
        <div className="track-title">{track.title}</div>
        <div className="track-meta">
          <span>{track.format}</span>
        </div>
      </div>

      {/* Mini Waveform */}
      <div className="track-waveform">
        <canvas
          ref={canvasRef}
          width={80}
          height={24}
          style={{ width: 80, height: 24 }}
        />
      </div>

      {/* Duration */}
      <span className="track-duration">{formatDuration(track.duration)}</span>

      {/* Remove Button */}
      <button
        className="btn btn-icon btn-ghost btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove track"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// Utility: simple hash code from string
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Utility: seeded random (0..1)
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
