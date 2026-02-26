const http = require("http");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

const HOST = String(process.env.HOST || "0.0.0.0");
const PORT = Number(process.env.PORT || 8080);

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const COMPANIES_PATH = path.join(DATA_DIR, "companies.json");
const STORIES_PATH = path.join(DATA_DIR, "stories.json");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
const FOUNDER_BACKEND_URL = String(process.env.FOUNDER_BACKEND_URL || "http://127.0.0.1:9091/index.html").trim();
const GOOGLE_OAUTH_CLIENT_ID = String(process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
const GOOGLE_OAUTH_CLIENT_SECRET = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
const GOOGLE_OAUTH_REDIRECT_URI = String(
  process.env.GOOGLE_OAUTH_REDIRECT_URI || `http://127.0.0.1:${PORT}/api/ads/connections/google/oauth/callback`
).trim();
const GOOGLE_ADS_DEVELOPER_TOKEN = String(process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim();
const GOOGLE_ADS_API_VERSION = String(process.env.GOOGLE_ADS_API_VERSION || "v18").trim();
const META_APP_ID = String(process.env.META_APP_ID || "").trim();
const META_APP_SECRET = String(process.env.META_APP_SECRET || "").trim();
const META_OAUTH_REDIRECT_URI = String(
  process.env.META_OAUTH_REDIRECT_URI || `http://127.0.0.1:${PORT}/api/ads/connections/meta/oauth/callback`
).trim();
const META_GRAPH_API_VERSION = String(process.env.META_GRAPH_API_VERSION || "v19.0").trim();
const ADS_SYNC_ENABLED = String(process.env.ADS_SYNC_ENABLED || "true").trim().toLowerCase() !== "false";
const ADS_SYNC_INTERVAL_MINUTES = Math.max(5, Number(process.env.ADS_SYNC_INTERVAL_MINUTES || 30));
const ADS_SYNC_RUN_ON_START = String(process.env.ADS_SYNC_RUN_ON_START || "false").trim().toLowerCase() === "true";
const TOKEN_ENCRYPTION_KEY = String(process.env.TOKEN_ENCRYPTION_KEY || "").trim();
const TOKEN_KEY_BUFFER = TOKEN_ENCRYPTION_KEY
  ? crypto.createHash("sha256").update(TOKEN_ENCRYPTION_KEY).digest()
  : null;
const CAMPAIGN_STATUSES = new Set(["Draft", "Approved", "Queued"]);
const LEAD_GEN_CHANNEL_DEFINITIONS = {
  "google-ads": { label: "Google Ads", defaultCpl: 180 },
  "facebook-ads": { label: "Facebook Ads", defaultCpl: 135 },
  "local-services-ads": { label: "Local Service Ads", defaultCpl: 95 },
  seo: { label: "SEO", defaultCpl: 95 }
};
const LEAD_GEN_CHANNEL_KEYS = new Set(Object.keys(LEAD_GEN_CHANNEL_DEFINITIONS));
const LEAD_GEN_CHANNEL_ALIASES = {
  "twitter-ads": "facebook-ads",
  "tiktok-ads": "local-services-ads"
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== null) {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  const payload = JSON.stringify(value, null, 2);
  await fs.writeFile(filePath, payload, "utf8");
}

function withDefaultStore(base) {
  return {
    users: Array.isArray(base.users) ? base.users : [],
    sessions: base.sessions && typeof base.sessions === "object" ? base.sessions : {},
    workspaceNotes: base.workspaceNotes && typeof base.workspaceNotes === "object" ? base.workspaceNotes : {},
    companyStories: base.companyStories && typeof base.companyStories === "object" ? base.companyStories : {},
    workspaceCustomizations:
      base.workspaceCustomizations && typeof base.workspaceCustomizations === "object"
        ? base.workspaceCustomizations
        : {},
    automationCampaigns:
      base.automationCampaigns && typeof base.automationCampaigns === "object" ? base.automationCampaigns : {},
    leadSignups: Array.isArray(base.leadSignups) ? base.leadSignups : [],
    adsConnections: base.adsConnections && typeof base.adsConnections === "object" ? base.adsConnections : {},
    adsOAuthStates: base.adsOAuthStates && typeof base.adsOAuthStates === "object" ? base.adsOAuthStates : {},
    adsSyncRuns: Array.isArray(base.adsSyncRuns) ? base.adsSyncRuns : [],
    adsMetricsDaily: Array.isArray(base.adsMetricsDaily) ? base.adsMetricsDaily : []
  };
}

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const seedStories = await readJson(STORIES_PATH, {});

  let existing = null;
  try {
    existing = await readJson(STORE_PATH);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  if (!existing) {
    await writeJson(
      STORE_PATH,
      withDefaultStore({
        users: [],
        sessions: {},
        workspaceNotes: {},
        companyStories: seedStories,
        workspaceCustomizations: {},
        automationCampaigns: {}
      })
    );
    return;
  }

  const nextStore = withDefaultStore(existing);
  for (const [companyId, stories] of Object.entries(seedStories)) {
    if (!Array.isArray(nextStore.companyStories[companyId]) || nextStore.companyStories[companyId].length === 0) {
      nextStore.companyStories[companyId] = stories;
    }
  }

  await writeJson(STORE_PATH, nextStore);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
}

function createWorkspaceId(name) {
  const slug = String(name || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return `${slug || "workspace"}-${crypto.randomBytes(3).toString("hex")}`;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    workspaceId: user.workspaceId,
    workspaceName: user.workspaceName
  };
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}

async function getBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function authenticate(req, store) {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  const session = store.sessions[token];
  if (!session) {
    return null;
  }

  const user = store.users.find((entry) => entry.id === session.userId);
  if (!user) {
    delete store.sessions[token];
    return null;
  }

  return { token, user };
}

function normalizeStory(story, fallbackAuthor = "Unknown Seller") {
  return {
    id: String(story.id || crypto.randomUUID()),
    title: String(story.title || "Untitled story"),
    stage: String(story.stage || "Unknown stage"),
    outcome: String(story.outcome || "Unknown"),
    author: String(story.author || fallbackAuthor),
    story: String(story.story || ""),
    createdAt: story.createdAt || new Date().toISOString()
  };
}

function getCompanyCustomization(store, workspaceId, companyId) {
  if (!store.workspaceCustomizations[workspaceId]) {
    store.workspaceCustomizations[workspaceId] = {};
  }
  if (!store.workspaceCustomizations[workspaceId][companyId]) {
    store.workspaceCustomizations[workspaceId][companyId] = {
      stakeholders: [],
      buyingProcess: []
    };
  }
  return store.workspaceCustomizations[workspaceId][companyId];
}

function sanitizeText(value, fallback = "", maxLength = 240) {
  const next = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!next) {
    return fallback;
  }
  return next.slice(0, maxLength);
}

function sanitizeList(values, maxItems = 6, maxLength = 180) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((entry) => sanitizeText(entry, "", maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeSignupPayload(raw) {
  const payload = raw && typeof raw === "object" ? raw : {};
  return {
    type: sanitizeText(payload.type, "general_signup", 40),
    source: sanitizeText(payload.source, "website", 80),
    name: sanitizeText(payload.name, "", 120),
    phone: sanitizeText(payload.phone, "", 60),
    email: sanitizeText(payload.email, "", 180).toLowerCase(),
    communicationMethod: sanitizeText(payload.communicationMethod, "", 60),
    availability: sanitizeText(payload.availability, "", 400),
    notes: sanitizeText(payload.notes, "", 800),
    businessName: sanitizeText(payload.businessName, "", 160),
    industry: sanitizeText(payload.industry, "", 120),
    monthlyBudgetUsd: sanitizeText(payload.monthlyBudgetUsd, "", 40),
    channels: sanitizeList(payload.channels, 8, 80)
  };
}

function addLeadSignup(store, payload) {
  const signup = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...sanitizeSignupPayload(payload)
  };
  store.leadSignups.unshift(signup);
  if (store.leadSignups.length > 500) {
    store.leadSignups.length = 500;
  }
  return signup;
}

function maskSecret(secret) {
  const value = String(secret || "");
  if (!value) return "";
  if (value.length <= 4) return `••••${value}`;
  return `••••••••${value.slice(-4)}`;
}

function encryptSecret(secret) {
  const value = String(secret || "").trim();
  if (!value) return null;
  if (!TOKEN_KEY_BUFFER) {
    return { mode: "plain", value };
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", TOKEN_KEY_BUFFER, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    mode: "enc",
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    value: encrypted.toString("hex")
  };
}

function decryptSecret(secretEnvelope) {
  if (!secretEnvelope) return "";
  if (typeof secretEnvelope === "string") {
    return secretEnvelope;
  }
  if (secretEnvelope.mode === "plain") {
    return String(secretEnvelope.value || "");
  }
  if (secretEnvelope.mode !== "enc" || !TOKEN_KEY_BUFFER) {
    return "";
  }
  try {
    const iv = Buffer.from(String(secretEnvelope.iv || ""), "hex");
    const tag = Buffer.from(String(secretEnvelope.tag || ""), "hex");
    const encrypted = Buffer.from(String(secretEnvelope.value || ""), "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", TOKEN_KEY_BUFFER, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

function getAdsConnection(store, channelKey) {
  if (!store.adsConnections || typeof store.adsConnections !== "object") {
    store.adsConnections = {};
  }
  if (!store.adsConnections[channelKey] || typeof store.adsConnections[channelKey] !== "object") {
    store.adsConnections[channelKey] = {
      channel: channelKey,
      connected: false,
      accountId: "",
      customerId: "",
      loginCustomerId: "",
      businessId: "",
      token: null,
      tokenLast4: "",
      tokenType: "",
      syncStatus: "not_connected",
      lastSyncAt: "",
      lastError: "",
      updatedAt: ""
    };
  }
  return store.adsConnections[channelKey];
}

function sanitizeConnectionForClient(connection) {
  return {
    channel: sanitizeText(connection.channel, "", 20),
    connected: Boolean(connection.connected),
    accountId: sanitizeText(connection.accountId, "", 80),
    customerId: sanitizeText(connection.customerId, "", 80),
    loginCustomerId: sanitizeText(connection.loginCustomerId, "", 80),
    businessId: sanitizeText(connection.businessId, "", 80),
    tokenConfigured: Boolean(connection.token),
    tokenLast4: sanitizeText(connection.tokenLast4 || "", "", 16),
    tokenMask: maskSecret(connection.tokenLast4 || ""),
    tokenType: sanitizeText(connection.tokenType, "", 40),
    syncStatus: sanitizeText(connection.syncStatus, "not_connected", 80),
    lastSyncAt: sanitizeText(connection.lastSyncAt, "", 80),
    lastError: sanitizeText(connection.lastError, "", 320),
    updatedAt: sanitizeText(connection.updatedAt, "", 80)
  };
}

function createAdsOauthState(store, channel, metadata = {}) {
  if (!store.adsOAuthStates || typeof store.adsOAuthStates !== "object") {
    store.adsOAuthStates = {};
  }
  const state = crypto.randomBytes(20).toString("hex");
  store.adsOAuthStates[state] = {
    channel,
    createdAt: new Date().toISOString(),
    returnTo: sanitizeText(metadata.returnTo, "/founder-integrations", 180),
    accountId: sanitizeText(metadata.accountId, "", 80),
    customerId: sanitizeText(metadata.customerId, "", 80),
    loginCustomerId: sanitizeText(metadata.loginCustomerId, "", 80),
    businessId: sanitizeText(metadata.businessId, "", 80)
  };
  return state;
}

function consumeAdsOauthState(store, state, expectedChannel) {
  if (!state || !store.adsOAuthStates || typeof store.adsOAuthStates !== "object") {
    return null;
  }
  const data = store.adsOAuthStates[state];
  delete store.adsOAuthStates[state];
  if (!data) return null;
  if (expectedChannel && data.channel !== expectedChannel) return null;
  return data;
}

function buildGoogleOauthUrl(state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent",
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function buildMetaOauthUrl(state) {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: "ads_read,ads_management,business_management",
    state
  });
  return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

async function exchangeGoogleCodeForToken(code) {
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials are missing.");
  }

  const body = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || "Google OAuth token exchange failed.");
  }
  return payload;
}

async function refreshGoogleAccessToken(refreshToken) {
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials are missing.");
  }

  const body = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || "Google access token refresh failed.");
  }
  return payload;
}

