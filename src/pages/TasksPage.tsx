import { useEffect, useState, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDataStore, type Task } from "../stores/dataStore";
import { Plus, RefreshCw, GripVertical, X } from "lucide-react";

const COLUMNS: { id: Task["status"]; label: string; color: string }[] = [
  { id: "todo", label: "Todo", color: "border-blue-500" },
  { id: "in_progress", label: "In Progress", color: "border-status-working" },
  { id: "review", label: "Review", color: "border-purple-500" },
  { id: "done", label: "Done", color: "border-status-idle" },
];

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-priority-urgent/20 text-priority-urgent",
  normal: "bg-priority-normal/20 text-priority-normal",
  low: "bg-priority-low/20 text-priority-low",
};

function TaskCard({
  task,
  overlay,
  onClick,
}: {
  task: Task;
  overlay?: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task,
  });

  const style = overlay
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
      };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      onClick={overlay ? undefined : onClick}
      className={`bg-surface-2 rounded-md border border-surface-3 p-3 transition-all duration-150 ${
        overlay
          ? "shadow-xl ring-1 ring-accent/30 scale-[1.02] cursor-grabbing"
          : "hover:-translate-y-0.5 hover:shadow-md hover:border-surface-3/80 cursor-pointer"
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_BADGE[task.priority]}`}>
              {task.priority === "urgent" ? "🔴" : task.priority === "normal" ? "🟡" : "🟢"}
            </span>
            <span className="text-sm font-medium truncate">{task.title}</span>
          </div>
          {task.source && <p className="text-xs text-gray-500 truncate">{task.source}</p>}
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskDetailModal({
  task,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasChanges = title !== task.title || description !== (task.description || "") || priority !== task.priority || status !== task.status;

  const handleSave = () => {
    onUpdate(task.id, { title, description: description || undefined, priority, status });
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose} role="dialog" aria-modal="true" aria-label="Task detail" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="bg-surface-1 rounded-xl border border-surface-3 p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          {editing ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold bg-surface-2 border border-surface-3 rounded px-2 py-1 w-full mr-2 focus:outline-none focus:border-accent"
              autoFocus
            />
          ) : (
            <h2 className="text-lg font-semibold pr-4">{task.title}</h2>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Status + Priority */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Status</label>
              {editing ? (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Task["status"])}
                  className="w-full px-2 py-1.5 bg-surface-2 border border-surface-3 rounded text-sm focus:outline-none focus:border-accent"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm capitalize">{status.replace("_", " ")}</span>
              )}
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Priority</label>
              {editing ? (
                <div className="flex gap-1.5">
                  {(["urgent", "normal", "low"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`px-2 py-1 rounded text-xs ${
                        priority === p ? "bg-accent text-white" : "bg-surface-2 text-gray-400 hover:bg-surface-3"
                      }`}
                    >
                      {p === "urgent" ? "🔴" : p === "normal" ? "🟡" : "🟢"}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_BADGE[task.priority]}`}>
                  {task.priority}
                </span>
              )}
            </div>
          </div>

          {/* Source */}
          {task.source && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Source</label>
              <p className="text-sm text-gray-300">{task.source}</p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            {editing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm focus:outline-none focus:border-accent resize-y"
                placeholder="Add description..."
              />
            ) : (
              <p className="text-sm text-gray-300 whitespace-pre-wrap">
                {task.description || <span className="text-gray-600 italic">No description</span>}
              </p>
            )}
          </div>

          {/* Attachments */}
          {task.attachments && task.attachments.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Attachments</label>
              <div className="flex flex-wrap gap-2">
                {task.attachments.map((ref, i) => {
                  const displayUrl = ref.split("|")[0];
                  return (
                  <a key={i} href={displayUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={displayUrl}
                      alt={`Attachment ${i + 1}`}
                      className="max-w-[200px] max-h-[200px] object-contain rounded-lg border border-surface-3 hover:border-accent transition-colors"
                    />
                  </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Links */}
          {task.links && task.links.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Links</label>
              <div className="space-y-1">
                {task.links.map((link, i) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:text-accent-hover block truncate"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex gap-4 text-xs text-gray-600">
            <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
            <span>Updated: {new Date(task.updatedAt).toLocaleDateString()}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-surface-3">
            {editing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className="px-4 py-1.5 bg-accent hover:bg-accent-hover rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setTitle(task.title);
                    setDescription(task.description || "");
                    setPriority(task.priority);
                    setStatus(task.status);
                    setEditing(false);
                  }}
                  className="px-4 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm transition-colors"
              >
                Edit
              </button>
            )}
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-priority-urgent">Delete task?</span>
                <button
                  onClick={() => { onDelete(task.id); onClose(); }}
                  className="px-3 py-1 bg-priority-urgent/20 text-priority-urgent hover:bg-priority-urgent/30 rounded text-xs"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1 bg-surface-2 hover:bg-surface-3 rounded text-xs"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-gray-600 hover:text-priority-urgent transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Column({
  column,
  tasks,
  onTaskClick,
}: {
  column: (typeof COLUMNS)[0];
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[220px] bg-surface-1 rounded-lg border-t-2 ${column.color} ${
        isOver ? "ring-1 ring-accent/30" : ""
      }`}
    >
      <div className="p-3 pb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">{column.label}</h3>
        <span className="text-xs text-gray-500 bg-surface-2 px-1.5 py-0.5 rounded">{tasks.length}</span>
      </div>
      <div className="p-2 pt-0 space-y-2 min-h-[100px]">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
        ))}
      </div>
    </div>
  );
}

