const SOURCE_META = {
  "google-ads": { label: "Google Ads", color: "#7ea5ff" },
  "facebook-ads": { label: "Facebook Ads", color: "#72c6ff" },
  "local-services-ads": { label: "Local Service Ads", color: "#7fe0c4" },
  seo: { label: "SEO", color: "#9ad87d" }
};

const TRACKER_DATA = {
  campaigns: [
    {
      name: "Emergency Service Search - Core",
      source: "google-ads",
      spend: 11200,
      leads: 96,
      qualified: 44,
      status: "Active"
    },
    {
      name: "Service + City Search Expansion",
      source: "google-ads",
      spend: 6200,
      leads: 52,
      qualified: 26,
      status: "Active"
    },
    {
      name: "Facebook Homeowner Lead Forms",
      source: "facebook-ads",
      spend: 7800,
      leads: 88,
      qualified: 36,
      status: "Active"
    },
    {
      name: "Facebook Retargeting 30-Day",
      source: "facebook-ads",
      spend: 4200,
      leads: 37,
      qualified: 16,
      status: "Paused"
    },
    {
      name: "Local Service Ads - Main Market",
      source: "local-services-ads",
      spend: 6500,
      leads: 82,
      qualified: 41,
      status: "Active"
    },
    {
      name: "Local Service Ads - Neighbor Cities",
      source: "local-services-ads",
      spend: 3100,
      leads: 34,
      qualified: 15,
      status: "Active"
    },
    {
      name: "SEO Service Page Cluster",
      source: "seo",
      spend: 4900,
      leads: 43,
      qualified: 18,
      status: "Active"
    },
    {
      name: "SEO Local Map Pack Content",
      source: "seo",
      spend: 2400,
      leads: 20,
      qualified: 9,
      status: "Active"
    }
  ],
  weekly: [
    {
      label: "Week 1",
      sources: {
        "google-ads": { spend: 2700, leads: 23 },
        "facebook-ads": { spend: 2000, leads: 20 },
        "local-services-ads": { spend: 1600, leads: 21 },
        seo: { spend: 1100, leads: 9 }
      }
    },
    {
      label: "Week 2",
      sources: {
        "google-ads": { spend: 2850, leads: 24 },
        "facebook-ads": { spend: 2100, leads: 21 },
        "local-services-ads": { spend: 1650, leads: 20 },
        seo: { spend: 1150, leads: 10 }
      }
    },
    {
      label: "Week 3",
      sources: {
        "google-ads": { spend: 2950, leads: 25 },
        "facebook-ads": { spend: 2150, leads: 22 },
        "local-services-ads": { spend: 1700, leads: 20 },
        seo: { spend: 1200, leads: 10 }
      }
    },
    {
      label: "Week 4",
      sources: {
        "google-ads": { spend: 3050, leads: 26 },
        "facebook-ads": { spend: 2200, leads: 23 },
        "local-services-ads": { spend: 1750, leads: 22 },
        seo: { spend: 1250, leads: 11 }
      }
    },
    {
      label: "Week 5",
      sources: {
        "google-ads": { spend: 2900, leads: 24 },
        "facebook-ads": { spend: 2050, leads: 21 },
        "local-services-ads": { spend: 1600, leads: 18 },
        seo: { spend: 1300, leads: 10 }
      }
    },
    {
      label: "Week 6",
      sources: {
        "google-ads": { spend: 2900, leads: 26 },
        "facebook-ads": { spend: 1500, leads: 18 },
        "local-services-ads": { spend: 1300, leads: 15 },
        seo: { spend: 1300, leads: 10 }
      }
    }
  ]
};

const trackerKpis = document.getElementById("trackerKpis");
const trackerFilters = document.getElementById("trackerFilters");
const spendBreakdown = document.getElementById("spendBreakdown");
const leadsTrendChart = document.getElementById("leadsTrendChart");
const sourceSections = document.getElementById("sourceSections");
const campaignRows = document.getElementById("campaignRows");
const ESTIMATED_REVENUE_PER_BOOKED_JOB = 2400;

