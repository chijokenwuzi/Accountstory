const authGate = document.getElementById("authGate");
const appShell = document.getElementById("appShell");
const showLoginBtn = document.getElementById("showLogin");
const showRegisterBtn = document.getElementById("showRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");
const workspaceName = document.getElementById("workspaceName");
const logoutBtn = document.getElementById("logoutBtn");
const backBtn = document.getElementById("backBtn");
const searchInput = document.getElementById("companySearch");

const companyTabs = document.getElementById("companyTabs");
const companyResultMeta = document.getElementById("companyResultMeta");
const companyDetail = document.getElementById("companyDetail");

const accountTemplate = document.getElementById("accountTemplate");
const storiesTemplate = document.getElementById("storiesTemplate");
const storyDetailTemplate = document.getElementById("storyDetailTemplate");

const state = {
  token: localStorage.getItem("accountstory_token") || "",
  user: null,
  demoMode: false,
  companies: [],
  filteredCompanies: [],
  searchQuery: "",
  selectedCompanyId: null,
  storiesByCompany: {},
  customByCompany: {},
  demoNotes: {}
};

const DEMO_COMPANY_IDS = ["walmart", "amazon", "unitedhealth-group"];
const DEMO_MODE_STORAGE_KEY = "accountstory_demo_mode";

const DEMO_COMPANY_PROFILES = {
  walmart: {
    name: "Astera Retail Group",
    industry: "Retail Commerce",
    employees: "8,400",
    region: "North America",
    hq: "Chicago, Illinois",
    revenueUsdMillions: 1820,
    fortune500Rank2025: null,
    winLikelihood: "78%",
    accountContext:
      "Modern retail operator consolidating in-store, ecommerce, and fulfillment workflows into one revenue stack.",
    stakeholders: [
      { name: "Maya Chen", role: "Chief Revenue Officer (Economic Buyer)", influence: "High", stance: "Positive" },
      { name: "Liam Carter", role: "VP Demand Generation (Champion)", influence: "High", stance: "Positive" },
      { name: "Nina Brooks", role: "Head of RevOps", influence: "High", stance: "Neutral" },
      { name: "Rafael Ortiz", role: "Director of Marketing Analytics", influence: "Medium", stance: "Positive" },
      { name: "Priya Shah", role: "Director of Ecommerce", influence: "Medium", stance: "Neutral" },
      { name: "Daniel Park", role: "Procurement Lead", influence: "Low", stance: "Skeptical" }
    ],
    buyingProcess: [
      {
        phase: "Pipeline Gap Definition",
        owner: "VP Demand Generation",
        timeline: "Week 1",
        guess: "Team quantifies lead quality gaps by region and agrees on SQL targets before vendor evaluation."
      },
      {
        phase: "Channel Mix Test Plan",
        owner: "Head of RevOps",
        timeline: "Week 2-3",
        guess: "Runs a controlled split across paid search, paid social, and SEO content to validate CAC assumptions."
      },
      {
        phase: "Executive Forecast Review",
        owner: "Chief Revenue Officer",
        timeline: "Week 4",
        guess: "Economic buyer signs only after lead-to-revenue forecast matches quarterly plan confidence thresholds."
      },
      {
        phase: "Commercial Finalization",
        owner: "Procurement Lead",
        timeline: "Week 5-6",
        guess: "Contract closes with phased ramp pricing and a monthly performance governance cadence."
      }
    ],
    notes: [
      "Lead with SQL conversion lift, not raw lead volume.",
      "Tie budget model to seasonal demand swings and store promotions.",
      "Bring RevOps into every pricing and KPI conversation."
    ],
    engineeringOrg: {
      coreOrgs: [
        "Growth Engineering",
        "Commerce Platform Engineering",
        "Revenue Operations Systems"
      ],
      platformAndInfra: [
        "Attribution and analytics data pipelines",
        "Campaign workflow automation and QA tooling",
        "CDP integrations with CRM and lifecycle systems"
      ],
      engineeringDecisionPath: [
        "RevOps validates tracking architecture",
        "Growth leadership approves experimentation model",
        "Executive team signs forecast and rollout plan"
      ]
    },
    dataSources: ["Demo dataset: Astera board plan", "Demo dataset: Accountstory synthetic GTM profile"]
  },
  amazon: {
    name: "Beacon Freight Systems",
    industry: "Logistics Technology",
    employees: "5,900",
    region: "US + Canada",
    hq: "Dallas, Texas",
    revenueUsdMillions: 960,
    fortune500Rank2025: null,
    winLikelihood: "71%",
    accountContext:
      "Freight and brokerage platform scaling enterprise shipper acquisition while reducing cost per qualified lead.",
    stakeholders: [
      { name: "Harper Nguyen", role: "Chief Commercial Officer (Economic Buyer)", influence: "High", stance: "Positive" },
      { name: "Ethan Ross", role: "VP Growth Marketing (Champion)", influence: "High", stance: "Positive" },
      { name: "Olivia Diaz", role: "Head of Sales Operations", influence: "High", stance: "Neutral" },
      { name: "Noah Patel", role: "Performance Marketing Lead", influence: "Medium", stance: "Positive" },
      { name: "Avery Wilson", role: "Director of Product Marketing", influence: "Medium", stance: "Neutral" },
      { name: "Grace Kim", role: "Finance Controller", influence: "Low", stance: "Skeptical" }
    ],
    buyingProcess: [
      {
        phase: "Acquisition Baseline",
        owner: "Head of Sales Operations",
        timeline: "Week 1",
        guess: "Ops builds baseline by segment to identify where lead velocity is high but close rates lag."
      },
      {
        phase: "Pilot Channel Activation",
        owner: "VP Growth Marketing",
        timeline: "Week 2-4",
        guess: "Team launches two geo pilots with strict CPL and response-time guardrails for SDR handoff."
      },
      {
        phase: "Pipeline Quality Audit",
        owner: "Performance Marketing Lead",
        timeline: "Week 5",
        guess: "Audit checks keyword quality, creative-to-landing consistency, and lead scoring reliability."
      },
      {
        phase: "Budget Expansion Approval",
        owner: "Chief Commercial Officer",
        timeline: "Week 6",
        guess: "CCO approves full rollout once pilot cohorts show target CAC payback and stable SQL quality."
      }
    ],
    notes: [
      "Frame the plan around shipper acquisition speed and sales accept rate.",
      "Use regional pilot data to pre-answer finance risk questions.",
      "Prioritize fast CRM feedback loops for lead quality."
    ],
    engineeringOrg: {
      coreOrgs: [
        "Revenue Platform Engineering",
        "Marketing Data Engineering",
        "Lifecycle Automation Engineering"
      ],
      platformAndInfra: [
        "Lead routing services into CRM",
        "Attribution and spend data warehouse layer",
        "Ad platform connectors and monitoring"
      ],
      engineeringDecisionPath: [
        "Sales Ops + Marketing Ops confirm data trust",
        "Growth team validates campaign operations",
        "Commercial leadership approves scaling budgets"
      ]
    },
    dataSources: ["Demo dataset: Beacon GTM operating model", "Demo dataset: Synthetic freight sales cycle map"]
  },
  "unitedhealth-group": {
    name: "Cobalt Care Network",
    industry: "Healthcare Services",
    employees: "6,700",
    region: "United States",
    hq: "Nashville, Tennessee",
    revenueUsdMillions: 1245,
    fortune500Rank2025: null,
    winLikelihood: "82%",
    accountContext:
      "Multi-site care network focused on growing employer and patient programs with stricter compliance visibility.",
    stakeholders: [
      { name: "Sophia Bennett", role: "Chief Growth Officer (Economic Buyer)", influence: "High", stance: "Positive" },
      { name: "Mason Reed", role: "VP Marketing (Champion)", influence: "High", stance: "Positive" },
      { name: "Chloe Turner", role: "Director of Patient Acquisition", influence: "High", stance: "Neutral" },
      { name: "Isabella Hall", role: "Compliance Director", influence: "Medium", stance: "Skeptical" },
      { name: "James Foster", role: "Lifecycle Marketing Lead", influence: "Medium", stance: "Positive" },
      { name: "Elijah Cooper", role: "Procurement Manager", influence: "Low", stance: "Neutral" }
    ],
    buyingProcess: [
      {
        phase: "Compliance-Aligned Planning",
        owner: "Compliance Director",
        timeline: "Week 1-2",
        guess: "Campaign framework is reviewed for privacy language, claims requirements, and consent workflows."
      },
      {
        phase: "Audience + Offer Validation",
        owner: "Director of Patient Acquisition",
        timeline: "Week 3",
        guess: "Team tests message-market fit by employer segment and high-intent patient cohorts."
      },
      {
        phase: "Channel Allocation Sign-Off",
        owner: "VP Marketing",
        timeline: "Week 4",
        guess: "Approves budget splits by channel with lead quality thresholds for each service line."
      },
      {
        phase: "Executive Deployment Decision",
        owner: "Chief Growth Officer",
        timeline: "Week 5",
        guess: "Greenlight depends on forecasted appointment volume, conversion velocity, and compliance confidence."
      }
    ],
    notes: [
      "Lead with compliant growth narrative and audit readiness.",
      "Show forecast by service line, not one blended lead target.",
      "Include weekly quality reviews with Patient Acquisition leadership."
    ],
    engineeringOrg: {
      coreOrgs: [
        "Patient Growth Systems",
        "Clinical Operations Platform",
        "Enterprise Data and Integrations"
      ],
      platformAndInfra: [
        "HIPAA-safe data processing and analytics",
        "CRM + scheduling workflow integrations",
        "Attribution dashboards for channel and cohort outcomes"
      ],
      engineeringDecisionPath: [
        "Compliance validates controls and consent paths",
        "Growth operations confirms funnel instrumentation",
        "Executive team approves scale plan"
      ]
    },
    dataSources: ["Demo dataset: Cobalt clinical growth plan", "Demo dataset: Synthetic healthcare buying committee map"]
  }
};

