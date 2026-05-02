import { useCallback, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  Plus,
  FolderOpen,
  Trash2,
  ListMusic,
  Clock,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../../store/useProjectStore";
import { importAudioFiles, scanMusicFolder } from "../../lib/tauri";
import { TrackItem } from "./TrackItem";
import { formatDuration } from "../../types";

export function PlaylistBuilder() {
  const { tracks, addTracks, removeTrack, reorderTracks, clearTracks } =
    useProjectStore();
  const [importing, setImporting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const totalDuration = tracks.reduce((acc, t) => acc + t.duration, 0);

  const handleImportFiles = useCallback(async () => {
    try {
      setImporting(true);
      const selected = await open({
        multiple: true,
        title: "Import Audio Files",
        filters: [
          {
            name: "Audio Files",
            extensions: ["mp3", "wav", "flac", "ogg", "m4a", "aac"],
          },
        ],
      });

      if (selected && Array.isArray(selected) && selected.length > 0) {
        const paths = selected.map((s) => (typeof s === "string" ? s : s));
        const newTracks = await importAudioFiles(paths as string[]);
        addTracks(newTracks);
      }
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setImporting(false);
    }
  }, [addTracks]);

  const handleImportFolder = useCallback(async () => {
    try {
      setImporting(true);
      const selected = await open({
        directory: true,
        title: "Select Music Folder",
      });

      if (selected && typeof selected === "string") {
        const newTracks = await scanMusicFolder(selected);
        addTracks(newTracks);
      }
    } catch (err) {
      console.error("Folder import failed:", err);
    } finally {
      setImporting(false);
    }
  }, [addTracks]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = tracks.findIndex((t) => t.id === active.id);
        const newIndex = tracks.findIndex((t) => t.id === over.id);
        reorderTracks(oldIndex, newIndex);
      }
    },
    [tracks, reorderTracks]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2">
            <ListMusic size={16} className="text-[var(--color-accent)]" />
            Playlist
          </h2>
          {tracks.length > 0 && (
            <span className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-full">
              {tracks.length} tracks
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleImportFiles}
            disabled={importing}
          >
            <Plus size={14} />
            Files
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleImportFolder}
            disabled={importing}
          >
            <FolderOpen size={14} />
            Folder
          </button>
          {tracks.length > 0 && (
            <button
              className="btn btn-danger btn-sm"
              onClick={clearTracks}
            >
              <Trash2 size={14} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="empty-state h-full">
            <ListMusic size={48} strokeWidth={1} />
            <p className="text-sm font-medium">No tracks added yet</p>
            <p className="text-xs max-w-[280px]">
              Import audio files (MP3, WAV, FLAC) or scan a folder to build your playlist
            </p>
            <div className="flex gap-2 mt-2">
              <button className="btn btn-accent btn-sm" onClick={handleImportFiles}>
                <Plus size={14} />
                Import Files
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleImportFolder}>
                <FolderOpen size={14} />
                Scan Folder
              </button>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tracks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {tracks.map((track, index) => (
                <TrackItem
                  key={track.id}
                  track={track}
                  index={index}
                  onRemove={() => removeTrack(track.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Footer - Total Duration */}
      {tracks.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-1)]">
          <span className="text-xs text-[var(--color-text-muted)]">
            Total playlist duration
          </span>
          <span className="text-sm font-semibold text-[var(--color-accent-light)] flex items-center gap-1.5">
            <Clock size={13} />
            {formatDuration(totalDuration)}
          </span>
        </div>
      )}
    </div>
  );
}
