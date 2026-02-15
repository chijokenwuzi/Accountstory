const leadGenForm = document.getElementById("leadGenForm");
const leadGenStatus = document.getElementById("leadGenStatus");
const budgetSlider = document.getElementById("budgetSlider");
const budgetSliderValue = document.getElementById("budgetSliderValue");
const leadEstimatePreview = document.getElementById("leadEstimatePreview");

const CHANNEL_CPL = {
  "google-ads": 180,
  "facebook-ads": 135,
  "local-services-ads": 95,
  seo: 95
};

function money(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "$0";
  return `$${numeric.toLocaleString("en-US")}`;
}

function getSelectedChannels() {
  return Array.from(leadGenForm.querySelectorAll('input[name="channels"]:checked')).map((input) => input.value);
}

function estimateLeadRange(budget, channels) {
  if (!Array.isArray(channels) || !channels.length) {
    return null;
  }

  const channelBudget = budget / channels.length;
  let expected = 0;

  channels.forEach((channelKey) => {
    const cpl = CHANNEL_CPL[channelKey];
    if (!cpl) return;
    expected += channelBudget / cpl;
  });

  const rounded = Math.max(1, Math.round(expected));
  return {
    expected: rounded,
    low: Math.max(1, Math.floor(rounded * 0.8)),
    high: Math.max(1, Math.ceil(rounded * 1.2))
  };
}

function updateBudgetPreview() {
  const budget = Number(budgetSlider.value || 0);
  budgetSliderValue.textContent = `${money(budget)} / month`;

  const selectedChannels = getSelectedChannels();
  const channels = selectedChannels.length ? selectedChannels : ["google-ads"];

  const forecast = estimateLeadRange(budget, channels);
  if (!selectedChannels.length) {
    leadEstimatePreview.textContent = `Estimated leads: ${forecast.low}-${forecast.high} / month (defaulting to Google Ads)`;
    return;
  }
  leadEstimatePreview.textContent = `Estimated leads: ${forecast.low}-${forecast.high} / month`;
}

function setStatus(type, text) {
  leadGenStatus.textContent = text;
  leadGenStatus.className = type === "error" ? "message error" : type === "success" ? "message success" : "message";
}

function hydrateFromState() {
  const existing = window.LeadGenFunnelStorage.read();
  if (!existing || typeof existing !== "object") {
    updateBudgetPreview();
    return;
  }

  const fieldNames = [
    "businessName",
    "industry",
    "productName",
    "monthlyBudgetUsd",
    "offer",
    "audience",
    "differentiators",
    "objective",
    "tone",
    "landingPage"
  ];

  fieldNames.forEach((name) => {
    const field = leadGenForm.elements.namedItem(name);
    if (!field || typeof existing[name] !== "string") return;
    field.value = existing[name];
  });

  if (existing.monthlyBudgetUsd) {
    budgetSlider.value = String(existing.monthlyBudgetUsd);
  }

  if (Array.isArray(existing.channels) && existing.channels.length) {
    const checked = new Set(existing.channels);
    Array.from(leadGenForm.querySelectorAll('input[name="channels"]')).forEach((checkbox) => {
      checkbox.checked = checked.has(checkbox.value);
    });
  }

  updateBudgetPreview();
}

Array.from(leadGenForm.querySelectorAll('input[name="channels"]')).forEach((checkbox) => {
  checkbox.addEventListener("change", updateBudgetPreview);
});

budgetSlider.addEventListener("input", updateBudgetPreview);
hydrateFromState();

leadGenForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitButton = leadGenForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
  }

  try {
    const selectedChannels = getSelectedChannels();
    const channels = selectedChannels.length ? selectedChannels : ["google-ads"];

    const form = new FormData(leadGenForm);
    window.LeadGenFunnelStorage.merge({
      businessName: String(form.get("businessName") || "").trim(),
      industry: String(form.get("industry") || "").trim(),
      productName: String(form.get("productName") || "").trim(),
      monthlyBudgetUsd: String(form.get("monthlyBudgetUsd") || "").trim(),
      offer: String(form.get("offer") || "").trim(),
      audience: String(form.get("audience") || "").trim(),
      differentiators: String(form.get("differentiators") || "").trim(),
      objective: String(form.get("objective") || "").trim(),
      tone: String(form.get("tone") || "").trim(),
      landingPage: String(form.get("landingPage") || "").trim(),
      channels,
      channelAllocations: null
    });

    setStatus("success", "Saved. Continuing to creative step...");
    window.location.href = "/marketing-lead-gen/creative";
  } catch {
    setStatus("error", "Unable to save intake. Please retry.");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Continue to Creative Step";
    }
  }
});