const DEMO_STORIES = {
  walmart: [
    {
      id: "demo-astera-1",
      title: "Forecast-first kickoff won CRO support",
      stage: "Executive Discovery",
      outcome: "Won",
      author: "Riley Morgan",
      createdAt: "2026-01-06T17:20:00.000Z",
      story:
        "We opened with a lead-to-revenue forecast by region instead of channel tactics. That let the CRO align targets to quarterly revenue goals and fast-tracked the buying committee."
    },
    {
      id: "demo-astera-2",
      title: "RevOps workshop reduced handoff leakage",
      stage: "Pilot Validation",
      outcome: "Won",
      author: "Jordan Ellis",
      createdAt: "2026-01-14T14:00:00.000Z",
      story:
        "A joint workshop with RevOps rebuilt routing rules and SLA ownership. MQL-to-SQL leakage dropped in two weeks and unlocked budget expansion."
    },
    {
      id: "demo-astera-3",
      title: "Procurement objections neutralized early",
      stage: "Commercial Review",
      outcome: "Won",
      author: "Parker Lane",
      createdAt: "2026-01-22T19:40:00.000Z",
      story:
        "We pre-shared reporting cadence, KPI governance, and phased ramp terms before legal review. Procurement moved from skeptical to neutral and approved final terms."
    }
  ],
  amazon: [
    {
      id: "demo-beacon-1",
      title: "Geo pilot proved SQL quality, not just volume",
      stage: "Pilot Setup",
      outcome: "Won",
      author: "Casey Brooks",
      createdAt: "2026-01-07T16:10:00.000Z",
      story:
        "Instead of maximizing leads, we optimized for sales-accepted opportunities in two regions. Showing quality lift helped Commercial leadership approve full rollout."
    },
    {
      id: "demo-beacon-2",
      title: "Unified dashboard sped weekly decisions",
      stage: "Optimization",
      outcome: "Won",
      author: "Logan Rivera",
      createdAt: "2026-01-16T18:15:00.000Z",
      story:
        "We combined spend, funnel stages, and pipeline outcomes into one view for growth and sales ops. Weekly decisions moved from debate to action."
    },
    {
      id: "demo-beacon-3",
      title: "Finance approved after CAC payback model",
      stage: "Budget Approval",
      outcome: "Won",
      author: "Quinn Marshall",
      createdAt: "2026-01-24T13:30:00.000Z",
      story:
        "Finance challenged blended CAC assumptions. We delivered channel-level payback windows with conservative scenarios and secured approval in one review."
    }
  ],
  "unitedhealth-group": [
    {
      id: "demo-cobalt-1",
      title: "Compliance-first narrative prevented delays",
      stage: "Discovery",
      outcome: "Won",
      author: "Skyler James",
      createdAt: "2026-01-09T15:50:00.000Z",
      story:
        "The team expected compliance friction, so we led with approval workflows and consent controls. That removed major blockers before budget conversations."
    },
    {
      id: "demo-cobalt-2",
      title: "Service-line forecasting improved prioritization",
      stage: "Business Case",
      outcome: "Won",
      author: "Avery Monroe",
      createdAt: "2026-01-18T20:05:00.000Z",
      story:
        "Breaking forecast targets by service line clarified where marketing dollars should go first. Leadership aligned quickly and approved phased deployment."
    },
    {
      id: "demo-cobalt-3",
      title: "Cross-functional review accelerated launch",
      stage: "Final Approval",
      outcome: "Won",
      author: "Finley Adams",
      createdAt: "2026-01-26T12:25:00.000Z",
      story:
        "We ran one joint review with Growth, Compliance, and Ops leaders. Shared success criteria and reporting cadence made final approval straightforward."
    }
  ]
};

