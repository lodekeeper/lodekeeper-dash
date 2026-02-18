import { Router } from "express";
import type { Request, Response } from "express";
import { readJSON, writeJSON } from "../storage/store.js";
import { readWorkspaceFile, parseBacklog, type Task } from "../collectors/workspace.js";
import { broadcast } from "../ws/hub.js";
import { nanoid } from "nanoid";

const router = Router();

interface TaskStore {
  tasks: Task[];
  lastSyncedFromBacklog: string;
}

async function loadTasks(): Promise<Task[]> {
  const store = await readJSON<TaskStore>("tasks.json", { tasks: [], lastSyncedFromBacklog: "" });

  // If no tasks exist, seed from BACKLOG.md
  if (store.tasks.length === 0) {
    const content = await readWorkspaceFile("BACKLOG.md");
    if (content) {
      store.tasks = parseBacklog(content);
      store.lastSyncedFromBacklog = new Date().toISOString();
      await writeJSON("tasks.json", store);
    }
  }

  return store.tasks;
}

async function saveTasks(tasks: Task[]) {
  await writeJSON("tasks.json", {
    tasks,
    lastSyncedFromBacklog: new Date().toISOString(),
  });
  broadcast({ type: "tasks", data: tasks });
}

// GET /api/tasks
router.get("/", async (_req: Request, res: Response) => {
  const tasks = await loadTasks();
  res.json({ tasks });
});

// POST /api/tasks — create a new task
router.post("/", async (req: Request, res: Response) => {
  const { title, priority, status, description, source } = req.body;
  if (!title) {
    res.status(400).json({ error: "Title required" });
    return;
  }

  const tasks = await loadTasks();
  const task: Task = {
    id: nanoid(12),
    title,
    priority: priority || "normal",
    status: status || "todo",
    description,
    source: source || `Dashboard (${(req as any).user?.username})`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tasks.push(task);
  await saveTasks(tasks);
  res.json({ task });
});

// PATCH /api/tasks/:id — update a task
router.patch("/:id", async (req: Request, res: Response) => {
  const tasks = await loadTasks();
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const updates = req.body;
  const allowed = ["title", "priority", "status", "description", "source"];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      (tasks[idx] as any)[key] = updates[key];
    }
  }
  tasks[idx].updatedAt = new Date().toISOString();

  await saveTasks(tasks);
  res.json({ task: tasks[idx] });
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req: Request, res: Response) => {
  let tasks = await loadTasks();
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  tasks = tasks.filter((t) => t.id !== req.params.id);
  await saveTasks(tasks);
  res.json({ ok: true });
});

// POST /api/tasks/sync — re-sync from BACKLOG.md
router.post("/sync", async (_req: Request, res: Response) => {
  const content = await readWorkspaceFile("BACKLOG.md");
  if (!content) {
    res.status(404).json({ error: "BACKLOG.md not found" });
    return;
  }

  const tasks = parseBacklog(content);
  await saveTasks(tasks);
  res.json({ tasks, synced: true });
});

// POST /api/tasks/reorder — bulk update positions/statuses
router.post("/reorder", async (req: Request, res: Response) => {
  const { updates } = req.body; // [{id, status, order}]
  if (!Array.isArray(updates)) {
    res.status(400).json({ error: "updates array required" });
    return;
  }

  const tasks = await loadTasks();
  for (const update of updates) {
    const task = tasks.find((t) => t.id === update.id);
    if (task) {
      if (update.status) task.status = update.status;
      task.updatedAt = new Date().toISOString();
    }
  }

  await saveTasks(tasks);
  res.json({ ok: true, tasks });
});

export { router as tasksRouter };
