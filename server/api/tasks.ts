import { Router } from "express";
import type { Request, Response } from "express";
import { readJSON, writeJSON, getDataDir } from "../storage/store.js";
import { readWorkspaceFile, parseBacklog, writeBacklog, type Task } from "../collectors/workspace.js";
import { broadcast } from "../ws/hub.js";
import { nanoid } from "nanoid";
import fs from "node:fs/promises";
import path from "node:path";

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

async function saveTasks(tasks: Task[], writeBack = true) {
  await writeJSON("tasks.json", {
    tasks,
    lastSyncedFromBacklog: new Date().toISOString(),
  });
  broadcast({ type: "tasks", data: tasks });

  // Only write back to BACKLOG.md on explicit user actions (not on sync/re-seed)
  if (writeBack) {
    try {
      await writeBacklog(tasks);
    } catch (err) {
      console.error("Failed to write BACKLOG.md:", err);
    }
  }
}

// GET /api/tasks
router.get("/", async (_req: Request, res: Response) => {
  const tasks = await loadTasks();
  res.json({ tasks });
});

// POST /api/tasks — create a new task
router.post("/", async (req: Request, res: Response) => {
  const { title, priority, status, description, source, attachments } = req.body;
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
    attachments: Array.isArray(attachments) ? attachments : undefined,
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
  const allowed = ["title", "priority", "status", "description", "source", "attachments"];
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
  await saveTasks(tasks, false); // Don't write back to BACKLOG.md during sync
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

// POST /api/tasks/upload — upload an image attachment
router.post("/upload", async (req: Request, res: Response) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks);

    // Get content type from header
    const contentType = req.headers["content-type"] || "image/png";
    const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : contentType.includes("webp") ? "webp" : "jpg";
    const filename = `${nanoid(16)}.${ext}`;

    const uploadsDir = path.join(getDataDir(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, filename), body);

    res.json({ url: `/api/tasks/uploads/${filename}`, filename });
  } catch (err: any) {
    res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

// GET /api/tasks/uploads/:filename — serve uploaded images
router.get("/uploads/:filename", async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, ""); // sanitize
    const filePath = path.join(getDataDir(), "uploads", filename);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const ext = path.extname(filename).toLowerCase();
    const types: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };

    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    const data = await fs.readFile(filePath);
    res.send(data);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

export { router as tasksRouter };
