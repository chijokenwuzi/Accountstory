const assetsForm = document.getElementById("assetsForm");
const assetsStatus = document.getElementById("assetsStatus");
const assetsSummary = document.getElementById("assetsSummary");

const state = window.LeadGenFunnelStorage.read();

if (!state.vslWorkflow) {
  window.location.href = "/marketing-lead-gen/creative";
}

assetsSummary.textContent = `${state.businessName || "Draft intake"} · Creative mode: ${String(
  state.vslWorkflow.mode || "upload"
)}`;

function setStatus(type, text) {
  assetsStatus.textContent = text;
  assetsStatus.className = type === "error" ? "message error" : type === "success" ? "message success" : "message";
}

function fileNames(input) {
  if (!input || !input.files || !input.files.length) {
    return [];
  }
  return Array.from(input.files).map((file) => file.name);
}

if (state.businessAssets && typeof state.businessAssets === "object") {
  if (state.businessAssets.testimonialText) {
    assetsForm.elements.namedItem("testimonialText").value = state.businessAssets.testimonialText;
  }
  if (state.businessAssets.contentLinks) {
    assetsForm.elements.namedItem("contentLinks").value = state.businessAssets.contentLinks;
  }
}

assetsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitButton = assetsForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
  }

  try {
    const testimonialText = String(assetsForm.elements.namedItem("testimonialText").value || "").trim();
    const contentLinks = String(assetsForm.elements.namedItem("contentLinks").value || "").trim();

    window.LeadGenFunnelStorage.merge({
      businessAssets: {
        imageFiles: fileNames(assetsForm.elements.namedItem("imageFiles")),
        testimonialFiles: fileNames(assetsForm.elements.namedItem("testimonialFiles")),
        blogFiles: fileNames(assetsForm.elements.namedItem("blogFiles")),
        testimonialText,
        contentLinks
      }
    });

    setStatus("success", "Saved. Continuing to budget allocation...");
    window.location.href = "/marketing-lead-gen/budget";
  } catch {
    setStatus("error", "Unable to save assets. Please retry.");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Continue to Budget Allocation";
    }
  }
});
