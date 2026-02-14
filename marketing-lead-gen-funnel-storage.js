const LEAD_GEN_FUNNEL_STORAGE_KEY = "leadgen_funnel_state_v1";

function readLeadGenFunnelState() {
  try {
    const raw = localStorage.getItem(LEAD_GEN_FUNNEL_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLeadGenFunnelState(nextState) {
  localStorage.setItem(LEAD_GEN_FUNNEL_STORAGE_KEY, JSON.stringify(nextState));
}

function mergeLeadGenFunnelState(patch) {
  const current = readLeadGenFunnelState();
  const next = { ...current, ...(patch || {}) };
  writeLeadGenFunnelState(next);
  return next;
}

function clearLeadGenFunnelState() {
  localStorage.removeItem(LEAD_GEN_FUNNEL_STORAGE_KEY);
}

window.LeadGenFunnelStorage = {
  read: readLeadGenFunnelState,
  write: writeLeadGenFunnelState,
  merge: mergeLeadGenFunnelState,
  clear: clearLeadGenFunnelState
};
