import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { loadConfig, saveConfig, type AppUser, type InviteToken } from "../storage/store.js";
import { nanoid } from "nanoid";

const router = Router();

// ── Brute-force protection ──────────────────────────────────────────
// Tracks failed login attempts per IP. After MAX_ATTEMPTS failures within
// the window, the IP is locked out with exponential backoff.
interface LoginAttempt {
  failures: number;
  firstFailure: number;
  lockedUntil: number;
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;   // 15 min sliding window
const MAX_ATTEMPTS = 5;                     // lock after 5 failures
const BASE_LOCKOUT_MS = 60 * 1000;         // 1 min initial lockout
const MAX_LOCKOUT_MS = 30 * 60 * 1000;     // 30 min max lockout
const loginAttempts = new Map<string, LoginAttempt>();

function getClientIp(req: Request): string {
  // Trust X-Forwarded-For from Traefik/nginx
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

function checkLoginAllowed(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };

  const now = Date.now();

  // Window expired — reset
  if (now - record.firstFailure > LOGIN_WINDOW_MS && record.lockedUntil < now) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  // Currently locked out
  if (record.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((record.lockedUntil - now) / 1000) };
  }

  return { allowed: true };
}

function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || (now - record.firstFailure > LOGIN_WINDOW_MS && record.lockedUntil < now)) {
    loginAttempts.set(ip, { failures: 1, firstFailure: now, lockedUntil: 0 });
    return;
  }

  record.failures += 1;

  if (record.failures >= MAX_ATTEMPTS) {
    // Exponential backoff: 1m, 2m, 4m, 8m, 16m, 30m (capped)
    const lockoutMultiplier = Math.pow(2, Math.floor(record.failures / MAX_ATTEMPTS) - 1);
    const lockoutMs = Math.min(BASE_LOCKOUT_MS * lockoutMultiplier, MAX_LOCKOUT_MS);
    record.lockedUntil = now + lockoutMs;
    console.log(`[auth] IP ${ip} locked for ${lockoutMs / 1000}s after ${record.failures} failed attempts`);
  }
}

function recordLoginSuccess(ip: string): void {
  loginAttempts.delete(ip);
}

// Cleanup stale records every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts) {
    if (now - record.firstFailure > LOGIN_WINDOW_MS && record.lockedUntil < now) {
      loginAttempts.delete(ip);
    }
  }
}, 15 * 60 * 1000);

// ── Token revocation ────────────────────────────────────────────────
// Simple in-memory token blacklist (cleared on restart — acceptable for single-server dashboard)
const revokedTokens = new Set<string>();
const REVOKE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1h

// Periodically clean expired entries
setInterval(() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) return;
  for (const token of revokedTokens) {
    try {
      jwt.verify(token, secret);
    } catch {
      // Token expired naturally, remove from blacklist
      revokedTokens.delete(token);
    }
  }
}, REVOKE_CLEANUP_INTERVAL);

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-me-to-a-random-64-byte-hex-string") {
    throw new Error("JWT_SECRET not configured. Set it in .env (generate with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\")");
  }
  if (secret.length < 32) {
    throw new Error("JWT_SECRET too weak. Must be at least 32 characters. Generate with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"");
  }
  return secret;
}

function signToken(user: { id: string; username: string; role: string }): string {
  const expiry = Number(process.env.JWT_EXPIRY) || 604800;
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    getSecret(),
    { expiresIn: expiry }
  );
}

function setTokenCookie(res: Response, token: string) {
  const expiry = Number(process.env.JWT_EXPIRY) || 604800;
  // Secure=true by default; only disable explicitly for local dev
  const isSecure = process.env.COOKIE_INSECURE !== "true";
  res.cookie("token", token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "strict",
    maxAge: expiry * 1000,
    path: "/",
  });
}

// Check if setup is needed
router.get("/status", async (_req: Request, res: Response) => {
  const config = await loadConfig();
  res.json({
    setupComplete: config.setupComplete,
    hasUsers: config.users.length > 0,
  });
});

