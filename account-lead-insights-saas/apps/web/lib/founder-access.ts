const FOUNDER_EMAIL = (process.env.NEXT_PUBLIC_FOUNDER_EMAIL || "chijokenwuzi@gmail.com").toLowerCase();

export function founderEmail() {
  return FOUNDER_EMAIL;
}

export function canAccessFounderPortal(email: string | undefined | null) {
  return String(email || "").trim().toLowerCase() === FOUNDER_EMAIL;
}
