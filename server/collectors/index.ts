/**
 * Collector orchestrator — starts periodic data collection.
 */
import { collectGitHub } from "./github.js";
import { collectDiscordThreads } from "./discord.js";
import { collectCronJobs } from "./cron.js";
import { collectAgents } from "./agents.js";
import { broadcast } from "../ws/hub.js";

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
