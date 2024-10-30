export const shotsInput = [
  [
    "Rockwool står foran massive udvidelser over hele kloden",
    "Boeing henter 145 mia. kr.",
    "Boligejere med for stor grundskyldsregning har udsigt til hjælp",
    "Kriseramte Boeing vil rejse milliarder for at tilbagebetale gæld",
    "Aarstiderne solgt til gigant",
    "Danish family sells company for $500M"
  ],  
  [
    "Local football match results",                     // Low relevance, no wealth event
    "New Danish tech startup launched",                // Low relevance, no wealth event
    "Vestas CEO buys shares",                          // Low relevance, non-private activity
    "Vestas CEO sells significant shares",             // Moderate relevance, but still public activity
    "Maersk heir sells estate in Copenhagen",          // High relevance, private wealth event
    "Danish lottery winner claims prize"               // Moderate relevance, small personal wealth event
  ],
  [
    "A.P. Moller Foundation donates $100 million to charity",  // Low relevance, public foundation
    "LEGO family in acquisition talks for rival company",       // High relevance, private family wealth activity
    "Danfoss heir plans succession of family business",         // Moderate relevance, future wealth event
    "Widex and Demant plan to merge operations",                // High relevance, private wealth generation event
    "Novo Nordisk announces stock split",                       // Low relevance, public company
    "3Shape is working on an IPO"                               // High relevance, potential private wealth generation
  ]
];

export const shotsOutput = [
  {
    assessment: [
      { relevance_headline: 5, assessment_headline: "Corporate expansion, no private wealth for Danish individuals." },
      { relevance_headline: 0, assessment_headline: "Foreign corporate activity, no relevance to Danish private wealth." },
      { relevance_headline: 5, assessment_headline: "Tax relief for homeowners, not substantial wealth generation." },
      { relevance_headline: 0, assessment_headline: "Foreign corporate fundraising, no private wealth for Danish individuals." },
      { relevance_headline: 95, assessment_headline: "Acquisition likely results in substantial wealth for Danish founders." },
      { relevance_headline: 100, assessment_headline: "Clear private wealth event for Danish family." }
    ]
  },  
  { assessment: [
    { relevance_headline: 0, assessment_headline: "Not a wealth event." },
    { relevance_headline: 10, assessment_headline: "No direct wealth event." },
    { relevance_headline: 20, assessment_headline: "Public, non-private activity." },
    { relevance_headline: 30, assessment_headline: "Potential minor wealth event." },
    { relevance_headline: 95, assessment_headline: "Clear wealth event benefiting Danish private individual." },
    { relevance_headline: 60, assessment_headline: "Moderate private wealth event below $50 million." }
  ]},
  {
    assessment: [
      { relevance_headline: 10, assessment_headline: "Public, charitable activity, not a wealth event." },
      { relevance_headline: 95, assessment_headline: "Significant private wealth event in Denmark." },
      { relevance_headline: 40, assessment_headline: "Future potential wealth event." },
      { relevance_headline: 95, assessment_headline: "Merger with private wealth implications." },
      { relevance_headline: 5, assessment_headline: "Public company, no private wealth." },
      { relevance_headline: 85, assessment_headline: "Potential substantial private wealth event through IPO." }
    ]
  }
];
