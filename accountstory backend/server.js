const http = require("node:http");
const path = require("node:path");
const fsSync = require("node:fs");
const { promises: fs } = require("node:fs");

function loadEnvFile(filePath) {
  try {
    const raw = fsSync.readFileSync(filePath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const separator = trimmed.indexOf("=");
      if (separator < 0) return;

      const key = trimmed.slice(0, separator).trim();
      const valueRaw = trimmed.slice(separator + 1).trim();
      if (!key || key in process.env) return;

      const unquoted = valueRaw.replace(/^['"]|['"]$/g, "");
      process.env[key] = unquoted;
    });
  } catch {
    // Optional .env file; ignore if missing or unreadable.
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 9091);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 30000);
const OPENAI_ALLOW_FALLBACK = process.env.OPENAI_ALLOW_FALLBACK === "true";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const STAGES = ["Intake", "Creative QA", "Launch", "Optimization", "Scale", "Blocked"];
const ACTIVE_STAGES = new Set(["Launch", "Optimization", "Scale"]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const STOP_WORDS = new Set([
  "about",
  "above",
  "after",
  "again",
  "against",
  "almost",
  "also",
  "because",
  "been",
  "before",
  "being",
  "between",
  "could",
  "every",
  "from",
  "have",
  "just",
  "more",
  "much",
  "only",
  "other",
  "over",
  "should",
  "some",
  "than",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "very",
  "want",
  "with",
  "your"
]);

const DEFAULT_STORE = {
  selectedCustomerId: "cust-1",
  customers: [
    {
      id: "cust-1",
      name: "Cobalt Care",
      industry: "Healthcare",
      tier: "Enterprise",
      website: "https://cobaltcare.example",
      location: "Florida",
      defaultOffer: "Free smile consultation",
      defaultAudience: "Adults 28-55 interested in cosmetic dentistry",
      defaultLandingUrl: "https://cobaltcare.example/consult",
      customerNotes: "Avoid absolute medical claims. Keep tone confident and premium."
    },
    {
      id: "cust-2",
      name: "Astera Retail",
      industry: "Ecommerce",
      tier: "Growth",
      website: "https://asteraretail.example",
      location: "United States",
      defaultOffer: "",
      defaultAudience: "",
      defaultLandingUrl: "",
      customerNotes: ""
    },
    {
      id: "cust-3",
      name: "Beacon Freight",
      industry: "Logistics",
      tier: "Core",
      website: "https://beaconfreight.example",
      location: "Texas",
      defaultOffer: "",
      defaultAudience: "",
      defaultLandingUrl: "",
      customerNotes: ""
    }
  ],
  guardrails: {
    budgetCap: 2500,
    cpaCap: 120,
    policyGate: true,
    creativeGate: true,
    killSwitch: true
  },
  campaigns: [
    {
      id: "cmp-1",
      customerId: "cust-1",
      name: "Patient Enrollment Sprint",
      goal: "Lead Volume",
      channels: ["Facebook", "Google"],
      dailyBudget: 900,
      targetCpa: 88,
      mode: "Hybrid",
      stage: "Optimization",
      risk: "Low"
    },
    {
      id: "cmp-2",
      customerId: "cust-2",
      name: "Founder VSL Offer Push",
      goal: "Booked Calls",
      channels: ["Facebook"],
      dailyBudget: 3000,
      targetCpa: 130,
      mode: "Autopilot",
      stage: "Blocked",
      risk: "High"
    }
  ],
  assets: [
    {
      id: "asset-1",
      customerId: "cust-1",
      type: "VSL",
      url: "",
      notes: "90 second founder VSL with compliance-safe claims"
    }
  ],
  adInputRuns: []
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_STORE));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function parseBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new Error("Payload too large");
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeCustomer(entry, fallbackId) {
  const source = entry && typeof entry === "object" ? entry : {};
  return {
    id: normalizeText(source.id) || fallbackId || uid("cust"),
    name: normalizeText(source.name) || "Customer",
    industry: normalizeText(source.industry) || "Unknown",
    tier: normalizeText(source.tier) || "Core",
    website: normalizeText(source.website),
    location: normalizeText(source.location),
    defaultOffer: normalizeText(source.defaultOffer),
    defaultAudience: normalizeText(source.defaultAudience),
    defaultLandingUrl: normalizeText(source.defaultLandingUrl),
    customerNotes: normalizeText(source.customerNotes)
  };
}

function parseCustomInputs(value) {
  const rawText = String(value || "").trim();
  if (!rawText) {
    return { rawText: "", parsed: null };
  }

  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === "object") {
      return { rawText, parsed };
    }
    return { rawText, parsed: null };
  } catch {
    return { rawText, parsed: null };
  }
}