function cloneDemoStories(companyId) {
  return (DEMO_STORIES[companyId] || []).map((story) => ({ ...story }));
}

function applyDemoProfile(company) {
  const profile = DEMO_COMPANY_PROFILES[company.id];
  if (!profile) return company;
  return {
    ...company,
    ...profile,
    stakeholders: profile.stakeholders.map((entry) => ({ ...entry })),
    buyingProcess: profile.buyingProcess.map((entry) => ({ ...entry })),
    notes: [...profile.notes],
    engineeringOrg: {
      coreOrgs: [...profile.engineeringOrg.coreOrgs],
      platformAndInfra: [...profile.engineeringOrg.platformAndInfra],
      engineeringDecisionPath: [...profile.engineeringOrg.engineeringDecisionPath]
    },
    dataSources: [...profile.dataSources]
  };
}

const stanceClass = {
  Positive: "positive",
  Neutral: "neutral",
  Skeptical: "skeptical"
};

function setAuthMessage(message, isError = true) {
  authMessage.textContent = message;
  authMessage.className = isError ? "auth-message error" : "auth-message success";
}

function clearAuthMessage() {
  authMessage.textContent = "";
  authMessage.className = "auth-message";
}

function toggleAuthTab(mode) {
  const loginActive = mode === "login";
  showLoginBtn.classList.toggle("active", loginActive);
  showRegisterBtn.classList.toggle("active", !loginActive);
  loginForm.classList.toggle("hidden", !loginActive);
  registerForm.classList.toggle("hidden", loginActive);
  clearAuthMessage();
}

async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function parseRoute(pathname = window.location.pathname) {
  const storyDetailMatch = pathname.match(/^\/company\/([a-z0-9-]+)\/stories\/([^/]+)$/i);
  if (storyDetailMatch) {
    return {
      view: "story-detail",
      companyId: decodeURIComponent(storyDetailMatch[1]),
      storyId: decodeURIComponent(storyDetailMatch[2])
    };
  }

  const storiesMatch = pathname.match(/^\/company\/([a-z0-9-]+)\/stories$/i);
  if (storiesMatch) {
    return { view: "stories", companyId: decodeURIComponent(storiesMatch[1]), storyId: null };
  }

  const companyMatch = pathname.match(/^\/company\/([a-z0-9-]+)$/i);
  if (companyMatch) {
    return { view: "account", companyId: decodeURIComponent(companyMatch[1]), storyId: null };
  }

  return { view: "account", companyId: null, storyId: null };
}

function updateRoute(view, companyId, storyId, replace = false) {
  const encodedCompany = encodeURIComponent(companyId);
  let nextPath = `/company/${encodedCompany}`;

  if (view === "stories") {
    nextPath = `/company/${encodedCompany}/stories`;
  }

  if (view === "story-detail") {
    nextPath = `/company/${encodedCompany}/stories/${encodeURIComponent(storyId)}`;
  }

  if (replace) {
    window.history.replaceState({}, "", nextPath);
    return;
  }
  window.history.pushState({}, "", nextPath);
}

function persistSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("accountstory_token", token);
}

async function login(payload) {
  const result = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  persistSession(result.token, result.user);
}

async function register(payload) {
  const result = await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  persistSession(result.token, result.user);
}

async function hydrateSession() {
  if (!state.token) {
    return false;
  }

  try {
    const result = await apiFetch("/api/auth/me");
    state.user = result.user;
    return true;
  } catch {
    localStorage.removeItem("accountstory_token");
    state.token = "";
    state.user = null;
    return false;
  }
}

function shouldUseDemoMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("auth") === "1") {
    sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    return false;
  }
  if (params.get("demo") === "1") {
    sessionStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
    return true;
  }
  sessionStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
  return true;
}

function enableDemoMode() {
  state.demoMode = true;
  state.token = "";
  state.user = {
    id: "demo-user",
    name: "Demo User",
    email: "demo@accountstory.local",
    workspaceId: "demo-workspace",
    workspaceName: "Accountstory Demo"
  };
}

function showApp() {
  authGate.classList.add("hidden");
  appShell.classList.remove("hidden");
  workspaceName.textContent = state.user.workspaceName;
  if (state.demoMode) {
    logoutBtn.textContent = "Exit Demo";
    logoutBtn.title = "Exit demo mode";
  } else {
    logoutBtn.textContent = "Logout";
    logoutBtn.title = "";
  }
}