// First-time setup
router.post("/setup", async (req: Request, res: Response) => {
  const config = await loadConfig();
  if (config.setupComplete) {
    res.status(400).json({ error: "Setup already complete" });
    return;
  }

  const { username, password } = req.body;
  if (!username || !password || password.length < 8) {
    res.status(400).json({ error: "Username required, password min 8 chars" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user: AppUser = {
    id: nanoid(),
    username,
    passwordHash,
    role: "admin",
    createdAt: new Date().toISOString(),
  };

  config.users.push(user);
  config.setupComplete = true;
  await saveConfig(config);

  const token = signToken(user);
  setTokenCookie(res, token);
  res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
});

// Login (with brute-force protection)
router.post("/login", async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const { allowed, retryAfterSec } = checkLoginAllowed(ip);

  if (!allowed) {
    res.status(429).json({
      error: "Too many failed attempts. Try again later.",
      retryAfterSec,
    });
    return;
  }

  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const config = await loadConfig();
  const user = config.users.find((u) => u.username === username);
  if (!user) {
    recordLoginFailure(ip);
    // Constant-time delay to prevent username enumeration
    await bcrypt.compare(password, "$2a$12$000000000000000000000000000000000000000000");
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    recordLoginFailure(ip);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  recordLoginSuccess(ip);
  const token = signToken(user);
  setTokenCookie(res, token);
  res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
});

// Logout — invalidate token + clear cookie
router.post("/logout", (req: Request, res: Response) => {
  const token = req.cookies?.token;
  if (token) {
    revokedTokens.add(token);
  }
  res.clearCookie("token", { path: "/" });
  res.json({ ok: true });
});

// Verify current session
router.get("/me", async (req: Request, res: Response) => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload;
    res.json({
      user: {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
      },
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Get short-lived WS token (for WebSocket auth since httpOnly cookie can't be read by JS)
router.get("/ws-token", async (req: Request, res: Response) => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload;
    // Issue a short-lived token (60s) specifically for WS auth
    const wsToken = jwt.sign(
      { sub: payload.sub, username: payload.username, role: payload.role, ws: true },
      getSecret(),
      { expiresIn: 60 }
    );
    res.json({ token: wsToken });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Create invite (admin only)
router.post("/invite", async (req: Request, res: Response) => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload;
    if (payload.role !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return;
    }

    const config = await loadConfig();
    const invite: InviteToken = {
      token: nanoid(32),
      createdBy: payload.sub as string,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      used: false,
    };

    config.invites = config.invites || [];
    config.invites.push(invite);
    await saveConfig(config);

    res.json({ inviteUrl: `/invite/${invite.token}` });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Accept invite
router.post("/invite/:inviteToken", async (req: Request, res: Response) => {
  const { inviteToken } = req.params;
  const { username, password } = req.body;

  if (!username || !password || password.length < 8) {
    res.status(400).json({ error: "Username required, password min 8 chars" });
    return;
  }

  const config = await loadConfig();
  const invite = config.invites?.find(
    (i) => i.token === inviteToken && !i.used && new Date(i.expiresAt) > new Date()
  );

  if (!invite) {
    res.status(400).json({ error: "Invalid or expired invite" });
    return;
  }

  if (config.users.find((u) => u.username === username)) {
    res.status(400).json({ error: "Username taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user: AppUser = {
    id: nanoid(),
    username,
    passwordHash,
    role: "viewer",
    createdAt: new Date().toISOString(),
  };

  invite.used = true;
  config.users.push(user);
  await saveConfig(config);

  const token = signToken(user);
  setTokenCookie(res, token);
  res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
});

// JWT verification middleware
export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Check revocation list
  if (revokedTokens.has(token)) {
    res.clearCookie("token", { path: "/" });
    res.status(401).json({ error: "Token revoked" });
    return;
  }

  try {
    const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload;
    (req as any).user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export { router as authRouter };
