// src/modules/assessments/shotsHeadlines.js (version 2.1 - Add English Translation)
export const shotsInput = [
  [
    'Rockwool står foran massive udvidelser over hele kloden',
    'Boeing henter 145 mia. kr.',
    'Boligejere med for stor grundskyldsregning har udsigt til hjælp',
    'Aarstiderne solgt til gigant',
    'Scandinavian family sells company for $500M',
  ].join('\n- '),

  [
    "Egeria raises €1.25 billion with new private equity fund",
    "Egeria enters new partnership with Junge Die Bäckerei.",
    "FSN Capital VI acquires a majority stake in ilionx",
    "Egeria divests Dutch Bakery after a period of strong growth",
    "Axcel closes its seventh fund at EUR 1.3 billion"
  ].join('\n- '),

  [
    'A.P. Moller Foundation donates $100 million to charity',
    'LEGO family (KIRKBI A/S) in acquisition talks for rival toy company for DKK 5 billion',
    'Danfoss heir (Bitten & Mads Clausen Foundation) announces succession plan for family business leadership',
    'Widex and Demant plan to merge operations',
    '3Shape (privately owned) is working on an IPO',
  ].join('\n- '),

  [
    'Nå|Spår milliard-smell fra toll', // Stellantis example
    'Familieejet koncern bestrider millionkrav efter Nordic Waste', // USTC example
    'Fynske bankers fusionsplaner skydes ned af storaktionær' // Public bank merger
  ].join('\n- '),

  [
    'Grundfos owner (Poul Due Jensen Foundation) announces DKK 300 million dividend distribution to family members',
    'Bestseller owner Anders Holch Povlsen personally acquires Scottish estate for DKK 150 million',
    "Martin Thorborg's AI Startup Secures Funding",
    'Martin Thorborg giver et foredrag om iværksætteri'
  ].join('\n- '),
];

export const shotsOutput = [
  // MODIFIED: Added headline_en to each object
  JSON.stringify({
    assessment: [
      { headline_en: 'Rockwool faces massive expansions across the globe', relevance_headline: 10, assessment_headline: 'Corporate expansion (Rockwool is public), no direct private wealth generation.' },
      { headline_en: 'Boeing raises DKK 145 billion', relevance_headline: 0, assessment_headline: 'Foreign corporate activity, no relevance.' },
      { headline_en: 'Homeowners with excessive property tax bills can expect help', relevance_headline: 15, assessment_headline: 'Tax relief provides benefit, but not a substantial direct wealth transfer.' },
      { headline_en: 'Aarstiderne sold to giant', relevance_headline: 95, assessment_headline: 'Acquisition likely results in substantial wealth for founders/owners.' },
      { headline_en: 'Scandinavian family sells company for $500M', relevance_headline: 100, assessment_headline: 'Clear substantial private wealth event for a family.' },
    ],
  }),
  // MODIFIED: Added headline_en to each object
  JSON.stringify({
    assessment: [
      { headline_en: "Egeria raises €1.25 billion with new private equity fund", relevance_headline: 0, assessment_headline: "Irrelevant. PE firm fundraising is operational news, not a transaction." },
      { headline_en: "Egeria enters new partnership with Junge Die Bäckerei.", relevance_headline: 90, assessment_headline: "High relevance. A PE firm 'partnership' is an investment, a direct wealth event for the target company's owners." },
      { headline_en: "FSN Capital VI acquires a majority stake in ilionx", relevance_headline: 95, assessment_headline: "High relevance. A PE firm acquiring a majority stake is a clear liquidity event for the sellers." },
      { headline_en: "Egeria divests Dutch Bakery after a period of strong growth", relevance_headline: 95, assessment_headline: "High relevance. A PE firm 'divestment' or 'sale' is a clear liquidity event." },
      { headline_en: "Axcel closes its seventh fund at EUR 1.3 billion", relevance_headline: 0, assessment_headline: "Irrelevant. PE firm operational news (fundraising)." }
    ]
  }),
  // MODIFIED: Added headline_en to each object
  JSON.stringify({
    assessment: [
      { headline_en: 'A.P. Moller Foundation donates $100 million to charity', relevance_headline: 0, assessment_headline: 'Foundation donation, no personal private wealth involved.' },
      { headline_en: 'LEGO family (KIRKBI A/S) in acquisition talks for rival toy company for DKK 5 billion', relevance_headline: 95, assessment_headline: "Significant acquisition by rich list family's holding company, impacting family's wealth." },
      { headline_en: 'Danfoss heir (Bitten & Mads Clausen Foundation) announces succession plan for family business leadership', relevance_headline: 30, assessment_headline: 'Succession planning is not an immediate substantial wealth event.' },
      { headline_en: 'Widex and Demant plan to merge operations', relevance_headline: 70, assessment_headline: 'Merger of two significant companies, potential for substantial wealth implications for any remaining private owners.' },
      { headline_en: '3Shape (privately owned) is working on an IPO', relevance_headline: 80, assessment_headline: 'Potential substantial private wealth event if IPO proceeds benefit founders/owners significantly.' },
    ],
  }),
  // MODIFIED: Added headline_en to each object
  JSON.stringify({
    assessment: [
        { headline_en: 'Now | Predicts billion-krone blow from tariffs', relevance_headline: 5, assessment_headline: "Irrelevant. News about a foreign multinational (Stellantis) and financial losses." },
        { headline_en: 'Family-owned conglomerate disputes million-krone claim after Nordic Waste', relevance_headline: 60, assessment_headline: "Relevant due to Rich List family involvement (USTC owners) in a significant legal/financial dispute." },
        { headline_en: "Funen banks' merger plans shot down by major shareholder", relevance_headline: 10, assessment_headline: "Irrelevant. Merger of publicly-listed, non-family-owned banks." }
    ]
  }),
  // MODIFIED: Added headline_en to each object
  JSON.stringify({
    assessment: [
      { headline_en: 'Grundfos owner (Poul Due Jensen Foundation) announces DKK 300 million dividend distribution to family members', relevance_headline: 95, assessment_headline: 'Clear substantial private wealth event for the family via distribution from their foundation.' },
      { headline_en: 'Bestseller owner Anders Holch Povlsen personally acquires Scottish estate for DKK 150 million', relevance_headline: 90, assessment_headline: 'Substantial personal acquisition by rich list individual Anders Holch Povlsen.' },
      { headline_en: "Martin Thorborg's AI Startup Secures Funding", relevance_headline: 85, assessment_headline: 'High relevance. A new venture by a known Rich List individual securing funding is a significant potential wealth event.' },
      { headline_en: 'Martin Thorborg gives a lecture on entrepreneurship', relevance_headline: 0, assessment_headline: "Irrelevant. Rich List individual's public appearance is not a wealth event." }
    ],
  }),
];