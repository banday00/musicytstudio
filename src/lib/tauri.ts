import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  TrackItem,
  RenderProgress,
  GpuInfo,
  ProjectInfo,
} from "../types";

// ==========================================
// Project Commands
// ==========================================

export async function saveProject(name: string, data: unknown): Promise<void> {
  return invoke("save_project", { name, data });
}

export async function loadProject(name: string): Promise<unknown> {
  return invoke("load_project", { name });
}

export async function listProjects(): Promise<ProjectInfo[]> {
  return invoke("list_projects");
}

export async function deleteProject(name: string): Promise<void> {
  return invoke("delete_project", { name });
}

// ==========================================
// Asset Commands
// ==========================================

export async function scanMusicFolder(folderPath: string): Promise<TrackItem[]> {
  return invoke("scan_music_folder", { folderPath });
}

export async function getAudioDuration(filePath: string): Promise<number> {
  return invoke("get_audio_duration", { filePath });
}

export async function importAudioFiles(filePaths: string[]): Promise<TrackItem[]> {
  return invoke("import_audio_files", { filePaths });
}

export async function readImageBase64(path: string): Promise<string> {
  return invoke("read_image_base64", { path });
}

// ==========================================
// Render Commands
// ==========================================

export interface StartRenderParams {
  jobId: string;
  tracks: {
    id: string;
    title: string;
    path: string;
    duration: number;
  }[];
  settings: {
    resolution: string;
    encoder: string;
    output_folder: string;
    output_filename: string;
    background_image: string | null;
    overlay_video: string | null;
    eq_bands: Record<string, number>;
    fast_mode: boolean;
    visualizer: string;
  };
}

export async function startRender(params: StartRenderParams): Promise<string> {
  return invoke("start_render", {
    jobId: params.jobId,
    tracks: params.tracks,
    settings: params.settings,
  });
}

export async function cancelRender(jobId: string): Promise<void> {
  return invoke("cancel_render", { jobId });
}

export async function checkGpuAvailable(): Promise<GpuInfo> {
  return invoke("check_gpu_available");
}

// ==========================================
// Event Listeners
// ==========================================

export function onRenderProgress(
  callback: (progress: RenderProgress) => void
): Promise<UnlistenFn> {
  return listen<RenderProgress>("render-progress", (event) => {
    callback(event.payload);
  });
}
