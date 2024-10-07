// File: src/modules/assessments/shots.js
export const shotsInput = [
  [
    "Sunny weekend forecast",
    "Local football match results",
    "New Danish tech startup",
    "Vestas CEO buys shares",
    "Vestas CEO sells shares",
    "Maersk heir sells estate",
    "Danish lottery winner"  
  ],
  [
    "A.P. Moller Foundation donates",
    "Novo Nordisk stock splits",
    "LEGO family in acquisition talks",
    "Danfoss heir plans succession",
    "Widex and Demant plan to merge",
    "3Shape is working on an IPO",
    "Elon Musk sells all his shares"  
  ]
];

export const shotsOutput = [
    { assessment: [
        { relevance_headline: 0, assessment_headline: "weather is not relevant" },
        { relevance_headline: 0, assessment_headline: "sports is not relevant" },
        { relevance_headline: 15, assessment_headline: "startups generate wealth later" },
        { relevance_headline: 50, assessment_headline: "wealthy individual mentioned" },
        { relevance_headline: 80, assessment_headline: "liquid wealth increase" },
        { relevance_headline: 100, assessment_headline: "the sale will lead to investible liquidity" },
        { relevance_headline: 50, assessment_headline: "wealth event, but size doubtable" }
    ]},
    { assessment: [
        { relevance_headline: 15, assessment_headline: "this is rather a wealth reduction, not generation" },
        { relevance_headline: 10, assessment_headline: "a stock split is not a relevant event" },
        { relevance_headline: 100, assessment_headline: "acquisition will lead to wealth for the family" },
        { relevance_headline: 100, assessment_headline: "succession planning involves wealth" },
        { relevance_headline: 100, assessment_headline: "a merger will make the owners wealthy" },
        { relevance_headline: 100, assessment_headline: "an IPO leads to liquidity" },
        { relevance_headline: 10, assessment_headline: "This is not a Danish situation" }
    ]}
];
