/**
 * Workspace collector — reads BACKLOG.md, HEARTBEAT.md, and other workspace files.
 * Parses markdown into structured task data.
 */
import fs from "node:fs/promises";
import path from "node:path";

const WORKSPACE = process.env.WORKSPACE_PATH || "/home/openclaw/.openclaw/workspace";

export interface Task {
  id: string;
  title: string;
  priority: "urgent" | "normal" | "low";
  status: "backlog" | "todo" | "in_progress" | "review" | "done";
  source?: string;
  description?: string;
  links?: string[];
  createdAt: string;
  updatedAt: string;
}

export async function readWorkspaceFile(filename: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(WORKSPACE, filename), "utf-8");
  } catch {
    return null;
  }
}

export function parseBacklog(content: string): Task[] {
  const tasks: Task[] = [];
  const lines = content.split("\n");
  let currentTask: Partial<Task> | null = null;
  let inCompleted = false;

  for (const line of lines) {
    // Detect completed section
    if (line.match(/^## Completed/i)) {
      inCompleted = true;
      continue;
    }

    // Task header: ### 🔴 Title or ### ✅ Title or ### 🟡 Title
    const taskMatch = line.match(/^###\s+(✅|🔴|🟡|🟢)\s+(.+)/);
    if (taskMatch) {
      if (currentTask?.title) {
        tasks.push(finalizeTask(currentTask, inCompleted));
      }

      const [, emoji, title] = taskMatch;
      const isDone = title.includes("— DONE") || title.includes("— MERGED") || emoji === "✅";
      const priority = emoji === "🔴" ? "urgent" : emoji === "🟡" ? "normal" : "low";

      currentTask = {
        id: slugify(title),
        title: cleanTitle(title),
        priority: isDone ? "low" : priority,
        status: isDone ? "done" : "in_progress",
        description: "",
        links: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      continue;
    }

    // Completed section task: - ✅ Title
    if (inCompleted && line.match(/^- ✅\s+(.+)/)) {
      const match = line.match(/^- ✅\s+(.+)/);
      if (match) {
        tasks.push({
          id: slugify(match[1]),
          title: match[1],
          priority: "low",
          status: "done",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      continue;
    }

    // Task metadata
    if (currentTask) {
      const sourceMatch = line.match(/\*\*Source:\*\*\s*(.+)/);
      if (sourceMatch) {
        currentTask.source = sourceMatch[1];
        continue;
      }
      const statusMatch = line.match(/\*\*Status:\*\*\s*(.+)/);
      if (statusMatch) {
        currentTask.description = (currentTask.description || "") + statusMatch[1] + "\n";
        // Infer status from keywords
        const s = statusMatch[1].toLowerCase();
        if (s.includes("wait") || s.includes("monitor") || s.includes("review")) {
          currentTask.status = "review";
        } else if (s.includes("open") || s.includes("in progress")) {
          currentTask.status = "in_progress";
        }
        continue;
      }
      const nextMatch = line.match(/\*\*Next:\*\*\s*(.+)/);
      if (nextMatch) {
        currentTask.description = (currentTask.description || "") + "Next: " + nextMatch[1];
        continue;
      }
      // Collect links
      const linkMatches = line.matchAll(/https?:\/\/[^\s)]+/g);
      for (const m of linkMatches) {
        currentTask.links = currentTask.links || [];
        currentTask.links.push(m[0]);
      }
    }
  }

  if (currentTask?.title) {
    tasks.push(finalizeTask(currentTask, inCompleted));
  }

  return tasks;
}

function finalizeTask(partial: Partial<Task>, inCompleted: boolean): Task {
  return {
    id: partial.id || slugify(partial.title || "unknown"),
    title: partial.title || "Unknown Task",
    priority: partial.priority || "normal",
    status: inCompleted ? "done" : partial.status || "todo",
    source: partial.source,
    description: partial.description?.trim(),
    links: partial.links,
    createdAt: partial.createdAt || new Date().toISOString(),
    updatedAt: partial.updatedAt || new Date().toISOString(),
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function cleanTitle(title: string): string {
  return title.replace(/\s*—\s*(DONE|MERGED)\s*$/, "").trim();
}

export async function parseHeartbeat(): Promise<{
  checks: string[];
  raw: string;
}> {
  const content = await readWorkspaceFile("HEARTBEAT.md");
  if (!content) return { checks: [], raw: "" };

  const checks: string[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.match(/^##\s+/)) {
      checks.push(line.replace(/^##\s+/, "").trim());
    }
  }

  return { checks, raw: content };
}

export async function getAgentStatus(): Promise<{
  status: string;
  currentTask: string | null;
}> {
  // Read from a status file that the agent updates
  const statusFile = await readWorkspaceFile("memory/agent-status.json");
  if (statusFile) {
    try {
      return JSON.parse(statusFile);
    } catch {
      // fall through
    }
  }
  return { status: "idle", currentTask: null };
}
