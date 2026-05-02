import { create } from "zustand";
import type {
  TrackItem,
  RenderSettings,
  RenderJob,
  RenderProgress,
  EqPresetName,
} from "../types";
import { EQ_PRESETS } from "../types";

interface ProjectStore {
  // ==========================================
  // Project State
  // ==========================================
  projectName: string;
  isDirty: boolean;
  setProjectName: (name: string) => void;
  markDirty: () => void;
  markClean: () => void;

  // ==========================================
  // Playlist
  // ==========================================
  tracks: TrackItem[];
  addTracks: (tracks: TrackItem[]) => void;
  removeTrack: (id: string) => void;
  reorderTracks: (oldIndex: number, newIndex: number) => void;
  clearTracks: () => void;

  // ==========================================
  // Render Settings
  // ==========================================
  renderSettings: RenderSettings;
  updateRenderSettings: (settings: Partial<RenderSettings>) => void;

  // ==========================================
  // EQ
  // ==========================================
  eqBands: Record<string, number>;
  updateEqBand: (freq: string, db: number) => void;
  applyEqPreset: (preset: EqPresetName) => void;

  // ==========================================
  // Assets
  // ==========================================
  backgroundImage: string | null;
  setBackgroundImage: (path: string | null) => void;
  overlayVideo: string | null;
  setOverlayVideo: (path: string | null) => void;

  // ==========================================
  // Render Queue
  // ==========================================
  renderJobs: RenderJob[];
  addRenderJob: (job: RenderJob) => void;
  updateJobProgress: (jobId: string, progress: RenderProgress) => void;
  removeJob: (jobId: string) => void;
  clearCompletedJobs: () => void;

  // ==========================================
  // Sidebar
  // ==========================================
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // ==========================================
  // Hydrate / Reset
  // ==========================================
  hydrateFromProject: (data: {
    tracks: TrackItem[];
    renderSettings: Partial<RenderSettings>;
    eqBands: Record<string, number>;
    backgroundImage: string | null;
    overlayVideo: string | null;
  }) => void;
  resetProject: () => void;
}

const DEFAULT_EQ: Record<string, number> = {
  "60": 0, "170": 0, "310": 0, "600": 0,
  "1000": 0, "3000": 0, "6000": 0, "14000": 0,
};

const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  resolution: "1080p",
  encoder: "libx264",
  outputFolder: "",
  outputFilename: "output.mp4",
  backgroundImage: null,
  overlayVideo: null,
  eqBands: { ...DEFAULT_EQ },
  fastMode: false,
  visualizer: "none",
};

export const useProjectStore = create<ProjectStore>((set) => ({
  // ==========================================
  // Project State
  // ==========================================
  projectName: "Untitled Project",
  isDirty: false,
  setProjectName: (name) => set({ projectName: name }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  // ==========================================
  // Playlist
  // ==========================================
  tracks: [],
  addTracks: (newTracks) =>
    set((state) => ({
      tracks: [...state.tracks, ...newTracks],
      isDirty: true,
    })),
  removeTrack: (id) =>
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== id),
      isDirty: true,
    })),
  reorderTracks: (oldIndex, newIndex) =>
    set((state) => {
      const newTracks = [...state.tracks];
      const [removed] = newTracks.splice(oldIndex, 1);
      newTracks.splice(newIndex, 0, removed);
      return { tracks: newTracks, isDirty: true };
    }),
  clearTracks: () => set({ tracks: [], isDirty: true }),

  // ==========================================
  // Render Settings
  // ==========================================
  renderSettings: { ...DEFAULT_RENDER_SETTINGS },
  updateRenderSettings: (settings) =>
    set((state) => ({
      renderSettings: { ...state.renderSettings, ...settings },
      isDirty: true,
    })),

  // ==========================================
  // EQ
  // ==========================================
  eqBands: { ...DEFAULT_EQ },
  updateEqBand: (freq, db) =>
    set((state) => ({
      eqBands: { ...state.eqBands, [freq]: db },
      isDirty: true,
    })),
  applyEqPreset: (preset) =>
    set({
      eqBands: { ...EQ_PRESETS[preset] },
      isDirty: true,
    }),

  // ==========================================
  // Assets
  // ==========================================
  backgroundImage: null,
  setBackgroundImage: (path) => set({ backgroundImage: path, isDirty: true }),
  overlayVideo: null,
  setOverlayVideo: (path) => set({ overlayVideo: path, isDirty: true }),

  // ==========================================
  // Render Queue
  // ==========================================
  renderJobs: [],
  addRenderJob: (job) =>
    set((state) => ({
      renderJobs: [...state.renderJobs, job],
    })),
  updateJobProgress: (jobId, progress) =>
    set((state) => ({
      renderJobs: state.renderJobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              progress: progress.progress,
              status: progress.status as RenderJob["status"],
              etaSeconds: progress.eta_seconds,
              currentTimeMs: progress.current_time_ms,
              totalDurationMs: progress.total_duration_ms,
              message: progress.message,
            }
          : job
      ),
    })),
  removeJob: (jobId) =>
    set((state) => ({
      renderJobs: state.renderJobs.filter((j) => j.id !== jobId),
    })),
  clearCompletedJobs: () =>
    set((state) => ({
      renderJobs: state.renderJobs.filter(
        (j) => j.status !== "done" && j.status !== "error" && j.status !== "cancelled"
      ),
    })),

  // ==========================================
  // Sidebar
  // ==========================================
  activeTab: "image",
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ==========================================
  // Hydrate / Reset
  // ==========================================
  hydrateFromProject: (data) =>
    set({
      tracks: data.tracks,
      renderSettings: { ...DEFAULT_RENDER_SETTINGS, ...data.renderSettings },
      eqBands: { ...DEFAULT_EQ, ...data.eqBands },
      backgroundImage: data.backgroundImage,
      overlayVideo: data.overlayVideo,
      isDirty: false,
    }),
  resetProject: () =>
    set({
      projectName: "Untitled Project",
      isDirty: false,
      tracks: [],
      renderSettings: { ...DEFAULT_RENDER_SETTINGS },
      eqBands: { ...DEFAULT_EQ },
      backgroundImage: null,
      overlayVideo: null,
      renderJobs: [],
      activeTab: "image",
    }),
}));
