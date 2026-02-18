/**
 * GitHub collector — uses gh CLI to fetch PRs, issues, notifications.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

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

let cachedPRs: GitHubPR[] = [];
let cachedNotifications: GitHubNotification[] = [];
let lastFetchTime = 0;

async function runGh(args: string[]): Promise<string> {
  try {
    const { stdout } = await exec("gh", args, {
      timeout: 15000,
      env: { ...process.env, GH_PAGER: "" },
    });
    return stdout.trim();
  } catch (err: any) {
    console.error(`gh ${args.join(" ")} failed:`, err.message);
    return "";
  }
}

export async function fetchPRs(): Promise<GitHubPR[]> {
  // My open PRs
  const myPRsJson = await runGh([
    "pr", "list",
    "--repo", "ChainSafe/lodestar",
    "--author", "lodekeeper",
    "--state", "open",
    "--json", "number,title,state,url,author,createdAt,updatedAt,labels,reviewDecision,isDraft",
    "--limit", "20",
  ]);

  // PRs I'm reviewing
  const reviewPRsJson = await runGh([
    "pr", "list",
    "--repo", "ChainSafe/lodestar",
    "--search", "review-requested:lodekeeper",
    "--state", "open",
    "--json", "number,title,state,url,author,createdAt,updatedAt,labels,reviewDecision,isDraft",
    "--limit", "10",
  ]);

  const prs: GitHubPR[] = [];

  for (const raw of [myPRsJson, reviewPRsJson]) {
    if (!raw) continue;
    try {
      const items = JSON.parse(raw);
      for (const item of items) {
        if (!prs.find((p) => p.number === item.number)) {
          prs.push({
            number: item.number,
            title: item.title,
            state: item.state,
            url: item.url,
            author: item.author?.login || "unknown",
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            labels: (item.labels || []).map((l: any) => l.name),
            reviewDecision: item.reviewDecision || "",
            ciStatus: "unknown", // filled separately if needed
            isDraft: item.isDraft || false,
          });
        }
      }
    } catch {
      // skip parse errors
    }
  }

  // Fetch CI status for each PR
  for (const pr of prs) {
    try {
      const ciJson = await runGh([
        "pr", "checks", String(pr.number),
        "--repo", "ChainSafe/lodestar",
        "--json", "name,state,conclusion",
        "--jq", '[.[] | .conclusion] | if all(. == "SUCCESS") then "pass" elif any(. == "FAILURE") then "fail" elif any(. == "") then "pending" else "unknown" end',
      ]);
      pr.ciStatus = ciJson.trim() || "unknown";
    } catch {
      pr.ciStatus = "unknown";
    }
  }

  cachedPRs = prs;
  return prs;
}

export async function fetchNotifications(): Promise<GitHubNotification[]> {
  const json = await runGh([
    "api", "notifications",
    "--jq", '[.[] | {id: .id, reason: .reason, title: .subject.title, type: .subject.type, url: .subject.url, updated: .updated_at, unread: .unread}]',
  ]);

  if (!json) return cachedNotifications;

  const notifications: GitHubNotification[] = [];
  try {
    const items = JSON.parse(json);
    for (const item of items) {
      notifications.push({
        id: item.id,
        reason: item.reason,
        title: item.title,
        type: item.type,
        url: item.url || "",
        updatedAt: item.updated,
        unread: item.unread,
      });
    }
  } catch {
    // Fallback: try line-by-line
    for (const line of json.split("\n")) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        notifications.push({
          id: item.id,
          reason: item.reason,
          title: item.title,
          type: item.type,
          url: item.url || "",
          updatedAt: item.updated,
          unread: item.unread,
        });
      } catch { /* skip */ }
    }
  }

  cachedNotifications = notifications;
  return notifications;
}

export async function collectGitHub() {
  const now = Date.now();
  if (now - lastFetchTime < 30000) {
    return { prs: cachedPRs, notifications: cachedNotifications };
  }
  lastFetchTime = now;

  const [prs, notifications] = await Promise.all([
    fetchPRs(),
    fetchNotifications(),
  ]);

  return { prs, notifications };
}

export function getCachedGitHub() {
  return { prs: cachedPRs, notifications: cachedNotifications };
}
