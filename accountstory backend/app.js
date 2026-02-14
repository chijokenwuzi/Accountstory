const STAGES = ["Intake", "Creative QA", "Launch", "Optimization", "Scale", "Blocked"];

let state = null;
let serviceHealth = null;

const customerList = document.getElementById("customerList");
const customerForm = document.getElementById("customerForm");
const customerMessage = document.getElementById("customerMessage");

const buildCampaignForm = document.getElementById("buildCampaignForm");
const buildCustomer = document.getElementById("buildCustomer");
const buildCampaignMessage = document.getElementById("buildCampaignMessage");
const openAiStatus = document.getElementById("openAiStatus");
const loadCustomerDefaultsBtn = document.getElementById("loadCustomerDefaultsBtn");
const customerDefaultsHint = document.getElementById("customerDefaultsHint");

const guardrailForm = document.getElementById("guardrailForm");
const budgetCap = document.getElementById("budgetCap");
const cpaCap = document.getElementById("cpaCap");
const budgetCapValue = document.getElementById("budgetCapValue");
const cpaCapValue = document.getElementById("cpaCapValue");
const policyGate = document.getElementById("policyGate");
const creativeGate = document.getElementById("creativeGate");
const killSwitch = document.getElementById("killSwitch");
const guardrailMessage = document.getElementById("guardrailMessage");

const metricCustomers = document.getElementById("metricCustomers");
const metricLive = document.getElementById("metricLive");
const metricAutopilot = document.getElementById("metricAutopilot");
const metricRisk = document.getElementById("metricRisk");

const adInputRuns = document.getElementById("adInputRuns");
const boardColumns = document.getElementById("boardColumns");
const simulateBtn = document.getElementById("simulateBtn");

function money(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "$0";
  return `$${num.toLocaleString("en-US")}`;
}

function setMessage(node, type, text) {
  node.textContent = text || "";
  node.className = type ? `message ${type}` : "message";
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

  if (!state.campaigns.length) {
    metricAutopilot.textContent = "0%";
  } else {
    const autoCount = state.campaigns.filter((campaign) => campaign.mode === "Autopilot").length;
    metricAutopilot.textContent = `${Math.round((autoCount / state.campaigns.length) * 100)}%`;
  }

  const riskCount = state.campaigns.filter((campaign) => campaign.risk === "High" || campaign.stage === "Blocked").length;
  metricRisk.textContent = String(riskCount);
}

function renderServiceStatus() {
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

function createCampaignCard(campaign) {
  const card = document.createElement("article");
  card.className = "campaign-card";

  const title = document.createElement("strong");
  title.textContent = campaign.name;

  const customer = document.createElement("p");
  customer.textContent = customerNameById(campaign.customerId);

  const meta = document.createElement("p");
  meta.textContent = `${campaign.goal} | ${money(campaign.dailyBudget)}/day | tCPA ${money(campaign.targetCpa)}`;

  const badgeRow = document.createElement("div");
  badgeRow.className = "badge-row";

  const modeBadge = document.createElement("span");
  modeBadge.className = "badge";
  modeBadge.textContent = campaign.mode;

  const riskBadge = document.createElement("span");
  riskBadge.className = `badge${campaign.risk === "High" ? " warn" : ""}`;
  riskBadge.textContent = `Risk ${campaign.risk}`;

  const channelBadge = document.createElement("span");
  channelBadge.className = "badge";
  channelBadge.textContent = Array.isArray(campaign.channels) ? campaign.channels.join("+") : "";

  badgeRow.appendChild(modeBadge);
  badgeRow.appendChild(riskBadge);
  badgeRow.appendChild(channelBadge);

  const actions = document.createElement("div");
  actions.className = "card-actions";

  [
    { action: "advance", label: "Advance" },
    { action: "block", label: "Block" },
    { action: "autopilot", label: "Autopilot" },
    { action: "archive", label: "Archive" }
  ].forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-secondary btn-small";
    button.textContent = entry.label;
    button.dataset.action = entry.action;
    button.dataset.id = campaign.id;
    actions.appendChild(button);
  });

  card.appendChild(title);
  card.appendChild(customer);
  card.appendChild(meta);
  card.appendChild(badgeRow);
  card.appendChild(actions);
  return card;
}

