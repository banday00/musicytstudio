import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Settings,
  FolderOpen,
  Monitor,
  Cpu,
  Zap,
  HardDrive,
  Rocket,
  Activity,
} from "lucide-react";
import { useProjectStore } from "../../store/useProjectStore";
import { checkGpuAvailable, startRender } from "../../lib/tauri";
import type { GpuInfo, RenderJob } from "../../types";

export function RenderSettings() {
  const {
    renderSettings,
    updateRenderSettings,
    tracks,
    eqBands,
    backgroundImage,
    overlayVideo,
    addRenderJob,
    projectName,
  } = useProjectStore();

  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Detect GPU on mount
  useEffect(() => {
    checkGpuAvailable()
      .then((info) => {
        setGpuInfo(info);
        updateRenderSettings({ encoder: info.recommended });
      })
      .catch(() => {
        setGpuInfo({ nvenc: false, qsv: false, recommended: "libx264" });
      });
  }, []);

  // Auto-generate timestamp filename on mount
  useEffect(() => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19); // e.g., 2026-05-02T23-40-01
    const safeProjectName = projectName.replace(/[^a-zA-Z0-9]/g, "_");
    const newFilename = `${safeProjectName}_${timestamp}.mp4`;
    updateRenderSettings({ outputFilename: newFilename });
  }, [projectName, updateRenderSettings]);

  const handleSelectOutputFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        title: "Select Output Folder",
      });
      if (selected && typeof selected === "string") {
        updateRenderSettings({ outputFolder: selected });
      }
    } catch (err) {
      console.error("Folder picker error:", err);
    }
  }, [updateRenderSettings]);

  const handleAddToQueue = useCallback(async () => {
    if (tracks.length === 0) return;
    if (!renderSettings.outputFolder) return;

    setIsStarting(true);
    try {
      const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const filename =
        renderSettings.outputFilename ||
        `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;

      const totalDuration = tracks.reduce((acc, t) => acc + t.duration, 0);

      // Create job entry in store
      const job: RenderJob = {
        id: jobId,
        name: filename,
        status: "waiting",
        progress: 0,
        etaSeconds: 0,
        currentTimeMs: 0,
        totalDurationMs: totalDuration * 1000,
        message: "Queued...",
        createdAt: Date.now(),
        outputFolder: renderSettings.outputFolder,
      };
      addRenderJob(job);

      // Start render
      await startRender({
        jobId,
        tracks: tracks.map((t) => ({
          id: t.id,
          title: t.title,
          path: t.path,
          duration: t.duration,
        })),
        settings: {
          resolution: renderSettings.resolution,
          encoder: renderSettings.encoder,
          output_folder: renderSettings.outputFolder,
          output_filename: filename,
          background_image: backgroundImage,
          overlay_video: overlayVideo,
          eq_bands: eqBands,
          fast_mode: renderSettings.fastMode && renderSettings.visualizer === "none",
          visualizer: renderSettings.visualizer,
        },
      });
    } catch (err) {
      console.error("Failed to start render:", err);
    } finally {
      setIsStarting(false);
    }
  }, [tracks, renderSettings, eqBands, backgroundImage, overlayVideo, projectName, addRenderJob]);

  const resolutions = [
    { value: "720p", label: "720p HD", detail: "1280×720" },
    { value: "1080p", label: "1080p Full HD", detail: "1920×1080" },
    { value: "4k", label: "4K Ultra HD", detail: "3840×2160" },
  ];

  const encoderLabel = (enc: string) => {
    switch (enc) {
      case "h264_nvenc": return "NVIDIA NVENC";
      case "h264_qsv": return "Intel QuickSync";
      case "libx264": return "CPU (libx264)";
      default: return enc;
    }
  };

  return (
    <div className="p-4 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings size={14} className="text-[var(--color-accent)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Render Settings
        </span>
      </div>

      {/* Resolution */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Monitor size={12} /> Resolution
        </label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {resolutions.map((res) => (
            <button
              key={res.value}
              className={`flex flex-col items-center p-2.5 rounded-lg border transition-all ${
                renderSettings.resolution === res.value
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent-light)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-0)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
              }`}
              onClick={() => updateRenderSettings({ resolution: res.value as "720p" | "1080p" | "4k" })}
            >
              <span className="text-xs font-semibold">{res.label}</span>
              <span className="text-[9px] opacity-60">{res.detail}</span>
            </button>
          ))}
        </div>
      </div>

      {/* GPU / Encoder */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Cpu size={12} /> Encoder
        </label>
        {gpuInfo && (
          <div className="flex items-center gap-2 mt-1 mb-2">
            {gpuInfo.nvenc && (
              <span className="status-badge status-done flex items-center gap-1">
                <Zap size={9} /> NVIDIA
              </span>
            )}
            {gpuInfo.qsv && (
              <span className="status-badge status-done flex items-center gap-1">
                <Zap size={9} /> Intel
              </span>
            )}
            {!gpuInfo.nvenc && !gpuInfo.qsv && (
              <span className="status-badge status-waiting flex items-center gap-1">
                <HardDrive size={9} /> CPU Only
              </span>
            )}
          </div>
        )}
        <select
          className="select mt-1"
          value={renderSettings.encoder}
          onChange={(e) => updateRenderSettings({ encoder: e.target.value })}
        >
          <option value="libx264">CPU — libx264 (Universal)</option>
          {gpuInfo?.nvenc && (
            <option value="h264_nvenc">NVIDIA — h264_nvenc (Fast)</option>
          )}
          {gpuInfo?.qsv && (
            <option value="h264_qsv">Intel — h264_qsv (Fast)</option>
          )}
        </select>
      </div>

      {/* Performance Mode */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Rocket size={12} /> Performance Mode
        </label>
        <div className="flex gap-2 mt-2">
          <button
            className={`flex-1 flex flex-col items-center p-2.5 rounded-lg border transition-all ${
              !renderSettings.fastMode
                ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent-light)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-0)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
            }`}
            onClick={() => updateRenderSettings({ fastMode: false })}
          >
            <span className="text-xs font-semibold">High Quality</span>
            <span className="text-[9px] opacity-60">Full 30fps + FX</span>
          </button>
          <button
            className={`flex-1 flex flex-col items-center p-2.5 rounded-lg border transition-all ${
              renderSettings.fastMode
                ? "border-[var(--color-success)] bg-[rgba(34,197,94,0.15)] text-[var(--color-success)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-0)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
            }`}
            onClick={() => updateRenderSettings({ fastMode: true })}
          >
            <span className="text-xs font-semibold">Ultra-Fast</span>
            <span className="text-[9px] opacity-60">2fps • No FX • 30x Faster</span>
          </button>
        </div>
        {renderSettings.fastMode && renderSettings.visualizer !== "none" && (
          <p className="text-[10px] text-[var(--color-warning)] mt-2 leading-tight">
            ⚠️ Ultra-Fast mode is ignored because a visualizer is active. Visualizers require 30 FPS.
          </p>
        )}
      </div>

      {/* Visualizer */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Activity size={12} /> Visualizer (Bottom)
        </label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[
            { id: "none", label: "None" },
            { id: "waveform", label: "Waveform" },
            { id: "eq_bars", label: "EQ Bars" },
          ].map((viz) => (
            <button
              key={viz.id}
              className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                renderSettings.visualizer === viz.id
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent-light)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-0)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
              }`}
              onClick={() => updateRenderSettings({ visualizer: viz.id as "none" | "waveform" | "eq_bars" })}
            >
              <span className="text-xs font-semibold">{viz.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Output Folder */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <FolderOpen size={12} /> Output Folder
        </label>
        <div className="flex gap-2 mt-1">
          <input
            className="input flex-1"
            value={renderSettings.outputFolder}
            readOnly
            placeholder="Select output folder..."
          />
          <button className="btn btn-ghost btn-sm" onClick={handleSelectOutputFolder}>
            Browse
          </button>
        </div>
      </div>

      {/* Output Filename */}
      <div>
        <label className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2 block">
          Output Filename
        </label>
        <input
          className="input mt-1"
          value={renderSettings.outputFilename}
          onChange={(e) => updateRenderSettings({ outputFilename: e.target.value })}
          placeholder={`${projectName.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`}
        />
      </div>

      {/* Add to Queue Button */}
      <button
        className="btn btn-accent w-full py-3 text-sm font-semibold mt-2"
        onClick={handleAddToQueue}
        disabled={tracks.length === 0 || !renderSettings.outputFolder || isStarting}
      >
        {isStarting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <Zap size={16} />
            Add to Render Queue
          </>
        )}
      </button>

      {/* Summary */}
      {tracks.length > 0 && (
        <div className="bg-[var(--color-surface-0)] rounded-lg p-3 border border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] space-y-1">
          <div className="flex justify-between">
            <span>Tracks</span>
            <span className="text-[var(--color-text-secondary)]">{tracks.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Resolution</span>
            <span className="text-[var(--color-text-secondary)]">{renderSettings.resolution}</span>
          </div>
          <div className="flex justify-between">
            <span>Encoder</span>
            <span className="text-[var(--color-text-secondary)]">{encoderLabel(renderSettings.encoder)}</span>
          </div>
          <div className="flex justify-between">
            <span>Background</span>
            <span className="text-[var(--color-text-secondary)]">
              {backgroundImage ? "✓ Set" : "Black"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Video Overlay</span>
            <span className="text-[var(--color-text-secondary)] truncate max-w-[200px]" title={overlayVideo || "None"}>
              {overlayVideo ? overlayVideo.split(/[/\\]/).pop() : "None"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Visualizer</span>
            <span className="text-[var(--color-text-secondary)] capitalize">
              {renderSettings.visualizer.replace("_", " ")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
