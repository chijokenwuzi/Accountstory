const budgetForm = document.getElementById("budgetForm");
const budgetStatus = document.getElementById("budgetStatus");
const budgetSummary = document.getElementById("budgetSummary");
const allocationContainer = document.getElementById("allocationContainer");
const allocationTotal = document.getElementById("allocationTotal");
const allocationLeads = document.getElementById("allocationLeads");
const budgetOutput = document.getElementById("budgetOutput");
const exportPlanBtn = document.getElementById("exportPlanBtn");
const retryGenerateBtn = document.getElementById("retryGenerateBtn");

const CHANNEL_CONFIG = {
  "google-ads": { label: "Google Ads", cpl: 180 },
  "facebook-ads": { label: "Facebook Ads", cpl: 135 },
  "local-services-ads": { label: "Local Service Ads", cpl: 95 },
  seo: { label: "SEO", cpl: 95 }
};

const state = window.LeadGenFunnelStorage.read();
if (!Array.isArray(state.channels) || !state.channels.length) {
  window.LeadGenFunnelStorage.merge({ channels: ["google-ads"] });
}
if (!state.vslWorkflow) {
  window.LeadGenFunnelStorage.merge({ vslWorkflow: { mode: "upload", videoUrl: "", notes: "", uploadedFileName: "" } });
}
if (!state.businessAssets) {
  window.LeadGenFunnelStorage.merge({
    businessAssets: { imageFiles: [], testimonialFiles: [], blogFiles: [], testimonialText: "", contentLinks: "" }
  });
}
const activeState = window.LeadGenFunnelStorage.read();
let latestGeneratedPack = null;

