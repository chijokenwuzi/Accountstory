import { NextFunction, Request, Response } from "express";
import { canAccessOperator } from "../lib/operator-admins";

export async function requireOperatorAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: "Unauthorized" });
  const allowed = await canAccessOperator(req.auth.email);
  if (!allowed) return res.status(403).json({ error: "Operator access denied for this account." });
  return next();
}

