import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { roleSchema } from "@ali/shared";
import { prisma } from "../../lib/prisma";
import { hashPassword, signAccessToken, signRefreshToken, verifyPassword, verifyRefreshToken } from "../../lib/auth";
import { hashToken } from "../../lib/crypto";
import { requireAuth, requireRole } from "../../middleware/auth";

const registerSchema = z.object({
  orgName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const inviteSchema = z.object({ email: z.string().email(), role: roleSchema });
const resetRequestSchema = z.object({ email: z.string().email() });
const resetConfirmSchema = z.object({ token: z.string().min(8), newPassword: z.string().min(8) });

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);
    const org = await prisma.organization.create({ data: { name: input.orgName } });
    const user = await prisma.user.create({
      data: {
        orgId: org.id,
        name: input.name,
        email: input.email.toLowerCase(),
        role: "OWNER",
        passwordHash: await hashPassword(input.password)
      }
    });

    await prisma.subscription.create({ data: { orgId: org.id, status: "TRIAL", plan: "starter" } });

    const payload = { userId: user.id, orgId: org.id, role: user.role, email: user.email } as const;
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      }
    });

    res.status(201).json({ accessToken, refreshToken, user: { id: user.id, orgId: org.id, role: user.role, email: user.email } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || "Invalid registration input" });
    }
    return res.status(500).json({ error: "Unable to create account right now" });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({ where: { email: input.email.toLowerCase() } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const payload = { userId: user.id, orgId: user.orgId, role: user.role, email: user.email } as const;
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      }
    });

    res.json({ accessToken, refreshToken, user: { id: user.id, orgId: user.orgId, role: user.role, email: user.email } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || "Invalid login input" });
    }
    return res.status(500).json({ error: "Unable to log in right now" });
  }
});

authRouter.post("/refresh", async (req, res) => {
  try {
    const token = String(req.body?.refreshToken || "");
    if (!token) return res.status(400).json({ error: "refreshToken required" });

    const payload = verifyRefreshToken(token);
    const tokenRow = await prisma.refreshToken.findFirst({ where: { userId: payload.userId, tokenHash: hashToken(token) } });
    if (!tokenRow) return res.status(401).json({ error: "Invalid refresh token" });

    const accessToken = signAccessToken(payload);
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { id: user.id, orgId: user.orgId, role: user.role, email: user.email, name: user.name } });
});

authRouter.post("/invite", requireAuth, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  const input = inviteSchema.parse(req.body);
  const token = crypto.randomUUID();
  const invite = await prisma.invite.create({
    data: {
      orgId: req.auth!.orgId,
      email: input.email.toLowerCase(),
      role: input.role,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      sentByUserId: req.auth!.userId
    }
  });
  res.status(201).json({ inviteId: invite.id, token });
});

authRouter.post("/password-reset/request", async (req, res) => {
  const { email } = resetRequestSchema.parse(req.body);
  // In production send secure reset email token via Resend.
  const token = crypto.randomUUID();
  res.json({ requested: true, email, token });
});

authRouter.post("/password-reset/confirm", async (req, res) => {
  const { token, newPassword } = resetConfirmSchema.parse(req.body);
  if (!token) return res.status(400).json({ error: "Invalid token" });
  // Baseline: placeholder flow. Production should resolve token -> user.
  res.json({ reset: true, passwordHashPreview: await hashPassword(newPassword) });
});
