const companies = [
  {
    id: "northstar-health",
    name: "Northstar Health",
    industry: "Healthcare",
    employees: "3,200",
    region: "US + Canada",
    winLikelihood: "68%",
    accountContext:
      "Fast-growing healthcare provider standardizing intake and patient engagement across 24 clinics.",
    stakeholders: [
      { name: "CIO", role: "Economic Buyer", influence: "High", stance: "Skeptical" },
      { name: "VP Operations", role: "Champion", influence: "High", stance: "Positive" },
      { name: "IT Security Lead", role: "Blocker Risk", influence: "Medium", stance: "Neutral" },
      { name: "Director of RevOps", role: "Evaluator", influence: "Medium", stance: "Positive" },
      { name: "Procurement Manager", role: "Approver", influence: "Medium", stance: "Neutral" }
    ],
    buyingProcess: [
      {
        phase: "Pain Discovery",
        owner: "VP Operations",
        timeline: "Week 1-2",
        guess: "Buying process likely starts with operations proving current intake delays hurt revenue and patient satisfaction."
      },
      {
        phase: "Technical Evaluation",
        owner: "IT Security Lead",
        timeline: "Week 3-4",
        guess: "Security and integration fit become go/no-go criteria, especially HIPAA controls and EHR integrations."
      },
      {
        phase: "Business Case",
        owner: "Director of RevOps",
        timeline: "Week 5",
        guess: "Champion prepares ROI model tied to reduced no-show rate and faster patient onboarding."
      },
      {
        phase: "Budget + Procurement",
        owner: "CIO + Procurement",
        timeline: "Week 6-8",
        guess: "Final decision likely depends on a pricing structure aligned to clinic rollouts."
      }
    ],
    notes: [
      "Lead with operational outcomes, not feature depth.",
      "Provide security package early to avoid late-stage stall.",
      "Offer a pilot in two flagship clinics."
    ]
  },
  {
    id: "horizon-logistics",
    name: "Horizon Logistics",
    industry: "Transportation",
    employees: "8,600",
    region: "North America",
    winLikelihood: "54%",
    accountContext:
      "Regional logistics network trying to reduce carrier churn and automate broker workflows.",
    stakeholders: [
      { name: "COO", role: "Economic Buyer", influence: "High", stance: "Neutral" },
      { name: "Head of Brokerage", role: "Champion", influence: "High", stance: "Positive" },
      { name: "CFO", role: "Approver", influence: "High", stance: "Skeptical" },
      { name: "Data Platform Lead", role: "Evaluator", influence: "Medium", stance: "Positive" },
      { name: "Procurement Analyst", role: "Approver", influence: "Low", stance: "Neutral" }
    ],
    buyingProcess: [
      {
        phase: "Problem Framing",
        owner: "Head of Brokerage",
        timeline: "Week 1",
        guess: "Team aligns on churn and margin leakage, then compares in-house vs vendor options."
      },
      {
        phase: "Pilot Scope",
        owner: "Data Platform Lead",
        timeline: "Week 2-3",
        guess: "Likely asks for 30-day pilot on one region with clear KPI targets."
      },
      {
        phase: "Finance Review",
        owner: "CFO",
        timeline: "Week 4-5",
        guess: "CFO will pressure-test assumptions on cost per load and implementation overhead."
      },
      {
        phase: "Contracting",
        owner: "COO + Procurement",
        timeline: "Week 6",
        guess: "Deal closes if there is flexibility on annual volume tiers and SLA penalties."
      }
    ],
    notes: [
      "Show logistics-specific benchmark data in deck.",
      "Prepare objection handling for finance scrutiny.",
      "Frame rollout by region to de-risk adoption."
    ]
  },
  {
    id: "silverline-fintech",
    name: "Silverline Fintech",
    industry: "Financial Services",
    employees: "1,150",
    region: "US",
    winLikelihood: "73%",
    accountContext:
      "Digital-first lender scaling SMB underwriting and looking to improve speed without sacrificing compliance.",
    stakeholders: [
      { name: "Chief Risk Officer", role: "Economic Buyer", influence: "High", stance: "Positive" },
      { name: "VP Product", role: "Champion", influence: "High", stance: "Positive" },
      { name: "Compliance Director", role: "Blocker Risk", influence: "High", stance: "Neutral" },
      { name: "Engineering Manager", role: "Evaluator", influence: "Medium", stance: "Positive" },
      { name: "Legal Counsel", role: "Approver", influence: "Medium", stance: "Neutral" }
    ],
    buyingProcess: [
      {
        phase: "Internal Alignment",
        owner: "VP Product",
        timeline: "Week 1",
        guess: "Product and risk align on desired approval speed while preserving audit requirements."
      },
      {
        phase: "Compliance Validation",
        owner: "Compliance Director",
        timeline: "Week 2-3",
        guess: "Compliance team requests detailed controls, model explainability, and policy mapping."
      },
      {
        phase: "Executive Demo",
        owner: "Chief Risk Officer",
        timeline: "Week 4",
        guess: "CRO signs off only if demo proves risk controls and clear override workflows."
      },
      {
        phase: "Legal + Procurement",
        owner: "Legal Counsel",
        timeline: "Week 5-6",
        guess: "Negotiation will focus on data residency, liability caps, and response SLAs."
      }
    ],
    notes: [
      "Lead with risk controls and auditability.",
      "Include legal redline playbook in advance.",
      "Position phased release for underwriting queues."
    ]
  }
];
