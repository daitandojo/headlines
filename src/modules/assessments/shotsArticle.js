export const shotsInput = [
  { articleText: "Nyt anlæg ved Esbjerg skal producere klimavenlig brint"},
  { articleText: "Aarstiderne sold to giant" },
  { articleText: "Many homeowners will see lower property taxes in 2025 and 2026" },
  { articleText: "Danish family sells company for $500M" },
  { articleText: "Harald Nyborg billionaire establishes new discount chain" },
  { articleText: "New green energy plant in Esbjerg to produce climate-friendly hydrogen" },
  { articleText: "Homeowners to receive tax relief in 2025" },
  { articleText: "CEO of family-owned Danish tech firm sells for $120M" },
  { articleText: "Danish logistics company IPO to benefit founder" },
  { articleText: "Rockwool plans massive global expansions" },
  { articleText: "Boeing raises $19 billion to repay debts" },
  { articleText: "Homeowners with excessive property tax bills may receive aid" },
  { articleText: "Crisis-hit Boeing plans to raise billions to repay debt" },
  { articleText: "Novo Nordisk Foundation profits from new obesity drug" },
  { articleText: "Danish billionaire invests in U.S. tech startup" },
  { articleText: "Maersk Group reports 30% revenue increase" },
  { articleText: "Danish entrepreneur inherits $60 million from family estate" },
  { articleText: "Foreign investor buys stake in Danish public company" }
];

export const shotsOutput = [
  {
    "topic": "New plant in Esbjerg to produce climate-friendly hydrogen",
    "relevance_article": 30,
    "category": 0,
    "assessment_article": "Large-scale energy project with economic impact but no direct wealth transfer to private individuals.",
    "amount": 0,
    "contacts": [],
    "background": "Corporate or public infrastructure project."
  },
  {
    "topic": "Aarstiderne sold to giant",
    "relevance_article": 95,
    "category": 1,
    "assessment_article": "Substantial wealth event for Danish founders due to company sale.",
    "amount": 100, // Specify actual amount if known
    "contacts": ["Søren Ejlersen"],
    "background": "Sale of Danish company."
  },
  {
    "topic": "Many homeowners will see lower property taxes in 2025 and 2026",
    "relevance_article": 20,
    "category": 0,
    "assessment_article": "Tax reform benefits homeowners but does not result in direct, substantial wealth transfer.",
    "amount": 0,
    "contacts": [],
    "background": "Policy change affecting taxes."
  },
  {
    "topic": "Danish family sells company for $500M",
    "relevance_article": 100,
    "category": 1,
    "assessment_article": "Clear private wealth generation for Danish family.",
    "amount": 500,
    "contacts": ["Family Name"],
    "background": "Family-owned business sale."
  },
  {
    "topic": "Harald Nyborg billionaire establishes new discount chain",
    "relevance_article": 40,
    "category": 0,
    "assessment_article": "Business expansion with potential future wealth but no immediate substantial wealth transfer.",
    "amount": 0,
    "contacts": [],
    "background": "New business venture."
  },
  {
    "topic": "New green energy plant in Esbjerg to produce climate-friendly hydrogen",
    "relevance_article": 80,
    "category": 1,
    "assessment_article": "Potential significant wealth generation if private individuals are direct beneficiaries.",
    "amount": 0, // Specify actual amount if known
    "contacts": [],
    "background": "Large-scale energy project."
  },
  {
    "topic": "Homeowners to receive tax relief in 2025",
    "relevance_article": 20,
    "category": 0,
    "assessment_article": "Tax relief provides financial benefit but not a direct, substantial wealth transfer.",
    "amount": 0,
    "contacts": [],
    "background": "Policy change affecting homeowners."
  },
  {
    "topic": "CEO of family-owned Danish tech firm sells for $120M",
    "relevance_article": 95,
    "category": 1,
    "assessment_article": "Direct wealth event benefiting a private individual.",
    "amount": 120,
    "contacts": ["CEO Name"],
    "background": "Sale of privately held tech firm."
  },
  {
    "topic": "Danish logistics company IPO to benefit founder",
    "relevance_article": 90,
    "category": 1,
    "assessment_article": "Substantial private wealth generation from IPO.",
    "amount": 150, // Specify actual amount if known
    "contacts": ["Founder Name"],
    "background": "IPO of privately owned company."
  },
  {
    "topic": "Rockwool plans massive global expansions",
    "relevance_article": 10,
    "category": 0,
    "assessment_article": "Corporate expansion, no private wealth generation for Danish individuals.",
    "amount": 0,
    "contacts": [],
    "background": "Public company activity."
  },
  {
    "topic": "Boeing raises $19 billion to repay debts",
    "relevance_article": 0,
    "category": 0,
    "assessment_article": "Foreign company fundraising, not relevant to Danish private wealth.",
    "amount": 0,
    "contacts": [],
    "background": "Foreign corporate activity."
  },
  {
    "topic": "Homeowners with excessive property tax bills may receive aid",
    "relevance_article": 15,
    "category": 0,
    "assessment_article": "Tax relief efforts, no substantial private wealth generation.",
    "amount": 0,
    "contacts": [],
    "background": "Government assistance program."
  },
  {
    "topic": "Crisis-hit Boeing plans to raise billions to repay debt",
    "relevance_article": 0,
    "category": 0,
    "assessment_article": "Foreign corporate debt repayment, no relevance to Danish private wealth.",
    "amount": 0,
    "contacts": [],
    "background": "Foreign company financial strategy."
  },
  {
    "topic": "Novo Nordisk Foundation profits from new obesity drug",
    "relevance_article": 10,
    "category": 0,
    "assessment_article": "Foundation profits, but not a direct wealth event for private individuals.",
    "amount": 0,
    "contacts": [],
    "background": "Public foundation earnings."
  },
  {
    "topic": "Danish billionaire invests in U.S. tech startup",
    "relevance_article": 20,
    "category": 0,
    "assessment_article": "Investment activity, no direct wealth generation.",
    "amount": 0,
    "contacts": [],
    "background": "Cross-border investment."
  },
  {
    "topic": "Maersk Group reports 30% revenue increase",
    "relevance_article": 5,
    "category": 0,
    "assessment_article": "General corporate revenue, no private wealth generation.",
    "amount": 0,
    "contacts": [],
    "background": "Public company performance."
  },
  {
    "topic": "Danish entrepreneur inherits $60 million from family estate",
    "relevance_article": 95,
    "category": 1,
    "assessment_article": "Direct substantial wealth transfer through inheritance.",
    "amount": 60,
    "contacts": ["Entrepreneur Name"],
    "background": "Private individual receiving inheritance."
  },
  {
    "topic": "Foreign investor buys stake in Danish public company",
    "relevance_article": 10,
    "category": 0,
    "assessment_article": "Foreign investment in public company, no direct private wealth for Danish individuals.",
    "amount": 0,
    "contacts": [],
    "background": "Public company stock transaction."
  }
];
