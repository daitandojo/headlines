export const shotsInput = [
  { articleText: "Elon Musk sells $1bn of shares" },
  { articleText: "New IPO for 3Shape" },
  { articleText: "Haaber family sold 20 Zleep hotels 5 years ago" },
  { articleText: "Danish man wins football lottery" },
  { articleText: "New species of frog discovered" },
  { articleText: "Axcel sells Nissens Lubrication" },
  { articleText: "Widex and Demant planning for a merger " },
  { articleText: "Government considers privatizing Orstedt" },
  { articleText: "Polaris partner preparing for retirement" }
];

export const shotsOutput = [
  {
    "topic": "Elon Musk selling shares",
    "relevance_article": 0,
    "assessment_article": "Not relevant as not Danish",
    "amount": 0,
    "contacts": [],
    "background": ""
  },
  {
    "topic": "IPO planned for 3Shape",
    "relevance_article": 90,
    "assessment_article": "Wealth generated by Deichmann and Clausen",
    "amount": 50,
    "contacts": ["Nikolaj Deichmann (nd@deichmannmedia.com)", "Tais Clausen (tais@clausen.dk)"],
    "background": "Nikolaj and Tais founded 3Shape in 1998 as a spin-out of the hearing aid company Widex. They have had significant success and have full ownership of the company, except a small stake they sold to EQT a couple of years ago."
  },
  {
    "topic": "Hotel family sold hotels years ago",
    "relevance_article": 90,
    "assessment_article": "Although long ago, wealthy family mentioned",
    "amount": 100,
    "contacts": [],
    "background": "The Haaber family were behind the founding of the Zleep hotel concept and sold their company a couple of years ago."
  },
  {
    "topic": "Man wins lottery",
    "relevance_article": 0,
    "assessment_article": "Too insignificant",
    "amount": 0.1,
    "contacts": [],
    "background": ""
  },
  {
    "topic": "Species of frog discovered",
    "relevance_article": 0,
    "assessment_article": "Not relevant",
    "amount": 0,
    "contacts": [],
    "background": ""
  },
  {
    "topic": "PE firm Axcel selling Nissen Lubrication",
    "relevance_article": 95,
    "assessment_article": "Wealth generated for Nissen family",
    "amount": 70,
    "contacts": ["Alan Nissen (an@nissens.com)"],
    "background": "Alan Nissen successfully built the car part business from his father and sold a minority stake to Axcel. Alan has three daughters who will inherit the capital. Alan and his daughters will benefit as they are the major shareholders."
  },
  {
    "topic": "Widex and Demant planning merger",
    "relevance_article": 90,
    "assessment_article": "Family wealth will be generated",
    "amount": 90,
    "contacts": ["Anders Westermann (aw@twmedical.com)", "CEO of Demant (ceo@demant.dk)"],
    "background": "Consolidation in the hearing aid industry leads to Widex and Demant now having plans to merge. Both privately held companies, there will be a need for banking as well as wealth management for the major stakeholders Westermann and Topholm on Widex' side, and the Demant Foundation on Demant's side."
  },
  {
    "topic": "Danish government considers privatizing Orstedt",
    "relevance_article": 0,
    "assessment_article": "Not relevant as no individual wealth benefit directly",
    "amount": 0,
    "contacts": ["Mads Nipper (mn@orstedt.dk)"],
    "background": "Orsted is now listed after Goldman Sachs took it public a few years ago. There seems to be a renewed need for banking advisory services."
  },
  {
    "topic": "Polaris partner Jan Kuhl preparing for retirement",
    "relevance_article": 85,
    "assessment_article": "Wealth generation down the line",
    "amount": 70,
    "contacts": ["Jan Johan Kuhl (jk@polaris.com)"],
    "background": "As Jan Johan, founder of Polaris, is slowing down, as a majority shareholder he will have more funds available for investment."
  }
]    