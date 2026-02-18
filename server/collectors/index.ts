/**
 * Collector orchestrator — starts periodic data collection.
 */
import { collectGitHub } from "./github.js";
import { collectDiscordThreads } from "./discord.js";
import { collectCronJobs } from "./cron.js";
import { collectAgents } from "./agents.js";
import { broadcast } from "../ws/hub.js";
import { readJSON, writeJSON } from "../storage/store.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(execFile);
const NVM_NODE = "/home/openclaw/.nvm/versions/node/v22.22.0/bin";

const GITHUB_INTERVAL = 60_000;   // 60s
const DISCORD_INTERVAL = 120_000; // 2min
const CRON_INTERVAL = 120_000;    // 2min
const AGENT_INTERVAL = 15_000;    // 15s

export function startCollectors() {
  console.log("📊 Starting data collectors...");

  // Initial fetch
  setTimeout(async () => {
    await runAll();
  }, 2000);

  // Periodic
  setInterval(async () => {
    const gh = await collectGitHub();
    broadcast({ type: "github", data: gh });
  }, GITHUB_INTERVAL);

  setInterval(async () => {
    const threads = await collectDiscordThreads();
    broadcast({ type: "discord", data: threads });
  }, DISCORD_INTERVAL);

  setInterval(async () => {
    const jobs = await collectCronJobs();
    broadcast({ type: "cron", data: jobs });
  }, CRON_INTERVAL);

  setInterval(async () => {
    const agents = await collectAgents();
    broadcast({ type: "agents", data: agents });
  }, AGENT_INTERVAL);

  // Usage snapshots
  setTimeout(recordUsageSnapshot, 10000);
  setInterval(recordUsageSnapshot, USAGE_INTERVAL);
}

// Record daily usage snapshot every 10 minutes
const USAGE_INTERVAL = 600_000;

async function recordUsageSnapshot() {
  try {
    const { stdout } = await execAsync(
      `${NVM_NODE}/openclaw`,
      ["sessions", "--json"],
      { timeout: 15000, env: { ...process.env, PATH: `${NVM_NODE}:${process.env.PATH}` } }
    );
    const data = JSON.parse(stdout);
    const sessions = data.sessions || [];
    const totalTokens = sessions.reduce((sum: number, s: any) => sum + (s.totalTokens || 0), 0);
    const today = new Date().toISOString().slice(0, 10);

    const history = await readJSON<{ daily: Array<{ date: string; tokens: number; sessions: number }> }>("usage-history.json", { daily: [] });
    const existing = history.daily.find((d: any) => d.date === today);
    if (existing) {
      existing.tokens = totalTokens;
      existing.sessions = data.count || sessions.length;
    } else {
      history.daily.push({ date: today, tokens: totalTokens, sessions: data.count || sessions.length });
    }
    history.daily = history.daily.slice(-90);
    await writeJSON("usage-history.json", history);
  } catch { /* ignore */ }
}

async function runAll() {
  try {
    const [gh, threads, jobs, agents] = await Promise.all([
      collectGitHub(),
      collectDiscordThreads(),
      collectCronJobs(),
      collectAgents(),
    ]);

    broadcast({ type: "github", data: gh });
    broadcast({ type: "discord", data: threads });
    broadcast({ type: "cron", data: jobs });
    broadcast({ type: "agents", data: agents });
  } catch (err) {
    console.error("Collector error:", err);
  }
}
