import { create } from "zustand";
import { api } from "../api/client";
import { onWsMessage, connectWs } from "../api/ws";

// Types
export interface Task {
  id: string;
  title: string;
  priority: "urgent" | "normal" | "low";
  status: "todo" | "in_progress" | "review" | "done";
  source?: string;
  description?: string;
  links?: string[];
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  state: string;
  url: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
  reviewDecision: string;
  ciStatus: string;
  isDraft: boolean;
}

export interface GitHubNotification {
  id: string;
  reason: string;
  title: string;
  type: string;
  url: string;
  updatedAt: string;
  unread: boolean;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  url: string;
  author: string;
  labels: string[];
  updatedAt: string;
  comments: number;
}

export interface DiscordThread {
  id: string;
  name: string;
  channel: string;
  channelId?: string;
  guildName: string;
  url: string;
  status: "active" | "quiet" | "archived";
  lastActivity?: string;
  notes?: string;
}

export interface AgentSession {
  key: string;
  kind: string;
  model: string;
  displayName: string;
  totalTokens: number;
  updatedAt: number;
  lastMessage?: string;
  channel?: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  lastRun?: string;
  nextRun?: string;
  enabled: boolean;
  payload: string;
  sessionTarget: string;
}

export interface AgentStatus {
  agentStatus: "idle" | "working" | "busy";
  currentTask: string | null;
  model: string;
  uptime: number;
}

interface DataState {
  // Tasks
  tasks: Task[];
  tasksLoading: boolean;
  fetchTasks: () => Promise<void>;
  createTask: (task: Partial<Task>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  syncTasks: () => Promise<void>;
  moveTask: (id: string, status: Task["status"]) => Promise<void>;

  // GitHub
  prs: GitHubPR[];
  notifications: GitHubNotification[];
  issues: GitHubIssue[];
  fetchGitHub: () => Promise<void>;

  // Discord
  threads: DiscordThread[];
  fetchDiscord: () => Promise<void>;

  // Agents
  sessions: AgentSession[];
  fetchAgents: () => Promise<void>;

  // Jobs
  cronJobs: CronJob[];
  heartbeatChecks: string[];
  fetchJobs: () => Promise<void>;

  // Status
  status: AgentStatus | null;
  fetchStatus: () => Promise<void>;

  // Init WebSocket
  initWs: () => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  // Tasks
  tasks: [],
  tasksLoading: false,
  fetchTasks: async () => {
    set({ tasksLoading: true });
    try {
      const data = await api.get<{ tasks: Task[] }>("/api/tasks");
      set({ tasks: data.tasks, tasksLoading: false });
    } catch {
      set({ tasksLoading: false });
    }
  },
  createTask: async (task) => {
    await api.post<{ task: Task }>("/api/tasks", task);
    // Fetch canonical list instead of optimistic add (prevents brief duplicates)
    const data = await api.get<{ tasks: Task[] }>("/api/tasks");
    set({ tasks: data.tasks });
  },
  updateTask: async (id, updates) => {
    const data = await api.patch<{ task: Task }>(`/api/tasks/${id}`, updates);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? data.task : t)) }));
  },
  deleteTask: async (id) => {
    await api.delete(`/api/tasks/${id}`);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },
  syncTasks: async () => {
    const data = await api.post<{ tasks: Task[] }>("/api/tasks/sync");
    set({ tasks: data.tasks });
  },
  moveTask: async (id, status) => {
    await api.patch(`/api/tasks/${id}`, { status });
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t)),
    }));
  },

  // GitHub
  prs: [],
  issues: [],
  notifications: [],
  fetchGitHub: async () => {
    try {
      const data = await api.get<{ prs: GitHubPR[]; notifications: GitHubNotification[]; issues: GitHubIssue[] }>("/api/tracking/github");
      set({ prs: data.prs, notifications: data.notifications, issues: data.issues || [] });
    } catch {
      // keep stale data
    }
  },

  // Discord
  threads: [],
  fetchDiscord: async () => {
    try {
      const data = await api.get<{ threads: DiscordThread[] }>("/api/tracking/discord");
      set({ threads: data.threads });
    } catch {
      // keep stale
    }
  },

  // Agents
  sessions: [],
  fetchAgents: async () => {
    try {
      const data = await api.get<{ sessions: AgentSession[] }>("/api/agents");
      set({ sessions: data.sessions });
    } catch {
      // keep stale
    }
  },

  // Jobs
  cronJobs: [],
  heartbeatChecks: [],
  fetchJobs: async () => {
    try {
      const data = await api.get<{ cronJobs: CronJob[]; heartbeat: { checks: string[] } }>("/api/jobs");
      set({ cronJobs: data.cronJobs, heartbeatChecks: data.heartbeat.checks });
    } catch {
      // keep stale
    }
  },

  // Status
  status: null,
  fetchStatus: async () => {
    try {
      const data = await api.get<AgentStatus>("/api/status");
      set({ status: data });
    } catch {
      // keep stale
    }
  },

  // WebSocket
  initWs: () => {
    connectWs();
    onWsMessage((msg) => {
      switch (msg.type) {
        case "tasks":
          set({ tasks: msg.data as Task[] });
          break;
        case "github":
          {
            const gh = msg.data as { prs: GitHubPR[]; notifications: GitHubNotification[] };
            set({ prs: gh.prs, notifications: gh.notifications });
          }
          break;
        case "discord":
          set({ threads: msg.data as DiscordThread[] });
          break;
        case "agents":
          {
            const a = msg.data as { sessions: AgentSession[] };
            set({ sessions: a.sessions });
          }
          break;
        case "cron":
          set({ cronJobs: msg.data as CronJob[] });
          break;
      }
    });
  },
}));
