import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { loadConfig, saveConfig, type AppUser, type InviteToken } from "../storage/store.js";
import { nanoid } from "nanoid";

const router = Router();

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-me-to-a-random-64-byte-hex-string") {
    throw new Error("JWT_SECRET not configured. Set it in .env");
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
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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

// Login
router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const config = await loadConfig();
  const user = config.users.find((u) => u.username === username);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken(user);
  setTokenCookie(res, token);
  res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
});

// Logout
router.post("/logout", (_req: Request, res: Response) => {
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
