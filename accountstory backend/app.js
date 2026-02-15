let state = null;
let serviceHealth = null;

const customerList = document.getElementById("customerList");
const customerForm = document.getElementById("customerForm");
const customerMessage = document.getElementById("customerMessage");

const buildCampaignForm = document.getElementById("buildCampaignForm");
const buildCustomer = document.getElementById("buildCustomer");
const buildCampaignMessage = document.getElementById("buildCampaignMessage");
const openAiStatus = document.getElementById("openAiStatus");
const backToLandingBtn = document.getElementById("backToLandingBtn");
const loadCustomerDefaultsBtn = document.getElementById("loadCustomerDefaultsBtn");
const customerDefaultsHint = document.getElementById("customerDefaultsHint");
const integrationMessage = document.getElementById("integrationMessage");
const facebookConnectForm = document.getElementById("facebookConnectForm");
const googleConnectForm = document.getElementById("googleConnectForm");
const facebookConnectStatus = document.getElementById("facebookConnectStatus");
const googleConnectStatus = document.getElementById("googleConnectStatus");
const publishQueue = document.getElementById("publishQueue");
const publishMessage = document.getElementById("publishMessage");

const metricCustomers = document.getElementById("metricCustomers");
const metricLive = document.getElementById("metricLive");

const adInputRuns = document.getElementById("adInputRuns");
const simulateBtn = document.getElementById("simulateBtn");
let globalAdCursor = 0;
const ADS_PER_VIEW = 2;
const PLATFORM_LABEL = {
  facebook: "Facebook",
  google: "Google"
};

function setMessage(node, type, text) {
  if (!node) return;
  node.textContent = text || "";
  node.className = type ? `message ${type}` : "message";
}

function platformKey(value) {
  const key = String(value || "").trim().toLowerCase();
  return key === "facebook" || key === "google" ? key : "";
}

function platformLabel(value) {
  const key = platformKey(value);
  return PLATFORM_LABEL[key] || key;
}

function integrationState(platform) {
  const key = platformKey(platform);
  if (!state || !key || !state.integrations || typeof state.integrations !== "object") return null;
  return state.integrations[key] || null;
}

function connectedPlatforms() {
  if (!state || !state.integrations) return [];
  return ["facebook", "google"].filter((platform) => {
    const entry = state.integrations[platform];
    return entry && entry.connected;
  });
}

function customerNameById(customerId) {
  if (!state) return "Unknown";
  const found = state.customers.find((entry) => entry.id === customerId);
  return found ? found.name : "Unknown";
}

function customerById(customerId) {
  if (!state) return null;
  return state.customers.find((entry) => entry.id === customerId) || null;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return payload;
}

async function syncStateFromApi() {
  const payload = await request("/api/state");
  state = payload.state;
  renderAll();
}

function renderCustomerOptions() {
  const options = state.customers.map((customer) => `<option value="${customer.id}">${customer.name}</option>`).join("");
  buildCustomer.innerHTML = options;
  buildCustomer.value = state.selectedCustomerId;
}

function renderCustomerList() {
  customerList.innerHTML = "";

  state.customers.forEach((customer) => {
    const li = document.createElement("li");
    li.className = `customer-item${customer.id === state.selectedCustomerId ? " active" : ""}`;
    li.dataset.customerId = customer.id;

    const name = document.createElement("strong");
    name.textContent = customer.name;

    const meta = document.createElement("p");
    const geo = customer.location ? ` | ${customer.location}` : "";
    meta.textContent = `${customer.industry} | ${customer.tier}${geo}`;

    li.appendChild(name);
    li.appendChild(meta);
    customerList.appendChild(li);
  });
}

function setBuilderField(name, value, force = false) {
  const field = buildCampaignForm.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLTextAreaElement)) {
    return;
  }

  const next = String(value || "").trim();
  if (!next) return;
  if (!force && String(field.value || "").trim()) return;
  field.value = next;
}

function customerProfileInputs(customer) {
  if (!customer) return "";

  const payload = {};
  if (customer.industry) payload.industry = customer.industry;
  if (customer.tier) payload.tier = customer.tier;
  if (customer.location) payload.location = customer.location;
  if (customer.website) payload.website = customer.website;
  if (!Object.keys(payload).length) return "";
  return JSON.stringify(payload, null, 2);
}

function renderCustomerDefaultsHint() {
  if (!customerDefaultsHint) return;
  const customer = customerById(buildCustomer.value || state.selectedCustomerId);
  if (!customer) {
    customerDefaultsHint.textContent = "";
    return;
  }

  const available = [];
  if (customer.defaultOffer) available.push("offer");
  if (customer.defaultAudience) available.push("audience");
  if (customer.defaultLandingUrl || customer.website) available.push("landing URL");
  if (customer.customerNotes) available.push("notes");
  customerDefaultsHint.textContent = available.length
    ? `Defaults available: ${available.join(", ")}.`
    : "No saved defaults yet for this customer.";
}

function applyCustomerDefaults(force = false) {
  const customer = customerById(buildCustomer.value || state.selectedCustomerId);
  if (!customer) return;

  setBuilderField("offer", customer.defaultOffer, force);
  setBuilderField("audience", customer.defaultAudience, force);
  setBuilderField("landingUrl", customer.defaultLandingUrl || customer.website, force);
  setBuilderField("strategyNotes", customer.customerNotes, force);
  setBuilderField("customInputs", customerProfileInputs(customer), force);
}

function renderMetrics() {
  metricCustomers.textContent = String(state.customers.length);

  const live = state.campaigns.filter((campaign) => ["Launch", "Optimization", "Scale"].includes(campaign.stage)).length;
  metricLive.textContent = String(live);
}

function renderServiceStatus() {
  if (backToLandingBtn && serviceHealth && serviceHealth.landingUrl) {
    backToLandingBtn.href = String(serviceHealth.landingUrl);
  }

  if (!openAiStatus) return;
  if (!serviceHealth) {
    openAiStatus.textContent = "Checking OpenAI connection...";
    return;
  }

  if (serviceHealth.openAiConfigured) {
    openAiStatus.textContent = `OpenAI connected (${serviceHealth.model || "model unknown"}).`;
    return;
  }

  if (serviceHealth.openAiFallbackEnabled) {
    openAiStatus.textContent = "OpenAI key not set. Running in fallback generator mode.";
    return;
  }

  openAiStatus.textContent = "OpenAI key missing. Set OPENAI_API_KEY, then restart the server.";
}