function showAuth() {
  appShell.classList.add("hidden");
  authGate.classList.remove("hidden");
}

function renderCompanyList() {
  if (!companyTabs) {
    return;
  }

  companyTabs.innerHTML = "";
  if (companyResultMeta) {
    companyResultMeta.textContent = `Showing ${state.filteredCompanies.length} of ${state.companies.length} accounts`;
  }
  if (!state.filteredCompanies.length) {
    companyTabs.innerHTML = '<p class="company-tabs-empty">No accounts match your search.</p>';
    return;
  }

  state.filteredCompanies.forEach((company) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = company.id === state.selectedCompanyId ? "company-tab active" : "company-tab";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", company.id === state.selectedCompanyId ? "true" : "false");
    button.dataset.companyId = company.id;
    button.textContent = company.name;
    companyTabs.appendChild(button);
  });
}

async function loadWorkspaceNote(companyId) {
  if (state.demoMode) {
    const entry = state.demoNotes[companyId] || { note: "", updatedAt: null };
    return { ...entry };
  }
  return apiFetch(`/api/workspaces/${state.user.workspaceId}/notes/${companyId}`);
}

async function saveWorkspaceNote(companyId, note) {
  if (state.demoMode) {
    const saved = { note: String(note || ""), updatedAt: new Date().toISOString() };
    state.demoNotes[companyId] = saved;
    return { ...saved };
  }
  return apiFetch(`/api/workspaces/${state.user.workspaceId}/notes/${companyId}`, {
    method: "PUT",
    body: JSON.stringify({ note })
  });
}

async function loadStories(companyId, force = false) {
  if (DEMO_STORIES[companyId]) {
    if (!Array.isArray(state.storiesByCompany[companyId])) {
      state.storiesByCompany[companyId] = cloneDemoStories(companyId);
    }
    return state.storiesByCompany[companyId];
  }

  if (!force && Array.isArray(state.storiesByCompany[companyId])) {
    return state.storiesByCompany[companyId];
  }
  const result = await apiFetch(`/api/companies/${companyId}/stories`);
  state.storiesByCompany[companyId] = result.stories;
  return result.stories;
}

async function loadCustomization(companyId, force = false) {
  if (state.demoMode) {
    if (!state.customByCompany[companyId]) {
      state.customByCompany[companyId] = { stakeholders: [], buyingProcess: [] };
    }
    return state.customByCompany[companyId];
  }

  if (!force && state.customByCompany[companyId]) {
    return state.customByCompany[companyId];
  }

  const result = await apiFetch(
    `/api/workspaces/${state.user.workspaceId}/companies/${companyId}/customization`
  );
  state.customByCompany[companyId] = result;
  return result;
}

