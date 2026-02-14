const leadGenCard = document.getElementById("leadGenPricingCard");
const leadGenControls = document.getElementById("leadGenPricingControls");
const leadGenBudgetSlider = document.getElementById("leadGenBudgetSlider");
const leadGenBudgetValue = document.getElementById("leadGenBudgetValue");
const leadGenLeadRange = document.getElementById("leadGenLeadRange");
const leadGenMgmtFee = document.getElementById("leadGenMgmtFee");

function money(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "$0";
  return `$${numeric.toLocaleString("en-US")}`;
}

function computeLeadRange(monthlyBudget) {
  const blendedCpl = 130;
  const expected = Math.max(1, Math.round(monthlyBudget / blendedCpl));
  return {
    low: Math.max(1, Math.floor(expected * 0.8)),
    high: Math.max(1, Math.ceil(expected * 1.2))
  };
}

function updateLeadGenPricing() {
  const budget = Math.max(1000, Number(leadGenBudgetSlider.value || 5000));
  const leadRange = computeLeadRange(budget);
  const managementFee = Math.max(1500, Math.round(budget * 0.2));

  leadGenBudgetValue.textContent = `${money(budget)} ad spend`;
  leadGenLeadRange.textContent = `Estimated leads: ${leadRange.low}-${leadRange.high} / month`;
  leadGenMgmtFee.textContent = `Estimated management fee: ${money(managementFee)} / month`;
}

function navigateToLeadGen() {
  const href = leadGenCard.dataset.href || "/marketing-lead-gen";
  window.location.href = href;
}

if (
  leadGenCard &&
  leadGenControls &&
  leadGenBudgetSlider &&
  leadGenBudgetValue &&
  leadGenLeadRange &&
  leadGenMgmtFee
) {
  leadGenBudgetSlider.addEventListener("input", updateLeadGenPricing);
  updateLeadGenPricing();

  leadGenCard.addEventListener("click", (event) => {
    const interactive = event.target.closest("input, label, button, a");
    if (interactive && leadGenControls.contains(interactive)) {
      return;
    }
    if (interactive && interactive.tagName.toLowerCase() === "a") {
      return;
    }
    navigateToLeadGen();
  });

  leadGenCard.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    navigateToLeadGen();
  });
}