function fillIntegrationForm(form, connection) {
  if (!form || !connection) return;
  const accountName = form.elements.namedItem("accountName");
  const accountId = form.elements.namedItem("accountId");
  const businessId = form.elements.namedItem("businessId");
  const tokenHint = form.elements.namedItem("tokenHint");

  if (accountName instanceof HTMLInputElement) accountName.value = connection.accountName || "";
  if (accountId instanceof HTMLInputElement) accountId.value = connection.accountId || "";
  if (businessId instanceof HTMLInputElement) businessId.value = connection.businessId || "";
  if (tokenHint instanceof HTMLInputElement) tokenHint.value = connection.tokenMask || "";
}

function renderIntegrations() {
  const facebook = integrationState("facebook");
  const google = integrationState("google");
  fillIntegrationForm(facebookConnectForm, facebook);
  fillIntegrationForm(googleConnectForm, google);

  if (facebookConnectStatus) {
    if (facebook && facebook.connected) {
      const label = facebook.accountName ? facebook.accountName : "connected account";
      facebookConnectStatus.textContent = `Connected: ${label}${facebook.connectedAt ? ` | ${formatTime(facebook.connectedAt)}` : ""}`;
    } else {
      facebookConnectStatus.textContent = "Not connected.";
    }
  }

  if (googleConnectStatus) {
    if (google && google.connected) {
      const label = google.accountName ? google.accountName : "connected account";
      googleConnectStatus.textContent = `Connected: ${label}${google.connectedAt ? ` | ${formatTime(google.connectedAt)}` : ""}`;
    } else {
      googleConnectStatus.textContent = "Not connected.";
    }
  }
}

