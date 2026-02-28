import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        orgId: string;
        role: "OWNER" | "ADMIN" | "OPERATOR";
        email: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(roles: Array<"OWNER" | "ADMIN" | "OPERATOR">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
