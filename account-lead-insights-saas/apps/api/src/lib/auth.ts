import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type AuthTokenPayload = {
  userId: string;
  orgId: string;
  role: "OWNER" | "ADMIN" | "OPERATOR";
  email: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret as jwt.Secret, { expiresIn: env.jwtAccessTtl as any });
}

export function signRefreshToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret as jwt.Secret, { expiresIn: env.jwtRefreshTtl as any });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AuthTokenPayload;
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as AuthTokenPayload;
}