function formatTime(stamp) {
  try {
    return new Date(stamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "Unknown time";
  }
}

function optionPlatforms(option) {
  const platforms = [];
  if (option && option.facebook) platforms.push("facebook");
  if (option && option.google) platforms.push("google");
  return platforms;
}

function adPageCount(optionCount) {
  if (optionCount <= 0) return 0;
  return Math.ceil(optionCount / ADS_PER_VIEW);
}

function selectedGlobalAdPage(optionCount) {
  const pageCount = adPageCount(optionCount);
  if (!pageCount) return 0;
  const raw = Number(globalAdCursor || 0);
  const safe = Number.isInteger(raw) ? raw : 0;
  const next = ((safe % pageCount) + pageCount) % pageCount;
  globalAdCursor = next;
  return next;
}

function shiftGlobalAdPage(optionCount, direction) {
  const pageCount = adPageCount(optionCount);
  if (!pageCount) return;
  const delta = direction === "next" ? 1 : -1;
  const current = selectedGlobalAdPage(optionCount);
  globalAdCursor = (current + delta + pageCount) % pageCount;
}

function adEntriesForRun(options) {
  const list = [];
  (Array.isArray(options) ? options : []).forEach((option, index) => {
    const optionId = String(option && option.id ? option.id : `option-${index}`);
    if (option && option.facebook) {
      list.push({
        key: `${optionId}:facebook`,
        option,
        optionId,
        platform: "Facebook",
        pack: option.facebook
      });
    }
    if (option && option.google) {
      list.push({
        key: `${optionId}:google`,
        option,
        optionId,
        platform: "Google",
        pack: option.google
      });
    }
  });
  return list;
}

function adEntriesForRuns(runs) {
  const entries = [];
  (Array.isArray(runs) ? runs : []).forEach((run, runIndex) => {
    const runId = String(run && run.id ? run.id : `run-${runIndex}`);
    const options = Array.isArray(run && run.options) ? run.options : [];
    adEntriesForRun(options).forEach((entry) => {
      entries.push({
        ...entry,
        run,
        runId,
        entryKey: `${runId}:${entry.key}`
      });
    });
  });
  return entries;
}

function createQueueButtons(runId, option) {
  const wrap = document.createElement("div");
  wrap.className = "publish-actions";
  const optionId = String(option && option.id ? option.id : "");

  const available = optionPlatforms(option);
  const connected = connectedPlatforms();
  const connectedAvailable = available.filter((platform) => connected.includes(platform));

  const publishButton = document.createElement("button");
  publishButton.type = "button";
  publishButton.className = "btn btn-secondary btn-small";
  publishButton.textContent = "Publish";
  publishButton.dataset.publishAction = "queue-option";
  publishButton.dataset.runId = runId;
  publishButton.dataset.optionId = optionId;
  publishButton.disabled = !connectedAvailable.length || !optionId || !available.length;
  if (connectedAvailable.length) {
    publishButton.title = `Will create a publish job for: ${connectedAvailable.map(platformLabel).join(", ")}`;
  } else {
    publishButton.title = "Connect Facebook or Google first.";
  }
  wrap.appendChild(publishButton);

  return wrap;
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();
  if (status === "sent") return "ok";
  if (status === "failed") return "warn";
  if (status === "archived") return "";
  return "";
}

function renderPublishQueue() {
  if (!publishQueue) return;
  publishQueue.innerHTML = "";
  const jobs = Array.isArray(state.publishJobs)
    ? state.publishJobs.filter((entry) => entry.customerId === state.selectedCustomerId)
    : [];

  if (!jobs.length) {
    const empty = document.createElement("p");
    empty.className = "empty-col";
    empty.textContent = "No publish jobs yet. Queue jobs from generated ad options.";
    publishQueue.appendChild(empty);
    return;
  }

  jobs.slice(0, 50).forEach((job) => {
    const card = document.createElement("article");
    card.className = "queue-job";

    const top = document.createElement("div");
    top.className = "queue-top";

    const title = document.createElement("strong");
    title.textContent = `${platformLabel(job.platform)} | ${job.optionLabel || "Option"}`;

    const badge = document.createElement("span");
    badge.className = `badge ${statusClass(job.status)}`.trim();
    badge.textContent = job.status || "Ready";

    top.appendChild(title);
    top.appendChild(badge);

    const meta = document.createElement("p");
    meta.className = "queue-meta";
    const account = job.integrationAccountName ? ` | ${job.integrationAccountName}` : "";
    meta.textContent = `${formatTime(job.createdAt)} | ${job.campaignName || "Campaign"}${account}`;

    const summary = document.createElement("p");
    summary.className = "queue-meta";
    summary.textContent = job.lastError ? `Last Error: ${job.lastError}` : "Prepared payload and waiting for API connector.";

    const actions = document.createElement("div");
    actions.className = "publish-actions";

    if (String(job.status || "").toLowerCase() !== "sent") {
      const sentBtn = document.createElement("button");
      sentBtn.type = "button";
      sentBtn.className = "btn btn-secondary btn-small";
      sentBtn.textContent = "Mark Sent";
      sentBtn.dataset.publishAction = "job-action";
      sentBtn.dataset.jobId = job.id;
      sentBtn.dataset.jobAction = "mark_sent";
      actions.appendChild(sentBtn);
    }

    if (String(job.status || "").toLowerCase() !== "failed") {
      const failBtn = document.createElement("button");
      failBtn.type = "button";
      failBtn.className = "btn btn-secondary btn-small";
      failBtn.textContent = "Mark Failed";
      failBtn.dataset.publishAction = "job-action";
      failBtn.dataset.jobId = job.id;
      failBtn.dataset.jobAction = "mark_failed";
      actions.appendChild(failBtn);
    } else {
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "btn btn-secondary btn-small";
      retryBtn.textContent = "Retry";
      retryBtn.dataset.publishAction = "job-action";
      retryBtn.dataset.jobId = job.id;
      retryBtn.dataset.jobAction = "retry";
      actions.appendChild(retryBtn);
    }

    const archiveBtn = document.createElement("button");
    archiveBtn.type = "button";
    archiveBtn.className = "btn btn-secondary btn-small";
    archiveBtn.textContent = "Archive";
    archiveBtn.dataset.publishAction = "job-action";
    archiveBtn.dataset.jobId = job.id;
    archiveBtn.dataset.jobAction = "archive";
    actions.appendChild(archiveBtn);

    card.appendChild(top);
    card.appendChild(meta);
    card.appendChild(summary);
    card.appendChild(actions);
    publishQueue.appendChild(card);
  });
}

function createCopyRow(label, value, options = {}) {
  const row = document.createElement("div");
  row.className = "copy-row";

  const labelRow = document.createElement("div");
  labelRow.className = "copy-label-row";

  const name = document.createElement("span");
  name.className = "copy-label";
  name.textContent = label;
  labelRow.appendChild(name);

  if (options.help) {
    const help = document.createElement("details");
    help.className = "copy-help";

    const trigger = document.createElement("summary");
    trigger.textContent = "i";
    trigger.ariaLabel = `${label} help`;

    const popover = document.createElement("div");
    popover.className = "copy-help-popover";
    popover.textContent = String(options.help);

    help.appendChild(trigger);
    help.appendChild(popover);

    const closeHelp = () => {
      help.open = false;
    };

    row.addEventListener("mouseleave", closeHelp);
    row.addEventListener("focusout", () => {
      requestAnimationFrame(() => {
        if (!row.contains(document.activeElement)) closeHelp();
      });
    });

    labelRow.appendChild(help);
  }

  const type = String(options.type || "text").toLowerCase();
  let text;

  if (type === "textarea") {
    text = document.createElement("textarea");
    text.rows = Number(options.rows || 3);
    text.className = "pack-field pack-field-textarea";
  } else if (type === "select") {
    text = document.createElement("select");
    text.className = "pack-field";
    const choices = Array.isArray(options.choices) ? options.choices : [];
    choices.forEach((entry) => {
      const option = document.createElement("option");
      option.value = String(entry.value || "");
      option.textContent = String(entry.label || entry.value || "");
      text.appendChild(option);
    });
  } else {
    text = document.createElement("input");
    text.type = ["number", "url", "date", "datetime-local"].includes(type) ? type : "text";
    text.className = "pack-field";
    if (options.min !== undefined) text.min = String(options.min);
    if (options.max !== undefined) text.max = String(options.max);
    if (options.step !== undefined) text.step = String(options.step);
  }

  text.value = String(value || "");
  if (options.placeholder) {
    text.placeholder = String(options.placeholder);
  }

  if (type === "select" && text instanceof HTMLSelectElement && text.value !== String(value || "")) {
    const fallback = String(value || "");
    if (fallback) {
      const extra = document.createElement("option");
      extra.value = fallback;
      extra.textContent = fallback;
      text.appendChild(extra);
      text.value = fallback;
    }
  }

  if (options.field) {
    text.dataset.packField = String(options.field);
  }

  row.appendChild(labelRow);
  row.appendChild(text);
  return row;
}

function fieldValueForDisplay(pack, definition) {
  if (!pack || typeof pack !== "object") return "";
  const raw = pack[definition.field];
  if (definition.multiline) {
    if (Array.isArray(raw)) return raw.join("\n");
    return String(raw || "");
  }
  return raw === undefined || raw === null ? "" : String(raw);
}

const FACEBOOK_FIELD_DEFS = [
  { label: "Campaign Name", field: "campaignName" },
  {
    label: "Campaign Status",
    field: "campaignStatus",
    type: "select",
    choices: [{ value: "ACTIVE" }, { value: "PAUSED" }]
  },
  {
    label: "Buying Type",
    field: "buyingType",
    type: "select",
    choices: [{ value: "AUCTION" }, { value: "RESERVED" }]
  },
  {
    label: "Objective",
    field: "objective",
    type: "select",
    choices: [
      { value: "OUTCOME_LEADS" },
      { value: "OUTCOME_SALES" },
      { value: "OUTCOME_TRAFFIC" },
      { value: "OUTCOME_ENGAGEMENT" },
      { value: "OUTCOME_AWARENESS" }
    ]
  },
  { label: "Special Ad Categories (one per line)", field: "specialAdCategories", type: "textarea", rows: 2, multiline: true },
  {
    label: "Campaign Budget Optimization",
    field: "campaignBudgetOptimization",
    type: "select",
    choices: [{ value: "on", label: "On" }, { value: "off", label: "Off" }]
  },
  { label: "Daily Budget (USD)", field: "dailyBudget", type: "number", min: 0, step: 1 },
  { label: "Lifetime Budget (USD)", field: "lifetimeBudget", type: "number", min: 0, step: 1 },
  {
    label: "Bid Strategy",
    field: "bidStrategy",
    type: "select",
    choices: [{ value: "LOWEST_COST" }, { value: "COST_CAP" }, { value: "BID_CAP" }, { value: "LOWEST_COST_WITH_MIN_ROAS" }]
  },
  { label: "Bid Amount", field: "bidAmount", type: "number", min: 0, step: 0.01 },
  { label: "Target Cost", field: "targetCost", type: "number", min: 0, step: 0.01 },
  { label: "Target ROAS", field: "targetRoas", type: "number", min: 0, step: 0.01 },
  { label: "Start Time", field: "scheduleStart", type: "datetime-local" },
  { label: "End Time", field: "scheduleEnd", type: "datetime-local" },
  { label: "Audience", field: "adSetAudience", type: "textarea", rows: 2 },
  { label: "Custom Audience IDs (one per line)", field: "customAudienceIds", type: "textarea", rows: 2, multiline: true },
  { label: "Lookalike Audience IDs (one per line)", field: "lookalikeAudienceIds", type: "textarea", rows: 2, multiline: true },
  { label: "Geo Includes (one per line)", field: "geoInclude", type: "textarea", rows: 2, multiline: true },
  { label: "Geo Excludes (one per line)", field: "geoExclude", type: "textarea", rows: 2, multiline: true },
  { label: "Age Min", field: "ageMin", type: "number", min: 13, max: 65, step: 1 },
  { label: "Age Max", field: "ageMax", type: "number", min: 13, max: 65, step: 1 },
  {
    label: "Genders",
    field: "genders",
    type: "select",
    choices: [{ value: "all", label: "All" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }]
  },
  { label: "Languages (one per line)", field: "languages", type: "textarea", rows: 2, multiline: true },
  { label: "Placements", field: "placements", type: "textarea", rows: 2 },
  { label: "Publisher Platforms (one per line)", field: "publisherPlatforms", type: "textarea", rows: 2, multiline: true },
  { label: "Device Platforms (one per line)", field: "devicePlatforms", type: "textarea", rows: 2, multiline: true },
  { label: "Optimization Goal", field: "optimizationGoal" },
  { label: "Billing Event", field: "billingEvent" },
  {
    label: "Attribution Window",
    field: "attributionWindow",
    type: "select",
    choices: [{ value: "7d_click_1d_view" }, { value: "7d_click" }, { value: "1d_click" }, { value: "1d_view" }]
  },
  { label: "Pixel ID", field: "pixelId" },
  { label: "Conversion Event", field: "conversionEvent" },
  { label: "Page ID", field: "pageId" },
  { label: "Instagram Actor ID", field: "instagramActorId" },
  { label: "Primary Text", field: "primaryText", type: "textarea", rows: 4 },
  { label: "Headline", field: "headline" },
  { label: "Description", field: "description", type: "textarea", rows: 3 },
  {
    label: "CTA",
    field: "cta",
    type: "select",
    choices: [
      { value: "Learn More" },
      { value: "Shop Now" },
      { value: "Sign Up" },
      { value: "Book Now" },
      { value: "Get Quote" }
    ]
  },
  { label: "Destination URL", field: "destinationUrl", type: "url" },
  { label: "URL Parameters", field: "urlParameters", type: "textarea", rows: 2 },
  {
    label: "Creative Type",
    field: "creativeType",
    type: "select",
    choices: [{ value: "image", label: "Image" }, { value: "video", label: "Video" }]
  },
  { label: "Creative URL", field: "mediaUrl", type: "url" },
  { label: "Thumbnail URL", field: "thumbnailUrl", type: "url" }
];

const GOOGLE_FIELD_DEFS = [
  { label: "Campaign Name", field: "campaignName" },
  {
    label: "Campaign Status",
    field: "campaignStatus",
    type: "select",
    choices: [{ value: "ENABLED" }, { value: "PAUSED" }]
  },
  {
    label: "Campaign Type",
    field: "campaignType",
    type: "select",
    choices: [{ value: "SEARCH" }, { value: "PERFORMANCE_MAX" }, { value: "DISPLAY" }, { value: "VIDEO" }]
  },
  { label: "Channel Sub Type", field: "channelSubType" },
  {
    label: "Bidding Strategy",
    field: "biddingStrategyType",
    type: "select",
    choices: [
      { value: "MAXIMIZE_CONVERSIONS" },
      { value: "TARGET_CPA" },
      { value: "MAXIMIZE_CONVERSION_VALUE" },
      { value: "TARGET_ROAS" },
      { value: "MANUAL_CPC" }
    ]
  },
  { label: "Target CPA", field: "targetCpa", type: "number", min: 0, step: 0.01 },
  { label: "Target ROAS", field: "targetRoas", type: "number", min: 0, step: 0.01 },
  { label: "Daily Budget (USD)", field: "dailyBudget", type: "number", min: 0, step: 1 },
  { label: "Start Date", field: "startDate", type: "date" },
  { label: "End Date", field: "endDate", type: "date" },
  { label: "Networks (one per line)", field: "networkSettings", type: "textarea", rows: 2, multiline: true },
  { label: "Locations Include (one per line)", field: "locationsInclude", type: "textarea", rows: 2, multiline: true },
  { label: "Locations Exclude (one per line)", field: "locationsExclude", type: "textarea", rows: 2, multiline: true },
  { label: "Languages (one per line)", field: "languages", type: "textarea", rows: 2, multiline: true },
  { label: "Audience Signal", field: "audienceSignal", type: "textarea", rows: 2 },
  { label: "Customer Match List IDs (one per line)", field: "customerMatchListIds", type: "textarea", rows: 2, multiline: true },
  { label: "Ad Schedule Rules (one per line)", field: "adSchedule", type: "textarea", rows: 2, multiline: true },
  { label: "Ad Group Name", field: "adGroupName" },
  {
    label: "Ad Group Status",
    field: "adGroupStatus",
    type: "select",
    choices: [{ value: "ENABLED" }, { value: "PAUSED" }]
  },
  { label: "Keywords (one per line)", field: "keywords", type: "textarea", rows: 4, multiline: true },
  { label: "Negative Keywords (one per line)", field: "negativeKeywords", type: "textarea", rows: 3, multiline: true },
  { label: "Headlines (one per line)", field: "headlines", type: "textarea", rows: 4, multiline: true },
  { label: "Descriptions (one per line)", field: "descriptions", type: "textarea", rows: 4, multiline: true },
  { label: "Final URL", field: "finalUrl", type: "url" },
  { label: "Path 1", field: "path1" },
  { label: "Path 2", field: "path2" },
  { label: "Final URL Suffix", field: "finalUrlSuffix" },
  { label: "Tracking Template", field: "trackingTemplate" },
  { label: "Conversion Action IDs (one per line)", field: "conversionActionIds", type: "textarea", rows: 2, multiline: true },
  { label: "Device Bid Modifiers (one per line)", field: "deviceBidModifiers", type: "textarea", rows: 2, multiline: true },
  { label: "Sitelinks (one per line)", field: "assetsSitelinks", type: "textarea", rows: 3, multiline: true },
  { label: "Callouts (one per line)", field: "assetsCallouts", type: "textarea", rows: 3, multiline: true },
  { label: "Structured Snippets (one per line)", field: "assetsStructuredSnippets", type: "textarea", rows: 3, multiline: true },
  { label: "Business Name", field: "businessName" },
  { label: "Logo URL", field: "logoUrl", type: "url" },
  { label: "Image URLs (one per line)", field: "imageUrls", type: "textarea", rows: 3, multiline: true },
  { label: "Video URLs (one per line)", field: "videoUrls", type: "textarea", rows: 3, multiline: true }
];

const FIELD_HELP = {
  facebook: {
    buyingType: "Controls auction model. AUCTION is standard and most common. RESERVED is negotiated inventory. Example: Use AUCTION for normal lead-gen campaigns.",
    specialAdCategories: "Required for regulated categories (credit, employment, housing, social issues). Leave empty if not applicable. Example: Set HOUSING for real-estate ads.",
    campaignBudgetOptimization: "Lets Meta auto-distribute budget across ad sets for best performance. Example: Set On when testing multiple audiences in one campaign.",
    bidStrategy: "Defines how Meta bids in auctions. Use LOWEST_COST by default unless you have strong cost targets. Example: Choose COST_CAP when you need tighter CPL control.",
    bidAmount: "Explicit bid cap value used with BID_CAP strategies. Example: 8.50 means max bid of $8.50 per auction.",
    targetCost: "Average cost goal used with cost control strategies. Example: Set 35 to target around $35 per lead.",
    targetRoas: "Desired return on ad spend target when optimizing for value. Example: 2.5 means target $2.50 back per $1 spent.",
    customAudienceIds: "Existing retargeting or uploaded audience IDs from Meta. Example: 23850000123456789.",
    lookalikeAudienceIds: "Lookalike audience IDs created from source lists or events. Example: 23850000999999999 for a purchaser lookalike.",
    publisherPlatforms: "Where to run ads: facebook, instagram, audience_network, messenger. Example lines: facebook and instagram.",
    devicePlatforms: "Limit delivery by device class, typically mobile or desktop. Example lines: mobile and desktop.",
    optimizationGoal: "Event Meta optimizes for (for example LEAD, PURCHASE, LINK_CLICKS). Example: LEAD for lead form campaigns.",
    billingEvent: "How spend is billed (such as impressions). Usually platform-selected. Example: IMPRESSIONS.",
    attributionWindow: "How long after a click/view Meta credits a conversion to this ad. Example: 7d_click_1d_view.",
    pixelId: "Meta Pixel ID tied to your conversion tracking. Example: 123456789012345.",
    conversionEvent: "Conversion event to optimize for, such as Lead or Purchase. Example: Lead.",
    instagramActorId: "Instagram account ID used as ad identity for placements on Instagram. Example: 17841400000000000.",
    urlParameters: "Tracking params appended to destination URL (for example UTM tags). Example: utm_source=facebook&utm_campaign=smile_q2.",
    thumbnailUrl: "Manual thumbnail image URL when creative is video. Example: https://cdn.client.com/thumbs/ad1.jpg."
  },
  google: {
    channelSubType: "Optional campaign subtype under the main campaign type. Example: APP_CAMPAIGN for app installs.",
    biddingStrategyType: "How Google bids in auctions. Strategy choice changes optimization behavior. Example: TARGET_CPA for stable lead-gen.",
    targetCpa: "Desired cost per acquisition used by TARGET_CPA bidding. Example: 60 means target $60 per conversion.",
    targetRoas: "Desired return on ad spend used by TARGET_ROAS bidding. Example: 3.0 means 300 percent ROAS target.",
    networkSettings: "Networks to include, such as Google Search Partners or Display. Example lines: GOOGLE_SEARCH and SEARCH_PARTNERS.",
    audienceSignal: "Audience hints Google can use to accelerate learning. Example: In-market users searching cosmetic dentistry.",
    customerMatchListIds: "Uploaded first-party audience list IDs from Google Ads. Example: 1122334455.",
    adSchedule: "Day/time delivery rules. One rule per line. Example: MON-FRI 08:00-18:00.",
    finalUrlSuffix: "Tracking suffix appended to the final URL. Example: utm_source=google&utm_campaign=q2_offer.",
    trackingTemplate: "Click tracking template for third-party tracking systems. Example: {lpurl}?device={device}&matchtype={matchtype}.",
    conversionActionIds: "Specific conversion actions used for reporting/optimization. Example: 9988776655.",
    deviceBidModifiers: "Optional device-level bid adjustments by percent. Example: MOBILE:+20 and DESKTOP:-10.",
    assetsSitelinks: "Sitelink extension text or identifiers, one per line. Example: Book Online | Pricing | Testimonials.",
    assetsCallouts: "Callout extension text, one per line. Example: No Insurance Needed and Same-Day Appointments.",
    assetsStructuredSnippets: "Structured snippet values, one per line. Example: Services: Whitening, Veneers, Implants."
  }
};

const MISSION_CRITICAL_FIELDS = {
  facebook: new Set([
    "campaignName",
    "objective",
    "dailyBudget",
    "bidStrategy",
    "adSetAudience",
    "primaryText",
    "headline",
    "description",
    "cta",
    "destinationUrl",
    "creativeType",
    "mediaUrl"
  ]),
  google: new Set([
    "campaignName",
    "campaignType",
    "biddingStrategyType",
    "targetCpa",
    "dailyBudget",
    "adGroupName",
    "keywords",
    "headlines",
    "descriptions",
    "finalUrl"
  ])
};

function fieldHelpText(platform, field) {
  const platformKey = String(platform || "").toLowerCase();
  if (!platformKey || !field) return "";
  const entries = FIELD_HELP[platformKey] || {};
  return String(entries[field] || "");
}

function isMissionCriticalField(platform, field) {
  const platformKey = String(platform || "").toLowerCase();
  const fields = MISSION_CRITICAL_FIELDS[platformKey];
  return !!(fields && fields.has(String(field || "")));
}

function fieldDefinitions(platform) {
  return platform === "Facebook" ? FACEBOOK_FIELD_DEFS : GOOGLE_FIELD_DEFS;
}

function createFieldGrid(platform, pack, definitions) {
  const grid = document.createElement("div");
  grid.className = "copy-grid";
  definitions.forEach((definition) => {
    grid.appendChild(
      createCopyRow(definition.label, fieldValueForDisplay(pack, definition), {
        ...definition,
        help: fieldHelpText(platform, definition.field)
      })
    );
  });
  return grid;
}

function domainFromUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "yourdomain.com";
  }
}