async function exchangeMetaCodeForToken(code) {
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error("Meta app credentials are missing.");
  }

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    code,
    redirect_uri: META_OAUTH_REDIRECT_URI
  });
  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token?${params.toString()}`
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || "Meta OAuth token exchange failed.");
  }
  return payload;
}

function normalizeMetricsRow(row, fallbackChannel) {
  const spendUsd = Number(row.spendUsd || 0);
  const conversions = Number(row.conversions || 0);
  return {
    channel: sanitizeText(row.channel, fallbackChannel, 24),
    date: sanitizeText(row.date, new Date().toISOString().slice(0, 10), 16),
    accountId: sanitizeText(row.accountId, "", 80),
    campaignId: sanitizeText(row.campaignId, "", 80),
    campaignName: sanitizeText(row.campaignName, "", 180),
    impressions: Math.max(0, Number(row.impressions || 0)),
    clicks: Math.max(0, Number(row.clicks || 0)),
    spendUsd: Number.isFinite(spendUsd) ? Number(spendUsd.toFixed(2)) : 0,
    conversions: Number.isFinite(conversions) ? Number(conversions.toFixed(2)) : 0,
    cplUsd: conversions > 0 ? Number((spendUsd / conversions).toFixed(2)) : 0,
    source: sanitizeText(row.source, "api", 40),
    syncedAt: new Date().toISOString()
  };
}

function mergeMetricsRows(store, rows) {
  const current = Array.isArray(store.adsMetricsDaily) ? store.adsMetricsDaily : [];
  const byKey = new Map();
  current.forEach((entry) => {
    const key = `${entry.channel}|${entry.date}|${entry.accountId}|${entry.campaignId}`;
    byKey.set(key, entry);
  });

  rows.forEach((entry) => {
    const normalized = normalizeMetricsRow(entry, entry.channel || "unknown");
    const key = `${normalized.channel}|${normalized.date}|${normalized.accountId}|${normalized.campaignId}`;
    byKey.set(key, normalized);
  });

  store.adsMetricsDaily = Array.from(byKey.values())
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 8000);
}

function summarizeAdsMetrics(store, days = 30) {
  const metrics = Array.isArray(store.adsMetricsDaily) ? store.adsMetricsDaily : [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(1, Number(days || 30)));

  const channelMap = new Map();
  metrics.forEach((entry) => {
    const dateValue = new Date(entry.date);
    if (Number.isNaN(dateValue.getTime()) || dateValue < cutoff) {
      return;
    }
    const channelKey = sanitizeText(entry.channel, "unknown", 24);
    const existing = channelMap.get(channelKey) || {
      channel: channelKey,
      spendUsd: 0,
      conversions: 0,
      clicks: 0,
      impressions: 0
    };
    existing.spendUsd += Number(entry.spendUsd || 0);
    existing.conversions += Number(entry.conversions || 0);
    existing.clicks += Number(entry.clicks || 0);
    existing.impressions += Number(entry.impressions || 0);
    channelMap.set(channelKey, existing);
  });

  return Array.from(channelMap.values())
    .map((entry) => ({
      ...entry,
      spendUsd: Number(entry.spendUsd.toFixed(2)),
      conversions: Number(entry.conversions.toFixed(2)),
      cplUsd: entry.conversions > 0 ? Number((entry.spendUsd / entry.conversions).toFixed(2)) : 0
    }))
    .sort((a, b) => b.spendUsd - a.spendUsd);
}

function buildRecentDateRange(days = 7) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(1, Number(days || 7)));
  const format = (value) => value.toISOString().slice(0, 10);
  return { since: format(start), until: format(end) };
}

async function fetchGoogleAdsMetrics(connection) {
  const refreshToken = decryptSecret(connection.token);
  if (!refreshToken) {
    throw new Error("Google refresh token is missing.");
  }
  if (!connection.customerId) {
    throw new Error("Google customer ID is missing.");
  }
  if (!GOOGLE_ADS_DEVELOPER_TOKEN) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN is missing.");
  }

  const tokenPayload = await refreshGoogleAccessToken(refreshToken);
  const accessToken = String(tokenPayload.access_token || "");
  if (!accessToken) {
    throw new Error("Google access token refresh returned no access token.");
  }

  const query = `
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_7_DAYS
  `;

  const endpoint = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${encodeURIComponent(
    connection.customerId
  )}/googleAds:searchStream`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": GOOGLE_ADS_DEVELOPER_TOKEN
  };
  if (connection.loginCustomerId) {
    headers["login-customer-id"] = connection.loginCustomerId;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || "Google Ads metrics query failed.");
  }

  const streamBatches = Array.isArray(payload) ? payload : [payload];
  const rows = [];
  streamBatches.forEach((batch) => {
    const results = Array.isArray(batch.results) ? batch.results : [];
    results.forEach((entry) => {
      rows.push({
        channel: "google",
        date: entry.segments?.date,
        accountId: connection.customerId,
        campaignId: entry.campaign?.id,
        campaignName: entry.campaign?.name,
        impressions: Number(entry.metrics?.impressions || 0),
        clicks: Number(entry.metrics?.clicks || 0),
        spendUsd: Number(entry.metrics?.costMicros || entry.metrics?.cost_micros || 0) / 1_000_000,
        conversions: Number(entry.metrics?.conversions || 0),
        source: "google_ads_api"
      });
    });
  });
  return rows;
}

