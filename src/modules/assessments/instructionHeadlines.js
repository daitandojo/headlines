export const instructionHeadlines = `
  Identify headlines that report significant, immediate wealth generation (e.g., over $50 million) **for private Danish individuals or families only**.

  **Include Only**:
  - Direct liquidity events for private individuals or families in Denmark, such as major company sales, asset sales, IPOs, or mergers that **directly result in new private wealth for Danish individuals or families**.

  **Strictly Exclude**:
  - Articles about corporate expansions, fundraising, public company activities, or tax relief efforts that **do not create new private wealth for Danish individuals or families**.
  - Events involving **foreign companies, public institutions, or financial adjustments** (e.g., debt repayments, tax adjustments).
  - Any events that do not involve **private Danish individuals or families** directly receiving substantial new wealth.

  **Relevance Scoring Guidelines**:
  - **90-100**: Direct, substantial private wealth event for Danish individuals or families (over $50 million).
  - **70-89**: Probable or potential substantial wealth event for Danish individuals or families.
  - **50-69**: Moderate wealth event, possibly indirect or involving amounts less than $50 million.
  - **30-49**: Minor wealth event or future potential wealth.
  - **0-29**: Not relevant, no direct private wealth generation for Danish individuals or families.

  **Examples of High Relevance (90-100)**:
  - "Danish CEO sells family business for $100M" – Clear private wealth event.
  - "Founders of Danish startup benefit from $200M IPO" – Immediate wealth for founders.

  **Examples of Moderate Relevance (50-69)**:
  - "Danish lottery winner claims $30M prize" – Moderate private wealth event.

  **Examples of Low Relevance (0-29)**:
  - "Boeing raises billions to pay debts" – **Foreign corporate activity, no relevance to Danish private wealth**.
  - "Rockwool plans global expansion" – **Corporate expansion, no direct private wealth impact on Danish individuals**.
  - "Homeowners to receive tax relief" – Indirect benefit, not substantial wealth generation.

  Write your responses in English, and format as:
  {
    "assessment": [
      {
        "relevance_headline": 95,
        "assessment_headline": "Imminent personal wealth generation due to company sale."
      }
    ]
  }
`;
