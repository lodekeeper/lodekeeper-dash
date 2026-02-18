/**
 * Cron collector — reads cron jobs from OpenClaw via CLI.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

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

let cachedJobs: CronJob[] = [];

export async function collectCronJobs(): Promise<CronJob[]> {
  try {
    const { stdout } = await exec("openclaw", ["cron", "list", "--json"], {
      timeout: 10000,
    });
    const jobs = JSON.parse(stdout);
    cachedJobs = jobs.map((j: any) => ({
      id: j.id || j.jobId,
      name: j.name || "Unnamed",
      schedule: formatSchedule(j.schedule),
      lastRun: j.lastRun,
      nextRun: j.nextRun,
      enabled: j.enabled !== false,
      payload: j.payload?.kind || "unknown",
      sessionTarget: j.sessionTarget || "unknown",
    }));
    return cachedJobs;
  } catch {
    // Fallback: return cached
    return cachedJobs;
  }
}

function formatSchedule(schedule: any): string {
  if (!schedule) return "unknown";
  if (schedule.kind === "cron") return schedule.expr;
  if (schedule.kind === "every") {
    const ms = schedule.everyMs;
    if (ms >= 3600000) return `every ${ms / 3600000}h`;
    if (ms >= 60000) return `every ${ms / 60000}m`;
    return `every ${ms / 1000}s`;
  }
  if (schedule.kind === "at") return `at ${schedule.at}`;
  return JSON.stringify(schedule);
}

export function getCachedCronJobs() {
  return cachedJobs;
}