function renderBoard() {
  boardColumns.innerHTML = "";

  STAGES.forEach((stage) => {
    const column = document.createElement("section");
    column.className = "board-col";

    const title = document.createElement("h3");
    title.textContent = stage;

    const stack = document.createElement("div");
    stack.className = "board-stack";

    const campaigns = state.campaigns.filter((campaign) => campaign.stage === stage);

    if (!campaigns.length) {
      const empty = document.createElement("p");
      empty.className = "empty-col";
      empty.textContent = "No campaigns";
      stack.appendChild(empty);
    } else {
      campaigns.forEach((campaign) => stack.appendChild(createCampaignCard(campaign)));
    }

    column.appendChild(title);
    column.appendChild(stack);
    boardColumns.appendChild(column);
  });
}

function renderGuardrails() {
  budgetCap.value = String(state.guardrails.budgetCap);
  cpaCap.value = String(state.guardrails.cpaCap);
  policyGate.checked = Boolean(state.guardrails.policyGate);
  creativeGate.checked = Boolean(state.guardrails.creativeGate);
  killSwitch.checked = Boolean(state.guardrails.killSwitch);
  budgetCapValue.textContent = `${money(state.guardrails.budgetCap)} cap`;
  cpaCapValue.textContent = `${money(state.guardrails.cpaCap)} cap`;
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

function createCopyRow(label, value) {
  const row = document.createElement("div");
  row.className = "copy-row";

  const name = document.createElement("span");
  name.className = "copy-label";
  name.textContent = label;

  const text = document.createElement("p");
  text.className = "copy-value";
  text.textContent = value;

  const actions = document.createElement("div");
  actions.className = "copy-actions";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-secondary btn-small";
  button.textContent = "Copy";
  button.dataset.copy = value;

  actions.appendChild(button);
  row.appendChild(name);
  row.appendChild(text);
  row.appendChild(actions);
  return row;
}

function facebookPackText(pack) {
  return [
    `Campaign Name: ${pack.campaignName}`,
    `Objective: ${pack.objective}`,
    `Audience: ${pack.adSetAudience}`,
    `Placements: ${pack.placements}`,
    `Primary Text: ${pack.primaryText}`,
    `Headline: ${pack.headline}`,
    `Description: ${pack.description}`,
    `CTA: ${pack.cta}`,
    `Destination URL: ${pack.destinationUrl}`
  ].join("\n");
}

function googlePackText(pack) {
  return [
    `Campaign Name: ${pack.campaignName}`,
    `Campaign Type: ${pack.campaignType}`,
    `Final URL: ${pack.finalUrl}`,
    `Path 1: ${pack.path1}`,
    `Path 2: ${pack.path2}`,
    `Headlines:`,
    ...(Array.isArray(pack.headlines) ? pack.headlines.map((item, index) => `${index + 1}. ${item}`) : []),
    `Descriptions:`,
    ...(Array.isArray(pack.descriptions) ? pack.descriptions.map((item, index) => `${index + 1}. ${item}`) : []),
    `Keywords:`,
    ...(Array.isArray(pack.keywords) ? pack.keywords.map((item, index) => `${index + 1}. ${item}`) : []),
    `Audience Signal: ${pack.audienceSignal}`
  ].join("\n");
}

function createPlatformBlock(platform, pack) {
  const block = document.createElement("div");
  block.className = "platform-block";

  const head = document.createElement("div");
  head.className = "platform-head";

  const title = document.createElement("h5");
  title.textContent = platform;

  const copyAll = document.createElement("button");
  copyAll.type = "button";
  copyAll.className = "btn btn-secondary btn-small";
  copyAll.textContent = "Copy All";
  copyAll.dataset.copy = platform === "Facebook" ? facebookPackText(pack) : googlePackText(pack);

  head.appendChild(title);
  head.appendChild(copyAll);

  const grid = document.createElement("div");
  grid.className = "copy-grid";

  if (platform === "Facebook") {
    grid.appendChild(createCopyRow("Campaign Name", pack.campaignName));
    grid.appendChild(createCopyRow("Objective", pack.objective));
    grid.appendChild(createCopyRow("Audience", pack.adSetAudience));
    grid.appendChild(createCopyRow("Placements", pack.placements));
    grid.appendChild(createCopyRow("Primary Text", pack.primaryText));
    grid.appendChild(createCopyRow("Headline", pack.headline));
    grid.appendChild(createCopyRow("Description", pack.description));
    grid.appendChild(createCopyRow("CTA", pack.cta));
    grid.appendChild(createCopyRow("Destination URL", pack.destinationUrl));
  } else {
    grid.appendChild(createCopyRow("Campaign Name", pack.campaignName));
    grid.appendChild(createCopyRow("Campaign Type", pack.campaignType));
    grid.appendChild(createCopyRow("Final URL", pack.finalUrl));
    grid.appendChild(createCopyRow("Path 1", pack.path1));
    grid.appendChild(createCopyRow("Path 2", pack.path2));
    grid.appendChild(createCopyRow("Headlines", (pack.headlines || []).join("\n")));
    grid.appendChild(createCopyRow("Descriptions", (pack.descriptions || []).join("\n")));
    grid.appendChild(createCopyRow("Keywords", (pack.keywords || []).join("\n")));
    grid.appendChild(createCopyRow("Audience Signal", pack.audienceSignal));
  }

  block.appendChild(head);
  block.appendChild(grid);
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

  runs.slice(0, 12).forEach((run) => {
    const runCard = document.createElement("article");
    runCard.className = "ad-run";

    const head = document.createElement("div");
    head.className = "ad-run-head";

    const headText = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `${run.artifactName || "Artifact"} | ${run.objective || "Leads"}`;
    const meta = document.createElement("p");
    meta.textContent = `${customerNameById(run.customerId)} | ${formatTime(run.createdAt)} | ${(run.channels || []).join(", ")}`;

    headText.appendChild(title);
    headText.appendChild(meta);
    head.appendChild(headText);

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "ad-options";

    (run.options || []).forEach((option) => {
      const optionCard = document.createElement("section");
      optionCard.className = "ad-option";

      const optionTitle = document.createElement("h4");
      optionTitle.textContent = option.label || "Ad Option";

      const rationale = document.createElement("p");
      rationale.textContent = option.rationale || "Generated from customer artifact.";

      optionCard.appendChild(optionTitle);
      optionCard.appendChild(rationale);

      if (option.facebook) {
        optionCard.appendChild(createPlatformBlock("Facebook", option.facebook));
      }

      if (option.google) {
        optionCard.appendChild(createPlatformBlock("Google", option.google));
      }

      optionsWrap.appendChild(optionCard);
    });

    runCard.appendChild(head);
    runCard.appendChild(optionsWrap);
    adInputRuns.appendChild(runCard);
  });
}

function renderAll() {
  renderServiceStatus();
  renderCustomerOptions();
  renderCustomerList();
  renderCustomerDefaultsHint();
  applyCustomerDefaults(false);
  renderGuardrails();
  renderMetrics();
  renderAdInputRuns();
  renderBoard();
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
        customInputs: String(form.get("customInputs") || "").trim()
      }
    });

    state = payload.state;
    renderAll();
    setMessage(buildCampaignMessage, "success", payload.message || "Campaigns created.");
  } catch (error) {
    setMessage(buildCampaignMessage, "error", error.message);
  }
});

