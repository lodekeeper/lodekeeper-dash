import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../data");

export async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export function dataPath(filename: string): string {
  return path.join(DATA_DIR, filename);
}

export async function readJSON<T>(filename: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(dataPath(filename), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJSON(filename: string, data: unknown): Promise<void> {
  await fs.writeFile(dataPath(filename), JSON.stringify(data, null, 2), "utf-8");
}

export async function loadConfig(): Promise<AppConfig> {
  return readJSON<AppConfig>("config.json", { users: [], setupComplete: false });
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await writeJSON("config.json", config);
}

export interface AppUser {
  id: string;
  username: string;
  passwordHash: string;
  role: "admin" | "viewer";
  createdAt: string;
}

export interface InviteToken {
  token: string;
  createdBy: string;
  expiresAt: string;
  used: boolean;
}

export interface AppConfig {
  users: AppUser[];
  invites?: InviteToken[];
  setupComplete: boolean;
}
