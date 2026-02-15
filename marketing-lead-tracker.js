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
      spend: 900,
      leads: 20,
      qualified: 9,
      status: "Active"
    },
    {
      name: "Service + City Search Expansion",
      source: "google-ads",
      spend: 480,
      leads: 12,
      qualified: 5,
      status: "Active"
    },
    {
      name: "Facebook Homeowner Lead Forms",
      source: "facebook-ads",
      spend: 620,
      leads: 15,
      qualified: 6,
      status: "Active"
    },
    {
      name: "Facebook Retargeting 30-Day",
      source: "facebook-ads",
      spend: 320,
      leads: 8,
      qualified: 3,
      status: "Paused"
    },
    {
      name: "Local Service Ads - Main Market",
      source: "local-services-ads",
      spend: 420,
      leads: 10,
      qualified: 5,
      status: "Active"
    },
    {
      name: "Local Service Ads - Neighbor Cities",
      source: "local-services-ads",
      spend: 180,
      leads: 5,
      qualified: 2,
      status: "Active"
    },
    {
      name: "SEO Service Page Cluster",
      source: "seo",
      spend: 50,
      leads: 1,
      qualified: 0,
      status: "Active"
    },
    {
      name: "SEO Local Map Pack Content",
      source: "seo",
      spend: 30,
      leads: 0,
      qualified: 0,
      status: "Active"
    }
  ],
  weekly: [
    {
      label: "Week 1",
      sources: {
        "google-ads": { spend: 180, leads: 4 },
        "facebook-ads": { spend: 130, leads: 3 },
        "local-services-ads": { spend: 90, leads: 2 },
        seo: { spend: 20, leads: 1 }
      }
    },
    {
      label: "Week 2",
      sources: {
        "google-ads": { spend: 220, leads: 5 },
        "facebook-ads": { spend: 150, leads: 4 },
        "local-services-ads": { spend: 100, leads: 3 },
        seo: { spend: 20, leads: 1 }
      }
    },
    {
      label: "Week 3",
      sources: {
        "google-ads": { spend: 250, leads: 5 },
        "facebook-ads": { spend: 160, leads: 4 },
        "local-services-ads": { spend: 110, leads: 3 },
        seo: { spend: 20, leads: 1 }
      }
    },
    {
      label: "Week 4",
      sources: {
        "google-ads": { spend: 260, leads: 6 },
        "facebook-ads": { spend: 180, leads: 4 },
        "local-services-ads": { spend: 120, leads: 3 },
        seo: { spend: 10, leads: 0 }
      }
    },
    {
      label: "Week 5",
      sources: {
        "google-ads": { spend: 240, leads: 5 },
        "facebook-ads": { spend: 170, leads: 4 },
        "local-services-ads": { spend: 100, leads: 2 },
        seo: { spend: 10, leads: 1 }
      }
    },
    {
      label: "Week 6",
      sources: {
        "google-ads": { spend: 230, leads: 5 },
        "facebook-ads": { spend: 150, leads: 3 },
        "local-services-ads": { spend: 80, leads: 2 },
        seo: { spend: 0, leads: 0 }
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