budgetCap.addEventListener("input", () => {
  budgetCapValue.textContent = `${money(budgetCap.value)} cap`;
});

cpaCap.addEventListener("input", () => {
  cpaCapValue.textContent = `${money(cpaCap.value)} cap`;
});

guardrailForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const payload = await request("/api/guardrails", {
      method: "PUT",
      body: {
        budgetCap: Number(budgetCap.value || 2500),
        cpaCap: Number(cpaCap.value || 120),
        policyGate: Boolean(policyGate.checked),
        creativeGate: Boolean(creativeGate.checked),
        killSwitch: Boolean(killSwitch.checked)
      }
    });

    state = payload.state;
    renderAll();
    setMessage(guardrailMessage, "success", payload.message || "Guardrails saved.");
  } catch (error) {
    setMessage(guardrailMessage, "error", error.message);
  }
});

boardColumns.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !id) return;

  try {
    const payload = await request(`/api/campaigns/${encodeURIComponent(id)}/action`, {
      method: "POST",
      body: { action }
    });

    state = payload.state;
    renderAll();
  } catch (error) {
    setMessage(guardrailMessage, "error", error.message);
  }
});

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

adInputRuns.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const text = target.dataset.copy;
  if (!text) return;

  try {
    await copyToClipboard(text);
    setMessage(buildCampaignMessage, "success", "Copied to clipboard.");
  } catch {
    setMessage(buildCampaignMessage, "error", "Unable to copy. Copy manually from the field text.");
  }
});

simulateBtn.addEventListener("click", async () => {
  try {
    const payload = await request("/api/simulate", { method: "POST" });
    state = payload.state;
    renderAll();
    setMessage(guardrailMessage, "success", payload.message || "Cycle complete.");
  } catch (error) {
    setMessage(guardrailMessage, "error", error.message);
  }
});

(async function init() {
  try {
    serviceHealth = await request("/api/health");
    await syncStateFromApi();
  } catch (error) {
    setMessage(guardrailMessage, "error", `Failed to load backend state: ${error.message}`);
    renderServiceStatus();
  }
})();
