// src/modules/assessments/shotsArticle.js (version 2.0)
// src/modules/assessments/shotsArticle.js

export const shotsInput = [
  { articleText: 'Nyt anlæg ved Esbjerg skal producere klimavenlig brint. Direktør Jens Hansen udtaler...' },
  { articleText: 'Aarstiderne, stiftet af Søren Ejlersen, er blevet solgt til en international fødevaregigant for et trecifret millionbeløb.' },
  { articleText: 'Many homeowners will see lower property taxes in 2025 and 2026' },
  { articleText: 'The Møller family has sold their shipping software company, NaviTech, for $500M.' },
  { articleText: 'Stellantis, the multinational car company, has reported that it stands to lose over 300 million kroner due to new US tariffs.' }, // NEW NEGATIVE EXAMPLE
  { articleText: 'The family-owned conglomerate USTC, owned by the Østergaard-Nielsen family, is disputing a multimillion-krone claim from the Nordic Waste bankruptcy trustee.' }, // NEW RICH LIST PROXIMITY EXAMPLE
  { articleText: 'CEO of family-owned Scandinavian tech firm, Anna Schmidt, sells for $120M' },
  { articleText: 'The Grundfos holding company, owned by the Due Jensen family, has announced a dividend of 300 million kroner to be distributed among family members.' },
  { articleText: 'Rockwool plans massive global expansions' },
];

export const shotsOutput = [
  // REFINED: Updated to new JSON structure with country
  JSON.stringify({
    country: 'Denmark',
    topic: 'Green hydrogen plant in Esbjerg',
    relevance_article: 10,
    assessment_article: 'Infrastructure project with no direct personal wealth transfer.',
    amount: 0,
    key_individuals: [],
    background: 'Public or corporate energy initiative.',
  }),
  // REFINED: Updated to new JSON structure with country and email inference
  JSON.stringify({
    country: 'Denmark',
    topic: 'Sale of Aarstiderne',
    relevance_article: 95,
    assessment_article: 'Clear private wealth event for Scandinavian founder.',
    amount: 150, // Assuming DKK millions -> USD
    key_individuals: [{
      "name": "Søren Ejlersen",
      "role_in_event": "Founder & Seller",
      "company": "Aarstiderne",
      "email_suggestion": "soren.ejlersen@aarstiderne.com"
    }],
    background: 'Sale of private Scandinavian company.',
  }),
  // REFINED: Updated to new JSON structure with country
  JSON.stringify({
    country: 'Denmark',
    topic: 'Property tax cuts for homeowners',
    relevance_article: 15,
    assessment_article: 'General tax relief is not a substantial direct wealth event.',
    amount: 0,
    key_individuals: [],
    background: 'Policy affecting many, not enriching individuals.',
  }),
  // REFINED: Updated to new JSON structure with country and email inference
  JSON.stringify({
    country: 'Denmark',
    topic: 'Sale of NaviTech',
    relevance_article: 100,
    assessment_article: 'Substantial wealth event clearly benefiting a Scandinavian family.',
    amount: 500,
    key_individuals: [{
      "name": "Møller family",
      "role_in_event": "Seller",
      "company": "NaviTech",
      "email_suggestion": "contact@navitech.com"
    }],
    background: 'Private business transaction.',
  }),
  // NEW: Output for the Stellantis negative example with country
  JSON.stringify({
    country: 'United States',
    topic: 'Tariff losses for Stellantis',
    relevance_article: 5,
    assessment_article: 'Irrelevant. Article describes financial losses for a foreign multinational corporation.',
    amount: -300,
    key_individuals: [],
    background: 'General automotive industry news.',
  }),
  // NEW: Output for the USTC Rich List Proximity example with country
  JSON.stringify({
    country: 'Denmark',
    topic: 'USTC legal dispute over Nordic Waste claim',
    relevance_article: 60,
    assessment_article: 'High relevance due to the involvement of a Rich List family (Østergaard-Nielsen/USTC) in a significant financial event.',
    amount: 0,
    key_individuals: [{
        "name": "Østergaard-Nielsen family",
        "role_in_event": "Owner",
        "company": "USTC",
        "email_suggestion": "contact@ustc.dk"
    }],
    background: 'Ongoing legal and financial issue for a major family holding company.',
  }),
  // REFINED: Updated to new JSON structure with country and email inference
  JSON.stringify({
    country: 'Denmark',
    topic: 'Sale of Scandinavian tech firm',
    relevance_article: 95,
    assessment_article: 'Substantial wealth event for private Scandinavian individual.',
    amount: 120,
    key_individuals: [{
      "name": "Anna Schmidt",
      "role_in_event": "CEO & Seller",
      "company": "Unknown Tech Firm",
      "email_suggestion": null
    }],
    background: 'Private tech company acquisition.',
  }),
  // REFINED: Updated to new JSON structure with country
  JSON.stringify({
    country: 'Denmark',
    topic: 'Grundfos family dividend',
    relevance_article: 95,
    assessment_article: 'Direct and substantial wealth transfer to a private Scandinavian family.',
    amount: 45, // 300M DKK -> USD
    key_individuals: [{
        "name": "Due Jensen family",
        "role_in_event": "Recipient",
        "company": "Grundfos",
        "email_suggestion": null
    }],
    background: 'Dividend from a family-owned holding company.',
  }),
  // REFINED: Updated to new JSON structure with country
  JSON.stringify({
    country: 'Denmark',
    topic: 'Rockwool global expansion',
    relevance_article: 10,
    assessment_article: 'Corporate strategy of a public company, no individual wealth generation.',
    amount: 0,
    key_individuals: [],
    background: 'Public company operations.',
  }),
];