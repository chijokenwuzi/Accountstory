import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { roleSchema } from "@ali/shared";
import { prisma } from "../../lib/prisma";
import { hashPassword, signAccessToken, signRefreshToken, verifyPassword, verifyRefreshToken } from "../../lib/auth";
import { hashToken } from "../../lib/crypto";
import { requireAuth, requireRole } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const registerSchema = z.object({
  orgName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const inviteSchema = z.object({ email: z.string().email(), role: roleSchema });
const resetRequestSchema = z.object({ email: z.string().email() });
const resetConfirmSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8)
});

export const authRouter = Router();

function buildResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendPasswordResetEmail(email: string, code: string) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn({ email }, "RESEND_API_KEY missing, password reset code email not sent");
    return;
  }

  const from = process.env.RESEND_FROM || "noreply@accountleadinsights.com";
  const html = `
    <p>Your Account Lead Insights password reset code is:</p>
    <p style="font-size:24px;font-weight:700;letter-spacing:2px;">${code}</p>
    <p>This code expires in 15 minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your password reset code",
      html
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend failed (${response.status}): ${body}`);
  }
}

authRouter.post("/register", async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);
    const orgAndUser = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: input.orgName } });
      const user = await tx.user.create({
        data: {
          orgId: org.id,
          name: input.name,
          email: input.email.toLowerCase(),
          role: "OWNER",
          passwordHash: await hashPassword(input.password)
        }
      });
      await tx.subscription.create({ data: { orgId: org.id, status: "TRIAL", plan: "starter" } });
      return { org, user };
    });

    const { org, user } = orgAndUser;
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ error: "An account with this email already exists. Please log in." });
    }
    logger.error({ err: error }, "Failed to register user");
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
  try {
    const { email } = resetRequestSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });

    if (user) {
      const code = buildResetCode();
      const codeHash = hashToken(code);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 15);

      await prisma.passwordResetCode.create({
        data: {
          userId: user.id,
          codeHash,
          expiresAt
        }
      });

      try {
        await sendPasswordResetEmail(normalizedEmail, code);
      } catch (emailError) {
        logger.error({ err: emailError, email: normalizedEmail }, "Failed to send password reset code");
      }
    }

    // Always return success to avoid email enumeration.
    res.json({ requested: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || "Invalid request" });
    }
    logger.error({ err: error }, "Password reset request failed");
    return res.status(500).json({ error: "Unable to process reset request right now" });
  }
});

authRouter.post("/password-reset/confirm", async (req, res) => {
  try {
    const { email, code, newPassword } = resetConfirmSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (!user) return res.status(400).json({ error: "Invalid or expired code" });

    const latest = await prisma.passwordResetCode.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: "desc" }
    });

    if (!latest) return res.status(400).json({ error: "Invalid or expired code" });
    if (latest.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: "Invalid or expired code" });
    if (latest.attempts >= 5) return res.status(400).json({ error: "Too many attempts. Request a new code." });

    const providedHash = hashToken(code);
    if (providedHash !== latest.codeHash) {
      await prisma.passwordResetCode.update({
        where: { id: latest.id },
        data: { attempts: { increment: 1 } }
      });
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const newPasswordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: newPasswordHash } }),
      prisma.passwordResetCode.update({ where: { id: latest.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } })
    ]);

    return res.json({ reset: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || "Invalid request" });
    }
    logger.error({ err: error }, "Password reset confirm failed");
    return res.status(500).json({ error: "Unable to reset password right now" });
  }
});
