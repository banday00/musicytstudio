import { useCallback } from "react";
import {
  Layers,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Trash2,
  Ban,
  FolderOpen,
} from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useProjectStore } from "../../store/useProjectStore";
import { cancelRender } from "../../lib/tauri";
import { formatEta } from "../../types";
import clsx from "clsx";

export function RenderQueue() {
  const { renderJobs, removeJob, clearCompletedJobs } = useProjectStore();

  const handleCancel = useCallback(async (jobId: string) => {
    try {
      await cancelRender(jobId);
    } catch (err) {
      console.error("Failed to cancel:", err);
    }
  }, []);

  if (renderJobs.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 px-4">
        <Layers size={14} className="text-[var(--color-text-muted)]" />
        <span className="text-xs text-[var(--color-text-muted)]">
          Render queue is empty — configure settings and add a job
        </span>
      </div>
    );
  }

  const hasCompleted = renderJobs.some(
    (j) => j.status === "done" || j.status === "error" || j.status === "cancelled"
  );

  return (
    <div>
      {/* Queue Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[var(--color-accent)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Render Queue
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-full">
            {renderJobs.length} jobs
          </span>
        </div>
        {hasCompleted && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={clearCompletedJobs}
          >
            <Trash2 size={12} />
            Clear Done
          </button>
        )}
      </div>

      {/* Job List */}
      {renderJobs.map((job) => (
        <div key={job.id} className="render-job">
          {/* Status Icon */}
          <div className="flex-shrink-0">
            {job.status === "waiting" && (
              <Clock size={16} className="text-[var(--color-text-muted)]" />
            )}
            {job.status === "rendering" && (
              <Loader2 size={16} className="text-[var(--color-accent)] animate-spin" />
            )}
            {job.status === "done" && (
              <CheckCircle2 size={16} className="text-[var(--color-success)]" />
            )}
            {job.status === "error" && (
              <AlertCircle size={16} className="text-[var(--color-error)]" />
            )}
            {job.status === "cancelled" && (
              <Ban size={16} className="text-[var(--color-warning)]" />
            )}
          </div>

          {/* Job Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                {job.name}
              </span>
              <span
                className={clsx("status-badge", {
                  "status-waiting": job.status === "waiting",
                  "status-rendering": job.status === "rendering",
                  "status-done": job.status === "done",
                  "status-error": job.status === "error",
                  "status-cancelled": job.status === "cancelled",
                })}
              >
                {job.status}
              </span>
            </div>

            {/* Progress bar */}
            {(job.status === "rendering" || job.status === "done") && (
              <div className="mt-1.5">
                <div className="progress-bar">
                  <div
                    className={clsx("progress-fill", {
                      done: job.status === "done",
                    })}
                    style={{ width: `${Math.min(job.progress, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Message */}
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[200px]">
                {job.message}
              </span>
              {job.status === "rendering" && (
                <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                  <span className="font-mono">{job.progress.toFixed(1)}%</span>
                  <span>ETA {formatEta(job.etaSeconds)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 flex-shrink-0">
            {(job.status === "rendering" || job.status === "waiting") && (
              <button
                className="btn btn-icon btn-danger btn-sm"
                onClick={() => handleCancel(job.id)}
                title="Cancel"
              >
                <X size={14} />
              </button>
            )}
            {job.status === "done" && job.outputFolder && (
              <button
                className="btn btn-icon btn-ghost btn-sm text-[var(--color-accent)]"
                onClick={() => revealItemInDir(job.outputFolder!)}
                title="Open Folder"
              >
                <FolderOpen size={14} />
              </button>
            )}
            {(job.status === "done" || job.status === "error" || job.status === "cancelled") && (
              <button
                className="btn btn-icon btn-ghost btn-sm"
                onClick={() => removeJob(job.id)}
                title="Remove"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
