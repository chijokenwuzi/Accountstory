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
const CAMPAIGN_STATUSES = new Set(["Draft", "Approved", "Queued"]);
const LEAD_GEN_CHANNEL_DEFINITIONS = {
  "google-ads": { label: "Google Ads", defaultCpl: 180 },
  "twitter-ads": { label: "Twitter Ads", defaultCpl: 140 },
  "tiktok-ads": { label: "TikTok Ads", defaultCpl: 110 },
  seo: { label: "SEO", defaultCpl: 95 }
};
const LEAD_GEN_CHANNEL_KEYS = new Set(Object.keys(LEAD_GEN_CHANNEL_DEFINITIONS));

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
      base.automationCampaigns && typeof base.automationCampaigns === "object" ? base.automationCampaigns : {}
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
    "twitter-ads": "Test new hooks/angles weekly and pause underperforming audiences quickly.",
    "tiktok-ads": "Publish 2-3 short-form creative variants and scale the best watch-time + CTR combo.",
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
  const twitterPlan = baseOutput.ads?.x || {};
  const facebookPlan = baseOutput.ads?.facebook || {};
  const vsl = baseOutput.vsl || {};
  const channelPlans = {};

  if (selectedChannels.includes("google-ads")) {
    channelPlans.googleAds = googlePlan;
  }

  if (selectedChannels.includes("twitter-ads")) {
    channelPlans.twitterAds = twitterPlan;
  }

  if (selectedChannels.includes("tiktok-ads")) {
    channelPlans.tiktokAds = {
      hooks: sanitizeList([vsl.hook, ...(facebookPlan.headlines || []), ...(facebookPlan.creativeAngles || [])], 8, 140),
      scriptIdeas: sanitizeList(vsl.outline || [], 6, 180),
      captions: sanitizeList(
        [...(facebookPlan.primaryText || []), ...(twitterPlan.postVariants || [])],
        6,
        220
      ),
      cta: sanitizeText(facebookPlan.cta || vsl.cta || "Book Strategy Call", "Book Strategy Call", 80)
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
  const xShare = Math.max(0, budget - googleShare - facebookShare);
  const audience = brief.audience || `${company.industry} decision makers`;
  const baseHook = `${brief.productName} helps ${audience} get results without wasting ad budget.`;

  return {
    summary: `AI campaign pack for ${company.name}: Creative + Google + Meta + X variants focused on ${brief.objective.toLowerCase()}.`,
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
            "video sales letter ads",
            "google and facebook ad automation",
            "performance marketing system",
            "paid media optimization service"
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
            `Most ad accounts are not underfunded. They are under-systemized. ${brief.productName} fixes that with one weekly growth loop.`,
            `If your team runs Google + Meta + X separately, your learning cycle is broken. We combine creative testing and optimization in one system.`,
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
          { channel: "X (Twitter)", percent: 20, budgetUsd: xShare }
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
        "Wednesday: Launch/refresh Google, Meta, and X campaigns.",
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

  if (pathname === "/founder-backend") {
    res.writeHead(302, { Location: FOUNDER_BACKEND_URL });
    res.end();
    return;
  }

  const pageRoutes = {
    "/": "index.html",
    "/marketing": "marketing.html",
    "/features": "features.html",
    "/marketing-lead-gen": "marketing-lead-gen.html",
    "/marketing-lead-tracker": "marketing-lead-tracker.html",
    "/marketing-lead-gen/creative": "marketing-lead-gen-vsl.html",
    "/marketing-lead-gen/vsl": "marketing-lead-gen-vsl.html",
    "/marketing-lead-gen/assets": "marketing-lead-gen-assets.html",
    "/marketing-lead-gen/budget": "marketing-lead-gen-budget.html",
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
  });
}

start();