function truncate(value, max) {
  const text = normalizeText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function slugify(value) {
  const text = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return text || "offer";
}

function extractKeywords(text, max = 6) {
  const counts = new Map();
  const tokens = normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((entry) => entry && entry.length > 3 && !STOP_WORDS.has(entry) && !/^\d+$/.test(entry));

  tokens.forEach((token) => {
    counts.set(token, (counts.get(token) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map((entry) => entry[0]);
}

function inferOffer(offer, artifactText) {
  const direct = normalizeText(offer);
  if (direct) return direct;

  const text = normalizeText(artifactText);
  if (!text) return "qualified leads at predictable CPA";

  const sentence = text.split(/(?<=[.!?])\s+/)[0] || text;
  return truncate(sentence, 90).toLowerCase();
}

function riskLevel(campaign, guardrails) {
  const budget = Number(campaign.dailyBudget || 0);
  const cpa = Number(campaign.targetCpa || 0);
  const budgetCap = Number(guardrails.budgetCap || 0);
  const cpaCap = Number(guardrails.cpaCap || 0);

  if (budget > budgetCap || cpa > cpaCap) return "High";
  if (budget > budgetCap * 0.8 || cpa > cpaCap * 0.8) return "Medium";
  return "Low";
}

function moveStageForward(campaign) {
  if (campaign.stage === "Blocked") {
    campaign.stage = "Creative QA";
    return;
  }

  const index = STAGES.indexOf(campaign.stage);
  const maxIndex = STAGES.indexOf("Scale");
  if (index >= 0 && index < maxIndex) {
    campaign.stage = STAGES[index + 1];
  }
}

function buildFacebookInput(option, context) {
  const geo = context.customerLocation || "US";
  const defaultAudience = `${geo} 25-54, interests in ${context.keywordOne} and ${context.keywordTwo}, plus lookalikes from customer leads`;
  return {
    campaignName: truncate(`${context.customerName} | ${option.label} | FB`, 80),
    objective: context.objective,
    adSetAudience: truncate(context.audience || defaultAudience, 170),
    placements: "Advantage+ placements (Feeds, Reels, Stories)",
    primaryText: truncate(
      `${option.hook} ${context.offer}. Built from customer artifact: ${context.artifactName}. ${option.proofLine} ${option.ctaLine}`,
      350
    ),
    headline: truncate(option.headline, 40),
    description: truncate(option.description, 100),
    cta: context.cta,
    destinationUrl: context.landingUrl
  };
}

function buildGoogleInput(option, context) {
  const h1 = truncate(option.headline, 30);
  const h2 = truncate(`Get ${context.keywordOne} faster`, 30);
  const h3 = truncate(`${context.customerName} ${context.objective}`, 30);
  const h4 = truncate(`Reduce CPA with ${context.keywordTwo}`, 30);
  const h5 = truncate(option.shortHook, 30);
  const h6 = truncate(context.cta, 30);

  const d1 = truncate(`${option.hook} ${context.offer}. Built from your team artifact for faster launch.`, 90);
  const d2 = truncate(`Use ${context.keywordOne} + ${context.keywordTwo} messaging to qualify better leads.`, 90);
  const d3 = truncate(`${option.proofLine} Start with this draft and publish in Google Ads.`, 90);

  return {
    campaignName: truncate(`${context.customerName} | ${option.label} | Google`, 80),
    campaignType: "Search",
    finalUrl: context.landingUrl,
    path1: truncate(slugify(context.keywordOne), 15),
    path2: truncate(slugify(context.keywordTwo), 15),
    headlines: [h1, h2, h3, h4, h5, h6],
    descriptions: [d1, d2, d3],
    keywords: [
      truncate(`${context.keywordOne} service`, 40),
      truncate(`${context.keywordTwo} offer`, 40),
      truncate(`${context.customerName} ${context.objective}`.toLowerCase(), 40)
    ],
    audienceSignal: truncate(
      context.audience || `High-intent prospects searching for ${context.keywordOne} and ${context.keywordTwo}.`,
      120
    )
  };
}

function buildGenerationContext({
  objective,
  cta,
  customerName,
  customerIndustry,
  customerTier,
  customerLocation,
  customerNotes,
  artifactName,
  artifactText,
  offer,
  landingUrl,
  audience,
  strategyNotes,
  customInputs
}) {
  const normalizedArtifact = normalizeText(artifactText);
  const keywords = extractKeywords(`${artifactName} ${offer} ${normalizedArtifact}`, 6);
  const keywordOne = keywords[0] || "conversion";
  const keywordTwo = keywords[1] || "pipeline";
  const keywordThree = keywords[2] || "growth";
  const parsedInputs = parseCustomInputs(customInputs);

  return {
    objective: normalizeText(objective) || "Leads",
    cta: normalizeText(cta) || "Learn More",
    customerName: normalizeText(customerName) || "Customer",
    customerIndustry: normalizeText(customerIndustry),
    customerTier: normalizeText(customerTier),
    customerLocation: normalizeText(customerLocation),
    customerNotes: normalizeText(customerNotes),
    artifactName: normalizeText(artifactName) || "Collateral Pack",
    offer: inferOffer(offer, artifactText),
    landingUrl: normalizeText(landingUrl) || "https://clientdomain.com/offer",
    audience: normalizeText(audience),
    strategyNotes: normalizeText(strategyNotes),
    customInputsRaw: parsedInputs.rawText,
    customInputsParsed: parsedInputs.parsed,
    keywordOne,
    keywordTwo,
    keywordThree,
    artifactText: normalizedArtifact
  };
}

function generateRuleBasedAdInputOptions({
  channels,
  objective,
  cta,
  customerName,
  customerIndustry,
  customerTier,
  customerLocation,
  customerNotes,
  artifactName,
  artifactText,
  offer,
  landingUrl,
  audience,
  strategyNotes,
  customInputs
}) {
  const context = buildGenerationContext({
    objective,
    cta,
    customerName,
    customerIndustry,
    customerTier,
    customerLocation,
    customerNotes,
    artifactName,
    artifactText,
    offer,
    landingUrl,
    audience,
    strategyNotes,
    customInputs
  });

  const angleBlueprints = [
    {
      label: "Outcome Angle",
      hook: `Get ${context.offer} without long setup cycles`,
      shortHook: `Get ${context.offer}`,
      headline: `Get ${context.offer}`,
      description: `Outcome-focused angle for prospects ready to act.`
    },
    {
      label: "Pain To Solution",
      hook: `Stop wasting budget on low intent traffic and shift into ${context.keywordOne}-driven campaigns`,
      shortHook: `Stop budget waste`,
      headline: `Cut waste, grow ${context.keywordOne}`,
      description: `Pain-first framing that calls out current inefficiency.`
    },
    {
      label: "Proof Angle",
      hook: `Use proven collateral and customer proof to increase trust before the click`,
      shortHook: `Lead with proof`,
      headline: `Proof-led ${context.objective} system`,
      description: `Social proof framing using customer collateral.`
    }
  ];

  return angleBlueprints.slice(0, 3).map((angle, index) => {
    const option = {
      id: `rule-${index + 1}`,
      label: angle.label,
      rationale: `${angle.description} Focus keywords: ${context.keywordOne}, ${context.keywordTwo}, ${context.keywordThree}.`,
      hook: angle.hook,
      shortHook: angle.shortHook,
      headline: angle.headline,
      description: angle.description,
      proofLine: `Message built from ${context.artifactName}.`,
      ctaLine: `CTA: ${context.cta}.`
    };

    if (channels.includes("Facebook")) {
      option.facebook = buildFacebookInput(option, context);
    }

    if (channels.includes("Google")) {
      option.google = buildGoogleInput(option, context);
    }

    return option;
  });
}

function extractResponseText(payload) {
  if (payload && typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (payload && Array.isArray(payload.output)) {
    const chunks = [];
    payload.output.forEach((entry) => {
      if (!entry || !Array.isArray(entry.content)) return;
      entry.content.forEach((part) => {
        if (part && typeof part.text === "string") {
          chunks.push(part.text);
        }
      });
    });
    if (chunks.length) return chunks.join("\n");
  }

  return "";
}

function parseJsonFromModelText(text) {
  const raw = normalizeText(text);
  if (!raw) {
    throw new Error("OpenAI returned empty output.");
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidateFromFence = fenced ? fenced[1].trim() : "";
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const candidateFromBraces = firstBrace >= 0 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : "";
  const candidate = candidateFromFence || candidateFromBraces || raw;

  return JSON.parse(candidate);
}

function sanitizeStringList(input, itemMaxLen, maxItems, fallbackValues = []) {
  const values = Array.isArray(input) ? input : fallbackValues;
  const cleaned = values
    .map((entry) => truncate(normalizeText(entry), itemMaxLen))
    .filter((entry) => Boolean(entry));
  return cleaned.slice(0, maxItems);
}

function sanitizeFacebookPack(pack, context, label) {
  const source = pack && typeof pack === "object" ? pack : {};
  const fallbackOption = {
    label,
    hook: `Get ${context.offer}`,
    shortHook: `Get ${context.offer}`,
    headline: `${label} ${context.offer}`,
    description: "Generated from provided campaign inputs.",
    proofLine: `Message built from ${context.artifactName}.`,
    ctaLine: `CTA: ${context.cta}.`
  };
  const fallback = buildFacebookInput(fallbackOption, context);

  return {
    campaignName: truncate(source.campaignName || fallback.campaignName, 80),
    objective: truncate(source.objective || context.objective, 30),
    adSetAudience: truncate(source.adSetAudience || fallback.adSetAudience, 170),
    placements: truncate(source.placements || fallback.placements, 120),
    primaryText: truncate(source.primaryText || fallback.primaryText, 350),
    headline: truncate(source.headline || fallback.headline, 40),
    description: truncate(source.description || fallback.description, 100),
    cta: truncate(source.cta || context.cta, 30),
    destinationUrl: normalizeText(source.destinationUrl || context.landingUrl || fallback.destinationUrl)
  };
}

function sanitizeGooglePack(pack, context, label) {
  const source = pack && typeof pack === "object" ? pack : {};
  const fallbackOption = {
    label,
    hook: `Get ${context.offer}`,
    shortHook: `Get ${context.offer}`,
    headline: `${label} ${context.offer}`,
    description: "Generated from provided campaign inputs.",
    proofLine: `Message built from ${context.artifactName}.`,
    ctaLine: `CTA: ${context.cta}.`
  };
  const fallback = buildGoogleInput(fallbackOption, context);

  return {
    campaignName: truncate(source.campaignName || fallback.campaignName, 80),
    campaignType: truncate(source.campaignType || fallback.campaignType, 20),
    finalUrl: normalizeText(source.finalUrl || context.landingUrl || fallback.finalUrl),
    path1: truncate(slugify(source.path1 || fallback.path1), 15),
    path2: truncate(slugify(source.path2 || fallback.path2), 15),
    headlines: sanitizeStringList(source.headlines, 30, 8, fallback.headlines),
    descriptions: sanitizeStringList(source.descriptions, 90, 4, fallback.descriptions),
    keywords: sanitizeStringList(source.keywords, 40, 8, fallback.keywords),
    audienceSignal: truncate(source.audienceSignal || fallback.audienceSignal, 120)
  };
}

function normalizeAiOptions(rawOptions, channels, context) {
  const source = Array.isArray(rawOptions) ? rawOptions.slice(0, 3) : [];
  if (!source.length) {
    throw new Error("OpenAI returned no options.");
  }

  return source.map((entry, index) => {
    const optionSource = entry && typeof entry === "object" ? entry : {};
    const label = truncate(optionSource.label || `Option ${index + 1}`, 60);
    const rationale = truncate(
      optionSource.rationale || "Generated from provided campaign and artifact inputs.",
      220
    );

    const option = {
      id: uid("adopt"),
      label,
      rationale
    };

    if (channels.includes("Facebook")) {
      option.facebook = sanitizeFacebookPack(optionSource.facebook, context, label);
    }

    if (channels.includes("Google")) {
      option.google = sanitizeGooglePack(optionSource.google, context, label);
    }

    return option;
  });
}

async function generateOpenAiAdInputOptions({
  channels,
  objective,
  cta,
  customerName,
  customerIndustry,
  customerTier,
  customerLocation,
  customerNotes,
  artifactName,
  artifactText,
  offer,
  landingUrl,
  audience,
  strategyNotes,
  customInputs
}) {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OpenAI API key is missing. Set OPENAI_API_KEY in your environment to generate campaigns."
    );
  }

  const context = buildGenerationContext({
    objective,
    cta,
    customerName,
    customerIndustry,
    customerTier,
    customerLocation,
    customerNotes,
    artifactName,
    artifactText,
    offer,
    landingUrl,
    audience,
    strategyNotes,
    customInputs
  });

  const userPayload = {
    customerName: context.customerName,
    customerProfile: {
      industry: context.customerIndustry || "",
      tier: context.customerTier || "",
      location: context.customerLocation || "",
      notes: context.customerNotes || ""
    },
    objective: context.objective,
    cta: context.cta,
    channels,
    artifactName: context.artifactName,
    offer: context.offer,
    landingUrl: context.landingUrl,
    audience: context.audience || "",
    strategyNotes: context.strategyNotes || "",
    customInputs: context.customInputsParsed || context.customInputsRaw || "",
    artifactText: context.artifactText || ""
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are an ad operations planner. Output JSON only. Create 2-3 campaign options for Facebook and/or Google based on provided inputs. Use every non-empty input field exactly where relevant. Keep copy concise and practical for direct use in Ads Manager and Google Ads."
          },
          {
            role: "user",
            content:
              `Return strict JSON: {"options":[{"label":"...","rationale":"...","facebook":{"campaignName":"...","objective":"...","adSetAudience":"...","placements":"...","primaryText":"...","headline":"...","description":"...","cta":"...","destinationUrl":"..."},"google":{"campaignName":"...","campaignType":"Search","finalUrl":"...","path1":"...","path2":"...","headlines":["..."],"descriptions":["..."],"keywords":["..."],"audienceSignal":"..."}}]}. Include facebook object only if Facebook is in channels. Include google object only if Google is in channels. Respect platform constraints: Facebook headline <= 40 chars, Facebook description <= 100 chars, Google headlines <= 30 chars, Google descriptions <= 90 chars, path fields <= 15 chars. Input: ${JSON.stringify(userPayload)}`
          }
        ]
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed (${response.status}): ${truncate(detail, 220)}`);
  }

  const payload = await response.json();
  const outputText = extractResponseText(payload);
  const parsed = parseJsonFromModelText(outputText);

  return normalizeAiOptions(parsed.options, channels, context);
}

async function generateAdInputOptions(input) {
  try {
    return await generateOpenAiAdInputOptions(input);
  } catch (error) {
    if (OPENAI_ALLOW_FALLBACK) {
      return generateRuleBasedAdInputOptions(input).map((entry) => ({
        id: uid("adopt"),
        label: entry.label,
        rationale: `${entry.rationale} (Fallback mode)`,
        ...(entry.facebook ? { facebook: entry.facebook } : {}),
        ...(entry.google ? { google: entry.google } : {})
      }));
    }
    throw error;
  }
}

function normalizeStore(raw) {
  const base = cloneDefaults();
  const next = {
    ...base,
    ...(raw && typeof raw === "object" ? raw : {})
  };

  if (!Array.isArray(next.customers) || !next.customers.length) {
    next.customers = base.customers;
  }
  next.customers = next.customers.map((entry, index) => normalizeCustomer(entry, `cust-${index + 1}`));

  if (!Array.isArray(next.campaigns)) next.campaigns = [];
  if (!Array.isArray(next.assets)) next.assets = [];
  if (!Array.isArray(next.adInputRuns)) next.adInputRuns = [];

  if (!next.selectedCustomerId || !next.customers.some((entry) => entry.id === next.selectedCustomerId)) {
    next.selectedCustomerId = next.customers[0].id;
  }

  next.guardrails = {
    ...base.guardrails,
    ...(next.guardrails && typeof next.guardrails === "object" ? next.guardrails : {})
  };

  next.campaigns = next.campaigns.map((campaign) => {
    const safe = {
      ...campaign,
      channels: Array.isArray(campaign.channels)
        ? campaign.channels.filter((channel) => channel === "Facebook" || channel === "Google")
        : [],
      stage: STAGES.includes(campaign.stage) ? campaign.stage : "Intake"
    };
    safe.risk = riskLevel(safe, next.guardrails);
    return safe;
  });

  next.adInputRuns = next.adInputRuns
    .filter((entry) => entry && typeof entry === "object")
    .slice(0, 120)
    .map((entry) => ({
      id: String(entry.id || uid("run")),
      customerId: String(entry.customerId || ""),
      channels: Array.isArray(entry.channels)
        ? entry.channels.filter((channel) => channel === "Facebook" || channel === "Google")
        : [],
      objective: normalizeText(entry.objective) || "Leads",
      cta: normalizeText(entry.cta) || "Learn More",
      artifactName: normalizeText(entry.artifactName),
      offer: normalizeText(entry.offer),
      landingUrl: normalizeText(entry.landingUrl),
      audience: normalizeText(entry.audience),
      strategyNotes: normalizeText(entry.strategyNotes),
      customInputs:
        typeof entry.customInputs === "string"
          ? entry.customInputs.trim()
          : entry.customInputs && typeof entry.customInputs === "object"
            ? JSON.stringify(entry.customInputs)
            : "",
      createdAt: normalizeText(entry.createdAt) || new Date().toISOString(),
      options: Array.isArray(entry.options) ? entry.options.slice(0, 3) : []
    }));

  return next;
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const seed = normalizeStore(cloneDefaults());
    await fs.writeFile(STORE_PATH, JSON.stringify(seed, null, 2));
  }
}

async function readStore() {
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeStore(parsed);
}

async function writeStore(store) {
  await fs.writeFile(STORE_PATH, JSON.stringify(normalizeStore(store), null, 2));
}

function safePathFromUrl(urlPath) {
  const normalized = path.normalize(urlPath).replace(/^([.][.][/\\])+/, "");
  const target = path.join(ROOT, normalized);
  if (!target.startsWith(ROOT)) return null;
  return target;
}

async function serveStatic(res, pathname) {
  const routePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = safePathFromUrl(routePath);
  if (!filePath) {
    sendText(res, 400, "Bad request path");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      sendText(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath);
    const type = MIME_TYPES[ext] || "application/octet-stream";
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      sendText(res, 404, "Not found");
      return;
    }
    sendText(res, 500, "Internal server error");
  }
}

async function handleApi(req, res, pathname) {
  const method = req.method || "GET";
  const store = await readStore();

  if (method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "accountstory-backend-workspace",
      openAiConfigured: Boolean(OPENAI_API_KEY),
      openAiFallbackEnabled: OPENAI_ALLOW_FALLBACK,
      model: OPENAI_MODEL
    });
  }

  if (method === "GET" && pathname === "/api/state") {
    return sendJson(res, 200, { state: store });
  }

  if (method === "PATCH" && pathname === "/api/selection") {
    const body = await parseBody(req);
    const customerId = normalizeText(body.customerId);
    if (!customerId) {
      return sendJson(res, 400, { error: "customerId is required." });
    }
    if (!store.customers.some((entry) => entry.id === customerId)) {
      return sendJson(res, 404, { error: "Customer not found." });
    }

    store.selectedCustomerId = customerId;
    await writeStore(store);
    return sendJson(res, 200, { state: normalizeStore(store), message: "Selection updated." });
  }

  if (method === "POST" && pathname === "/api/customers") {
    const body = await parseBody(req);
    const name = normalizeText(body.name);
    const industry = normalizeText(body.industry);
    const tier = normalizeText(body.tier) || "Core";
    const website = normalizeText(body.website);
    const location = normalizeText(body.location);
    const defaultOffer = normalizeText(body.defaultOffer);
    const defaultAudience = normalizeText(body.defaultAudience);
    const defaultLandingUrl = normalizeText(body.defaultLandingUrl);
    const customerNotes = normalizeText(body.customerNotes);

    if (!name || !industry) {
      return sendJson(res, 400, { error: "name and industry are required." });
    }

    const exists = store.customers.some((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      return sendJson(res, 409, { error: "Customer already exists." });
    }

    const customer = normalizeCustomer({
      id: uid("cust"),
      name,
      industry,
      tier,
      website,
      location,
      defaultOffer,
      defaultAudience,
      defaultLandingUrl,
      customerNotes
    });
    store.customers.push(customer);
    store.selectedCustomerId = customer.id;

    await writeStore(store);
    return sendJson(res, 201, { state: normalizeStore(store), message: `${name} added.` });
  }

  if (method === "POST" && pathname === "/api/campaigns") {
    const body = await parseBody(req);
    const customerId = normalizeText(body.customerId);
    const name = normalizeText(body.name);
    const goal = normalizeText(body.goal) || "Lead Volume";
    const mode = normalizeText(body.mode) || "Hybrid";
    const channels = Array.isArray(body.channels)
      ? body.channels.filter((entry) => entry === "Facebook" || entry === "Google")
      : [];
    const dailyBudget = Number(body.dailyBudget || 0);
    const targetCpa = Number(body.targetCpa || 0);

    if (!name || !customerId) {
      return sendJson(res, 400, { error: "customerId and name are required." });
    }

    if (!store.customers.some((entry) => entry.id === customerId)) {
      return sendJson(res, 404, { error: "Customer not found." });
    }

    if (!channels.length) {
      return sendJson(res, 400, { error: "At least one channel is required." });
    }

    const campaign = {
      id: uid("cmp"),
      customerId,
      name,
      goal,
      channels,
      dailyBudget,
      targetCpa,
      mode,
      stage: "Intake",
      risk: "Low"
    };

    campaign.risk = riskLevel(campaign, store.guardrails);
    if (campaign.risk === "High" && store.guardrails.killSwitch) {
      campaign.stage = "Blocked";
    } else if (campaign.mode === "Autopilot" && !store.guardrails.creativeGate) {
      campaign.stage = "Launch";
    }

    store.campaigns.unshift(campaign);
    if (store.campaigns.length > 200) {
      store.campaigns.length = 200;
    }

    await writeStore(store);
    return sendJson(res, 201, {
      state: normalizeStore(store),
      message: campaign.stage === "Blocked" ? "Campaign blocked by guardrails." : "Campaign created."
    });
  }

  if (method === "POST" && pathname === "/api/campaigns/build") {
    const body = await parseBody(req);

    const customerId = normalizeText(body.customerId);
    const campaignBaseName = normalizeText(body.campaignBaseName);
    const objective = normalizeText(body.objective) || "Leads";
    const cta = normalizeText(body.cta) || "Learn More";
    const mode = normalizeText(body.mode) || "Hybrid";
    const artifactName = normalizeText(body.artifactName) || "Collateral Pack";
    const artifactText = normalizeText(body.artifactText);
    const offer = normalizeText(body.offer);
    const landingUrl = normalizeText(body.landingUrl);
    const audience = normalizeText(body.audience);
    const strategyNotes = normalizeText(body.strategyNotes);
    const customInputs = String(body.customInputs || "").trim();
    const channels = Array.isArray(body.channels)
      ? body.channels.filter((entry) => entry === "Facebook" || entry === "Google")
      : [];
    const dailyBudget = Number(body.dailyBudget || 300);
    const targetCpa = Number(body.targetCpa || 75);

    if (!customerId) {
      return sendJson(res, 400, { error: "customerId is required." });
    }

    const customer = store.customers.find((entry) => entry.id === customerId);
    if (!customer) {
      return sendJson(res, 404, { error: "Customer not found." });
    }

    if (!campaignBaseName) {
      return sendJson(res, 400, { error: "campaignBaseName is required." });
    }

    if (!channels.length) {
      return sendJson(res, 400, { error: "Select at least one channel." });
    }

    const resolvedOffer = offer || customer.defaultOffer;
    const resolvedLandingUrl = landingUrl || customer.defaultLandingUrl || customer.website;
    const resolvedAudience = audience || customer.defaultAudience;
    const resolvedStrategyNotes = [customer.customerNotes, strategyNotes].filter((entry) => Boolean(entry)).join(" | ");

    const customerProfileInputs = {};
    if (customer.industry) customerProfileInputs.industry = customer.industry;
    if (customer.tier) customerProfileInputs.tier = customer.tier;
    if (customer.location) customerProfileInputs.location = customer.location;
    if (customer.website) customerProfileInputs.website = customer.website;

    let resolvedCustomInputs = customInputs;
    if (!resolvedCustomInputs && Object.keys(customerProfileInputs).length) {
      resolvedCustomInputs = JSON.stringify(customerProfileInputs);
    } else if (resolvedCustomInputs) {
      const parsed = parseCustomInputs(resolvedCustomInputs);
      if (parsed.parsed && typeof parsed.parsed === "object") {
        resolvedCustomInputs = JSON.stringify({ ...customerProfileInputs, ...parsed.parsed });
      }
    }

    let options;
    try {
      options = await generateAdInputOptions({
        channels,
        objective,
        cta,
        customerName: customer.name,
        customerIndustry: customer.industry,
        customerTier: customer.tier,
        customerLocation: customer.location,
        customerNotes: customer.customerNotes,
        artifactName,
        artifactText,
        offer: resolvedOffer,
        landingUrl: resolvedLandingUrl,
        audience: resolvedAudience,
        strategyNotes: resolvedStrategyNotes,
        customInputs: resolvedCustomInputs
      });
    } catch (error) {
      return sendJson(res, 400, { error: String(error && error.message ? error.message : error) });
    }

    const run = {
      id: uid("run"),
      customerId,
      channels,
      objective,
      cta,
      artifactName,
      offer: inferOffer(resolvedOffer, artifactText),
      landingUrl: resolvedLandingUrl || "https://clientdomain.com/offer",
      audience: resolvedAudience,
      strategyNotes: resolvedStrategyNotes,
      customInputs: resolvedCustomInputs,
      createdAt: new Date().toISOString(),
      options
    };

    store.adInputRuns.unshift(run);
    if (store.adInputRuns.length > 120) {
      store.adInputRuns.length = 120;
    }

    const safeBudget = Math.max(50, Number.isFinite(dailyBudget) ? dailyBudget : 300);
    const budgetPerCampaign = Math.max(50, Math.round(safeBudget / Math.max(1, options.length)));
    const safeTargetCpa = Math.max(1, Number.isFinite(targetCpa) ? targetCpa : 75);

    const createdCampaigns = options.map((option) => {
      const campaign = {
        id: uid("cmp"),
        customerId,
        name: truncate(`${campaignBaseName} | ${option.label}`, 160),
        goal: objective,
        channels: [...channels],
        dailyBudget: budgetPerCampaign,
        targetCpa: safeTargetCpa,
        mode,
        stage: "Intake",
        risk: "Low",
        adRunId: run.id,
        adOptionId: option.id
      };

      campaign.risk = riskLevel(campaign, store.guardrails);
      if (campaign.risk === "High" && store.guardrails.killSwitch) {
        campaign.stage = "Blocked";
      } else if (campaign.mode === "Autopilot" && !store.guardrails.creativeGate) {
        campaign.stage = "Launch";
      }

      return campaign;
    });

    for (let i = createdCampaigns.length - 1; i >= 0; i -= 1) {
      store.campaigns.unshift(createdCampaigns[i]);
    }
    if (store.campaigns.length > 200) {
      store.campaigns.length = 200;
    }

    store.selectedCustomerId = customerId;
    await writeStore(store);

    return sendJson(res, 201, {
      state: normalizeStore(store),
      run,
      message: `Generated ${options.length} ad input packs and created ${createdCampaigns.length} campaigns.`
    });
  }

  if (method === "POST" && pathname === "/api/assets") {
    const body = await parseBody(req);
    const customerId = normalizeText(body.customerId);
    const type = normalizeText(body.type) || "VSL";
    const url = normalizeText(body.url);
    const notes = normalizeText(body.notes);

    if (!customerId) {
      return sendJson(res, 400, { error: "customerId is required." });
    }

    if (!store.customers.some((entry) => entry.id === customerId)) {
      return sendJson(res, 404, { error: "Customer not found." });
    }

    if (!url && !notes) {
      return sendJson(res, 400, { error: "Provide url or notes." });
    }

    const asset = { id: uid("asset"), customerId, type, url, notes };

    store.assets.unshift(asset);
    if (store.assets.length > 300) {
      store.assets.length = 300;
    }

    store.selectedCustomerId = customerId;
    await writeStore(store);
    return sendJson(res, 201, { state: normalizeStore(store), message: "Asset stored." });
  }

  if (method === "POST" && pathname === "/api/ad-inputs/generate") {
    const body = await parseBody(req);

    const customerId = normalizeText(body.customerId);
    const objective = normalizeText(body.objective) || "Leads";
    const cta = normalizeText(body.cta) || "Learn More";
    const artifactName = normalizeText(body.artifactName) || "Collateral Pack";
    const artifactText = normalizeText(body.artifactText);
    const offer = normalizeText(body.offer);
    const landingUrl = normalizeText(body.landingUrl);
    const audience = normalizeText(body.audience);
    const strategyNotes = normalizeText(body.strategyNotes);
    const customInputs = String(body.customInputs || "").trim();
    const channels = Array.isArray(body.channels)
      ? body.channels.filter((entry) => entry === "Facebook" || entry === "Google")
      : [];

    if (!customerId) {
      return sendJson(res, 400, { error: "customerId is required." });
    }

    const customer = store.customers.find((entry) => entry.id === customerId);
    if (!customer) {
      return sendJson(res, 404, { error: "Customer not found." });
    }

    if (!channels.length) {
      return sendJson(res, 400, { error: "Select at least one channel." });
    }

    const resolvedOffer = offer || customer.defaultOffer;
    const resolvedLandingUrl = landingUrl || customer.defaultLandingUrl || customer.website;
    const resolvedAudience = audience || customer.defaultAudience;
    const resolvedStrategyNotes = [customer.customerNotes, strategyNotes].filter((entry) => Boolean(entry)).join(" | ");

    const customerProfileInputs = {};
    if (customer.industry) customerProfileInputs.industry = customer.industry;
    if (customer.tier) customerProfileInputs.tier = customer.tier;
    if (customer.location) customerProfileInputs.location = customer.location;
    if (customer.website) customerProfileInputs.website = customer.website;

    let resolvedCustomInputs = customInputs;
    if (!resolvedCustomInputs && Object.keys(customerProfileInputs).length) {
      resolvedCustomInputs = JSON.stringify(customerProfileInputs);
    } else if (resolvedCustomInputs) {
      const parsed = parseCustomInputs(resolvedCustomInputs);
      if (parsed.parsed && typeof parsed.parsed === "object") {
        resolvedCustomInputs = JSON.stringify({ ...customerProfileInputs, ...parsed.parsed });
      }
    }

    let options;
    try {
      options = await generateAdInputOptions({
        channels,
        objective,
        cta,
        customerName: customer.name,
        customerIndustry: customer.industry,
        customerTier: customer.tier,
        customerLocation: customer.location,
        customerNotes: customer.customerNotes,
        artifactName,
        artifactText,
        offer: resolvedOffer,
        landingUrl: resolvedLandingUrl,
        audience: resolvedAudience,
        strategyNotes: resolvedStrategyNotes,
        customInputs: resolvedCustomInputs
      });
    } catch (error) {
      return sendJson(res, 400, { error: String(error && error.message ? error.message : error) });
    }

    const run = {
      id: uid("run"),
      customerId,
      channels,
      objective,
      cta,
      artifactName,
      offer: inferOffer(resolvedOffer, artifactText),
      landingUrl: resolvedLandingUrl || "https://clientdomain.com/offer",
      audience: resolvedAudience,
      strategyNotes: resolvedStrategyNotes,
      customInputs: resolvedCustomInputs,
      createdAt: new Date().toISOString(),
      options
    };

    store.adInputRuns.unshift(run);
    if (store.adInputRuns.length > 120) {
      store.adInputRuns.length = 120;
    }

    store.selectedCustomerId = customerId;
    await writeStore(store);

    return sendJson(res, 201, {
      state: normalizeStore(store),
      run,
      message: `Generated ${options.length} ad input packs for ${customer.name}.`
    });
  }

  if (method === "PUT" && pathname === "/api/guardrails") {
    const body = await parseBody(req);

    store.guardrails = {
      budgetCap: Number(body.budgetCap || store.guardrails.budgetCap || 2500),
      cpaCap: Number(body.cpaCap || store.guardrails.cpaCap || 120),
      policyGate: Boolean(body.policyGate),
      creativeGate: Boolean(body.creativeGate),
      killSwitch: Boolean(body.killSwitch)
    };

    store.campaigns = store.campaigns.map((campaign) => {
      const next = { ...campaign };
      next.risk = riskLevel(next, store.guardrails);
      if (store.guardrails.killSwitch && next.risk === "High" && ACTIVE_STAGES.has(next.stage)) {
        next.stage = "Blocked";
      }
      return next;
    });

    await writeStore(store);
    return sendJson(res, 200, { state: normalizeStore(store), message: "Guardrails updated." });
  }

  const actionMatch = pathname.match(/^\/api\/campaigns\/([^/]+)\/action$/);
  if (method === "POST" && actionMatch) {
    const campaignId = decodeURIComponent(actionMatch[1]);
    const body = await parseBody(req);
    const action = normalizeText(body.action);

    const campaign = store.campaigns.find((entry) => entry.id === campaignId);
    if (!campaign) {
      return sendJson(res, 404, { error: "Campaign not found." });
    }

    if (action === "advance") {
      moveStageForward(campaign);
    } else if (action === "block") {
      campaign.stage = "Blocked";
      campaign.risk = "High";
    } else if (action === "autopilot") {
      campaign.mode = "Autopilot";
      if (campaign.stage === "Intake") {
        campaign.stage = "Creative QA";
      }
    } else if (action === "archive") {
      store.campaigns = store.campaigns.filter((entry) => entry.id !== campaignId);
    } else {
      return sendJson(res, 400, { error: "Invalid action." });
    }

    store.campaigns = store.campaigns.map((entry) => ({
      ...entry,
      risk: riskLevel(entry, store.guardrails)
    }));

    await writeStore(store);
    return sendJson(res, 200, { state: normalizeStore(store), message: "Campaign updated." });
  }

  if (method === "POST" && pathname === "/api/simulate") {
    let progressed = 0;
    let blocked = 0;

    store.campaigns.forEach((campaign) => {
      if (campaign.stage === "Blocked") {
        if (!store.guardrails.killSwitch) {
          campaign.stage = "Creative QA";
        }
        return;
      }

      moveStageForward(campaign);
      progressed += 1;

      campaign.risk = riskLevel(campaign, store.guardrails);
      if (store.guardrails.killSwitch && campaign.risk === "High" && ACTIVE_STAGES.has(campaign.stage)) {
        campaign.stage = "Blocked";
        blocked += 1;
      }
    });

    await writeStore(store);
    return sendJson(res, 200, {
      state: normalizeStore(store),
      message: `Cycle complete: ${progressed} advanced, ${blocked} blocked by guardrails.`
    });
  }

  return sendJson(res, 404, { error: "API route not found." });
}

async function start() {
  await ensureStore();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);
      const pathname = decodeURIComponent(url.pathname);

      if (pathname.startsWith("/api/")) {
        await handleApi(req, res, pathname);
        return;
      }

      await serveStatic(res, pathname);
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      if (message === "Invalid JSON body") {
        sendJson(res, 400, { error: message });
        return;
      }
      if (message === "Payload too large") {
        sendJson(res, 413, { error: message });
        return;
      }
      sendJson(res, 500, { error: "Internal server error", detail: message });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Accountstory backend workspace running at http://${HOST}:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
