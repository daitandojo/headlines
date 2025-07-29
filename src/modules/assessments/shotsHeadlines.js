// src/modules/assessments/shotsHeadlines.js
export const shotsInput = [
  // --- This set is unchanged but assessments are refined for consistency ---
  [
    'Rockwool står foran massive udvidelser over hele kloden',
    'Boeing henter 145 mia. kr.',
    'Boligejere med for stor grundskyldsregning har udsigt til hjælp',
    'Kriseramte Boeing vil rejse milliarder for at tilbagebetale gæld',
    'Aarstiderne solgt til gigant',
    'Scandinavian family sells company for $500M',
  ].join('\n- '),

  // --- This set is unchanged but assessments are refined for consistency ---
  [
    'Local football match results',
    'New Scandinavian tech startup launched',
    'Vestas CEO buys shares',
    'Vestas CEO sells significant shares',
    'Maersk heir sells estate in Copenhagen',
    'Scandinavian lottery winner claims prize',
  ].join('\n- '),

  // --- This set is unchanged but assessments are refined for consistency ---
  [
    'A.P. Moller Foundation donates $100 million to charity',
    'LEGO family (KIRKBI A/S) in acquisition talks for rival toy company for DKK 5 billion',
    'Danfoss heir (Bitten & Mads Clausen Foundation) announces succession plan for family business leadership',
    'Widex and Demant plan to merge operations',
    'Novo Nordisk (public company) announces stock split',
    '3Shape (privately owned) is working on an IPO',
  ].join('\n- '),

  // --- NEW: This set explicitly teaches the rules from your feedback ---
  [
    'Nå|Spår milliard-smell fra toll', // Stellantis example
    'Familieejet koncern bestrider millionkrav efter Nordic Waste', // USTC example
    'Fynske bankers fusionsplaner skydes ned af storaktionær' // Public bank merger
  ].join('\n- '),

  // --- This set is refined to better teach Rich List Proximity ---
  [
    'Grundfos owner (Poul Due Jensen Foundation) announces DKK 300 million dividend distribution to family members',
    'Bestseller owner Anders Holch Povlsen personally acquires Scottish estate for DKK 150 million',
    "Martin Thorborg's AI Startup Secures Funding",
    'Martin Thorborg giver et foredrag om iværksætteri' // Example of non-relevant Rich List news
  ].join('\n- '),
];

export const shotsOutput = [
  JSON.stringify({
    assessment: [
      {
        relevance_headline: 10,
        assessment_headline:
          'Corporate expansion (Rockwool is public), no direct private wealth generation for Scandinavian individuals.',
      },
      {
        relevance_headline: 0,
        assessment_headline:
          'Foreign corporate activity, no relevance to Scandinavian private wealth.',
      },
      {
        relevance_headline: 15, // Refined score
        assessment_headline:
          'Tax relief provides benefit, but not a substantial direct wealth transfer.',
      },
      {
        relevance_headline: 0,
        assessment_headline:
          'Foreign corporate debt repayment, no relevance to Scandinavian private wealth.',
      },
      {
        relevance_headline: 95,
        assessment_headline:
          'Acquisition likely results in substantial wealth for Scandinavian founders/owners.',
      },
      {
        relevance_headline: 100,
        assessment_headline:
          'Clear substantial private wealth event for Scandinavian family.',
      },
    ],
  }),
  JSON.stringify({
    assessment: [
      { relevance_headline: 0, assessment_headline: 'Not a wealth event.' },
      {
        relevance_headline: 10,
        assessment_headline:
          'New company, no immediate substantial wealth transfer.',
      },
      {
        relevance_headline: 5,
        assessment_headline:
          'Public market activity by an individual, not a substantial private wealth generation event.',
      },
      {
        relevance_headline: 30,
        assessment_headline:
          'Share sale by individual, possibly some personal gain, but unlikely to be a major liquidity event based on headline alone.',
      },
      {
        relevance_headline: 95,
        assessment_headline:
          "Clear wealth event (>$30M implied by 'Maersk heir' and 'estate in Copenhagen') benefiting Scandinavian private individual.",
      },
      {
        relevance_headline: 40, // Refined score
        assessment_headline:
          'Private wealth event, but likely below significance threshold.',
      },
    ],
  }),
  JSON.stringify({
    assessment: [
      {
        relevance_headline: 0,
        assessment_headline:
          'Foundation donation, no personal private wealth involved for the family.',
      },
      {
        relevance_headline: 95,
        assessment_headline:
          "Significant acquisition by rich list family's holding company (KIRKBI A/S), likely impacting family's ultimate wealth substantially.",
      },
      {
        relevance_headline: 30,
        assessment_headline:
          'Succession planning in a family business suggests future wealth considerations, not an immediate substantial wealth event for individuals.',
      },
      {
        relevance_headline: 70,
        assessment_headline:
          'Merger of two significant Scandinavian-founded companies, potential for substantial wealth implications for any remaining private owners.',
      },
      {
        relevance_headline: 0,
        assessment_headline:
          'Public market action by a public company, no personal private wealth transfer.',
      },
      {
        relevance_headline: 80,
        assessment_headline:
          'Potential substantial private wealth event if IPO proceeds benefit Scandinavian founders/owners significantly.',
      },
    ],
  }),
  // --- NEW: Output for the new example set ---
  JSON.stringify({
    assessment: [
        {
            relevance_headline: 5,
            assessment_headline: "Irrelevant. News about a foreign multinational (Stellantis) and financial losses due to tariffs."
        },
        {
            relevance_headline: 60,
            assessment_headline: "Relevant due to Rich List family involvement (USTC owners) in a significant legal/financial dispute."
        },
        {
            relevance_headline: 10,
            assessment_headline: "Irrelevant. Merger of publicly-listed, non-family-owned banks."
        }
    ]
  }),
  // --- REFINED: Output for the Rich List Proximity set ---
  JSON.stringify({
    assessment: [
      {
        relevance_headline: 95,
        assessment_headline:
          'Clear substantial private wealth event for the Scandinavian Due Jensen family via distribution from their foundation.',
      },
      {
        relevance_headline: 90,
        assessment_headline:
          'Substantial personal acquisition by Scandinavian rich list individual Anders Holch Povlsen, a clear private wealth event.',
      },
      {
        relevance_headline: 85,
        assessment_headline:
          'High relevance. A new venture by a known Rich List individual (Martin Thorborg) securing funding is a significant potential wealth event.',
      },
      {
        relevance_headline: 0,
        assessment_headline: "Irrelevant. Rich List individual's public appearance is not a wealth event."
      }
    ],
  }),
];