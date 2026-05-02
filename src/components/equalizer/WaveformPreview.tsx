import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, SkipBack } from "lucide-react";
import { useProjectStore } from "../../store/useProjectStore";
import { formatDuration } from "../../types";

export function WaveformPreview() {
  const { tracks } = useProjectStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentTrack = tracks[0]; // Preview first track

  useEffect(() => {
    if (!containerRef.current || !currentTrack) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "rgba(139, 92, 246, 0.4)",
      progressColor: "rgba(139, 92, 246, 0.8)",
      cursorColor: "var(--color-accent)",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 60,
      normalize: true,
      backend: "WebAudio",
    });

    ws.on("timeupdate", (time: number) => setCurrentTime(time));
    ws.on("ready", () => setDuration(ws.getDuration()));
    ws.on("finish", () => setIsPlaying(false));
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));

    // Try to load the track
    try {
      ws.load(currentTrack.path);
    } catch {
      // If direct path doesn't work, show empty waveform
    }

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [currentTrack?.path]);

  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const restart = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(0);
    }
  };

  if (!currentTrack) {
    return (
      <div className="p-4">
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Add tracks to preview waveform
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="text-xs text-[var(--color-text-muted)] mb-2">
        Preview: <span className="text-[var(--color-text-primary)]">{currentTrack.title}</span>
      </div>

      <div
        ref={containerRef}
        className="rounded-lg overflow-hidden bg-[var(--color-surface-0)] border border-[var(--color-border)]"
      />

      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-1">
          <button className="btn btn-icon btn-ghost btn-sm" onClick={restart}>
            <SkipBack size={14} />
          </button>
          <button className="btn btn-icon btn-accent btn-sm" onClick={togglePlay}>
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>
        <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}