function readFieldValue(grid, field) {
  const node = grid.querySelector(`[data-pack-field="${field}"]`);
  if (
    node instanceof HTMLInputElement ||
    node instanceof HTMLTextAreaElement ||
    node instanceof HTMLSelectElement
  ) {
    return String(node.value || "").trim();
  }
  return "";
}

function splitLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hydratePackFromGrid(pack, grid, definitions) {
  definitions.forEach((definition) => {
    const raw = readFieldValue(grid, definition.field);
    if (definition.multiline) {
      pack[definition.field] = splitLines(raw);
      return;
    }
    if (definition.type === "number") {
      if (!raw) {
        pack[definition.field] = "";
        return;
      }
      const numeric = Number(raw);
      pack[definition.field] = Number.isFinite(numeric) ? numeric : raw;
      return;
    }
    pack[definition.field] = raw;
  });
  return pack;
}

function buildPackFromInputs(platform, sourcePack, grid) {
  const pack = hydratePackFromGrid({ ...(sourcePack || {}) }, grid, fieldDefinitions(platform));
  if (platform === "Facebook") {
    const creativeType = String(pack.creativeType || "").toLowerCase();
    pack.creativeType = creativeType === "video" ? "video" : "image";
  }
  return pack;
}

function createFacebookPreview(pack) {
  const preview = document.createElement("section");
  preview.className = "ad-preview facebook-preview";

  const label = document.createElement("p");
  label.className = "preview-label";
  label.textContent = "Facebook Feed Preview";

  const card = document.createElement("article");
  card.className = "preview-card facebook-feed-card";

  const top = document.createElement("header");
  top.className = "facebook-top";

  const avatar = document.createElement("div");
  avatar.className = "facebook-avatar";
  avatar.textContent = (pack.campaignName || "B").slice(0, 1).toUpperCase();

  const metaWrap = document.createElement("div");
  metaWrap.className = "facebook-meta";
  const pageName = document.createElement("strong");
  pageName.textContent = pack.campaignName || "Brand Page";
  const sponsored = document.createElement("span");
  sponsored.textContent = "Sponsored";
  metaWrap.appendChild(pageName);
  metaWrap.appendChild(sponsored);
  top.appendChild(avatar);
  top.appendChild(metaWrap);

  const body = document.createElement("p");
  body.className = "preview-body";
  body.textContent = pack.primaryText || "Primary text goes here.";

  const media = document.createElement("div");
  media.className = "preview-media facebook-media";
  const mediaUrl = String(pack.mediaUrl || "").trim();
  const creativeType = String(pack.creativeType || "image").toLowerCase();
  if (mediaUrl) {
    if (creativeType === "video") {
      const video = document.createElement("video");
      video.src = mediaUrl;
      video.controls = true;
      video.preload = "metadata";
      media.appendChild(video);
    } else {
      const image = document.createElement("img");
      image.src = mediaUrl;
      image.alt = "Facebook ad creative preview";
      image.loading = "lazy";
      media.appendChild(image);
    }
  } else {
    media.textContent = creativeType === "video" ? "Video placeholder" : "Image placeholder";
  }

  const bottom = document.createElement("div");
  bottom.className = "preview-bottom facebook-link-row";

  const domain = document.createElement("p");
  domain.className = "facebook-domain";
  domain.textContent = domainFromUrl(pack.destinationUrl || "");

  const head = document.createElement("strong");
  head.textContent = pack.headline || "Headline";

  const desc = document.createElement("p");
  desc.textContent = pack.description || "Description";

  const cta = document.createElement("span");
  cta.className = "preview-cta";
  cta.textContent = pack.cta || "Learn More";

  bottom.appendChild(domain);
  bottom.appendChild(head);
  bottom.appendChild(desc);
  bottom.appendChild(cta);

  card.appendChild(top);
  card.appendChild(body);
  card.appendChild(media);
  card.appendChild(bottom);

  preview.appendChild(label);
  preview.appendChild(card);
  return preview;
}