async function addStakeholder(companyId, payload) {
  if (state.demoMode) {
    return {
      id: `demo-stakeholder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: payload.name,
      role: payload.role,
      influence: payload.influence,
      stance: payload.stance
    };
  }
  const result = await apiFetch(
    `/api/workspaces/${state.user.workspaceId}/companies/${companyId}/stakeholders`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
  return result.stakeholder;
}

async function addBuyingProcessStep(companyId, payload) {
  if (state.demoMode) {
    return {
      id: `demo-step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      phase: payload.phase,
      owner: payload.owner,
      timeline: payload.timeline,
      guess: payload.guess
    };
  }
  const result = await apiFetch(
    `/api/workspaces/${state.user.workspaceId}/companies/${companyId}/buying-process`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
  return result.step;
}

async function deleteStakeholder(companyId, stakeholderId) {
  if (state.demoMode) {
    return;
  }
  await apiFetch(
    `/api/workspaces/${state.user.workspaceId}/companies/${companyId}/stakeholders/${stakeholderId}`,
    { method: "DELETE" }
  );
}

async function deleteBuyingProcessStep(companyId, stepId) {
  if (state.demoMode) {
    return;
  }
  await apiFetch(
    `/api/workspaces/${state.user.workspaceId}/companies/${companyId}/buying-process/${stepId}`,
    { method: "DELETE" }
  );
}

function getInfluenceWeight(influence) {
  if (influence === "High") return 2;
  if (influence === "Medium") return 1.5;
  return 1;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderAccountMap(container, stakeholders, onDeleteStakeholder) {
  container.innerHTML = "";

  if (!stakeholders.length) {
    container.innerHTML = '<p class="empty-state">No stakeholders available.</p>';
    return;
  }

  const width = 1240;
  const height = 720;

  const mapSurface = document.createElement("div");
  mapSurface.className = "account-map-surface";
  mapSurface.style.setProperty("--map-width", `${width}px`);
  mapSurface.style.setProperty("--map-height", `${height}px`);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.classList.add("account-map-lines");

  const nodesLayer = document.createElement("div");
  nodesLayer.className = "account-map-nodes";

  const tierOrder = ["High", "Medium", "Low"];
  const tierY = {
    High: 160,
    Medium: 360,
    Low: 560
  };

  tierOrder.forEach((tier) => {
    const y = tierY[tier];
    const guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
    guide.setAttribute("x1", "70");
    guide.setAttribute("y1", String(y));
    guide.setAttribute("x2", String(width - 70));
    guide.setAttribute("y2", String(y));
    guide.classList.add("map-lane-guide");
    svg.appendChild(guide);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", "24");
    label.setAttribute("y", String(y + 5));
    label.classList.add("map-lane-label");
    label.textContent = tier;
    svg.appendChild(label);
  });

  const tiered = {
    High: [],
    Medium: [],
    Low: []
  };
  stakeholders.forEach((stakeholder) => {
    const tier = tierOrder.includes(stakeholder.influence) ? stakeholder.influence : "Low";
    tiered[tier].push(stakeholder);
  });

  for (const tier of tierOrder) {
    tiered[tier].sort((a, b) => {
      const aBuyer = a.role.toLowerCase().includes("economic buyer") ? 1 : 0;
      const bBuyer = b.role.toLowerCase().includes("economic buyer") ? 1 : 0;
      if (aBuyer !== bBuyer) return bBuyer - aBuyer;
      return a.name.localeCompare(b.name);
    });
  }

  function appendNode(stakeholder, x, y, isCenter = false) {
    const node = document.createElement("article");
    node.className = `map-node ${stanceClass[stakeholder.stance] || "neutral"} ${isCenter ? "center" : ""}`;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;

    node.innerHTML = `
      <h4>${escapeHtml(stakeholder.name)}</h4>
      <p>${escapeHtml(stakeholder.role)}</p>
      <div class="chip-row">
        <span class="chip">Influence: ${escapeHtml(stakeholder.influence)}</span>
        <span class="chip">Stance: ${escapeHtml(stakeholder.stance)}</span>
      </div>
    `;

    if (!isCenter && stakeholder._isCustom && stakeholder.id) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "mini-delete";
      deleteButton.textContent = "Delete";
      deleteButton.dataset.stakeholderId = stakeholder.id;
      node.appendChild(deleteButton);
    }

    nodesLayer.appendChild(node);
  }

  const positioned = [];

  function xPositions(count, padding) {
    if (count <= 1) return [width / 2];
    const span = width - padding * 2;
    const step = span / (count - 1);
    return Array.from({ length: count }, (_, index) => padding + step * index);
  }

  function chunkRows(list, size) {
    if (size <= 0) return [list];
    const chunks = [];
    for (let index = 0; index < list.length; index += size) {
      chunks.push(list.slice(index, index + size));
    }
    return chunks;
  }

  tierOrder.forEach((tier) => {
    const tierStakeholders = tiered[tier];
    const padding = 170;
    const maxPerRow = Math.max(1, Math.floor((width - padding * 2) / 220) + 1);
    const rows = chunkRows(tierStakeholders, maxPerRow);
    rows.forEach((rowStakeholders, rowIndex) => {
      const xs = xPositions(rowStakeholders.length, padding);
      const rowYOffset = (rowIndex - (rows.length - 1) / 2) * 88;
      rowStakeholders.forEach((stakeholder, index) => {
        positioned.push({
          stakeholder,
          tier,
          x: xs[index],
          y: tierY[tier] + rowYOffset
        });
      });
    });
  });

  const highTier = positioned.filter((entry) => entry.tier === "High");
  const highTierAnchor =
    highTier.find((entry) => entry.stakeholder.role.toLowerCase().includes("economic buyer")) || highTier[0] || null;

  function findParent(node) {
    if (node === highTierAnchor) return null;

    if (node.tier === "High") {
      return highTierAnchor;
    }

    const candidates =
      node.tier === "Low"
        ? positioned.filter((entry) => entry !== node && (entry.tier === "Medium" || entry.tier === "High"))
        : positioned.filter((entry) => entry !== node && entry.tier === "High");

    if (!candidates.length) return highTierAnchor;
    return candidates.reduce((closest, candidate) => {
      if (!closest) return candidate;
      return Math.abs(candidate.x - node.x) < Math.abs(closest.x - node.x) ? candidate : closest;
    }, null);
  }

  positioned.forEach((node) => {
    const parent = findParent(node);
    if (!parent) return;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", parent.x);
    line.setAttribute("y1", parent.y);
    line.setAttribute("x2", node.x);
    line.setAttribute("y2", node.y);
    line.setAttribute("stroke-width", String(getInfluenceWeight(node.stakeholder.influence)));
    line.classList.add("map-link");
    svg.appendChild(line);
  });

  positioned.forEach((node) => {
    const isCenter = node.stakeholder.role.toLowerCase().includes("economic buyer");
    appendNode(node.stakeholder, node.x, node.y, isCenter);
  });

  mapSurface.appendChild(svg);
  mapSurface.appendChild(nodesLayer);
  container.appendChild(mapSurface);

  if (typeof onDeleteStakeholder === "function") {
    nodesLayer.addEventListener("click", (event) => {
      const button = event.target.closest("button.mini-delete[data-stakeholder-id]");
      if (!button) return;
      onDeleteStakeholder(button.dataset.stakeholderId);
    });
  }
}

function storyCardMarkup(story, companyId, compact = false) {
  const shortBody = compact && story.story.length > 150 ? `${story.story.slice(0, 150)}...` : story.story;
  return `
    <article class="story-card" data-story-id="${escapeHtml(story.id)}" data-company-id="${escapeHtml(companyId)}">
      <div class="story-pill-row">
        <span class="story-pill">${escapeHtml(story.stage)}</span>
        <span class="story-pill outcome">${escapeHtml(story.outcome)}</span>
      </div>
      <h4>${escapeHtml(story.title)}</h4>
      <p>${escapeHtml(shortBody)}</p>
      <p class="story-meta-inline">${escapeHtml(story.author)} · ${new Date(story.createdAt).toLocaleDateString()}</p>
    </article>
  `;
}

function fillList(listElement, items) {
  listElement.innerHTML = "";
  if (!Array.isArray(items) || !items.length) {
    const li = document.createElement("li");
    li.textContent = "No data yet.";
    listElement.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    listElement.appendChild(li);
  });
}

function fillSourceList(listElement, items) {
  listElement.innerHTML = "";
  if (!Array.isArray(items) || !items.length) {
    const li = document.createElement("li");
    li.textContent = "No source links available.";
    listElement.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = item;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item;
    li.appendChild(link);
    listElement.appendChild(li);
  });
}

