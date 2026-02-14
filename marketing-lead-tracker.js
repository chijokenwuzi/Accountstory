const SOURCE_META = {
  "google-ads": { label: "Google Ads", color: "#7ea5ff" },
  "twitter-ads": { label: "Twitter Ads", color: "#72c6ff" },
  "tiktok-ads": { label: "TikTok Ads", color: "#7fe0c4" },
  seo: { label: "SEO", color: "#9ad87d" }
};

const TRACKER_DATA = {
  campaigns: [
    {
      name: "Search - High Intent US",
      source: "google-ads",
      spend: 12400,
      leads: 78,
      qualified: 41,
      status: "Active"
    },
    {
      name: "Brand Terms Expansion",
      source: "google-ads",
      spend: 5400,
      leads: 39,
      qualified: 23,
      status: "Active"
    },
    {
      name: "Twitter Founder Funnel",
      source: "twitter-ads",
      spend: 7200,
      leads: 56,
      qualified: 30,
      status: "Active"
    },
    {
      name: "Twitter Retargeting 30D",
      source: "twitter-ads",
      spend: 3600,
      leads: 24,
      qualified: 13,
      status: "Paused"
    },
    {
      name: "TikTok Creative Test Batch 4",
      source: "tiktok-ads",
      spend: 8200,
      leads: 92,
      qualified: 38,
      status: "Active"
    },
    {
      name: "TikTok UGC Retargeting",
      source: "tiktok-ads",
      spend: 4100,
      leads: 44,
      qualified: 19,
      status: "Active"
    },
    {
      name: "SEO Pillar + Cluster Sprint",
      source: "seo",
      spend: 6600,
      leads: 64,
      qualified: 28,
      status: "Active"
    },
    {
      name: "SEO Comparison Page Refresh",
      source: "seo",
      spend: 2200,
      leads: 19,
      qualified: 9,
      status: "Active"
    }
  ],
  weekly: [
    {
      label: "Week 1",
      sources: {
        "google-ads": { spend: 2600, leads: 17 },
        "twitter-ads": { spend: 1700, leads: 12 },
        "tiktok-ads": { spend: 1900, leads: 19 },
        seo: { spend: 1200, leads: 10 }
      }
    },
    {
      label: "Week 2",
      sources: {
        "google-ads": { spend: 2800, leads: 19 },
        "twitter-ads": { spend: 1800, leads: 13 },
        "tiktok-ads": { spend: 2100, leads: 21 },
        seo: { spend: 1300, leads: 11 }
      }
    },
    {
      label: "Week 3",
      sources: {
        "google-ads": { spend: 3000, leads: 20 },
        "twitter-ads": { spend: 1900, leads: 14 },
        "tiktok-ads": { spend: 2300, leads: 24 },
        seo: { spend: 1400, leads: 12 }
      }
    },
    {
      label: "Week 4",
      sources: {
        "google-ads": { spend: 3200, leads: 22 },
        "twitter-ads": { spend: 2000, leads: 15 },
        "tiktok-ads": { spend: 2400, leads: 25 },
        seo: { spend: 1500, leads: 12 }
      }
    },
    {
      label: "Week 5",
      sources: {
        "google-ads": { spend: 3100, leads: 21 },
        "twitter-ads": { spend: 1900, leads: 14 },
        "tiktok-ads": { spend: 2300, leads: 23 },
        seo: { spend: 1700, leads: 13 }
      }
    },
    {
      label: "Week 6",
      sources: {
        "google-ads": { spend: 3100, leads: 18 },
        "twitter-ads": { spend: 1500, leads: 12 },
        "tiktok-ads": { spend: 1300, leads: 24 },
        seo: { spend: 1700, leads: 12 }
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
const ESTIMATED_PIPELINE_PER_QUALIFIED_LEAD = 8500;

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
  const estimatedPipeline = totals.qualified * ESTIMATED_PIPELINE_PER_QUALIFIED_LEAD;
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
      <p>Qualified Rate</p>
      <strong>${totals.qualificationRate.toFixed(1)}%</strong>
    </article>
    <article class="tracker-kpi-card">
      <p>Estimated Pipeline</p>
      <strong>${money(estimatedPipeline)}</strong>
      <p class="tracker-kpi-sub">Assumption: ${money(
        ESTIMATED_PIPELINE_PER_QUALIFIED_LEAD
      )} pipeline value per qualified lead</p>
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