function createGooglePreview(pack) {
  const preview = document.createElement("section");
  preview.className = "ad-preview google-preview";

  const label = document.createElement("p");
  label.className = "preview-label";
  label.textContent = "Google Search Preview";

  const card = document.createElement("article");
  card.className = "preview-card google-search-card";

  const url = document.createElement("div");
  url.className = "google-url-row";
  const dot = document.createElement("span");
  dot.className = "google-url-dot";
  dot.textContent = "Ad";
  const urlText = document.createElement("p");
  urlText.className = "google-url";
  const domain = domainFromUrl(pack.finalUrl);
  urlText.textContent = `${domain}/${pack.path1 || ""}/${pack.path2 || ""}`.replace(/\/+$/, "");
  url.appendChild(dot);
  url.appendChild(urlText);

  const headlineList = (pack.headlines || []).slice(0, 3).filter(Boolean);
  const headline = document.createElement("p");
  headline.className = "google-headline";
  headline.textContent = headlineList.length ? headlineList.join(" | ") : "Headline 1 | Headline 2 | Headline 3";

  const desc = document.createElement("p");
  desc.className = "google-desc";
  const descriptionList = (pack.descriptions || []).slice(0, 2).filter(Boolean);
  desc.textContent = descriptionList.length ? descriptionList.join(" ") : "Ad description copy appears here.";

  card.appendChild(url);
  card.appendChild(headline);
  card.appendChild(desc);

  preview.appendChild(label);
  preview.appendChild(card);
  return preview;
}

