import { useEffect, useState, useCallback } from "react";
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
  { id: "backlog", label: "Backlog", color: "border-gray-600" },
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

function TaskCard({ task, overlay }: { task: Task; overlay?: boolean }) {
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
      className={`bg-surface-2 rounded-md border border-surface-3 p-3 cursor-grab active:cursor-grabbing ${
        overlay ? "shadow-xl ring-1 ring-accent/30" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button {...listeners} {...attributes} className="mt-0.5 text-gray-600 hover:text-gray-400">
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

function Column({ column, tasks }: { column: (typeof COLUMNS)[0]; tasks: Task[] }) {
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
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function AddTaskModal({ onClose, onAdd }: { onClose: () => void; onAdd: (t: Partial<Task>) => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("normal");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface-1 rounded-xl border border-surface-3 p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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
              onAdd({ title: title.trim(), priority, status: "todo" });
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
  const moveTask = useDataStore((s) => s.moveTask);
  const syncTasks = useDataStore((s) => s.syncTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
    try {
      await syncTasks();
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sync
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <Column key={col.id} column={col} tasks={tasks.filter((t) => t.status === col.id)} />
          ))}
        </div>

        <DragOverlay>{activeTask && <TaskCard task={activeTask} overlay />}</DragOverlay>
      </DndContext>

      {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} onAdd={createTask} />}
    </div>
  );
}
