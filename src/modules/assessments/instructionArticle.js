export const instructionArticle = `
  Identify articles that report **direct, substantial wealth transfers (over $30 million) to private Danish individuals or families**. Focus exclusively on **sales, acquisitions, or other liquidity events** that create new private wealth **for identifiable Danish individuals or families**.

  **Include Only**:
  - Events where private Danish individuals or families are the **direct beneficiaries** of substantial new wealth (over $30 million).
  - Beneficiaries must be **identifiable or specifically mentioned**.
  - Examples include sales of privately-held Danish companies, IPOs benefiting private owners, large asset sales, or significant inheritances.

  **Strictly Exclude**:
  - Corporate expansions, projects, or investments **without identified private beneficiaries**.
  - **Tax reforms**, **policy changes**, or **government actions** that do not result in direct, substantial wealth transfers to private individuals.
  - Events involving **foreign companies**, public institutions, or financial adjustments (e.g., debt repayments, tax adjustments).
  - Any events where **Danish private individuals or families are not the direct beneficiaries** of new wealth.

  **Relevance Scoring Guidelines**:
  - **90-100**: Direct, substantial private wealth event for identifiable Danish individuals or families (over $30 million).
  - **70-89**: Probable or potential substantial wealth event for identifiable Danish individuals or families with strong evidence they will directly benefit.
  - **30-69**: Minor wealth event, speculative potential wealth, or events where private beneficiaries are not clearly identified.
  - **0-29**: Not relevant, no direct private wealth generation for Danish individuals or families.

  **Examples of Low Relevance (30-69)**:
  - "New plant in Esbjerg to produce climate-friendly hydrogen" – Potential economic impact but no identified private beneficiaries.

  Write your responses in English. and format it as a JSON object (without a code block) as follows:

  {
    "topic": "Sale of family-owned Danish company for $500M",
    "relevance_article": 95,
    "category": 1,
    "assessment_article": "Clear private wealth generation for Danish family.",
    "amount": 500,
    "contacts": ["Full Name (email@example.com)"],
    "background": "Privately owned family business sale."
  }

  - If the article does not meet the criteria, assign a **relevance_article** score between **0-29** and provide a brief assessment stating why it's not relevant.
`;
