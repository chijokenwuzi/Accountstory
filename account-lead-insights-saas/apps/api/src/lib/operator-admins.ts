import path from "path";
import fs from "fs/promises";

function resolveDataDir() {
  const cwd = process.cwd();
  const normalized = cwd.replace(/\\/g, "/");
  if (normalized.endsWith("/apps/api")) {
    return path.resolve(cwd, "data");
  }
  return path.resolve(cwd, "apps/api/data");
}

const DATA_DIR = resolveDataDir();
const ALLOWLIST_PATH = path.join(DATA_DIR, "operator-admins.json");
const DEFAULT_ADMINS = ["chijokenwuzi@gmail.com"];

type AllowlistFile = { admins: string[] };

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

async function ensureAllowlistFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(ALLOWLIST_PATH);
  } catch {
    const payload: AllowlistFile = { admins: [...DEFAULT_ADMINS] };
    await fs.writeFile(ALLOWLIST_PATH, JSON.stringify(payload, null, 2), "utf8");
  }
}

export async function getOperatorAdmins(): Promise<string[]> {
  await ensureAllowlistFile();
  try {
    const raw = await fs.readFile(ALLOWLIST_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AllowlistFile>;
    const admins = Array.isArray(parsed.admins) ? parsed.admins : [];
    const deduped = Array.from(new Set(admins.map(normalizeEmail).filter(Boolean)));
    return deduped.length ? deduped : [...DEFAULT_ADMINS];
  } catch {
    return [...DEFAULT_ADMINS];
  }
}

export async function addOperatorAdmin(email: string): Promise<string[]> {
  const nextEmail = normalizeEmail(email);
  if (!nextEmail) {
    return getOperatorAdmins();
  }
  const existing = await getOperatorAdmins();
  const merged = Array.from(new Set([...existing, nextEmail]));
  await fs.writeFile(ALLOWLIST_PATH, JSON.stringify({ admins: merged }, null, 2), "utf8");
  return merged;
}

export async function removeOperatorAdmin(email: string): Promise<string[]> {
  const target = normalizeEmail(email);
  const existing = await getOperatorAdmins();
  const filtered = existing.filter((entry) => entry !== target);
  const safe = filtered.length ? filtered : [...DEFAULT_ADMINS];
  await fs.writeFile(ALLOWLIST_PATH, JSON.stringify({ admins: safe }, null, 2), "utf8");
  return safe;
}

export async function canAccessOperator(email: string): Promise<boolean> {
  const admins = await getOperatorAdmins();
  return admins.includes(normalizeEmail(email));
}
