/**
 * Discord collector — reads tracked threads from workspace memory files.
 */
import { readWorkspaceFile } from "./workspace.js";

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

let cachedThreads: DiscordThread[] = [];

export async function collectDiscordThreads(): Promise<DiscordThread[]> {
  const raw = await readWorkspaceFile("memory/discord-threads.json");
  if (!raw) return cachedThreads;

  try {
    const data = JSON.parse(raw);
    const threads: DiscordThread[] = [];

    // data is an object with threadId keys
    for (const [id, info] of Object.entries(data)) {
      const t = info as any;
      threads.push({
        id,
        name: t.name || `Thread ${id}`,
        channel: t.channel || "unknown",
        guild: t.guild || "",
        guildName: t.guildName || "ChainSafe",
        url: `https://discord.com/channels/${t.guild || "593655374469660673"}/${id}`,
        status: t.status || "active",
        lastCheckedMsg: t.lastCheckedMsg,
        notes: t.notes,
      });
    }

    cachedThreads = threads;
    return threads;
  } catch {
    return cachedThreads;
  }
}

export function getCachedDiscordThreads() {
  return cachedThreads;
}
