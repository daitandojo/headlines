// File: headlines_mongo/src/modules/assessments/shotsHeadlines.js
export const shotsInput = [
  // --- DEFINITIVE FIX: The input for each shot must be a SINGLE STRING, ---
  // --- matching exactly how the final prompt is constructed. ---
  [
    'Rockwool står foran massive udvidelser over hele kloden',
    'Boeing henter 145 mia. kr.',
    'Boligejere med for stor grundskyldsregning har udsigt til hjælp',
    'Kriseramte Boeing vil rejse milliarder for at tilbagebetale gæld',
    'Aarstiderne solgt til gigant',
    'Danish family sells company for $500M',
  ].join('\n- '),

  [
    'Local football match results',
    'New Danish tech startup launched',
    'Vestas CEO buys shares',
    'Vestas CEO sells significant shares',
    'Maersk heir sells estate in Copenhagen',
    'Danish lottery winner claims prize',
  ].join('\n- '),

  [
    'A.P. Moller Foundation donates $100 million to charity',
    'LEGO family (KIRKBI A/S) in acquisition talks for rival toy company for DKK 5 billion',
    'Danfoss heir (Bitten & Mads Clausen Foundation) announces succession plan for family business leadership',
    'Widex and Demant plan to merge operations',
    'Novo Nordisk (public company) announces stock split',
    '3Shape (privately owned) is working on an IPO',
  ].join('\n- '),

  [
    'Grundfos (company) reports record annual profits',
    'Grundfos owner (Poul Due Jensen Foundation) announces DKK 300 million dividend distribution to family members',
    'Bestseller (company) to open 50 new stores in Germany',
    'Bestseller owner Anders Holch Povlsen personally acquires Scottish estate for DKK 150 million',
    'Coloplast (public company) CEO receives large bonus',
    'ECCO Sko A/S (family owned) posts strong revenue growth',
  ].join('\n- '),

  [
    'Martin Thorborg erkender: Kunstig intelligens kan true hans forretning',
    "Martin Thorborg's AI Startup Secures Funding",
  ].join('\n- '),
];

export const shotsOutput = [
  JSON.stringify({
    assessment: [
      {
        relevance_headline: 10,
        assessment_headline:
          'Corporate expansion (Rockwool is public), no direct private wealth generation for Danish individuals.',
      },
      {
        relevance_headline: 0,
        assessment_headline:
          'Foreign corporate activity, no relevance to Danish private wealth.',
      },
      {
        relevance_headline: 20,
        assessment_headline:
          'Tax relief provides benefit, but not a substantial direct wealth transfer.',
      },
      {
        relevance_headline: 0,
        assessment_headline:
          'Foreign corporate debt repayment, no relevance to Danish private wealth.',
      },
      {
        relevance_headline: 95,
        assessment_headline:
          'Acquisition likely results in substantial wealth for Danish founders/owners.',
      },
      {
        relevance_headline: 100,
        assessment_headline:
          'Clear substantial private wealth event for Danish family.',
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
          'Share sale by individual, possibly some personal gain, unlikely to exceed $50M based on headline alone.',
      },
      {
        relevance_headline: 95,
        assessment_headline:
          "Clear wealth event (>$50M implied by 'Maersk heir' and 'estate in Copenhagen') benefiting Danish private individual.",
      },
      {
        relevance_headline: 50,
        assessment_headline:
          'Private wealth event, but likely below $50M threshold.',
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
          'Succession planning in a family business (Danfoss via foundation) suggests future wealth considerations, not an immediate substantial wealth event for individuals.',
      },
      {
        relevance_headline: 70,
        assessment_headline:
          'Merger of two significant Danish-founded (though Sivantos/Widex is now WS Audiology, part foreign-owned) companies, potential for substantial wealth implications for any remaining Danish private owners if value is realized.',
      },
      {
        relevance_headline: 0,
        assessment_headline:
          'Public market action by a public company, no personal private wealth transfer.',
      },
      {
        relevance_headline: 80,
        assessment_headline:
          'Potential substantial private wealth event if IPO proceeds benefit Danish founders/owners significantly.',
      },
    ],
  }),
  JSON.stringify({
    assessment: [
      {
        relevance_headline: 0,
        assessment_headline:
          'Corporate performance of Grundfos (company), not a direct private wealth event for the Due Jensen family unless specific large dividend to family is mentioned.',
      },
      {
        relevance_headline: 95,
        assessment_headline:
          'Clear substantial private wealth event for the Danish Due Jensen family via distribution from their foundation.',
      },
      {
        relevance_headline: 0,
        assessment_headline:
          'Corporate expansion of Bestseller (company), not a direct private wealth event for Anders Holch Povlsen.',
      },
      {
        relevance_headline: 90,
        assessment_headline:
          'Substantial personal acquisition by Danish rich list individual Anders Holch Povlsen, a clear private wealth event.',
      },
      {
        relevance_headline: 10,
        assessment_headline:
          'Executive compensation in a public company, not a private wealth generation event of the type tracked (e.g. founder liquidity).',
      },
      {
        relevance_headline: 10,
        assessment_headline:
          "Corporate performance of ECCO (family-owned company), but headline doesn't specify a direct, substantial wealth event for the Toosbuy Kasprzak family.",
      },
    ],
  }),
  JSON.stringify({
    assessment: [
      {
        relevance_headline: 75,
        assessment_headline:
          "High relevance due to Martin Thorborg's strategic statements about his business's core vulnerability, implying potential significant future actions.",
      },
      {
        relevance_headline: 85,
        assessment_headline:
          'High relevance. A new venture by a known Rich List individual (Martin Thorborg) securing funding is a significant potential wealth event.',
      },
    ],
  }),
];
