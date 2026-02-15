const vslForm = document.getElementById("vslForm");
const vslStatus = document.getElementById("vslStatus");
const vslSummary = document.getElementById("vslSummary");
const vslFileInput = document.getElementById("vslFileInput");

const state = window.LeadGenFunnelStorage.read();

if (!Array.isArray(state.channels) || !state.channels.length) {
  window.location.href = "/marketing-lead-gen";
}

const channelNames = {
  "google-ads": "Google Ads",
  "facebook-ads": "Facebook Ads",
  "local-services-ads": "Local Service Ads",
  seo: "SEO"
};

function setStatus(type, text) {
  vslStatus.textContent = text;
  vslStatus.className = type === "error" ? "message error" : type === "success" ? "message success" : "message";
}

vslSummary.textContent = `${state.businessName || "Draft intake"} · Channels: ${state.channels
  .map((channel) => channelNames[channel] || channel)
  .join(", ")}`;

if (state.vslWorkflow && typeof state.vslWorkflow === "object") {
  const existingMode = String(state.vslWorkflow.mode || "upload");
  const modeInput = vslForm.querySelector(`input[name="vslMode"][value="${existingMode}"]`);
  if (modeInput) {
    modeInput.checked = true;
  }
  if (state.vslWorkflow.videoUrl) {
    vslForm.elements.namedItem("vslUrl").value = state.vslWorkflow.videoUrl;
  }
  if (state.vslWorkflow.notes) {
    vslForm.elements.namedItem("vslNotes").value = state.vslWorkflow.notes;
  }
}

vslForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitButton = vslForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
  }

  try {
    const form = new FormData(vslForm);
    const mode = String(form.get("vslMode") || "upload");
    const videoUrl = String(form.get("vslUrl") || "").trim();
    const notes = String(form.get("vslNotes") || "").trim();
    const uploadedFileName = vslFileInput.files && vslFileInput.files[0] ? vslFileInput.files[0].name : "";

    window.LeadGenFunnelStorage.merge({
      vslWorkflow: {
        mode,
        videoUrl,
        notes,
        uploadedFileName
      }
    });

    setStatus("success", "Saved. Continuing to business assets...");
    window.location.href = "/marketing-lead-gen/assets";
  } catch {
    setStatus("error", "Unable to save creative settings. Please retry.");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Continue to Business Assets";
    }
  }
});