async function renderAccountView(companyId, replaceRoute = false) {
  const company = state.companies.find((entry) => entry.id === companyId);
  if (!company) {
    companyDetail.innerHTML = '<p class="empty-state">Company not found.</p>';
    return;
  }

  state.selectedCompanyId = companyId;
  renderCompanyList();
  updateRoute("account", companyId, null, replaceRoute);

  const fragment = accountTemplate.content.cloneNode(true);
  fragment.getElementById("detailName").textContent = company.name;
  const metaParts = [
    company.fortune500Rank2025 ? `Fortune 500 #${company.fortune500Rank2025}` : null,
    company.industry,
    company.employees ? `${company.employees} employees` : null,
    company.hq ? `HQ: ${company.hq}` : company.region,
    company.revenueUsdMillions ? `Revenue: $${company.revenueUsdMillions.toLocaleString()}M` : null
  ].filter(Boolean);
  fragment.getElementById("detailMeta").textContent = metaParts.join(" · ");
  fragment.getElementById("detailWinRate").textContent = company.winLikelihood;
  fragment.getElementById("accountContext").textContent = company.accountContext;

  let customization = { stakeholders: [], buyingProcess: [] };
  try {
    customization = await loadCustomization(companyId);
  } catch {
    // keep default empty customization
  }
  const effectiveStakeholders = [
    ...company.stakeholders.map((entry) => ({ ...entry, _isCustom: false })),
    ...(customization.stakeholders || []).map((entry) => ({ ...entry, _isCustom: true }))
  ];
  const effectiveBuyingProcess = [
    ...company.buyingProcess.map((entry) => ({ ...entry, _isCustom: false })),
    ...(customization.buyingProcess || []).map((entry) => ({ ...entry, _isCustom: true }))
  ];

  const processSteps = fragment.getElementById("processSteps");
  const engineeringCoreList = fragment.getElementById("engineeringCoreList");
  const engineeringPlatformList = fragment.getElementById("engineeringPlatformList");
  const engineeringDecisionList = fragment.getElementById("engineeringDecisionList");
  const sourceList = fragment.getElementById("sourceList");
  const engineeringOrg = company.engineeringOrg || {};
  fillList(engineeringCoreList, engineeringOrg.coreOrgs);
  fillList(engineeringPlatformList, engineeringOrg.platformAndInfra);
  fillList(engineeringDecisionList, engineeringOrg.engineeringDecisionPath);
  fillSourceList(sourceList, company.dataSources);

  effectiveBuyingProcess.forEach((step) => {
    const card = document.createElement("article");
    card.className = "step-card";
    card.innerHTML = `
      <p class="step-phase">${escapeHtml(step.phase)}</p>
      <p class="step-meta">${escapeHtml(step.owner)} · ${escapeHtml(step.timeline)}</p>
      <p>${escapeHtml(step.guess)}</p>
    `;
    if (step._isCustom && step.id) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "mini-delete";
      deleteButton.textContent = "Delete";
      deleteButton.dataset.stepId = step.id;
      card.appendChild(deleteButton);
    }
    processSteps.appendChild(card);
  });

  const salesNotes = fragment.getElementById("salesNotes");
  company.notes.forEach((note) => {
    const li = document.createElement("li");
    li.textContent = note;
    salesNotes.appendChild(li);
  });

  companyDetail.innerHTML = "";
  companyDetail.appendChild(fragment);

  const accountMap = document.getElementById("accountMap");
  renderAccountMap(accountMap, effectiveStakeholders, async (stakeholderId) => {
    stakeholderStatus.textContent = "Deleting stakeholder...";
    try {
      await deleteStakeholder(companyId, stakeholderId);
      if (state.customByCompany[companyId]) {
        state.customByCompany[companyId].stakeholders = state.customByCompany[companyId].stakeholders.filter(
          (entry) => entry.id !== stakeholderId
        );
      }
      stakeholderStatus.textContent = "Stakeholder deleted.";
      await renderAccountView(companyId, true);
    } catch (error) {
      stakeholderStatus.textContent = error.message;
    }
  });

  const stakeholderStatus = document.getElementById("stakeholderStatus");
  const processStatus = document.getElementById("processStatus");
  const addStakeholderForm = document.getElementById("addStakeholderForm");
  const addProcessForm = document.getElementById("addProcessForm");

  addStakeholderForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    stakeholderStatus.textContent = "Adding stakeholder...";
    const form = new FormData(addStakeholderForm);
    const name = String(form.get("name") || "").trim();
    const role = String(form.get("role") || "").trim();
    if (!name || !role) {
      stakeholderStatus.textContent = "Name and role are required.";
      return;
    }
    const payload = {
      name,
      role,
      influence: String(form.get("influence") || "Medium").trim() || "Medium",
      stance: String(form.get("stance") || "Neutral").trim() || "Neutral"
    };

    try {
      const stakeholder = await addStakeholder(companyId, payload);
      if (!state.customByCompany[companyId]) {
        state.customByCompany[companyId] = { stakeholders: [], buyingProcess: [] };
      }
      state.customByCompany[companyId].stakeholders.push(stakeholder);
      effectiveStakeholders.push({ ...stakeholder, _isCustom: true });
      stakeholderStatus.textContent = "Stakeholder added.";
      addStakeholderForm.reset();
      renderAccountMap(accountMap, effectiveStakeholders, async (stakeholderId) => {
        stakeholderStatus.textContent = "Deleting stakeholder...";
        try {
          await deleteStakeholder(companyId, stakeholderId);
          if (state.customByCompany[companyId]) {
            state.customByCompany[companyId].stakeholders = state.customByCompany[companyId].stakeholders.filter(
              (entry) => entry.id !== stakeholderId
            );
          }
          stakeholderStatus.textContent = "Stakeholder deleted.";
          await renderAccountView(companyId, true);
        } catch (error) {
          stakeholderStatus.textContent = error.message;
        }
      });
    } catch (error) {
      stakeholderStatus.textContent = error.message;
    }
  });

  addProcessForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    processStatus.textContent = "Adding process step...";
    const form = new FormData(addProcessForm);
    const phase = String(form.get("phase") || "").trim();
    if (!phase) {
      processStatus.textContent = "Step name is required.";
      return;
    }
    const payload = {
      phase,
      owner: String(form.get("owner") || "").trim() || "TBD",
      timeline: String(form.get("timeline") || "").trim() || "TBD",
      guess: String(form.get("guess") || "").trim() || "No additional details provided."
    };

    try {
      const step = await addBuyingProcessStep(companyId, payload);
      if (!state.customByCompany[companyId]) {
        state.customByCompany[companyId] = { stakeholders: [], buyingProcess: [] };
      }
      state.customByCompany[companyId].buyingProcess.push(step);
      processStatus.textContent = "Process step added.";
      addProcessForm.reset();

      const card = document.createElement("article");
      card.className = "step-card";
      card.innerHTML = `
        <p class="step-phase">${escapeHtml(step.phase)}</p>
        <p class="step-meta">${escapeHtml(step.owner)} · ${escapeHtml(step.timeline)}</p>
        <p>${escapeHtml(step.guess)}</p>
      `;
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "mini-delete";
      deleteButton.textContent = "Delete";
      deleteButton.dataset.stepId = step.id;
      card.appendChild(deleteButton);
      processSteps.appendChild(card);
    } catch (error) {
      processStatus.textContent = error.message;
    }
  });

  processSteps.addEventListener("click", async (event) => {
    const button = event.target.closest("button.mini-delete[data-step-id]");
    if (!button) return;

    processStatus.textContent = "Deleting process step...";
    try {
      await deleteBuyingProcessStep(companyId, button.dataset.stepId);
      if (state.customByCompany[companyId]) {
        state.customByCompany[companyId].buyingProcess = state.customByCompany[companyId].buyingProcess.filter(
          (entry) => entry.id !== button.dataset.stepId
        );
      }
      processStatus.textContent = "Process step deleted.";
      await renderAccountView(companyId, true);
    } catch (error) {
      processStatus.textContent = error.message;
    }
  });

  const noteField = document.getElementById("workspaceNote");
  const noteStatus = document.getElementById("workspaceNoteStatus");
  const saveButton = document.getElementById("saveWorkspaceNote");

  noteStatus.textContent = "Loading...";
  try {
    const noteResult = await loadWorkspaceNote(companyId);
    noteField.value = noteResult.note || "";
    noteStatus.textContent = noteResult.updatedAt
      ? `Last saved: ${new Date(noteResult.updatedAt).toLocaleString()}`
      : "No saved note yet";
  } catch {
    noteStatus.textContent = "Unable to load workspace note";
  }

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    noteStatus.textContent = "Saving...";
    try {
      const saved = await saveWorkspaceNote(companyId, noteField.value);
      noteStatus.textContent = `Last saved: ${new Date(saved.updatedAt).toLocaleString()}`;
    } catch (error) {
      noteStatus.textContent = error.message;
    } finally {
      saveButton.disabled = false;
    }
  });

  const previewContainer = document.getElementById("storyPreviewList");
  const viewStories = document.getElementById("viewStories");
  try {
    const stories = await loadStories(companyId);
    const topStories = stories.slice(0, 3);
    if (!topStories.length) {
      previewContainer.innerHTML = '<p class="empty-state">No stories yet. Add the first one.</p>';
    } else {
      previewContainer.innerHTML = topStories.map((story) => storyCardMarkup(story, companyId, true)).join("");
    }
  } catch {
    previewContainer.innerHTML = '<p class="empty-state">Unable to load stories.</p>';
  }

  previewContainer.addEventListener("click", (event) => {
    const card = event.target.closest(".story-card");
    if (!card) return;
    navigateToStoryDetail(companyId, card.dataset.storyId);
  });

  viewStories.addEventListener("click", () => {
    navigateToStories(companyId);
  });
}

