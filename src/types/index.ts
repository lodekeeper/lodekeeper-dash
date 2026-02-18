export interface User {
  id: string;
  username: string;
  role: "admin" | "viewer";
}

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

export type TaskStatus = Task["status"];
export type TaskPriority = Task["priority"];

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

export interface DiscordThread {
  id: string;
  name: string;
  channel: string;
  guild: string;
  guildName: string;
  url: string;
  status: "active" | "quiet" | "archived";
  lastCheckedMsg?: string;
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

export interface RunningProcess {
  sessionId: string;
  pid?: number;
  command?: string;
  running: boolean;
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

export interface Heartbeat {
  checks: string[];
  raw: string;
}

export interface StatusData {
  agentStatus: "idle" | "working" | "busy";
  currentTask: string | null;
  model: string;
  uptime: number;
  lastHeartbeat: string | null;
  contextUsage: number | null;
  tokenUsageToday: number;
  messagesHandledToday: number;
}

export interface UsageDay {
  date: string;
  tokens: number;
  cost: number;
  messages: number;
}

export interface WsMessage {
  type: string;
  data?: unknown;
  ok?: boolean;
  sessionId?: string;
  timestamp?: number;
}
