// ==========================================
// Core Data Types
// ==========================================

export interface TrackItem {
  id: string;
  title: string;
  path: string;
  duration: number; // seconds
  format: string;   // MP3, WAV, FLAC, etc.
}

export interface RenderSettings {
  resolution: "720p" | "1080p" | "4k";
  encoder: string;          // "h264_nvenc" | "h264_qsv" | "libx264"
  outputFolder: string;
  outputFilename: string;
  backgroundImage: string | null;
  overlayVideo: string | null;
  eqBands: Record<string, number>;
  fastMode: boolean;
  visualizer: "none" | "waveform" | "eq_bars";
}

export type FlarePreset = "none" | "soft" | "hard" | "cinematic";

export interface RenderJob {
  id: string;
  name: string;
  status: RenderJobStatus;
  progress: number;        // 0 to 100
  etaSeconds: number;
  currentTimeMs: number;
  totalDurationMs: number;
  message: string;
  createdAt: number;       // timestamp
  outputFolder?: string;
}

export type RenderJobStatus = "waiting" | "rendering" | "done" | "error" | "cancelled";

export interface RenderProgress {
  job_id: string;
  progress: number;
  status: string;
  eta_seconds: number;
  current_time_ms: number;
  total_duration_ms: number;
  message: string;
}

// ==========================================
// EQ Types
// ==========================================

export const EQ_FREQUENCIES = [
  { key: "60", label: "60Hz" },
  { key: "170", label: "170Hz" },
  { key: "310", label: "310Hz" },
  { key: "600", label: "600Hz" },
  { key: "1000", label: "1kHz" },
  { key: "3000", label: "3kHz" },
  { key: "6000", label: "6kHz" },
  { key: "14000", label: "14kHz" },
] as const;

export type EqPresetName = "flat" | "bass_boost" | "treble_boost" | "lofi" | "warm" | "vocal";

export const EQ_PRESETS: Record<EqPresetName, Record<string, number>> = {
  flat:         { "60": 0, "170": 0, "310": 0, "600": 0, "1000": 0, "3000": 0, "6000": 0, "14000": 0 },
  bass_boost:   { "60": 8, "170": 6, "310": 3, "600": 0, "1000": 0, "3000": 0, "6000": 0, "14000": 0 },
  treble_boost: { "60": 0, "170": 0, "310": 0, "600": 0, "1000": 2, "3000": 5, "6000": 7, "14000": 9 },
  lofi:         { "60": -2, "170": 0, "310": 0, "600": -3, "1000": -1, "3000": -4, "6000": -6, "14000": -8 },
  warm:         { "60": 4, "170": 3, "310": 1, "600": 0, "1000": -1, "3000": -2, "6000": -3, "14000": -4 },
  vocal:        { "60": -3, "170": -1, "310": 0, "600": 2, "1000": 5, "3000": 4, "6000": 2, "14000": 0 },
};

// ==========================================
// GPU Detection
// ==========================================

export interface GpuInfo {
  nvenc: boolean;
  qsv: boolean;
  recommended: string;
}

// ==========================================
// Project Types
// ==========================================

export interface ProjectInfo {
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectData {
  tracks: TrackItem[];
  renderSettings: Omit<RenderSettings, "eqBands">;
  eqBands: Record<string, number>;
  backgroundImage: string | null;
  overlayVideo: string | null;
}

// ==========================================
// Utility
// ==========================================

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatEta(seconds: number): string {
  if (seconds <= 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