async function renderStoriesView(companyId, replaceRoute = false) {
  const company = state.companies.find((entry) => entry.id === companyId);
  if (!company) {
    companyDetail.innerHTML = '<p class="empty-state">Company not found.</p>';
    return;
  }

  state.selectedCompanyId = companyId;
  renderCompanyList();
  updateRoute("stories", companyId, null, replaceRoute);

  const fragment = storiesTemplate.content.cloneNode(true);
  fragment.getElementById("storiesCompanyName").textContent = `${company.name} Stories`;

  companyDetail.innerHTML = "";
  companyDetail.appendChild(fragment);

  const backToAccount = document.getElementById("backToAccount");
  const addStoryForm = document.getElementById("addStoryForm");
  const storyFormStatus = document.getElementById("storyFormStatus");
  const companyStoriesList = document.getElementById("companyStoriesList");

  backToAccount.addEventListener("click", () => {
    navigateToAccount(companyId);
  });

  async function refreshStories() {
    try {
      const stories = await loadStories(companyId, true);
      if (!stories.length) {
        companyStoriesList.innerHTML = '<p class="empty-state">No stories yet for this account.</p>';
        return;
      }
      companyStoriesList.innerHTML = stories.map((story) => storyCardMarkup(story, companyId)).join("");
    } catch {
      companyStoriesList.innerHTML = '<p class="empty-state">Unable to load stories.</p>';
    }
  }

  await refreshStories();

  companyStoriesList.addEventListener("click", (event) => {
    const card = event.target.closest(".story-card");
    if (!card) return;
    navigateToStoryDetail(companyId, card.dataset.storyId);
  });

  addStoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    storyFormStatus.textContent = "Saving story...";

    const form = new FormData(addStoryForm);
    const payload = {
      title: String(form.get("title") || "").trim(),
      stage: String(form.get("stage") || "").trim(),
      outcome: String(form.get("outcome") || "").trim(),
      story: String(form.get("story") || "").trim()
    };

    try {
      if (DEMO_STORIES[companyId]) {
        if (!payload.title || !payload.stage || !payload.outcome || !payload.story) {
          throw new Error("title, stage, outcome, and story are required.");
        }
        const newStory = {
          id: `demo-user-${Date.now()}`,
          ...payload,
          author: state.user?.name || "Account Team",
          createdAt: new Date().toISOString()
        };
        if (!Array.isArray(state.storiesByCompany[companyId])) {
          state.storiesByCompany[companyId] = cloneDemoStories(companyId);
        }
        state.storiesByCompany[companyId].unshift(newStory);
        storyFormStatus.textContent = "Story saved.";
        addStoryForm.reset();
        await refreshStories();
        return;
      }

      await apiFetch(`/api/companies/${companyId}/stories`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      storyFormStatus.textContent = "Story saved.";
      addStoryForm.reset();
      await refreshStories();
    } catch (error) {
      storyFormStatus.textContent = error.message;
    }
  });
}