function AddTaskModal({ onClose, onAdd }: { onClose: () => void; onAdd: (t: Partial<Task>) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File | Blob) => {
    setUploading(true);
    try {
      const res = await fetch("/api/tasks/upload", {
        method: "POST",
        headers: { "Content-Type": file.type || "image/png" },
        body: file,
        credentials: "include",
      });
      const data = await res.json();
      if (data.url) {
        // Store "url|diskPath" so agent can find the file
        const ref = data.diskPath ? `${data.url}|${data.diskPath}` : data.url;
        setAttachments((prev) => [...prev, ref]);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploading(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadImage(file);
        break;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        uploadImage(file);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose} role="dialog" aria-modal="true" aria-label="Add task" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div
        className="bg-surface-1 rounded-xl border border-surface-3 p-5 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add Task</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) {
              onAdd({
                title: title.trim(),
                description: description.trim() || undefined,
                priority,
                status: "todo",
                attachments: attachments.length > 0 ? attachments : undefined,
              });
              onClose();
            }
          }}
          className="space-y-3"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title..."
            className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm focus:outline-none focus:border-accent"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)..."
            rows={3}
            className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm focus:outline-none focus:border-accent resize-y"
          />

          {/* Image attachments */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 bg-surface-2 hover:bg-surface-3 rounded text-xs text-gray-400 transition-colors"
              >
                📎 Attach image
              </button>
              <span className="text-[10px] text-gray-600">or paste / drag & drop</span>
              {uploading && <span className="text-[10px] text-accent animate-pulse">Uploading...</span>}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file);
                e.target.value = "";
              }}
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((ref, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={ref.split("|")[0]}
                      alt={`Attachment ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-surface-3"
                    />
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-priority-urgent rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {(["urgent", "normal", "low"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  priority === p ? "bg-accent text-white" : "bg-surface-2 text-gray-400 hover:bg-surface-3"
                }`}
              >
                {p === "urgent" ? "🔴 Urgent" : p === "normal" ? "🟡 Normal" : "🟢 Low"}
              </button>
            ))}
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm font-medium transition-colors"
          >
            Add Task
          </button>
        </form>
      </div>
    </div>
  );
}

export function TasksPage() {
  const tasks = useDataStore((s) => s.tasks);
  const fetchTasks = useDataStore((s) => s.fetchTasks);
  const createTask = useDataStore((s) => s.createTask);
  const updateTask = useDataStore((s) => s.updateTask);
  const deleteTask = useDataStore((s) => s.deleteTask);
  const moveTask = useDataStore((s) => s.moveTask);
  const syncTasks = useDataStore((s) => s.syncTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; count?: number } | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<Task["priority"] | "all">("all");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      setActiveTask(task || null);
    },
    [tasks],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const newStatus = over.id as Task["status"];
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== newStatus) {
        moveTask(taskId, newStatus);
      }
    },
    [tasks, moveTask],
  );

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      await syncTasks();
      const count = useDataStore.getState().tasks.length;
      setSyncResult({ ok: true, count });
      setTimeout(() => setSyncResult(null), 2500);
    } catch {
      setSyncResult({ ok: false });
      setTimeout(() => setSyncResult(null), 3000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Task Board</h1>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 ${
              syncResult?.ok
                ? "bg-status-idle/20 text-status-idle"
                : syncResult?.ok === false
                  ? "bg-priority-urgent/20 text-priority-urgent"
                  : "bg-surface-2 hover:bg-surface-3 text-gray-300"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : syncResult?.ok ? `Synced ${syncResult.count} tasks ✓` : syncResult?.ok === false ? "Sync failed · Retry" : "Sync"}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </button>
        </div>
      </div>

      {/* Priority filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Filter:</span>
        {(["all", "urgent", "normal", "low"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              priorityFilter === p
                ? p === "all" ? "bg-accent/20 text-accent" : `${PRIORITY_BADGE[p as keyof typeof PRIORITY_BADGE]}`
                : "bg-surface-2 text-gray-500 hover:bg-surface-3"
            }`}
          >
            {p === "all" ? "All" : p === "urgent" ? "🔴 Urgent" : p === "normal" ? "🟡 Normal" : "🟢 Low"}
          </button>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const filtered = tasks.filter((t) => t.status === col.id && (priorityFilter === "all" || t.priority === priorityFilter));
            return (
              <Column
                key={col.id}
                column={col}
                tasks={filtered}
                onTaskClick={setDetailTask}
              />
            );
          })}
        </div>

        <DragOverlay>{activeTask && <TaskCard task={activeTask} overlay />}</DragOverlay>
      </DndContext>

      {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} onAdd={createTask} />}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onUpdate={(id, updates) => {
            updateTask(id, updates);
            setDetailTask(null);
          }}
          onDelete={(id) => {
            deleteTask(id);
            setDetailTask(null);
          }}
        />
      )}
    </div>
  );
}