let activeSource = "all";

function money(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
}

function fmt(value) {
  return Math.round(Number(value || 0)).toLocaleString("en-US");
}

function getActiveKeys() {
  if (activeSource === "all") {
    return Object.keys(SOURCE_META);
  }
  return [activeSource];
}

function getCampaignsFiltered() {
  const activeKeys = new Set(getActiveKeys());
  return TRACKER_DATA.campaigns.filter((entry) => activeKeys.has(entry.source));
}

function getTotals(campaigns) {
  const spend = campaigns.reduce((acc, entry) => acc + entry.spend, 0);
  const leads = campaigns.reduce((acc, entry) => acc + entry.leads, 0);
  const qualified = campaigns.reduce((acc, entry) => acc + entry.qualified, 0);
  const cpl = leads > 0 ? spend / leads : 0;
  const qualificationRate = leads > 0 ? (qualified / leads) * 100 : 0;
  return { spend, leads, qualified, cpl, qualificationRate };
}

function bySource(campaigns) {
  const grouped = {};
  campaigns.forEach((entry) => {
    if (!grouped[entry.source]) {
      grouped[entry.source] = { source: entry.source, spend: 0, leads: 0, qualified: 0, campaigns: [] };
    }
    grouped[entry.source].spend += entry.spend;
    grouped[entry.source].leads += entry.leads;
    grouped[entry.source].qualified += entry.qualified;
    grouped[entry.source].campaigns.push(entry);
  });
  return Object.values(grouped);
}

function createFilterButtons() {
  const filters = [
    { key: "all", label: "All Sources" },
    ...Object.keys(SOURCE_META).map((key) => ({ key, label: SOURCE_META[key].label }))
  ];
  trackerFilters.innerHTML = filters
    .map(
      (filter) =>
        `<button type="button" class="tracker-filter${
          filter.key === activeSource ? " active" : ""
        }" data-filter="${filter.key}">${filter.label}</button>`
    )
    .join("");

  Array.from(trackerFilters.querySelectorAll("button[data-filter]")).forEach((button) => {
    button.addEventListener("click", () => {
      activeSource = button.dataset.filter;
      render();
    });
  });
}

function renderKpis(campaigns) {
  const totals = getTotals(campaigns);
  const costPerBookedCall = totals.qualified > 0 ? totals.spend / totals.qualified : 0;
  const estimatedRevenue = totals.qualified * ESTIMATED_REVENUE_PER_BOOKED_JOB;
  trackerKpis.innerHTML = `
    <article class="tracker-kpi-card">
      <p>Total Spend</p>
      <strong>${money(totals.spend)}</strong>
    </article>
    <article class="tracker-kpi-card">
      <p>Total Leads</p>
      <strong>${fmt(totals.leads)}</strong>
    </article>
    <article class="tracker-kpi-card">
      <p>Average CPL</p>
      <strong>${money(totals.cpl)}</strong>
    </article>
    <article class="tracker-kpi-card">
      <p>Booked Calls</p>
      <strong>${fmt(totals.qualified)}</strong>
    </article>
    <article class="tracker-kpi-card">
      <p>Cost Per Booked Call</p>
      <strong>${money(costPerBookedCall)}</strong>
    </article>
    <article class="tracker-kpi-card">
      <p>Estimated Revenue</p>
      <strong>${money(estimatedRevenue)}</strong>
      <p class="tracker-kpi-sub">Assumption: ${money(
        ESTIMATED_REVENUE_PER_BOOKED_JOB
      )} average revenue per closed job</p>
    </article>
  `;
}