function createPlatformBlock(platform, pack) {
  const block = document.createElement("div");
  block.className = "platform-block";

  const head = document.createElement("div");
  head.className = "platform-head";

  const title = document.createElement("h5");
  title.textContent = platform;

  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "btn btn-secondary btn-small";
  refreshBtn.textContent = "Refresh Preview";
  refreshBtn.dataset.previewRefresh = "platform";

  head.appendChild(title);
  head.appendChild(refreshBtn);

  const previewSlot = document.createElement("div");
  previewSlot.className = "platform-preview";

  const definitions = fieldDefinitions(platform);
  const missionCritical = definitions.filter((definition) => isMissionCriticalField(platform, definition.field));
  const advanced = definitions.filter((definition) => !isMissionCriticalField(platform, definition.field));

  const fieldsWrap = document.createElement("div");
  fieldsWrap.className = "field-sections";

  const missionSection = document.createElement("section");
  missionSection.className = "field-section";
  const missionTitle = document.createElement("p");
  missionTitle.className = "field-section-title";
  missionTitle.textContent = "Mission-Critical Fields";
  missionSection.appendChild(missionTitle);
  missionSection.appendChild(createFieldGrid(platform, pack, missionCritical.length ? missionCritical : definitions));
  fieldsWrap.appendChild(missionSection);

  if (advanced.length) {
    const advancedSection = document.createElement("details");
    advancedSection.className = "advanced-fields";

    const advancedSummary = document.createElement("summary");
    advancedSummary.textContent = `Advanced Filter (${advanced.length} fields)`;

    const advancedNote = document.createElement("p");
    advancedNote.className = "advanced-fields-note";
    advancedNote.textContent = "Use these controls for deeper platform tuning after mission-critical setup.";

    advancedSection.appendChild(advancedSummary);
    advancedSection.appendChild(advancedNote);
    advancedSection.appendChild(createFieldGrid(platform, pack, advanced));
    fieldsWrap.appendChild(advancedSection);
  }

  const refreshPreview = () => {
    const updated = buildPackFromInputs(platform, pack, fieldsWrap);
    Object.assign(pack, updated);
    previewSlot.innerHTML = "";
    previewSlot.appendChild(platform === "Facebook" ? createFacebookPreview(pack) : createGooglePreview(pack));
  };
  refreshBtn.addEventListener("click", refreshPreview);
  refreshPreview();

  block.appendChild(head);
  block.appendChild(previewSlot);
  block.appendChild(fieldsWrap);
  return block;
}

