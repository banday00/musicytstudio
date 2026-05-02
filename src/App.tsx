import { useEffect, useState, useCallback } from "react";
import {
  Music2,
  FolderPlus,
  Save,
  FilePlus,
  Trash2,
  Loader2,
} from "lucide-react";
import { useProjectStore } from "./store/useProjectStore";
import { listProjects, saveProject, loadProject, deleteProject, onRenderProgress } from "./lib/tauri";
import { PlaylistBuilder } from "./components/playlist/PlaylistBuilder";
import { ImagePicker } from "./components/assets/ImagePicker";
import { OverlayVideoPicker } from "./components/assets/OverlayVideoPicker";
import { EqualizerPanel } from "./components/equalizer/EqualizerPanel";
import { RenderSettings } from "./components/render/RenderSettings";
import { RenderQueue } from "./components/render/RenderQueue";
import type { ProjectInfo, ProjectData } from "./types";

function App() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const store = useProjectStore();

  // Load project list on mount
  useEffect(() => {
    refreshProjects();
  }, []);

  // Listen for render progress events
  useEffect(() => {
    const unlisten = onRenderProgress((progress) => {
      store.updateJobProgress(progress.job_id, progress);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const list = await listProjects();
      setProjects(list);
    } catch {
      // silently fail if backend isn't ready
    }
  }, []);

  const handleNewProject = useCallback(() => {
    store.resetProject();
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    store.setProjectName(`BD-${dd}${mm}${yyyy}`);
  }, []);

  const handleSaveProject = useCallback(async () => {
    setLoading(true);
    try {
      const data: ProjectData = {
        tracks: store.tracks,
        renderSettings: {
          resolution: store.renderSettings.resolution,
          encoder: store.renderSettings.encoder,
          outputFolder: store.renderSettings.outputFolder,
          outputFilename: store.renderSettings.outputFilename,
          backgroundImage: store.backgroundImage,
          overlayVideo: store.overlayVideo,
          fastMode: store.renderSettings.fastMode,
          visualizer: store.renderSettings.visualizer,
        },
        eqBands: store.eqBands,
        backgroundImage: store.backgroundImage,
        overlayVideo: store.overlayVideo,
      };
      await saveProject(store.projectName, data);
      store.markClean();
      await refreshProjects();
    } catch (err) {
      console.error("Failed to save project:", err);
    } finally {
      setLoading(false);
    }
  }, [store.projectName, store.tracks, store.renderSettings, store.eqBands, store.backgroundImage, store.overlayVideo]);

  const handleLoadProject = useCallback(async (name: string) => {
    setLoading(true);
    try {
      const data = (await loadProject(name)) as ProjectData;
      store.setProjectName(name);
      store.hydrateFromProject({
        tracks: data.tracks || [],
        renderSettings: data.renderSettings || {},
        eqBands: data.eqBands || {},
        backgroundImage: data.backgroundImage || null,
        overlayVideo: data.overlayVideo || null,
      });
    } catch (err) {
      console.error("Failed to load project:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteProject = useCallback(async (name: string) => {
    try {
      await deleteProject(name);
      await refreshProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  }, []);

  const tabs = [
    { key: "image", label: "Image" },
    { key: "overlay", label: "Overlay" },
    { key: "eq", label: "EQ" },
    { key: "render", label: "Render" },
  ];

  return (
    <div className="app-layout">
      {/* ====== SIDEBAR ====== */}
      <aside className="sidebar">
        <div className="panel-header">
          <h2 className="flex items-center gap-2">
            <Music2 size={16} className="text-[var(--color-accent)]" />
            Projects
          </h2>
          <div className="flex gap-1">
            <button
              className="btn btn-icon btn-ghost"
              onClick={handleNewProject}
              title="New Project"
            >
              <FilePlus size={15} />
            </button>
            <button
              className="btn btn-icon btn-ghost"
              onClick={handleSaveProject}
              disabled={loading}
              title="Save Project"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            </button>
          </div>
        </div>

        {/* Current project name */}
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <input
            className="input text-sm font-semibold"
            value={store.projectName}
            onChange={(e) => store.setProjectName(e.target.value)}
            placeholder="Project name..."
          />
          {store.isDirty && (
            <span className="text-[10px] text-[var(--color-warning)] mt-1 block">
              ● Unsaved changes
            </span>
          )}
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Recent Projects
            </span>
          </div>
          {projects.length === 0 ? (
            <div className="empty-state py-8">
              <FolderPlus size={32} />
              <p className="text-xs">No saved projects yet</p>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.name}
                className={`project-item group ${
                  project.name === store.projectName ? "active" : ""
                }`}
                onClick={() => handleLoadProject(project.name)}
              >
                <Music2 size={14} className="text-[var(--color-accent)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{project.name}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="btn btn-icon btn-ghost btn-sm opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(project.name);
                  }}
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ====== MAIN PANEL ====== */}
      <main className="main-panel">
        <PlaylistBuilder />
      </main>

      {/* ====== RIGHT PANEL ====== */}
      <aside className="right-panel">
        <div className="p-3">
          <div className="tab-bar">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`tab-item ${store.activeTab === tab.key ? "active" : ""}`}
                onClick={() => store.setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {store.activeTab === "image" && <ImagePicker />}
          {store.activeTab === "overlay" && <OverlayVideoPicker />}
          {store.activeTab === "eq" && <EqualizerPanel />}
          {store.activeTab === "render" && <RenderSettings />}
        </div>
      </aside>

      {/* ====== BOTTOM BAR ====== */}
      <div className="bottom-bar">
        <RenderQueue />
      </div>
    </div>
  );
}

export default App;