function renderSpendBreakdown(campaigns) {
  const grouped = bySource(campaigns);
  const maxSpend = Math.max(...grouped.map((entry) => entry.spend), 1);

  spendBreakdown.innerHTML = grouped
    .map((entry) => {
      const width = Math.max(4, Math.round((entry.spend / maxSpend) * 100));
      const meta = SOURCE_META[entry.source] || { label: entry.source, color: "#8db1ff" };
      return `
        <div class="source-bar-row">
          <div class="source-bar-head">
            <strong>${meta.label}</strong>
            <span>${money(entry.spend)} · ${fmt(entry.leads)} leads</span>
          </div>
          <div class="source-bar-track">
            <div class="source-bar-fill" style="width:${width}%; background:${meta.color};"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function trendPoints() {
  const active = new Set(getActiveKeys());
  return TRACKER_DATA.weekly.map((week) => {
    let leads = 0;
    active.forEach((sourceKey) => {
      leads += Number(week.sources[sourceKey]?.leads || 0);
    });
    return { label: week.label, leads };
  });
}

function renderTrendChart() {
  const points = trendPoints();
  const width = 680;
  const height = 260;
  const padding = 36;
  const maxY = Math.max(...points.map((point) => point.leads), 10);

  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const toX = (index) => padding + index * stepX;
  const toY = (value) => height - padding - (value / maxY) * (height - padding * 2);

  const polyline = points
    .map((point, index) => `${toX(index).toFixed(2)},${toY(point.leads).toFixed(2)}`)
    .join(" ");

  const circles = points
    .map(
      (point, index) =>
        `<circle cx="${toX(index).toFixed(2)}" cy="${toY(point.leads).toFixed(2)}" r="4" class="trend-point"></circle>`
    )
    .join("");

  const labels = points
    .map(
      (point, index) =>
        `<text x="${toX(index).toFixed(2)}" y="${height - 10}" text-anchor="middle" class="trend-label">${point.label}</text>`
    )
    .join("");

  const gridLines = [0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = height - padding - ratio * (height - padding * 2);
      const value = Math.round(maxY * ratio);
      return `
        <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" class="trend-grid"></line>
        <text x="${padding - 8}" y="${y + 4}" text-anchor="end" class="trend-axis">${value}</text>
      `;
    })
    .join("");

  leadsTrendChart.innerHTML = `
    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="trend-axis-line"></line>
    ${gridLines}
    <polyline points="${polyline}" class="trend-line"></polyline>
    ${circles}
    ${labels}
  `;
}

function renderSourceSections(campaigns) {
  const grouped = bySource(campaigns);
  sourceSections.innerHTML = grouped
    .map((entry) => {
      const source = SOURCE_META[entry.source] || { label: entry.source, color: "#8db1ff" };
      const cpl = entry.leads > 0 ? entry.spend / entry.leads : 0;
      return `
        <article class="source-card">
          <div class="source-card-top">
            <h3>${source.label}</h3>
            <span class="source-dot" style="background:${source.color};"></span>
          </div>
          <p>Spend: <strong>${money(entry.spend)}</strong></p>
          <p>Leads: <strong>${fmt(entry.leads)}</strong></p>
          <p>CPL: <strong>${money(cpl)}</strong></p>
          <p>Qualified: <strong>${fmt(entry.qualified)}</strong></p>
          <p class="leadgen-label">Campaigns</p>
          <ul class="leadgen-list">
            ${entry.campaigns.map((campaign) => `<li>${campaign.name}</li>`).join("")}
          </ul>
        </article>
      `;
    })
    .join("");
}

function renderCampaignTable(campaigns) {
  campaignRows.innerHTML = campaigns
    .map((entry) => {
      const source = SOURCE_META[entry.source] || { label: entry.source };
      const cpl = entry.leads > 0 ? entry.spend / entry.leads : 0;
      return `
        <tr>
          <td>${entry.name}</td>
          <td>${source.label}</td>
          <td>${money(entry.spend)}</td>
          <td>${fmt(entry.leads)}</td>
          <td>${money(cpl)}</td>
          <td>${fmt(entry.qualified)}</td>
          <td>${entry.status}</td>
        </tr>
      `;
    })
    .join("");
}

function render() {
  createFilterButtons();
  const campaigns = getCampaignsFiltered();
  renderKpis(campaigns);
  renderSpendBreakdown(campaigns);
  renderTrendChart();
  renderSourceSections(campaigns);
  renderCampaignTable(campaigns);
}

render();