function renderAdInputRuns() {
  adInputRuns.innerHTML = "";

  const runs = Array.isArray(state.adInputRuns)
    ? state.adInputRuns.filter((entry) => entry.customerId === state.selectedCustomerId)
    : [];

  if (!runs.length) {
    const empty = document.createElement("p");
    empty.className = "empty-col";
    empty.textContent = "No generated ad input packs for this customer yet.";
    adInputRuns.appendChild(empty);
    return;
  }

  const adEntries = adEntriesForRuns(runs);
  if (!adEntries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-col";
    empty.textContent = "No generated options for this customer yet.";
    adInputRuns.appendChild(empty);
    return;
  }

  const selectedPage = selectedGlobalAdPage(adEntries.length);
  const startIndex = selectedPage * ADS_PER_VIEW;
  const visibleEntries = adEntries.slice(startIndex, startIndex + ADS_PER_VIEW);
  const endIndex = Math.min(startIndex + visibleEntries.length, adEntries.length);
  const pageCount = adPageCount(adEntries.length);

  const runCard = document.createElement("article");
  runCard.className = "ad-run";

  const head = document.createElement("div");
  head.className = "ad-run-head";

  const headText = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = "Generated Campaign Ads";
  const meta = document.createElement("p");
  meta.textContent = "Mission-critical fields shown first. Open Advanced Filter for full platform controls.";

  headText.appendChild(title);
  headText.appendChild(meta);
  head.appendChild(headText);

  const optionNav = document.createElement("div");
  optionNav.className = "option-nav";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn btn-secondary btn-small option-nav-btn";
  prevBtn.textContent = "←";
  prevBtn.title = "Previous ad";
  prevBtn.ariaLabel = "Previous ad";
  prevBtn.dataset.optionNav = "prev";
  prevBtn.dataset.optionCount = String(adEntries.length);
  prevBtn.disabled = pageCount <= 1;

  const navLabel = document.createElement("span");
  navLabel.className = "option-nav-label";
  navLabel.textContent = `Ads ${startIndex + 1}-${endIndex} of ${adEntries.length}`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn btn-secondary btn-small option-nav-btn";
  nextBtn.textContent = "→";
  nextBtn.title = "Next ad";
  nextBtn.ariaLabel = "Next ad";
  nextBtn.dataset.optionNav = "next";
  nextBtn.dataset.optionCount = String(adEntries.length);
  nextBtn.disabled = pageCount <= 1;

  optionNav.appendChild(prevBtn);
  optionNav.appendChild(navLabel);
  optionNav.appendChild(nextBtn);
  head.appendChild(optionNav);

  const optionsWrap = document.createElement("div");
  optionsWrap.className = "ad-options";

  visibleEntries.forEach((entry) => {
    const run = entry.run || {};
    const option = entry.option || {};
    const optionCard = document.createElement("section");
    optionCard.className = "ad-option";

    const optionTitle = document.createElement("h4");
    optionTitle.textContent = `${option.label || "Ad Option"} | ${entry.platform}`;

    const rationale = document.createElement("p");
    rationale.textContent = option.rationale || "Generated from customer artifact.";

    const context = document.createElement("p");
    context.className = "ad-option-context";
    context.textContent = `${run.artifactName || "Artifact"} | ${customerNameById(run.customerId)} | ${(run.channels || []).join(", ") || "Channel N/A"}`;

    optionCard.appendChild(optionTitle);
    optionCard.appendChild(rationale);
    optionCard.appendChild(context);
    optionCard.appendChild(createQueueButtons(run.id, option));
    optionCard.appendChild(createPlatformBlock(entry.platform, entry.pack));
    optionsWrap.appendChild(optionCard);
  });

  runCard.appendChild(head);
  runCard.appendChild(optionsWrap);
  adInputRuns.appendChild(runCard);
}

function renderAll() {
  renderServiceStatus();
  renderCustomerOptions();
  renderCustomerList();
  renderIntegrations();
  renderCustomerDefaultsHint();
  applyCustomerDefaults(false);
  renderMetrics();
  renderAdInputRuns();
  renderPublishQueue();
}

async function saveIntegration(platform, formNode) {
  const formData = new FormData(formNode);
  const payload = await request(`/api/integrations/${encodeURIComponent(platform)}/connect`, {
    method: "POST",
    body: {
      accountName: String(formData.get("accountName") || "").trim(),
      accountId: String(formData.get("accountId") || "").trim(),
      businessId: String(formData.get("businessId") || "").trim(),
      tokenHint: String(formData.get("tokenHint") || "").trim()
    }
  });
  state = payload.state;
  renderAll();
  setMessage(integrationMessage, "success", payload.message || `${platformLabel(platform)} connected.`);
}

async function disconnectIntegration(platform) {
  const payload = await request(`/api/integrations/${encodeURIComponent(platform)}/disconnect`, {
    method: "POST"
  });
  state = payload.state;
  renderAll();
  setMessage(integrationMessage, "success", payload.message || `${platformLabel(platform)} disconnected.`);
}

async function queuePublish(runId, optionId, platforms = []) {
  const payload = await request("/api/publish/jobs", {
    method: "POST",
    body: {
      customerId: state.selectedCustomerId,
      runId,
      optionId,
      platforms
    }
  });
  state = payload.state;
  renderAll();
  setMessage(publishMessage, "success", payload.message || "Publish jobs queued.");
}