async function renderStoryDetailView(companyId, storyId, replaceRoute = false) {
  const company = state.companies.find((entry) => entry.id === companyId);
  if (!company) {
    companyDetail.innerHTML = '<p class="empty-state">Company not found.</p>';
    return;
  }

  state.selectedCompanyId = companyId;
  renderCompanyList();
  updateRoute("story-detail", companyId, storyId, replaceRoute);

  companyDetail.innerHTML = '<p class="empty-state">Loading story...</p>';

  try {
    const stories = await loadStories(companyId);
    const cachedStory = stories.find((entry) => entry.id === storyId);
    const story = cachedStory || (await apiFetch(`/api/companies/${companyId}/stories/${storyId}`)).story;
    const fragment = storyDetailTemplate.content.cloneNode(true);

    fragment.getElementById("storyTitle").textContent = story.title;
    fragment.getElementById("storyMeta").textContent = `${company.name} · ${story.stage} · ${story.outcome} · ${story.author} · ${new Date(story.createdAt).toLocaleString()}`;
    fragment.getElementById("storyBody").textContent = story.story;

    companyDetail.innerHTML = "";
    companyDetail.appendChild(fragment);

    document.getElementById("backToStories").addEventListener("click", () => {
      navigateToStories(companyId);
    });
  } catch {
    companyDetail.innerHTML = '<p class="empty-state">Story not found.</p>';
  }
}

async function filterCompanies(query = "", replaceRoute = false) {
  const lowered = String(query || "").trim().toLowerCase();
  state.searchQuery = lowered;
  state.filteredCompanies = state.companies.filter((company) => {
    if (!lowered) return true;
    return `${company.name} ${company.industry}`.toLowerCase().includes(lowered);
  });
  renderCompanyList();

  if (!state.filteredCompanies.length) {
    companyDetail.innerHTML = '<p class="empty-state">No accounts match your search.</p>';
    return;
  }

  if (!state.selectedCompanyId || !state.filteredCompanies.some((company) => company.id === state.selectedCompanyId)) {
    await renderAccountView(state.filteredCompanies[0].id, replaceRoute);
  }
}

async function routeToCurrentPath(replace = false) {
  if (!state.companies.length) {
    companyDetail.innerHTML = '<p class="empty-state">No companies loaded.</p>';
    return;
  }

  const route = parseRoute();
  const defaultCompany = state.companies[0];
  const company = state.companies.find((entry) => entry.id === route.companyId) || defaultCompany;

  if (route.view === "stories") {
    await renderStoriesView(company.id, replace);
    return;
  }

  if (route.view === "story-detail" && route.storyId) {
    await renderStoryDetailView(company.id, route.storyId, replace);
    return;
  }

  await renderAccountView(company.id, replace);
}

async function navigateToAccount(companyId) {
  await renderAccountView(companyId, false);
}

async function navigateToStories(companyId) {
  await renderStoriesView(companyId, false);
}

async function navigateToStoryDetail(companyId, storyId) {
  await renderStoryDetailView(companyId, storyId, false);
}

async function loadCompanies() {
  const result = await apiFetch("/api/companies");
  const byId = new Map(result.companies.map((company) => [company.id, company]));
  let demoCompanies = DEMO_COMPANY_IDS.map((id) => byId.get(id))
    .filter(Boolean)
    .map((company) => applyDemoProfile(company));
  if (!demoCompanies.length) {
    demoCompanies = result.companies.slice(0, 3).map((company) => applyDemoProfile(company));
  }
  state.companies = demoCompanies;
  state.filteredCompanies = [...state.companies];
  renderCompanyList();
  await routeToCurrentPath(true);
}

showLoginBtn.addEventListener("click", () => toggleAuthTab("login"));
showRegisterBtn.addEventListener("click", () => toggleAuthTab("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAuthMessage();

  const form = new FormData(loginForm);
  const payload = {
    email: String(form.get("email") || "").trim(),
    password: String(form.get("password") || "")
  };

  try {
    await login(payload);
    showApp();
    await loadCompanies();
  } catch (error) {
    setAuthMessage(error.message);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAuthMessage();

  const form = new FormData(registerForm);
  const payload = {
    name: String(form.get("name") || "").trim(),
    email: String(form.get("email") || "").trim(),
    password: String(form.get("password") || ""),
    workspaceName: String(form.get("workspaceName") || "").trim()
  };

  try {
    await register(payload);
    showApp();
    await loadCompanies();
  } catch (error) {
    setAuthMessage(error.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  if (state.demoMode) {
    sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    window.location.href = "/";
    return;
  }

  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // no-op
  }

  state.token = "";
  state.user = null;
  state.storiesByCompany = {};
  state.customByCompany = {};
  localStorage.removeItem("accountstory_token");
  showAuth();
  toggleAuthTab("login");
});

if (companyTabs) {
  companyTabs.addEventListener("click", async (event) => {
    const target = event.target.closest("button[data-company-id]");
    if (!target) {
      return;
    }
    await navigateToAccount(target.dataset.companyId);
  });
}

if (searchInput) {
  searchInput.addEventListener("input", async (event) => {
    await filterCompanies(event.target.value, true);
  });
}

window.addEventListener("popstate", async () => {
  await routeToCurrentPath(true);
});

backBtn.addEventListener("click", async () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  const fallbackCompany = state.selectedCompanyId || state.companies[0]?.id;
  if (fallbackCompany) {
    await navigateToAccount(fallbackCompany);
  }
});

(async function init() {
  toggleAuthTab("login");

  if (shouldUseDemoMode()) {
    enableDemoMode();
    showApp();
    await loadCompanies();
    return;
  }

  const hasSession = await hydrateSession();
  if (!hasSession) {
    showAuth();
    return;
  }

  showApp();
  await loadCompanies();
})();
