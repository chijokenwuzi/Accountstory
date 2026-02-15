const LEAD_GEN_FUNNEL_STORAGE_KEY = "leadgen_funnel_state_v1";

function normalizeChannelKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "twitter-ads") return "facebook-ads";
  if (key === "tiktok-ads") return "local-services-ads";
  return key;
}

function normalizeChannels(values) {
  if (!Array.isArray(values)) return [];
  const deduped = [];
  values.forEach((entry) => {
    const key = normalizeChannelKey(entry);
    if (!key || deduped.includes(key)) return;
    deduped.push(key);
  });
  return deduped;
}

function readLeadGenFunnelState() {
  try {
    const raw = localStorage.getItem(LEAD_GEN_FUNNEL_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const next = { ...parsed };
    if (Array.isArray(next.channels)) {
      next.channels = normalizeChannels(next.channels);
    }
    if (next.channelAllocations && typeof next.channelAllocations === "object") {
      const migrated = {};
      Object.entries(next.channelAllocations).forEach(([channelKey, percent]) => {
        const key = normalizeChannelKey(channelKey);
        if (!key) return;
        migrated[key] = Number(migrated[key] || 0) + Number(percent || 0);
      });
      next.channelAllocations = migrated;
    }
    return next;
  } catch {
    return {};
  }
}

function writeLeadGenFunnelState(nextState) {
  localStorage.setItem(LEAD_GEN_FUNNEL_STORAGE_KEY, JSON.stringify(nextState));
}

function mergeLeadGenFunnelState(patch) {
  const current = readLeadGenFunnelState();
  const incoming = { ...(patch || {}) };
  if (Array.isArray(incoming.channels)) {
    incoming.channels = normalizeChannels(incoming.channels);
  }
  if (incoming.channelAllocations && typeof incoming.channelAllocations === "object") {
    const nextAllocations = {};
    Object.entries(incoming.channelAllocations).forEach(([channelKey, percent]) => {
      const key = normalizeChannelKey(channelKey);
      if (!key) return;
      nextAllocations[key] = Number(percent || 0);
    });
    incoming.channelAllocations = nextAllocations;
  }
  const next = { ...current, ...incoming };
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