async function runJobAction(jobId, action) {
  const payload = await request(`/api/publish/jobs/${encodeURIComponent(jobId)}/action`, {
    method: "POST",
    body: { action }
  });
  state = payload.state;
  renderAll();
  setMessage(publishMessage, "success", payload.message || "Publish job updated.");
}

customerList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const row = target.closest(".customer-item");
  if (!row) return;

  const customerId = row.dataset.customerId;
  if (!customerId) return;

  try {
    const payload = await request("/api/selection", { method: "PATCH", body: { customerId } });
    state = payload.state;
    renderAll();
  } catch (error) {
    setMessage(customerMessage, "error", error.message);
  }
});

customerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = new FormData(customerForm);
  const name = String(form.get("companyName") || "").trim();
  const industry = String(form.get("industry") || "").trim();
  const tier = String(form.get("tier") || "Core").trim();
  const website = String(form.get("website") || "").trim();
  const location = String(form.get("location") || "").trim();
  const defaultOffer = String(form.get("defaultOffer") || "").trim();
  const defaultAudience = String(form.get("defaultAudience") || "").trim();
  const defaultLandingUrl = String(form.get("defaultLandingUrl") || "").trim();
  const customerNotes = String(form.get("customerNotes") || "").trim();

  try {
    const payload = await request("/api/customers", {
      method: "POST",
      body: {
        name,
        industry,
        tier,
        website,
        location,
        defaultOffer,
        defaultAudience,
        defaultLandingUrl,
        customerNotes
      }
    });

    state = payload.state;
    renderAll();
    customerForm.reset();
    setMessage(customerMessage, "success", payload.message || "Customer added.");
  } catch (error) {
    setMessage(customerMessage, "error", error.message);
  }
});

if (facebookConnectForm) {
  facebookConnectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveIntegration("facebook", facebookConnectForm);
    } catch (error) {
      setMessage(integrationMessage, "error", error.message);
    }
  });
}

if (googleConnectForm) {
  googleConnectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveIntegration("google", googleConnectForm);
    } catch (error) {
      setMessage(integrationMessage, "error", error.message);
    }
  });
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const disconnectPlatform = platformKey(target.dataset.disconnectPlatform);
  if (!disconnectPlatform) return;

  try {
    await disconnectIntegration(disconnectPlatform);
  } catch (error) {
    setMessage(integrationMessage, "error", error.message);
  }
});

buildCustomer.addEventListener("change", async () => {
  const customerId = String(buildCustomer.value || "");
  if (!customerId) return;

  try {
    const payload = await request("/api/selection", { method: "PATCH", body: { customerId } });
    state = payload.state;
    renderAll();
  } catch (error) {
    setMessage(buildCampaignMessage, "error", error.message);
  }
});

if (loadCustomerDefaultsBtn) {
  loadCustomerDefaultsBtn.addEventListener("click", () => {
    applyCustomerDefaults(true);
    renderCustomerDefaultsHint();
    setMessage(buildCampaignMessage, "success", "Customer defaults loaded into campaign builder.");
  });
}

if (backToLandingBtn) {
  backToLandingBtn.addEventListener("click", (event) => {
    event.preventDefault();
    const fallback = serviceHealth && serviceHealth.landingUrl ? String(serviceHealth.landingUrl) : "/";
    window.location.href = fallback;
  });
}

buildCampaignForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = new FormData(buildCampaignForm);
  const channels = Array.from(buildCampaignForm.querySelectorAll('input[name="buildChannels"]:checked')).map((entry) => entry.value);

  try {
    const payload = await request("/api/campaigns/build", {
      method: "POST",
      body: {
        customerId: String(form.get("customerId") || state.selectedCustomerId),
        campaignBaseName: String(form.get("campaignBaseName") || "").trim(),
        objective: String(form.get("objective") || "Leads"),
        cta: String(form.get("cta") || "Learn More"),
        channels,
        mode: String(form.get("mode") || "Hybrid"),
        dailyBudget: Number(form.get("dailyBudget") || 0),
        targetCpa: Number(form.get("targetCpa") || 0),
        artifactName: String(form.get("artifactName") || "").trim(),
        offer: String(form.get("offer") || "").trim(),
        landingUrl: String(form.get("landingUrl") || "").trim(),
        artifactText: String(form.get("artifactText") || "").trim(),
        audience: String(form.get("audience") || "").trim(),
        strategyNotes: String(form.get("strategyNotes") || "").trim(),
        customInputs: String(form.get("customInputs") || "").trim(),
        creativeType: String(form.get("creativeType") || "image").trim(),
        creativeUrl: String(form.get("creativeUrl") || "").trim()
      }
    });

    state = payload.state;
    renderAll();
    setMessage(buildCampaignMessage, "success", payload.message || "Campaigns created.");
  } catch (error) {
    setMessage(buildCampaignMessage, "error", error.message);
  }
});

adInputRuns.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const optionNav = String(target.dataset.optionNav || "");
  if (optionNav) {
    const optionCount = Number(target.dataset.optionCount || 0);
    if (!optionCount) return;
    shiftGlobalAdPage(optionCount, optionNav);
    renderAdInputRuns();
    return;
  }

  const publishAction = String(target.dataset.publishAction || "");
  if (publishAction) {
    const runId = String(target.dataset.runId || "");
    const optionId = String(target.dataset.optionId || "");

    try {
      if (publishAction === "queue-option") {
        await queuePublish(runId, optionId, []);
      }
    } catch (error) {
      setMessage(publishMessage, "error", error.message);
    }
    return;
  }
});

if (publishQueue) {
  publishQueue.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = String(target.dataset.publishAction || "");
    if (action === "job-action") {
      const jobId = String(target.dataset.jobId || "");
      const jobAction = String(target.dataset.jobAction || "");
      if (!jobId || !jobAction) return;

      try {
        await runJobAction(jobId, jobAction);
      } catch (error) {
        setMessage(publishMessage, "error", error.message);
      }
      return;
    }

  });
}

simulateBtn.addEventListener("click", async () => {
  try {
    const payload = await request("/api/simulate", { method: "POST" });
    state = payload.state;
    renderAll();
    setMessage(buildCampaignMessage, "success", payload.message || "Cycle complete.");
  } catch (error) {
    setMessage(buildCampaignMessage, "error", error.message);
  }
});

(async function init() {
  try {
    serviceHealth = await request("/api/health");
    await syncStateFromApi();
  } catch (error) {
    setMessage(buildCampaignMessage, "error", `Failed to load backend state: ${error.message}`);
    renderServiceStatus();
  }
})();