async function fetchMetaAdsMetrics(connection) {
  const accessToken = decryptSecret(connection.token);
  if (!accessToken) {
    throw new Error("Meta access token is missing.");
  }
  if (!connection.accountId) {
    throw new Error("Meta ad account ID is missing.");
  }

  const { since, until } = buildRecentDateRange(7);
  const accountId = String(connection.accountId || "").replace(/^act_/, "");
  const params = new URLSearchParams({
    access_token: accessToken,
    level: "campaign",
    fields: "date_start,campaign_id,campaign_name,impressions,clicks,spend,actions",
    time_range: JSON.stringify({ since, until }),
    limit: "500"
  });
  const endpoint = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/act_${accountId}/insights?${params.toString()}`;
  const response = await fetch(endpoint);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || "Meta Ads insights query failed.");
  }

  const rows = [];
  const data = Array.isArray(payload.data) ? payload.data : [];
  data.forEach((entry) => {
    const actions = Array.isArray(entry.actions) ? entry.actions : [];
    const conversions = actions.reduce((acc, action) => {
      const actionType = String(action.action_type || "").toLowerCase();
      if (
        actionType.includes("lead") ||
        actionType.includes("omni_purchase") ||
        actionType.includes("offsite_conversion")
      ) {
        return acc + Number(action.value || 0);
      }
      return acc;
    }, 0);

    rows.push({
      channel: "meta",
      date: entry.date_start,
      accountId: accountId,
      campaignId: entry.campaign_id,
      campaignName: entry.campaign_name,
      impressions: Number(entry.impressions || 0),
      clicks: Number(entry.clicks || 0),
      spendUsd: Number(entry.spend || 0),
      conversions,
      source: "meta_graph_api"
    });
  });
  return rows;
}

let adsSyncInFlight = false;
let adsSyncTimer = null;

async function runAdsDataSync(reason = "manual") {
  if (adsSyncInFlight) {
    return {
      skipped: true,
      reason: "sync_in_progress"
    };
  }

  adsSyncInFlight = true;
  const startedAt = new Date().toISOString();
  const runRecord = {
    id: crypto.randomUUID(),
    startedAt,
    finishedAt: "",
    reason: sanitizeText(reason, "manual", 40),
    status: "running",
    channels: [],
    rowsSynced: 0,
    warnings: [],
    error: ""
  };

  try {
    const store = withDefaultStore(await readJson(STORE_PATH, {}));
    const googleConnection = getAdsConnection(store, "google");
    const metaConnection = getAdsConnection(store, "meta");
    const connected = [
      { key: "google", connection: googleConnection },
      { key: "meta", connection: metaConnection }
    ].filter((entry) => entry.connection.connected && entry.connection.token);

    if (!connected.length) {
      runRecord.status = "skipped";
      runRecord.warnings.push("No connected Google/Meta accounts to sync.");
    } else {
      const mergedRows = [];
      for (const entry of connected) {
        const channelKey = entry.key;
        const channelConnection = entry.connection;
        try {
          const rows =
            channelKey === "google"
              ? await fetchGoogleAdsMetrics(channelConnection)
              : await fetchMetaAdsMetrics(channelConnection);

          mergedRows.push(...rows);
          runRecord.channels.push(channelKey);
          runRecord.rowsSynced += rows.length;
          channelConnection.syncStatus = "synced";
          channelConnection.lastError = "";
          channelConnection.lastSyncAt = new Date().toISOString();
          channelConnection.updatedAt = new Date().toISOString();
        } catch (error) {
          const message = sanitizeText(error.message || `${channelKey} sync failed`, "Sync failed", 320);
          runRecord.warnings.push(`${channelKey}: ${message}`);
          channelConnection.syncStatus = "error";
          channelConnection.lastError = message;
          channelConnection.updatedAt = new Date().toISOString();
        }
      }

      if (mergedRows.length) {
        mergeMetricsRows(store, mergedRows);
      }
      runRecord.status = runRecord.warnings.length ? "partial_success" : "success";
    }

    runRecord.finishedAt = new Date().toISOString();
    store.adsSyncRuns.unshift(runRecord);
    if (store.adsSyncRuns.length > 250) {
      store.adsSyncRuns.length = 250;
    }
    await writeJson(STORE_PATH, store);
    return runRecord;
  } catch (error) {
    runRecord.status = "failed";
    runRecord.error = sanitizeText(error.message || "Ads sync failed.", "Ads sync failed.", 320);
    runRecord.finishedAt = new Date().toISOString();

    try {
      const store = withDefaultStore(await readJson(STORE_PATH, {}));
      store.adsSyncRuns.unshift(runRecord);
      if (store.adsSyncRuns.length > 250) {
        store.adsSyncRuns.length = 250;
      }
      await writeJson(STORE_PATH, store);
    } catch (persistError) {
      console.error("Unable to persist failed sync run:", persistError);
    }
    return runRecord;
  } finally {
    adsSyncInFlight = false;
  }
}

function parseBudget(value, fallback = 5000) {
  const numeric = Number(String(value || "").replace(/[$,]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return Math.max(500, Math.round(numeric));
}

function sanitizeAutomationBrief(raw) {
  const objective = sanitizeText(raw.objective, "Generate booked calls", 120);
  const tone = sanitizeText(raw.tone, "Confident", 40);

  return {
    productName: sanitizeText(raw.productName, "", 120),
    offer: sanitizeText(raw.offer, "", 360),
    audience: sanitizeText(raw.audience, "", 280),
    landingPage: sanitizeText(raw.landingPage, "", 260),
    positioning: sanitizeText(raw.positioning, "Modern, measurable growth system", 240),
    objective,
    tone,
    monthlyBudgetUsd: parseBudget(raw.monthlyBudgetUsd, 5000)
  };
}

function sanitizeLeadGenBrief(raw) {
  const normalizedDifferentiators = String(raw.differentiators || "")
    .split(/\n|,/g)
    .map((entry) => sanitizeText(entry, "", 140))
    .filter(Boolean)
    .slice(0, 6);
  const rawChannels = Array.isArray(raw.channels)
    ? raw.channels
    : typeof raw.channels === "string"
      ? raw.channels.split(",")
      : [];
  const channels = rawChannels
    .map((entry) => sanitizeText(entry, "", 40).toLowerCase())
    .map((entry) => LEAD_GEN_CHANNEL_ALIASES[entry] || entry)
    .filter((entry) => LEAD_GEN_CHANNEL_KEYS.has(entry));
  const uniqueChannels = [...new Set(channels)];
  const effectiveChannels = uniqueChannels.length ? uniqueChannels : ["google-ads"];
  const rawAllocations = raw.channelAllocations && typeof raw.channelAllocations === "object" ? raw.channelAllocations : {};
  const allocationSeed = effectiveChannels.map((channel) => Math.max(0, Number(rawAllocations[channel]) || 0));
  const allocationSum = allocationSeed.reduce((acc, value) => acc + value, 0);
  const normalizedAllocations = {};
  if (effectiveChannels.length) {
    if (allocationSum <= 0) {
      const equal = 100 / effectiveChannels.length;
      effectiveChannels.forEach((channel) => {
        normalizedAllocations[channel] = equal;
      });
    } else {
      effectiveChannels.forEach((channel, index) => {
        normalizedAllocations[channel] = (allocationSeed[index] / allocationSum) * 100;
      });
    }
  }
  const vslWorkflow = raw.vslWorkflow && typeof raw.vslWorkflow === "object" ? raw.vslWorkflow : {};
  const businessAssets = raw.businessAssets && typeof raw.businessAssets === "object" ? raw.businessAssets : {};

  return {
    businessName: sanitizeText(raw.businessName, "Your Business", 120),
    industry: sanitizeText(raw.industry, "Professional Services", 120),
    productName: sanitizeText(raw.productName, "Lead Gen Offer", 120),
    offer: sanitizeText(raw.offer, "Book more qualified leads with a multi-channel campaign.", 360),
    audience: sanitizeText(raw.audience, "High-intent prospects in your target market", 280),
    objective: sanitizeText(raw.objective, "Generate booked sales calls", 120),
    tone: sanitizeText(raw.tone, "Confident", 40),
    landingPage: sanitizeText(raw.landingPage, "", 260),
    monthlyBudgetUsd: parseBudget(raw.monthlyBudgetUsd, 5000),
    differentiators: normalizedDifferentiators,
    channels: effectiveChannels,
    channelAllocations: normalizedAllocations,
    vslWorkflow: {
      mode: sanitizeText(vslWorkflow.mode, "upload", 40),
      videoUrl: sanitizeText(vslWorkflow.videoUrl, "", 260),
      notes: sanitizeText(vslWorkflow.notes, "", 2000),
      uploadedFileName: sanitizeText(vslWorkflow.uploadedFileName, "", 200)
    },
    businessAssets: {
      imageFiles: Array.isArray(businessAssets.imageFiles) ? businessAssets.imageFiles.length : 0,
      testimonialFiles: Array.isArray(businessAssets.testimonialFiles) ? businessAssets.testimonialFiles.length : 0,
      blogFiles: Array.isArray(businessAssets.blogFiles) ? businessAssets.blogFiles.length : 0,
      testimonialText: sanitizeText(businessAssets.testimonialText, "", 3000),
      contentLinks: sanitizeText(businessAssets.contentLinks, "", 3000)
    }
  };
}

function estimateLeadsFromBudget(monthlyBudgetUsd, channels, channelAllocations = {}) {
  if (!Array.isArray(channels) || !channels.length) {
    return { expected: 0, low: 0, high: 0 };
  }

  let expected = 0;
  channels.forEach((channelKey) => {
    const channel = LEAD_GEN_CHANNEL_DEFINITIONS[channelKey];
    if (!channel) return;
    const allocation = Math.max(0, Number(channelAllocations[channelKey]) || 0);
    const channelBudget = (monthlyBudgetUsd * allocation) / 100;
    expected += channelBudget / channel.defaultCpl;
  });

  const rounded = Math.max(1, Math.round(expected));
  return {
    expected: rounded,
    low: Math.max(1, Math.floor(rounded * 0.8)),
    high: Math.max(1, Math.ceil(rounded * 1.2))
  };
}

function buildLeadGenAutomationPack(baseOutput, leadGenBrief) {
  const budget = baseOutput.execution?.budget || {};
  const monthlyBudgetUsd = Math.max(500, Number(budget.monthlyUsd || leadGenBrief.monthlyBudgetUsd));
  const selectedChannels = Array.isArray(leadGenBrief.channels) ? leadGenBrief.channels : [];
  const channelAllocations =
    leadGenBrief.channelAllocations && typeof leadGenBrief.channelAllocations === "object"
      ? leadGenBrief.channelAllocations
      : {};
  const channelMix = selectedChannels.length
    ? selectedChannels.map((channelKey) => ({
        channel: LEAD_GEN_CHANNEL_DEFINITIONS[channelKey]?.label || channelKey,
        percent: Number((Number(channelAllocations[channelKey]) || 0).toFixed(2)),
        budgetUsd: Math.round((monthlyBudgetUsd * (Number(channelAllocations[channelKey]) || 0)) / 100)
      }))
    : [];
  const leadForecast = estimateLeadsFromBudget(monthlyBudgetUsd, selectedChannels, channelAllocations);
  const differentiators = leadGenBrief.differentiators.length
    ? leadGenBrief.differentiators
    : ["Speed to launch", "Clear attribution", "Weekly optimization cadence"];
  const checklistByChannel = {
    "google-ads": "Rotate search headlines/descriptions and shift budget to the lowest CPL intent terms.",
    "facebook-ads": "Refresh offers/angles weekly and cut ad sets that fall above target cost per booked call.",
    "local-services-ads": "Review job type bids, response time, and review velocity to improve ranking and call quality.",
    seo: "Update target pages weekly and expand high-performing keyword clusters into supporting posts."
  };
  const weeklyAutomationChecklist = [];
  selectedChannels.forEach((channelKey) => {
    if (checklistByChannel[channelKey]) {
      weeklyAutomationChecklist.push(checklistByChannel[channelKey]);
    }
  });
  weeklyAutomationChecklist.push("Sync campaign and CRM metrics to one weekly scorecard.");
  const includeVsl = selectedChannels.some((channelKey) => channelKey !== "seo");
  const googlePlan = baseOutput.ads?.google || {};
  const facebookPlan = baseOutput.ads?.facebook || {};
  const vsl = baseOutput.vsl || {};
  const channelPlans = {};

  if (selectedChannels.includes("google-ads")) {
    channelPlans.googleAds = googlePlan;
  }

  if (selectedChannels.includes("facebook-ads")) {
    channelPlans.facebookAds = facebookPlan;
  }

  if (selectedChannels.includes("local-services-ads")) {
    channelPlans.localServicesAds = {
      adGroups: sanitizeList(
        [
          `${leadGenBrief.industry} emergency service`,
          `${leadGenBrief.industry} installation jobs`,
          `${leadGenBrief.industry} maintenance and tune-up`
        ],
        6,
        140
      ),
      trustSignals: sanitizeList(
        [...differentiators, "Licensed and insured", "Fast response time", "Highly rated local team"],
        6,
        120
      ),
      callToAction: sanitizeText(vsl.cta || "Book Service Call", "Book Service Call", 80)
    };
  }

  if (selectedChannels.includes("seo")) {
    channelPlans.seo = {
      keywordClusters: sanitizeList(googlePlan.keywords || [], 10, 90),
      contentPlan: [
        `Pillar page: ${leadGenBrief.offer}`,
        `Use-case page for ${leadGenBrief.audience}`,
        `Comparison page: alternatives vs ${leadGenBrief.productName}`,
        "Case-study page with proof and CTA",
        "FAQ page covering objections and pricing context"
      ],
      onPageChecklist: [
        "Map one primary keyword per page and avoid cannibalization.",
        "Align H1/title/meta to intent and CTR goals.",
        "Add internal links from high-authority pages.",
        "Use schema markup for services/FAQ where relevant.",
        "Track rankings + organic conversion events weekly."
      ]
    };
  }

  return {
    summary: `${leadGenBrief.businessName} multi-channel lead gen pack focused on ${leadGenBrief.objective.toLowerCase()}.`,
    brief: leadGenBrief,
    selectedChannels: selectedChannels.map((channelKey) => ({
      key: channelKey,
      label: LEAD_GEN_CHANNEL_DEFINITIONS[channelKey]?.label || channelKey
    })),
    leadForecast: {
      ...leadForecast,
      notes: `Estimated monthly leads based on benchmark CPL assumptions for ${selectedChannels
        .map((channelKey) => LEAD_GEN_CHANNEL_DEFINITIONS[channelKey]?.label || channelKey)
        .join(", ")}.`
    },
    intake: {
      vsl: leadGenBrief.vslWorkflow,
      assets: {
        imageFiles: leadGenBrief.businessAssets?.imageFiles || 0,
        testimonialFiles: leadGenBrief.businessAssets?.testimonialFiles || 0,
        blogFiles: leadGenBrief.businessAssets?.blogFiles || 0
      }
    },
    vsl: includeVsl ? baseOutput.vsl : null,
    channelPlans,
    funnel: {
      landingPageSections: [
        `Headline: ${leadGenBrief.offer}`,
        `Subheadline: built for ${leadGenBrief.audience}`,
        `Proof strip: differentiators (${differentiators.join(" | ")})`,
        "Offer breakdown and objections section",
        "Primary CTA block: book strategy call"
      ],
      leadCaptureFlow: [
        "Lead submits short qualification form.",
        "Auto-assign source channel + campaign UTM in CRM.",
        "Route high-intent leads directly to booking page."
      ]
    },
    operations: {
      budget: {
        monthlyUsd: monthlyBudgetUsd,
        channelMix
      },
      kpis: baseOutput.execution?.kpis || [],
      workflow: baseOutput.execution?.workflow || [],
      compliance: baseOutput.execution?.compliance || [],
      weeklyAutomationChecklist
    },
    generation: baseOutput.generation || { source: "template", model: "template-v1" }
  };
}

function getWorkspaceCampaigns(store, workspaceId) {
  if (!store.automationCampaigns[workspaceId]) {
    store.automationCampaigns[workspaceId] = [];
  }
  if (!Array.isArray(store.automationCampaigns[workspaceId])) {
    store.automationCampaigns[workspaceId] = [];
  }
  return store.automationCampaigns[workspaceId];
}

function buildFallbackAutomationOutput(company, brief) {
  const budget = brief.monthlyBudgetUsd;
  const googleShare = Math.round(budget * 0.45);
  const facebookShare = Math.round(budget * 0.35);
  const lsaShare = Math.max(0, budget - googleShare - facebookShare);
  const audience = brief.audience || `${company.industry} decision makers`;
  const baseHook = `${brief.productName} helps ${audience} get results without wasting ad budget.`;

  return {
    summary: `Campaign pack for ${company.name}: Creative + Google + Facebook + Local Service Ads focused on ${brief.objective.toLowerCase()}.`,
    strategy: {
      positioning: brief.positioning,
      primaryPain: `${audience} need predictable pipeline, not random lead spikes.`,
      promise: `${brief.offer} with weekly optimization and clear attribution.`,
      offerStack: [
        "Done-with-you campaign strategy",
        "Creative production workflow",
        "Daily optimization loop",
        "Weekly KPI review and iteration"
      ]
    },
    vsl: {
      title: `${brief.productName} - predictable growth playbook`,
      hook: baseHook,
      outline: [
        "Hook: call out wasted spend and inconsistent pipeline.",
        "Problem: why scattered channels and weak creative stall growth.",
        `Solution: ${brief.productName} operating system for ads + creative + testing.`,
        "Proof: early KPI wins and rapid iteration cycles.",
        `Offer: ${brief.offer}.`,
        "CTA: book a strategy call now."
      ],
      script: [
        `If your team has been spending money on ads without consistent pipeline, this is for you.`,
        `At ${brief.productName}, we built a system that turns creative and ad operations into one weekly growth engine.`,
        `We map your audience, build the message, launch channel-specific campaigns, and optimize every week.`,
        `The goal is simple: ${brief.objective.toLowerCase()} with clear attribution and compounding performance.`,
        `If you want that for ${company.name}, book a strategy call and we will map your first 30 days.`
      ].join("\n\n"),
      shotList: [
        "Open with a fast montage of poor dashboard results and missed targets.",
        "Founder on camera: frame the core pain in one sentence.",
        "Screen capture: show the campaign orchestration board and weekly cadence.",
        "Case-study slide: before/after KPI trend.",
        "Direct CTA frame with calendar booking URL."
      ],
      cta: "Book your growth strategy call"
    },
    ads: {
      google: {
        headlines: sanitizeList(
          [
            `${brief.productName} Growth Engine`,
            "Scale Leads With Better Ads",
            "Creative + Ads + Optimization",
            "Predictable Paid Acquisition",
            "Book A Strategy Call",
            `${company.name} Growth Plan`
          ],
          10,
          40
        ),
        descriptions: sanitizeList(
          [
            `Launch a full-funnel campaign system built for ${audience}.`,
            "Creative, testing, optimization, and reporting in one loop.",
            `Focused on ${brief.objective.toLowerCase()} with weekly iteration.`
          ],
          6,
          90
        ),
        keywords: sanitizeList(
          [
            `${company.industry} lead generation agency`,
            "emergency service ads",
            "google local service ads",
            "home service lead generation",
            "booked call marketing"
          ],
          12,
          60
        ),
        audiences: sanitizeList(
          [audience, `${company.industry} marketing leaders`, "Demand generation managers"],
          6,
          120
        ),
        cta: "Schedule a Call"
      },
      facebook: {
        primaryText: sanitizeList(
          [
            `${audience}: if your ad spend feels random, we can fix the system behind it.`,
            `${brief.productName} combines creative strategy + channel execution + weekly optimization.`,
            `Want ${brief.objective.toLowerCase()} with a repeatable process? Book a strategy call.`
          ],
          6,
          220
        ),
        headlines: sanitizeList(
          ["Stop Guessing Your Ad Strategy", "Turn Ads Into Predictable Pipeline", "Book Your Growth Call"],
          6,
          80
        ),
        creativeAngles: sanitizeList(
          [
            "Pain-first: wasted spend and inconsistent leads",
            "System-first: one operating cadence across channels",
            "Outcome-first: clearer attribution and faster iteration"
          ],
          6,
          140
        ),
        audiences: sanitizeList([audience, "Retargeting: site visitors (30 days)", "Lookalike: high-intent leads"], 6, 120),
        cta: "Book Now"
      },
      x: {
        postVariants: sanitizeList(
          [
            `Most home service ad accounts are not underfunded. They are under-systemized. ${brief.productName} fixes that with one weekly growth loop.`,
            `If your team runs Google + Meta + LSA separately, your learning cycle is broken. We combine creative testing and optimization in one system.`,
            `Want ${brief.objective.toLowerCase()} without channel chaos? Start with a strategy call and we will map your first sprint.`
          ],
          6,
          260
        ),
        audiences: sanitizeList([audience, "Founders and CMOs", "Demand gen and paid social operators"], 6, 120),
        cta: "Book Strategy Call"
      }
    },
    execution: {
      budget: {
        monthlyUsd: budget,
        channelMix: [
          { channel: "Google Search", percent: 45, budgetUsd: googleShare },
          { channel: "Facebook/Instagram", percent: 35, budgetUsd: facebookShare },
          { channel: "Local Service Ads", percent: 20, budgetUsd: lsaShare }
        ]
      },
      kpis: [
        "Cost per booked call",
        "Landing page conversion rate",
        "CTR by creative angle",
        "Qualified pipeline influenced"
      ],
      workflow: [
        "Monday: Pull prior-week metrics and identify winning creative hooks.",
        "Tuesday: Produce 2-3 creative/ad variants from top hook.",
        "Wednesday: Launch/refresh Google, Meta, and Local Service Ads campaigns.",
        "Thursday: Mid-week budget shift toward highest-converting segments.",
        "Friday: KPI review and next-sprint creative brief."
      ],
      compliance: [
        "Validate policy compliance before publish on each ad platform.",
        "Use consistent UTM naming for attribution.",
        `Set landing page destination: ${brief.landingPage || "TBD"}.`,
        "Keep ad claims specific and supportable."
      ]
    }
  };
}

function normalizeAutomationOutput(raw, company, brief) {
  const fallback = buildFallbackAutomationOutput(company, brief);
  const value = raw && typeof raw === "object" ? raw : {};
  const strategy = value.strategy && typeof value.strategy === "object" ? value.strategy : {};
  const vsl = value.vsl && typeof value.vsl === "object" ? value.vsl : {};
  const ads = value.ads && typeof value.ads === "object" ? value.ads : {};
  const google = ads.google && typeof ads.google === "object" ? ads.google : {};
  const facebook = ads.facebook && typeof ads.facebook === "object" ? ads.facebook : {};
  const x = ads.x && typeof ads.x === "object" ? ads.x : {};
  const execution = value.execution && typeof value.execution === "object" ? value.execution : {};
  const budget = execution.budget && typeof execution.budget === "object" ? execution.budget : {};

  const channelMixRaw = Array.isArray(budget.channelMix) ? budget.channelMix : [];
  const channelMix = channelMixRaw
    .map((entry) => ({
      channel: sanitizeText(entry.channel, "", 60),
      percent: Math.max(0, Math.min(100, Number(entry.percent) || 0)),
      budgetUsd: Math.max(0, Math.round(Number(entry.budgetUsd) || 0))
    }))
    .filter((entry) => entry.channel)
    .slice(0, 6);

  return {
    summary: sanitizeText(value.summary, fallback.summary, 360),
    strategy: {
      positioning: sanitizeText(strategy.positioning, fallback.strategy.positioning, 240),
      primaryPain: sanitizeText(strategy.primaryPain, fallback.strategy.primaryPain, 260),
      promise: sanitizeText(strategy.promise, fallback.strategy.promise, 260),
      offerStack: sanitizeList(strategy.offerStack, 6, 120).length
        ? sanitizeList(strategy.offerStack, 6, 120)
        : fallback.strategy.offerStack
    },
    vsl: {
      title: sanitizeText(vsl.title, fallback.vsl.title, 140),
      hook: sanitizeText(vsl.hook, fallback.vsl.hook, 240),
      outline: sanitizeList(vsl.outline, 8, 180).length ? sanitizeList(vsl.outline, 8, 180) : fallback.vsl.outline,
      script: sanitizeText(vsl.script, fallback.vsl.script, 5000),
      shotList: sanitizeList(vsl.shotList, 8, 180).length ? sanitizeList(vsl.shotList, 8, 180) : fallback.vsl.shotList,
      cta: sanitizeText(vsl.cta, fallback.vsl.cta, 80)
    },
    ads: {
      google: {
        headlines: sanitizeList(google.headlines, 10, 50).length
          ? sanitizeList(google.headlines, 10, 50)
          : fallback.ads.google.headlines,
        descriptions: sanitizeList(google.descriptions, 6, 120).length
          ? sanitizeList(google.descriptions, 6, 120)
          : fallback.ads.google.descriptions,
        keywords: sanitizeList(google.keywords, 14, 80).length
          ? sanitizeList(google.keywords, 14, 80)
          : fallback.ads.google.keywords,
        audiences: sanitizeList(google.audiences, 8, 140).length
          ? sanitizeList(google.audiences, 8, 140)
          : fallback.ads.google.audiences,
        cta: sanitizeText(google.cta, fallback.ads.google.cta, 60)
      },
      facebook: {
        primaryText: sanitizeList(facebook.primaryText, 6, 300).length
          ? sanitizeList(facebook.primaryText, 6, 300)
          : fallback.ads.facebook.primaryText,
        headlines: sanitizeList(facebook.headlines, 8, 120).length
          ? sanitizeList(facebook.headlines, 8, 120)
          : fallback.ads.facebook.headlines,
        creativeAngles: sanitizeList(facebook.creativeAngles, 8, 180).length
          ? sanitizeList(facebook.creativeAngles, 8, 180)
          : fallback.ads.facebook.creativeAngles,
        audiences: sanitizeList(facebook.audiences, 8, 140).length
          ? sanitizeList(facebook.audiences, 8, 140)
          : fallback.ads.facebook.audiences,
        cta: sanitizeText(facebook.cta, fallback.ads.facebook.cta, 60)
      },
      x: {
        postVariants: sanitizeList(x.postVariants, 6, 300).length
          ? sanitizeList(x.postVariants, 6, 300)
          : fallback.ads.x.postVariants,
        audiences: sanitizeList(x.audiences, 8, 140).length
          ? sanitizeList(x.audiences, 8, 140)
          : fallback.ads.x.audiences,
        cta: sanitizeText(x.cta, fallback.ads.x.cta, 60)
      }
    },
    execution: {
      budget: {
        monthlyUsd: Math.max(500, Math.round(Number(budget.monthlyUsd) || fallback.execution.budget.monthlyUsd)),
        channelMix: channelMix.length ? channelMix : fallback.execution.budget.channelMix
      },
      kpis: sanitizeList(execution.kpis, 8, 120).length
        ? sanitizeList(execution.kpis, 8, 120)
        : fallback.execution.kpis,
      workflow: sanitizeList(execution.workflow, 8, 200).length
        ? sanitizeList(execution.workflow, 8, 200)
        : fallback.execution.workflow,
      compliance: sanitizeList(execution.compliance, 8, 180).length
        ? sanitizeList(execution.compliance, 8, 180)
        : fallback.execution.compliance
    }
  };
}

async function tryGenerateAutomationWithOpenAI(company, brief) {
  if (!OPENAI_API_KEY || typeof fetch !== "function") {
    return null;
  }

  const prompt = {
    company: { name: company.name, industry: company.industry },
    brief,
    instructions: {
      style: "Direct-response marketing copy with clear ROI framing.",
      outputSchema: {
        summary: "string",
        strategy: { positioning: "string", primaryPain: "string", promise: "string", offerStack: ["string"] },
        vsl: { title: "string", hook: "string", outline: ["string"], script: "string", shotList: ["string"], cta: "string" },
        ads: {
          google: { headlines: ["string"], descriptions: ["string"], keywords: ["string"], audiences: ["string"], cta: "string" },
          facebook: {
            primaryText: ["string"],
            headlines: ["string"],
            creativeAngles: ["string"],
            audiences: ["string"],
            cta: "string"
          },
          x: { postVariants: ["string"], audiences: ["string"], cta: "string" }
        },
        execution: {
          budget: { monthlyUsd: "number", channelMix: [{ channel: "string", percent: "number", budgetUsd: "number" }] },
          kpis: ["string"],
          workflow: ["string"],
          compliance: ["string"]
        }
      }
    }
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You are a performance marketing strategist. Return ONLY valid JSON following the requested schema. No markdown."
          },
          {
            role: "user",
            content: JSON.stringify(prompt)
          }
        ]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content);
    return normalizeAutomationOutput(parsed, company, brief);
  } catch {
    return null;
  }
}

async function generateAutomationOutput(company, brief) {
  const openAiResult = await tryGenerateAutomationWithOpenAI(company, brief);
  if (openAiResult) {
    return {
      ...openAiResult,
      generation: {
        source: "openai",
        model: OPENAI_MODEL
      }
    };
  }

  return {
    ...buildFallbackAutomationOutput(company, brief),
    generation: {
      source: "template",
      model: "template-v1"
    }
  };
}

async function handleApi(req, res, url) {
  const store = withDefaultStore(await readJson(STORE_PATH, {}));
  const companies = await readJson(COMPANIES_PATH, []);
  const method = req.method || "GET";
  const pathname = url.pathname;

  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const workspaceName = String(body.workspaceName || "").trim();

    if (!name || !email || !password || !workspaceName) {
      return sendJson(res, 400, { error: "name, email, password, and workspaceName are required." });
    }

    if (store.users.some((user) => user.email === email)) {
      return sendJson(res, 409, { error: "User already exists." });
    }

    const { salt, hash } = hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordSalt: salt,
      passwordHash: hash,
      workspaceId: createWorkspaceId(workspaceName),
      workspaceName
    };

    const token = createSessionToken();
    store.users.push(user);
    store.sessions[token] = { userId: user.id, createdAt: new Date().toISOString() };
    addLeadSignup(store, {
      type: "account_signup",
      source: "auth_register",
      name,
      email,
      notes: `Workspace: ${workspaceName}`
    });
    await writeJson(STORE_PATH, store);

    return sendJson(res, 201, { token, user: sanitizeUser(user) });
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const user = store.users.find((entry) => entry.email === email);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return sendJson(res, 401, { error: "Invalid credentials." });
    }

    const token = createSessionToken();
    store.sessions[token] = { userId: user.id, createdAt: new Date().toISOString() };
    await writeJson(STORE_PATH, store);

    return sendJson(res, 200, { token, user: sanitizeUser(user) });
  }

  if (method === "POST" && pathname === "/api/auth/logout") {
    const token = getBearerToken(req);
    if (token && store.sessions[token]) {
      delete store.sessions[token];
      await writeJson(STORE_PATH, store);
    }
    return sendJson(res, 200, { ok: true });
  }

  if (method === "GET" && pathname === "/api/auth/me") {
    const auth = await authenticate(req, store);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 200, { user: sanitizeUser(auth.user) });
  }

  if (method === "GET" && pathname === "/api/companies") {
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const filtered = companies.filter((company) => {
      if (!query) return true;
      return `${company.name} ${company.industry}`.toLowerCase().includes(query);
    });
    return sendJson(res, 200, { companies: filtered });
  }

  if (method === "POST" && pathname === "/api/marketing-lead-gen/generate") {
    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }

    const leadGenBrief = sanitizeLeadGenBrief(body);

    const company = { name: leadGenBrief.businessName, industry: leadGenBrief.industry };
    const automationBrief = sanitizeAutomationBrief(leadGenBrief);
    const baseOutput = await generateAutomationOutput(company, automationBrief);
    const pack = buildLeadGenAutomationPack(baseOutput, leadGenBrief);
    return sendJson(res, 201, { pack });
  }

  if (method === "POST" && pathname === "/api/signups") {
    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }
    const signup = addLeadSignup(store, body);
    await writeJson(STORE_PATH, store);
    return sendJson(res, 201, { signup });
  }

  if (method === "GET" && pathname === "/api/signups") {
    const typeFilter = sanitizeText(url.searchParams.get("type"), "", 40).toLowerCase();
    const sourceFilter = sanitizeText(url.searchParams.get("source"), "", 80).toLowerCase();
    const signups = store.leadSignups
      .filter((entry) => {
        if (typeFilter && String(entry.type || "").toLowerCase() !== typeFilter) return false;
        if (sourceFilter && String(entry.source || "").toLowerCase() !== sourceFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sendJson(res, 200, { signups });
  }

  if (method === "GET" && pathname === "/api/ads/system") {
    return sendJson(res, 200, {
      schedulerEnabled: ADS_SYNC_ENABLED,
      schedulerIntervalMinutes: ADS_SYNC_INTERVAL_MINUTES,
      googleOAuthConfigured: Boolean(GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET),
      metaOAuthConfigured: Boolean(META_APP_ID && META_APP_SECRET),
      tokenEncryptionEnabled: Boolean(TOKEN_KEY_BUFFER)
    });
  }

  if (method === "GET" && pathname === "/api/ads/connections") {
    const google = sanitizeConnectionForClient(getAdsConnection(store, "google"));
    const meta = sanitizeConnectionForClient(getAdsConnection(store, "meta"));
    return sendJson(res, 200, { connections: { google, meta } });
  }

  if (method === "POST" && pathname === "/api/ads/connections/google/oauth/start") {
    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }
    if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
      return sendJson(res, 400, {
        error: "Google OAuth is not configured. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET."
      });
    }

    const state = createAdsOauthState(store, "google", {
      returnTo: body.returnTo || "/founder-integrations",
      customerId: body.customerId,
      loginCustomerId: body.loginCustomerId
    });
    await writeJson(STORE_PATH, store);
    const oauthUrl = buildGoogleOauthUrl(state);
    return sendJson(res, 200, { oauthUrl, state });
  }

  if (method === "GET" && pathname === "/api/ads/connections/google/oauth/callback") {
    const code = sanitizeText(url.searchParams.get("code"), "", 4000);
    const state = sanitizeText(url.searchParams.get("state"), "", 80);
    const stateData = consumeAdsOauthState(store, state, "google");
    const redirectTarget = stateData?.returnTo || "/founder-integrations";

    if (!stateData) {
      await writeJson(STORE_PATH, store);
      res.writeHead(302, { Location: `${redirectTarget}?sync_error=invalid_oauth_state` });
      res.end();
      return;
    }
    if (!code) {
      await writeJson(STORE_PATH, store);
      res.writeHead(302, { Location: `${redirectTarget}?sync_error=missing_oauth_code` });
      res.end();
      return;
    }

    let refreshToken = "";
    let tokenType = "refresh_token";
    let warning = "";
    try {
      const payload = await exchangeGoogleCodeForToken(code);
      refreshToken = String(payload.refresh_token || payload.access_token || "").trim();
      if (!payload.refresh_token && payload.access_token) {
        tokenType = "access_token_fallback";
        warning = "Google did not return a refresh token. Re-consent may be required.";
      }
    } catch (error) {
      refreshToken = `fallback_${code.slice(0, 28)}`;
      tokenType = "fallback_code_token";
      warning = sanitizeText(error.message, "OAuth exchange failed. Stored callback fallback token.", 240);
    }

    const connection = getAdsConnection(store, "google");
    connection.channel = "google";
    connection.connected = true;
    connection.customerId = sanitizeText(stateData.customerId, connection.customerId, 80);
    connection.loginCustomerId = sanitizeText(stateData.loginCustomerId, connection.loginCustomerId, 80);
    connection.token = encryptSecret(refreshToken);
    connection.tokenLast4 = refreshToken.slice(-4);
    connection.tokenType = tokenType;
    connection.syncStatus = warning ? "connected_with_warning" : "connected";
    connection.lastError = warning;
    connection.updatedAt = new Date().toISOString();
    await writeJson(STORE_PATH, store);

    const warningQuery = warning ? `&sync_warning=${encodeURIComponent(warning)}` : "";
    res.writeHead(302, { Location: `${redirectTarget}?connected=google${warningQuery}` });
    res.end();
    return;
  }

  if (method === "POST" && pathname === "/api/ads/connections/google/manual") {
    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }
    const refreshToken = sanitizeText(body.refreshToken, "", 4000);
    const customerId = sanitizeText(body.customerId, "", 80);
    if (!refreshToken || !customerId) {
      return sendJson(res, 400, { error: "refreshToken and customerId are required." });
    }

    const connection = getAdsConnection(store, "google");
    connection.channel = "google";
    connection.connected = true;
    connection.customerId = customerId;
    connection.loginCustomerId = sanitizeText(body.loginCustomerId, "", 80);
    connection.token = encryptSecret(refreshToken);
    connection.tokenLast4 = refreshToken.slice(-4);
    connection.tokenType = "refresh_token";
    connection.syncStatus = "connected";
    connection.lastError = "";
    connection.updatedAt = new Date().toISOString();
    await writeJson(STORE_PATH, store);
    return sendJson(res, 200, { connection: sanitizeConnectionForClient(connection) });
  }

  if (method === "POST" && pathname === "/api/ads/connections/meta/oauth/start") {
    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }
    if (!META_APP_ID || !META_APP_SECRET) {
      return sendJson(res, 400, {
        error: "Meta OAuth is not configured. Add META_APP_ID and META_APP_SECRET."
      });
    }

    const state = createAdsOauthState(store, "meta", {
      returnTo: body.returnTo || "/founder-integrations",
      accountId: body.accountId,
      businessId: body.businessId
    });
    await writeJson(STORE_PATH, store);
    const oauthUrl = buildMetaOauthUrl(state);
    return sendJson(res, 200, { oauthUrl, state });
  }

  if (method === "GET" && pathname === "/api/ads/connections/meta/oauth/callback") {
    const code = sanitizeText(url.searchParams.get("code"), "", 4000);
    const state = sanitizeText(url.searchParams.get("state"), "", 80);
    const stateData = consumeAdsOauthState(store, state, "meta");
    const redirectTarget = stateData?.returnTo || "/founder-integrations";

    if (!stateData) {
      await writeJson(STORE_PATH, store);
      res.writeHead(302, { Location: `${redirectTarget}?sync_error=invalid_oauth_state` });
      res.end();
      return;
    }
    if (!code) {
      await writeJson(STORE_PATH, store);
      res.writeHead(302, { Location: `${redirectTarget}?sync_error=missing_oauth_code` });
      res.end();
      return;
    }

    let accessToken = "";
    let warning = "";
    try {
      const payload = await exchangeMetaCodeForToken(code);
      accessToken = String(payload.access_token || "").trim();
      if (!accessToken) {
        throw new Error("Meta returned no access token.");
      }
    } catch (error) {
      accessToken = `fallback_${code.slice(0, 28)}`;
      warning = sanitizeText(error.message, "OAuth exchange failed. Stored callback fallback token.", 240);
    }

    const connection = getAdsConnection(store, "meta");
    connection.channel = "meta";
    connection.connected = true;
    connection.accountId = sanitizeText(stateData.accountId, connection.accountId, 80);
    connection.businessId = sanitizeText(stateData.businessId, connection.businessId, 80);
    connection.token = encryptSecret(accessToken);
    connection.tokenLast4 = accessToken.slice(-4);
    connection.tokenType = "access_token";
    connection.syncStatus = warning ? "connected_with_warning" : "connected";
    connection.lastError = warning;
    connection.updatedAt = new Date().toISOString();
    await writeJson(STORE_PATH, store);

    const warningQuery = warning ? `&sync_warning=${encodeURIComponent(warning)}` : "";
    res.writeHead(302, { Location: `${redirectTarget}?connected=meta${warningQuery}` });
    res.end();
    return;
  }

  if (method === "POST" && pathname === "/api/ads/connections/meta/manual") {
    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }
    const accessToken = sanitizeText(body.accessToken, "", 4000);
    const accountId = sanitizeText(body.accountId, "", 80);
    if (!accessToken || !accountId) {
      return sendJson(res, 400, { error: "accessToken and accountId are required." });
    }

    const connection = getAdsConnection(store, "meta");
    connection.channel = "meta";
    connection.connected = true;
    connection.accountId = accountId;
    connection.businessId = sanitizeText(body.businessId, "", 80);
    connection.token = encryptSecret(accessToken);
    connection.tokenLast4 = accessToken.slice(-4);
    connection.tokenType = "access_token";
    connection.syncStatus = "connected";
    connection.lastError = "";
    connection.updatedAt = new Date().toISOString();
    await writeJson(STORE_PATH, store);
    return sendJson(res, 200, { connection: sanitizeConnectionForClient(connection) });
  }

  const adsDisconnectMatch = pathname.match(/^\/api\/ads\/connections\/([^/]+)\/disconnect$/);
  if (adsDisconnectMatch && method === "POST") {
    const channel = sanitizeText(adsDisconnectMatch[1], "", 20).toLowerCase();
    if (!["google", "meta"].includes(channel)) {
      return sendJson(res, 400, { error: "Unsupported channel. Use google or meta." });
    }

    const connection = getAdsConnection(store, channel);
    connection.connected = false;
    connection.token = null;
    connection.tokenLast4 = "";
    connection.syncStatus = "not_connected";
    connection.lastError = "";
    connection.updatedAt = new Date().toISOString();
    await writeJson(STORE_PATH, store);
    return sendJson(res, 200, { connection: sanitizeConnectionForClient(connection) });
  }

  if (method === "POST" && pathname === "/api/ads/sync/run") {
    const run = await runAdsDataSync("manual");
    return sendJson(res, 200, { run });
  }

  if (method === "GET" && pathname === "/api/ads/sync/runs") {
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 30)));
    const runs = (Array.isArray(store.adsSyncRuns) ? store.adsSyncRuns : []).slice(0, limit);
    return sendJson(res, 200, { runs });
  }

  if (method === "GET" && pathname === "/api/ads/metrics/daily") {
    const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get("limit") || 500)));
    const channel = sanitizeText(url.searchParams.get("channel"), "", 20).toLowerCase();
    const metrics = (Array.isArray(store.adsMetricsDaily) ? store.adsMetricsDaily : [])
      .filter((entry) => !channel || String(entry.channel || "").toLowerCase() === channel)
      .slice(0, limit);
    return sendJson(res, 200, { metrics });
  }

  if (method === "GET" && pathname === "/api/ads/metrics/summary") {
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 30)));
    const summary = summarizeAdsMetrics(store, days);
    return sendJson(res, 200, { days, summary });
  }

  const companyStoryByIdMatch = pathname.match(/^\/api\/companies\/([^/]+)\/stories\/([^/]+)$/);
  if (method === "GET" && companyStoryByIdMatch) {
    const companyId = decodeURIComponent(companyStoryByIdMatch[1]);
    const storyId = decodeURIComponent(companyStoryByIdMatch[2]);
    const companyExists = companies.some((entry) => entry.id === companyId);
    if (!companyExists) {
      return sendJson(res, 404, { error: "Company not found." });
    }

    const stories = Array.isArray(store.companyStories[companyId]) ? store.companyStories[companyId] : [];
    const story = stories.find((entry) => entry.id === storyId);
    if (!story) {
      return sendJson(res, 404, { error: "Story not found." });
    }

    return sendJson(res, 200, { story: normalizeStory(story) });
  }

  const companyStoriesMatch = pathname.match(/^\/api\/companies\/([^/]+)\/stories$/);
  if (companyStoriesMatch) {
    const companyId = decodeURIComponent(companyStoriesMatch[1]);
    const companyExists = companies.some((entry) => entry.id === companyId);
    if (!companyExists) {
      return sendJson(res, 404, { error: "Company not found." });
    }

    if (!Array.isArray(store.companyStories[companyId])) {
      store.companyStories[companyId] = [];
    }

    if (method === "GET") {
      const stories = store.companyStories[companyId]
        .map((entry) => normalizeStory(entry))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return sendJson(res, 200, { stories });
    }

    if (method === "POST") {
      const auth = await authenticate(req, store);
      if (!auth) {
        return sendJson(res, 401, { error: "Unauthorized" });
      }

      const body = await getBody(req);
      if (!body) {
        return sendJson(res, 400, { error: "Invalid JSON payload." });
      }

      const title = String(body.title || "").trim();
      const stage = String(body.stage || "").trim();
      const outcome = String(body.outcome || "").trim();
      const storyText = String(body.story || "").trim();

      if (!title || !stage || !outcome || !storyText) {
        return sendJson(res, 400, { error: "title, stage, outcome, and story are required." });
      }

      const story = normalizeStory(
        {
          id: crypto.randomUUID(),
          title: title.slice(0, 160),
          stage: stage.slice(0, 80),
          outcome: outcome.slice(0, 40),
          story: storyText.slice(0, 4000),
          author: auth.user.name,
          createdAt: new Date().toISOString()
        },
        auth.user.name
      );

      store.companyStories[companyId].push(story);
      await writeJson(STORE_PATH, store);
      return sendJson(res, 201, { story });
    }
  }

  const notesMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/notes\/([^/]+)$/);
  if (notesMatch) {
    const workspaceId = decodeURIComponent(notesMatch[1]);
    const companyId = decodeURIComponent(notesMatch[2]);
    const auth = await authenticate(req, store);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }

    if (auth.user.workspaceId !== workspaceId) {
      return sendJson(res, 403, { error: "Forbidden for this workspace." });
    }

    const companyExists = companies.some((entry) => entry.id === companyId);
    if (!companyExists) {
      return sendJson(res, 404, { error: "Company not found." });
    }

    if (!store.workspaceNotes[workspaceId]) {
      store.workspaceNotes[workspaceId] = {};
    }

    if (method === "GET") {
      const noteEntry = store.workspaceNotes[workspaceId][companyId] || { note: "", updatedAt: null };
      return sendJson(res, 200, noteEntry);
    }

    if (method === "PUT") {
      const body = await getBody(req);
      if (!body) {
        return sendJson(res, 400, { error: "Invalid JSON payload." });
      }

      const note = String(body.note || "").slice(0, 8000);
      const nextEntry = { note, updatedAt: new Date().toISOString() };
      store.workspaceNotes[workspaceId][companyId] = nextEntry;
      await writeJson(STORE_PATH, store);
      return sendJson(res, 200, nextEntry);
    }
  }

  const customBaseMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/companies\/([^/]+)\/customization$/);
  if (customBaseMatch && method === "GET") {
    const workspaceId = decodeURIComponent(customBaseMatch[1]);
    const companyId = decodeURIComponent(customBaseMatch[2]);
    const auth = await authenticate(req, store);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    if (auth.user.workspaceId !== workspaceId) {
      return sendJson(res, 403, { error: "Forbidden for this workspace." });
    }

    const companyExists = companies.some((entry) => entry.id === companyId);
    if (!companyExists) {
      return sendJson(res, 404, { error: "Company not found." });
    }

    const custom = getCompanyCustomization(store, workspaceId, companyId);
    return sendJson(res, 200, custom);
  }

  const customStakeholderMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/companies\/([^/]+)\/stakeholders$/);
  if (customStakeholderMatch && method === "POST") {
    const workspaceId = decodeURIComponent(customStakeholderMatch[1]);
    const companyId = decodeURIComponent(customStakeholderMatch[2]);
    const auth = await authenticate(req, store);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    if (auth.user.workspaceId !== workspaceId) {
      return sendJson(res, 403, { error: "Forbidden for this workspace." });
    }

    const companyExists = companies.some((entry) => entry.id === companyId);
    if (!companyExists) {
      return sendJson(res, 404, { error: "Company not found." });
    }

    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }

    const name = String(body.name || "").trim();
    const role = String(body.role || "").trim();
    const influence = String(body.influence || "").trim();
    const stance = String(body.stance || "").trim();
    if (!name || !role || !influence || !stance) {
      return sendJson(res, 400, { error: "name, role, influence, and stance are required." });
    }

    const custom = getCompanyCustomization(store, workspaceId, companyId);
    const stakeholder = {
      id: crypto.randomUUID(),
      name: name.slice(0, 120),
      role: role.slice(0, 80),
      influence: influence.slice(0, 20),
      stance: stance.slice(0, 20)
    };
    custom.stakeholders.push(stakeholder);
    await writeJson(STORE_PATH, store);
    return sendJson(res, 201, { stakeholder });
  }

  const customStakeholderDeleteMatch = pathname.match(
    /^\/api\/workspaces\/([^/]+)\/companies\/([^/]+)\/stakeholders\/([^/]+)$/
  );
  if (customStakeholderDeleteMatch && method === "DELETE") {
    const workspaceId = decodeURIComponent(customStakeholderDeleteMatch[1]);
    const companyId = decodeURIComponent(customStakeholderDeleteMatch[2]);
    const stakeholderId = decodeURIComponent(customStakeholderDeleteMatch[3]);
    const auth = await authenticate(req, store);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    if (auth.user.workspaceId !== workspaceId) {
      return sendJson(res, 403, { error: "Forbidden for this workspace." });
    }

    const companyExists = companies.some((entry) => entry.id === companyId);
    if (!companyExists) {
      return sendJson(res, 404, { error: "Company not found." });
    }

    const custom = getCompanyCustomization(store, workspaceId, companyId);
    const before = custom.stakeholders.length;
    custom.stakeholders = custom.stakeholders.filter((entry) => entry.id !== stakeholderId);
    if (custom.stakeholders.length === before) {
      return sendJson(res, 404, { error: "Stakeholder not found." });
    }

    await writeJson(STORE_PATH, store);
    return sendJson(res, 200, { ok: true });
  }

  const customProcessMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/companies\/([^/]+)\/buying-process$/);
  if (customProcessMatch && method === "POST") {
    const workspaceId = decodeURIComponent(customProcessMatch[1]);
    const companyId = decodeURIComponent(customProcessMatch[2]);
    const auth = await authenticate(req, store);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    if (auth.user.workspaceId !== workspaceId) {
      return sendJson(res, 403, { error: "Forbidden for this workspace." });
    }

    const companyExists = companies.some((entry) => entry.id === companyId);
    if (!companyExists) {
      return sendJson(res, 404, { error: "Company not found." });
    }

    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }

    const phase = String(body.phase || "").trim();
    const owner = String(body.owner || "").trim();
    const timeline = String(body.timeline || "").trim();
    const guess = String(body.guess || "").trim();
    if (!phase || !owner || !timeline || !guess) {
      return sendJson(res, 400, { error: "phase, owner, timeline, and guess are required." });
    }

    const custom = getCompanyCustomization(store, workspaceId, companyId);
    const step = {
      id: crypto.randomUUID(),
      phase: phase.slice(0, 120),
      owner: owner.slice(0, 120),
      timeline: timeline.slice(0, 80),
      guess: guess.slice(0, 1200)
    };
    custom.buyingProcess.push(step);
    await writeJson(STORE_PATH, store);
    return sendJson(res, 201, { step });
  }

  const customProcessDeleteMatch = pathname.match(
    /^\/api\/workspaces\/([^/]+)\/companies\/([^/]+)\/buying-process\/([^/]+)$/
  );
  if (customProcessDeleteMatch && method === "DELETE") {
    const workspaceId = decodeURIComponent(customProcessDeleteMatch[1]);
    const companyId = decodeURIComponent(customProcessDeleteMatch[2]);
    const stepId = decodeURIComponent(customProcessDeleteMatch[3]);
    const auth = await authenticate(req, store);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    if (auth.user.workspaceId !== workspaceId) {
      return sendJson(res, 403, { error: "Forbidden for this workspace." });
    }

    const companyExists = companies.some((entry) => entry.id === companyId);
    if (!companyExists) {
      return sendJson(res, 404, { error: "Company not found." });
    }

    const custom = getCompanyCustomization(store, workspaceId, companyId);
    const before = custom.buyingProcess.length;
    custom.buyingProcess = custom.buyingProcess.filter((entry) => entry.id !== stepId);
    if (custom.buyingProcess.length === before) {
      return sendJson(res, 404, { error: "Step not found." });
    }

    await writeJson(STORE_PATH, store);
    return sendJson(res, 200, { ok: true });
  }

  const automationCampaignsMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/automation\/campaigns$/);
  if (automationCampaignsMatch && method === "GET") {
    const workspaceId = decodeURIComponent(automationCampaignsMatch[1]);
    const auth = await authenticate(req, store);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    if (auth.user.workspaceId !== workspaceId) {
      return sendJson(res, 403, { error: "Forbidden for this workspace." });
    }

    const companyId = String(url.searchParams.get("companyId") || "").trim();
    const campaigns = getWorkspaceCampaigns(store, workspaceId)
      .filter((entry) => !companyId || entry.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sendJson(res, 200, { campaigns });
  }

  const automationGenerateMatch = pathname.match(
    /^\/api\/workspaces\/([^/]+)\/companies\/([^/]+)\/automation\/generate$/
  );
  if (automationGenerateMatch && method === "POST") {
    const workspaceId = decodeURIComponent(automationGenerateMatch[1]);
    const companyId = decodeURIComponent(automationGenerateMatch[2]);
    const auth = await authenticate(req, store);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    if (auth.user.workspaceId !== workspaceId) {
      return sendJson(res, 403, { error: "Forbidden for this workspace." });
    }

    const company = companies.find((entry) => entry.id === companyId);
    if (!company) {
      return sendJson(res, 404, { error: "Company not found." });
    }

    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }

    const brief = sanitizeAutomationBrief(body);
    if (!brief.productName || !brief.offer || !brief.audience) {
      return sendJson(res, 400, {
        error: "productName, offer, and audience are required."
      });
    }

    const output = await generateAutomationOutput(company, brief);
    const campaign = {
      id: crypto.randomUUID(),
      workspaceId,
      companyId,
      companyName: company.name,
      title: `${brief.productName} campaign pack`,
      status: "Draft",
      brief,
      output,
      createdBy: auth.user.name,
      createdAt: new Date().toISOString(),
      updatedAt: null
    };

    const workspaceCampaigns = getWorkspaceCampaigns(store, workspaceId);
    workspaceCampaigns.unshift(campaign);
    if (workspaceCampaigns.length > 100) {
      workspaceCampaigns.length = 100;
    }

    await writeJson(STORE_PATH, store);
    return sendJson(res, 201, { campaign });
  }

  const automationCampaignByIdMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/automation\/campaigns\/([^/]+)$/);
  if (automationCampaignByIdMatch && method === "PATCH") {
    const workspaceId = decodeURIComponent(automationCampaignByIdMatch[1]);
    const campaignId = decodeURIComponent(automationCampaignByIdMatch[2]);
    const auth = await authenticate(req, store);
    if (!auth) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    if (auth.user.workspaceId !== workspaceId) {
      return sendJson(res, 403, { error: "Forbidden for this workspace." });
    }

    const body = await getBody(req);
    if (!body) {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }

    const status = sanitizeText(body.status, "", 24);
    if (!CAMPAIGN_STATUSES.has(status)) {
      return sendJson(res, 400, { error: "status must be Draft, Approved, or Queued." });
    }

    const workspaceCampaigns = getWorkspaceCampaigns(store, workspaceId);
    const campaign = workspaceCampaigns.find((entry) => entry.id === campaignId);
    if (!campaign) {
      return sendJson(res, 404, { error: "Campaign not found." });
    }

    campaign.status = status;
    campaign.updatedAt = new Date().toISOString();
    await writeJson(STORE_PATH, store);
    return sendJson(res, 200, { campaign });
  }

  const companyMatch = pathname.match(/^\/api\/companies\/([^/]+)$/);
  if (method === "GET" && companyMatch) {
    const companyId = decodeURIComponent(companyMatch[1]);
    const company = companies.find((entry) => entry.id === companyId);
    if (!company) {
      return sendJson(res, 404, { error: "Company not found." });
    }
    return sendJson(res, 200, { company });
  }

  return sendJson(res, 404, { error: "API route not found." });
}

function safePathFromUrl(urlPath) {
  const normalized = path.normalize(urlPath).replace(/^([.][.][/\\])+/, "");
  const targetPath = path.join(ROOT, normalized);
  if (!targetPath.startsWith(ROOT)) {
    return null;
  }
  return targetPath;
}

async function serveStatic(req, res, url) {
  const rawPathname = decodeURIComponent(url.pathname);
  const pathname =
    rawPathname.length > 1 && rawPathname.endsWith("/") ? rawPathname.slice(0, -1) : rawPathname;

  if (pathname === "/") {
    res.writeHead(301, { Location: "/marketing" });
    res.end();
    return;
  }

  if (pathname === "/founder-backend") {
    res.writeHead(302, { Location: FOUNDER_BACKEND_URL });
    res.end();
    return;
  }

  const pageRoutes = {
    "/marketing": "marketing.html",
    "/free-call": "free-call.html",
    "/founder-signups": "founder-signups.html",
    "/founder-integrations": "founder-integrations.html",
    "/features": "features.html",
    "/marketing-lead-gen": "marketing-lead-gen.html",
    "/marketing-lead-tracker": "marketing-lead-tracker.html",
    "/marketing-lead-gen/creative": "marketing-lead-gen-vsl.html",
    "/marketing-lead-gen/vsl": "marketing-lead-gen-vsl.html",
    "/marketing-lead-gen/assets": "marketing-lead-gen-assets.html",
    "/marketing-lead-gen/budget": "marketing-lead-gen-budget.html",
    "/lead-insights-login": "lead-insights-login.html",
    "/lead-insights-get-started": "lead-insights-get-started.html",
    "/pricing": "pricing.html",
    "/stories": "stories.html",
    "/login": "login.html",
    "/get-started": "get-started.html",
    "/workspace": "workspace.html"
  };

  const mappedPage = pageRoutes[pathname];
  if (mappedPage || pathname === "/company" || pathname.startsWith("/company/")) {
    const htmlFile = mappedPage || "workspace.html";
    const html = await fs.readFile(path.join(ROOT, htmlFile), "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  const filePath = safePathFromUrl(pathname);
  if (!filePath) {
    return sendText(res, 400, "Bad request path");
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return sendText(res, 404, "Not found");
    }

    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(res, 404, "Not found");
      return;
    }

    sendText(res, 500, "Internal server error");
  }
}

async function start() {
  await ensureStorage();

  if (ADS_SYNC_ENABLED) {
    adsSyncTimer = setInterval(() => {
      runAdsDataSync("scheduler").catch((error) => {
        console.error("Scheduled ads sync failed:", error);
      });
    }, ADS_SYNC_INTERVAL_MINUTES * 60 * 1000);
  }
  if (ADS_SYNC_ENABLED && ADS_SYNC_RUN_ON_START) {
    runAdsDataSync("startup").catch((error) => {
      console.error("Startup ads sync failed:", error);
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);

      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
        return;
      }

      await serveStatic(req, res, url);
    } catch (error) {
      console.error(error);
      sendText(res, 500, "Internal server error");
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Accountstory running at http://localhost:${PORT}`);
    if (ADS_SYNC_ENABLED) {
      console.log(`Ads sync scheduler enabled: every ${ADS_SYNC_INTERVAL_MINUTES} minutes`);
    } else {
      console.log("Ads sync scheduler disabled");
    }
  });

  server.on("close", () => {
    if (adsSyncTimer) {
      clearInterval(adsSyncTimer);
      adsSyncTimer = null;
    }
  });
}

start();