function money(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "$0";
  return `$${numeric.toLocaleString("en-US")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function listMarkup(items) {
  if (!Array.isArray(items) || !items.length) {
    return '<p class="leadgen-empty">No data.</p>';
  }
  return `<ul class="leadgen-list">${items.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>`;
}

function budgetMarkup(items) {
  if (!Array.isArray(items) || !items.length) {
    return '<p class="leadgen-empty">No budget split found.</p>';
  }

  return `
    <ul class="leadgen-budget-list">
      ${items
        .map(
          (entry) =>
            `<li><span>${escapeHtml(entry.channel || "Channel")} (${Number(entry.percent || 0)}%)</span><strong>${money(entry.budgetUsd)}</strong></li>`
        )
        .join("")}
    </ul>
  `;
}

function normalizeTo100(values) {
  const raw = values.map((value) => Math.max(0, Number(value) || 0));
  const sum = raw.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) {
    const equal = Math.floor(100 / raw.length);
    const remainder = 100 - equal * raw.length;
    return raw.map((_, index) => equal + (index < remainder ? 1 : 0));
  }

  const scaled = raw.map((value) => (value / sum) * 100);
  const floored = scaled.map((value) => Math.floor(value));
  let remainder = 100 - floored.reduce((acc, value) => acc + value, 0);
  const order = scaled
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  let pointer = 0;
  while (remainder > 0 && order.length) {
    floored[order[pointer % order.length].index] += 1;
    pointer += 1;
    remainder -= 1;
  }
  return floored;
}

const budget = Math.max(1000, Number(activeState.monthlyBudgetUsd || 5000));
budgetSummary.textContent = `${activeState.businessName || "Draft intake"} · Monthly budget ${money(
  budget
)} · Selected channels: ${activeState.channels
  .map((channel) => CHANNEL_CONFIG[channel]?.label || channel)
  .join(", ")}`;

let allocations = (() => {
  const existing =
    activeState.channelAllocations && typeof activeState.channelAllocations === "object"
      ? activeState.channelAllocations
      : {};
  const seed = activeState.channels.map((channel) => Number(existing[channel] || 0));
  const normalized = normalizeTo100(seed.every((value) => value === 0) ? activeState.channels.map(() => 1) : seed);
  return activeState.channels.map((channel, index) => ({
    key: channel,
    label: CHANNEL_CONFIG[channel]?.label || channel,
    percent: normalized[index]
  }));
})();

function rebalance(changedKey, nextPercent) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(nextPercent) || 0)));
  const updated = allocations.map((entry) => ({ ...entry }));
  const target = updated.find((entry) => entry.key === changedKey);
  if (!target) return;

  const others = updated.filter((entry) => entry.key !== changedKey);
  if (!others.length) {
    target.percent = 100;
    allocations = updated;
    return;
  }

  const remaining = 100 - clamped;
  const otherCurrent = others.map((entry) => entry.percent);
  const otherSum = otherCurrent.reduce((acc, value) => acc + value, 0);

  let normalizedOthers;
  if (otherSum <= 0) {
    normalizedOthers = normalizeTo100(others.map(() => 1)).map((value) => Math.round((value / 100) * remaining));
  } else {
    const scaled = otherCurrent.map((value) => (value / otherSum) * remaining);
    const floored = scaled.map((value) => Math.floor(value));
    let remainder = remaining - floored.reduce((acc, value) => acc + value, 0);
    const order = scaled
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((a, b) => b.fraction - a.fraction);
    let pointer = 0;
    while (remainder > 0 && order.length) {
      floored[order[pointer % order.length].index] += 1;
      pointer += 1;
      remainder -= 1;
    }
    normalizedOthers = floored;
  }

  target.percent = clamped;
  others.forEach((entry, index) => {
    entry.percent = normalizedOthers[index];
  });
  allocations = updated;
}

function estimateLeadRange() {
  let expected = 0;
  allocations.forEach((entry) => {
    const channelBudget = (budget * entry.percent) / 100;
    const cpl = CHANNEL_CONFIG[entry.key]?.cpl || 140;
    expected += channelBudget / cpl;
  });
  const rounded = Math.max(1, Math.round(expected));
  return {
    expected: rounded,
    low: Math.max(1, Math.floor(rounded * 0.8)),
    high: Math.max(1, Math.ceil(rounded * 1.2))
  };
}

const allocationRows = new Map();

function renderAllocationMeta() {
  const total = allocations.reduce((acc, entry) => acc + entry.percent, 0);
  const forecast = estimateLeadRange();
  allocationTotal.textContent = `Total allocation: ${total}%`;
  allocationLeads.textContent = `Expected leads at this split: ${forecast.low}-${forecast.high} / month (best estimate ${forecast.expected})`;
}

function syncAllocationUi() {
  allocations.forEach((entry) => {
    const row = allocationRows.get(entry.key);
    if (!row) return;
    row.percent.textContent = `${entry.percent}%`;
    row.slider.value = String(entry.percent);
  });
  renderAllocationMeta();
}

function initializeAllocationSliders() {
  allocationRows.clear();
  allocationContainer.innerHTML = "";
  allocations.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "allocation-row";
    row.innerHTML = `
      <div class="allocation-head">
        <strong>${entry.label}</strong>
        <span data-channel-percent="${entry.key}">${entry.percent}%</span>
      </div>
      <input type="range" min="0" max="100" step="1" value="${entry.percent}" data-channel-slider="${entry.key}" />
    `;
    allocationContainer.appendChild(row);

    const slider = row.querySelector(`input[data-channel-slider="${entry.key}"]`);
    const percent = row.querySelector(`span[data-channel-percent="${entry.key}"]`);
    if (!slider || !percent) return;
    allocationRows.set(entry.key, { slider, percent });

    slider.addEventListener("input", (event) => {
      rebalance(entry.key, event.target.value);
      syncAllocationUi();
    });
  });
  syncAllocationUi();
}

function renderPack(pack) {
  latestGeneratedPack = pack;
  if (exportPlanBtn) {
    exportPlanBtn.disabled = false;
  }

  const selectedChannels = Array.isArray(pack.selectedChannels) ? pack.selectedChannels : [];
  const leadForecast = pack.leadForecast || {};
  const vsl = pack.vsl || {};
  const channelPlans = pack.channelPlans || {};
  const funnel = pack.funnel || {};
  const operations = pack.operations || {};
  const budgetPlan = operations.budget || {};
  const generation = pack.generation || {};
  const intake = pack.intake || {};
  const sections = [];

  if (vsl && vsl.title) {
    sections.push(`
      <section class="leadgen-block">
        <h3>Creative Plan</h3>
        <p><strong>Title:</strong> ${escapeHtml(vsl.title)}</p>
        <p><strong>Hook:</strong> ${escapeHtml(vsl.hook || "")}</p>
        <p class="leadgen-label">Outline</p>
        ${listMarkup(vsl.outline || [])}
      </section>
    `);
  }

  if (channelPlans.googleAds) {
    sections.push(`
      <section class="leadgen-block">
        <h3>Google Ads</h3>
        ${listMarkup(channelPlans.googleAds.headlines || [])}
      </section>
    `);
  }

  if (channelPlans.facebookAds) {
    sections.push(`
      <section class="leadgen-block">
        <h3>Facebook Ads</h3>
        ${listMarkup(channelPlans.facebookAds.primaryText || [])}
      </section>
    `);
  }

  if (channelPlans.localServicesAds) {
    sections.push(`
      <section class="leadgen-block">
        <h3>Local Service Ads</h3>
        ${listMarkup(channelPlans.localServicesAds.adGroups || [])}
      </section>
    `);
  }

  if (channelPlans.seo) {
    sections.push(`
      <section class="leadgen-block">
        <h3>SEO Plan</h3>
        <p class="leadgen-label">Keyword Clusters</p>
        ${listMarkup(channelPlans.seo.keywordClusters || [])}
        <p class="leadgen-label">Content Plan</p>
        ${listMarkup(channelPlans.seo.contentPlan || [])}
      </section>
    `);
  }

  sections.push(`
    <section class="leadgen-block">
      <h3>Funnel Foundation</h3>
      <p class="leadgen-label">Landing Page Sections</p>
      ${listMarkup(funnel.landingPageSections || [])}
      <p class="leadgen-label">Lead Capture Flow</p>
      ${listMarkup(funnel.leadCaptureFlow || [])}
    </section>
  `);

  sections.push(`
    <section class="leadgen-block">
      <h3>Operations</h3>
      <p><strong>Monthly Budget:</strong> ${money(budgetPlan.monthlyUsd)}</p>
      ${budgetMarkup(budgetPlan.channelMix || [])}
      <p class="leadgen-label">Weekly Automation Checklist</p>
      ${listMarkup(operations.weeklyAutomationChecklist || [])}
      <p class="leadgen-label">Compliance</p>
      ${listMarkup(operations.compliance || [])}
    </section>
  `);

  if (intake.vsl || intake.assets) {
    sections.push(`
      <section class="leadgen-block">
        <h3>Intake Summary</h3>
        <p><strong>Creative Mode:</strong> ${escapeHtml(intake.vsl?.mode || "n/a")}</p>
        <p><strong>Uploaded Creative File:</strong> ${escapeHtml(intake.vsl?.uploadedFileName || "none")}</p>
        <p><strong>Image Assets:</strong> ${Number(intake.assets?.imageFiles || 0)}</p>
        <p><strong>Testimonial Assets:</strong> ${Number(intake.assets?.testimonialFiles || 0)}</p>
        <p><strong>Blog Assets:</strong> ${Number(intake.assets?.blogFiles || 0)}</p>
      </section>
    `);
  }

  budgetOutput.innerHTML = `
    <p class="leadgen-summary">${escapeHtml(pack.summary || "")}</p>
    <p class="leadgen-meta"><strong>Selected Channels:</strong> ${escapeHtml(
      selectedChannels.map((entry) => entry.label).join(", ")
    )}</p>
    <p class="leadgen-meta"><strong>Expected Leads:</strong> ${Number(leadForecast.low || 0)}-${Number(
      leadForecast.high || 0
    )} / month (best estimate ${Number(leadForecast.expected || 0)})</p>
    <p class="leadgen-meta">${escapeHtml(leadForecast.notes || "")}</p>
    <p class="leadgen-meta">Generated via ${escapeHtml(generation.source || "template")} (${escapeHtml(
      generation.model || "template-v1"
    )})</p>
    ${sections.join("")}
  `;
}

initializeAllocationSliders();

if (retryGenerateBtn) {
  retryGenerateBtn.addEventListener("click", () => {
    budgetForm.requestSubmit();
  });
}

if (exportPlanBtn) {
  exportPlanBtn.addEventListener("click", () => {
    if (!latestGeneratedPack) return;
    const payload = JSON.stringify(latestGeneratedPack, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const businessName = String(activeState.businessName || "leadgen-plan")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    anchor.href = url;
    anchor.download = `${businessName || "leadgen-plan"}-export.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });
}

budgetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = budgetForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Generating...";
  }
  if (retryGenerateBtn) {
    retryGenerateBtn.style.display = "none";
  }
  budgetStatus.textContent = "Generating final lead gen plan...";
  budgetStatus.className = "message";

  const channelAllocations = allocations.reduce((acc, entry) => {
    acc[entry.key] = entry.percent;
    return acc;
  }, {});

  window.LeadGenFunnelStorage.merge({ channelAllocations });
  const freshState = window.LeadGenFunnelStorage.read();
  const payload = {
    businessName: String(freshState.businessName || "").trim(),
    industry: String(freshState.industry || "").trim(),
    productName: String(freshState.productName || "").trim(),
    monthlyBudgetUsd: String(freshState.monthlyBudgetUsd || "").trim(),
    offer: String(freshState.offer || "").trim(),
    audience: String(freshState.audience || "").trim(),
    differentiators: String(freshState.differentiators || "").trim(),
    objective: String(freshState.objective || "").trim(),
    tone: String(freshState.tone || "").trim(),
    landingPage: String(freshState.landingPage || "").trim(),
    channels: Array.isArray(freshState.channels) ? freshState.channels : [],
    channelAllocations,
    vslWorkflow: freshState.vslWorkflow || {},
    businessAssets: freshState.businessAssets || {}
  };

  try {
    const response = await fetch("/api/marketing-lead-gen/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to generate lead gen pack.");
    }
    renderPack(result.pack);
    budgetStatus.textContent = "Final lead gen plan generated.";
    budgetStatus.className = "message success";
  } catch (error) {
    budgetStatus.textContent = `${error.message} Please retry.`;
    budgetStatus.className = "message error";
    if (retryGenerateBtn) {
      retryGenerateBtn.style.display = "inline-flex";
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Generate Final Lead Gen Plan";
    }
  }
});
