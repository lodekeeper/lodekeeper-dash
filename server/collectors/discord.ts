/**
 * Discord collector — reads tracked threads from workspace memory files.
 */
import { readWorkspaceFile } from "./workspace.js";

export interface DiscordThread {
  id: string;
  name: string;
  channel: string;
  channelId?: string;
  guild: string;
  guildName: string;
  url: string;
  status: "active" | "quiet" | "archived";
  lastCheckedMsg?: string;
  lastActivity?: string; // ISO timestamp from snowflake
  notes?: string;
}

// Discord snowflake epoch: 2015-01-01T00:00:00.000Z
const DISCORD_EPOCH = 1420070400000n;

function snowflakeToDate(snowflake: string): string | undefined {
  try {
    const id = BigInt(snowflake);
    const timestamp = Number((id >> 22n) + DISCORD_EPOCH);
    return new Date(timestamp).toISOString();
  } catch {
    return undefined;
  }
}

const CHAINSAFE_GUILD = "593655374469660673";
const STEEL_GUILD = "1359927674746835211";

let cachedThreads: DiscordThread[] = [];

export async function collectDiscordThreads(): Promise<DiscordThread[]> {
  const raw = await readWorkspaceFile("memory/discord-threads.json");
  if (!raw) return cachedThreads;

  try {
    const data = JSON.parse(raw);
    const threads: DiscordThread[] = [];

    // Parse "threads" array (ChainSafe Discord)
    if (Array.isArray(data.threads)) {
      for (const t of data.threads) {
        threads.push({
          id: t.id,
          name: t.name || `Thread ${t.id}`,
          channel: t.channel || "lodestar-developer",
          guild: CHAINSAFE_GUILD,
          guildName: "ChainSafe",
          url: `https://discord.com/channels/${CHAINSAFE_GUILD}/${t.id}`,
          status: t.status || "active",
          lastCheckedMsg: t.lastCheckedMessageId,
          lastActivity: t.lastCheckedMessageId ? snowflakeToDate(t.lastCheckedMessageId) : undefined,
          notes: t.notes,
        });
      }
    }

    // Parse "steelThreads" array (STEEL Discord)
    if (Array.isArray(data.steelThreads)) {
      for (const t of data.steelThreads) {
        const guild = t.guildId || STEEL_GUILD;
        threads.push({
          id: t.id,
          name: t.name || `Thread ${t.id}`,
          channel: "lodestar",
          guild,
          guildName: "STEEL",
          url: `https://discord.com/channels/${guild}/${t.id}`,
          status: t.status || "active",
          lastCheckedMsg: t.lastCheckedMessageId,
          lastActivity: t.lastCheckedMessageId ? snowflakeToDate(t.lastCheckedMessageId) : undefined,
          notes: t.notes,
        });
      }
    }

    // Parse "steelChannels" array
    if (Array.isArray(data.steelChannels)) {
      for (const c of data.steelChannels) {
        // Only add if not already present as a thread
        if (!threads.find((t) => t.id === c.id)) {
          const guild = c.guildId || STEEL_GUILD;
          threads.push({
            id: c.id,
            name: c.name || `Channel ${c.id}`,
            channel: "lodestar",
            guild,
            guildName: "STEEL",
            url: `https://discord.com/channels/${guild}/${c.id}`,
            status: "active",
            lastCheckedMsg: c.lastCheckedMessageId,
            lastActivity: c.lastCheckedMessageId ? snowflakeToDate(c.lastCheckedMessageId) : undefined,
          });
        }
      }
    }

    // Also support legacy format: object with threadId keys
    if (!Array.isArray(data.threads) && !Array.isArray(data.steelThreads)) {
      for (const [id, info] of Object.entries(data)) {
        if (typeof info === "object" && info !== null && !Array.isArray(info)) {
          const t = info as any;
          if (t.name || t.guild || t.channel) {
            const guild = t.guild || CHAINSAFE_GUILD;
            threads.push({
              id,
              name: t.name || `Thread ${id}`,
              channel: t.channel || "unknown",
              guild,
              guildName: guild === STEEL_GUILD ? "STEEL" : "ChainSafe",
              url: `https://discord.com/channels/${guild}/${id}`,
              status: t.status || "active",
              lastCheckedMsg: t.lastCheckedMsg || t.lastCheckedMessageId,
              notes: t.notes,
            });
          }
        }
      }
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
