// File: headlines_mongo/src/modules/assessments/shotsArticle.js

export const shotsInput = [
  { articleText: 'Nyt anlæg ved Esbjerg skal producere klimavenlig brint' },
  { articleText: 'Aarstiderne sold to giant' },
  {
    articleText:
      'Many homeowners will see lower property taxes in 2025 and 2026',
  },
  { articleText: 'Danish family sells company for $500M' },
  { articleText: 'Harald Nyborg billionaire establishes new discount chain' },
  {
    articleText:
      'New green energy plant in Esbjerg to produce climate-friendly hydrogen',
  },
  { articleText: 'Homeowners to receive tax relief in 2025' },
  { articleText: 'CEO of family-owned Danish tech firm sells for $120M' },
  { articleText: 'Danish logistics company IPO to benefit founder' },
  { articleText: 'Rockwool plans massive global expansions' },
  {
    articleText: 'Danish Crowns fyringsrunde er gået hårdt ud over hovedsædet',
  },
  { articleText: 'Boeing raises $19 billion to repay debts' },
  {
    articleText: 'Homeowners with excessive property tax bills may receive aid',
  },
  { articleText: 'Crisis-hit Boeing plans to raise billions to repay debt' },
  { articleText: 'Novo Nordisk Foundation profits from new obesity drug' },
  { articleText: 'Danish billionaire invests in U.S. tech startup' },
  { articleText: 'Maersk Group reports 30% revenue increase' },
  {
    articleText: 'Danish entrepreneur inherits $60 million from family estate',
  },
  { articleText: 'Foreign investor buys stake in Danish public company' },
];

// --- KEY FIX: All shot outputs for a JSON response must be a STRINGIFIED JSON object. ---
// The AI is trained to respond with a JSON object, so its "speech" in the few-shot examples
// must be a string that represents that JSON object.
export const shotsOutput = [
  JSON.stringify({
    topic: 'Green hydrogen plant in Esbjerg',
    relevance_article: 10,
    category: 0,
    assessment_article:
      'Infrastructure project with no direct personal wealth transfer.',
    amount: 0,
    contacts: [],
    background: 'Public or corporate energy initiative.',
  }),
  JSON.stringify({
    topic: 'Aarstiderne sold to giant',
    relevance_article: 95,
    category: 1,
    assessment_article: 'Clear private wealth event for Danish founders.',
    amount: 100,
    contacts: ['Søren Ejlersen'],
    background: 'Sale of private Danish company.',
  }),
  JSON.stringify({
    topic: 'Property tax cuts for homeowners',
    relevance_article: 20,
    category: 0,
    assessment_article: 'Tax relief is not a substantial direct wealth event.',
    amount: 0,
    contacts: [],
    background: 'Policy affecting many, not enriching individuals.',
  }),
  JSON.stringify({
    topic: 'Danish family sells company for $500M',
    relevance_article: 100,
    category: 1,
    assessment_article:
      'Substantial wealth event clearly benefiting a Danish family.',
    amount: 500,
    contacts: ['Family Name'],
    background: 'Private business transaction.',
  }),
  JSON.stringify({
    topic: 'Billionaire starts new chain',
    relevance_article: 40,
    category: 0,
    assessment_article:
      'No confirmed wealth transfer; potential future impact.',
    amount: 0,
    contacts: [],
    background: 'New business launch.',
  }),
  JSON.stringify({
    topic: 'Esbjerg green energy plant',
    relevance_article: 10,
    category: 0,
    assessment_article: 'Corporate project, no direct benefit to individuals.',
    amount: 0,
    contacts: [],
    background: 'Energy infrastructure development.',
  }),
  JSON.stringify({
    topic: 'Homeowner tax relief in 2025',
    relevance_article: 20,
    category: 0,
    assessment_article: 'Public policy benefit, not a personal wealth event.',
    amount: 0,
    contacts: [],
    background: 'Government fiscal policy.',
  }),
  JSON.stringify({
    topic: 'Tech CEO sells firm for $120M',
    relevance_article: 95,
    category: 1,
    assessment_article:
      'Substantial wealth event for private Danish individual.',
    amount: 120,
    contacts: ['CEO Name'],
    background: 'Private tech company acquisition.',
  }),
  JSON.stringify({
    topic: 'IPO benefits Danish logistics founder',
    relevance_article: 90,
    category: 1,
    assessment_article: 'Clear private wealth generation through IPO.',
    amount: 150,
    contacts: ['Founder Name'],
    background: 'Public offering of private firm.',
  }),
  JSON.stringify({
    topic: 'Rockwool global expansion',
    relevance_article: 10,
    category: 0,
    assessment_article: 'Corporate strategy, no individual wealth generation.',
    amount: 0,
    contacts: [],
    background: 'Public company operations.',
  }),
  JSON.stringify({
    topic: 'Danish Crown layoffs',
    relevance_article: 0,
    category: 0,
    assessment_article: 'No wealth event present.',
    amount: 0,
    contacts: [],
    background: 'Workforce reduction.',
  }),
  JSON.stringify({
    topic: 'Boeing debt fundraising',
    relevance_article: 0,
    category: 0,
    assessment_article:
      'Foreign financial activity irrelevant to Danish private wealth.',
    amount: 0,
    contacts: [],
    background: 'U.S. corporate strategy.',
  }),
  JSON.stringify({
    topic: 'Aid for property tax overpayments',
    relevance_article: 15,
    category: 0,
    assessment_article:
      'Financial support, not substantial private wealth transfer.',
    amount: 0,
    contacts: [],
    background: 'Public compensation mechanism.',
  }),
  JSON.stringify({
    topic: 'Crisis-hit Boeing raises capital',
    relevance_article: 0,
    category: 0,
    assessment_article: 'Foreign corporate debt issue, not relevant.',
    amount: 0,
    contacts: [],
    background: 'Financial maneuver by U.S. company.',
  }),
  JSON.stringify({
    topic: 'Novo Nordisk Foundation profits',
    relevance_article: 10,
    category: 0,
    assessment_article:
      'Institutional profit, no personal Danish wealth event.',
    amount: 0,
    contacts: [],
    background: 'Public foundation income.',
  }),
  JSON.stringify({
    topic: 'Danish billionaire invests abroad',
    relevance_article: 20,
    category: 0,
    assessment_article: 'Investment activity without clear wealth increase.',
    amount: 0,
    contacts: [],
    background: 'Cross-border financial move.',
  }),
  JSON.stringify({
    topic: 'Maersk revenue up 30%',
    relevance_article: 5,
    category: 0,
    assessment_article:
      'Corporate earnings report, not a private wealth event.',
    amount: 0,
    contacts: [],
    background: 'Listed company performance.',
  }),
  JSON.stringify({
    topic: 'Danish entrepreneur inherits $60M',
    relevance_article: 95,
    category: 1,
    assessment_article: 'Direct substantial wealth transfer via inheritance.',
    amount: 60,
    contacts: ['Entrepreneur Name'],
    background: 'Family wealth transition.',
  }),
  JSON.stringify({
    topic: 'Foreign investor buys Danish shares',
    relevance_article: 10,
    category: 0,
    assessment_article: 'No direct benefit to Danish individuals.',
    amount: 0,
    contacts: [],
    background: 'Public market transaction.',
  }),
];
