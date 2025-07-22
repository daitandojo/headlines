# Headlines-Mongo

An intelligent Danish business news processing application that scrapes, analyzes, and delivers curated newsletters based on relevance scoring powered by Large Language Models (LLM).

## Overview

This application monitors Danish business news sources (Børsen, Berlingske, Politiken, Finans.dk) for relevant content, uses AI to assess article relevance, and delivers curated newsletters via email.

## Features

- **Multi-source News Scraping**: Configurable web scraping from major Danish business publications
- **AI-Powered Relevance Scoring**: Uses LLM to evaluate headline and article content relevance
- **Automated Newsletter Delivery**: Curated email newsletters sent to configurable recipients
- **Queue-based Processing**: Uses Redis for reliable background email delivery
- **MongoDB Storage**: Persistent storage with comprehensive metadata tracking
- **Robust Error Handling**: Graceful handling of network issues and parsing errors
- **Comprehensive Logging**: Detailed logging for debugging and monitoring

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or cloud)
- OpenAI API key or Groq API key
- SMTP credentials for email delivery

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the project root:
   ```
   MONGO_URI=mongodb://localhost:27017/headlines
   
   # LLM Configuration (choose one)
   OPENAI_API_KEY=your_openai_key_here
   # OR
   GROQ_API_KEY=your_groq_key_here
   
   # Email Configuration
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   EMAIL_FROM=Headlines Newsletter <news@yourcompany.com>
   HEADLINE_RECIPIENTS_STR=recipient1@email.com,recipient2@email.com
   ```

3. **Run the application:**
   ```bash
   npm start
   ```

> **Note on Redis**: The app may log about Redis connections due to DaitanJS framework initialization. For single-process deployment, you can either:
> - **Use Upstash Redis** (recommended): `fly redis create` and set `REDIS_URL`
> - **Ignore Redis logs**: The app will continue to work even if Redis isn't connected
> - **Set placeholder**: `REDIS_URL=redis://localhost:6379` (won't affect functionality)

## Usage

### Daily Operation
The application runs as a complete pipeline that:
1. Fetches latest headlines from configured sources
2. Filters out previously processed articles
3. Uses AI to assess relevance of headline and content
4. Stores relevant articles in MongoDB
5. Sends curated email newsletter

### Manual Commands

**View processed articles:**
```bash
npm run show
```

**Send immediate newsletter:**
```bash
npm run mail
```

**Clean database:**
```bash
npm run delete
```

## Configuration

### News Sources
Configure news sources in `src/config/sources.js`. Each source requires:
- Base URL and start URL
- Headline scraping selectors (CSS or JSON)
- Article content extraction rules
- Source-specific configuration

### AI Relevance Thresholds
Adjust relevance criteria in `src/config/index.js`:
- `HEADLINES_RELEVANCE_THRESHOLD`: Minimum score for headline relevance (default: 10)
- `ARTICLES_RELEVANCE_THRESHOLD`: Minimum score for content relevance (default: 10)

### LLM Provider Selection
Choose between OpenAI and Groq in `src/config/llm.js`:
```javascript
// Set environment variables:
// LLM_PROVIDER=openai|groq
// OPENAI_API_KEY=sk-...
// GROQ_API_KEY=gpk-...
```

## File Structure

```
headlines-mongo/
├── app.js                 # Environment loading & app startup
├── app-logic.js          # Main pipeline orchestration
├── email.worker.js       # Queue worker for email delivery
├── models/
│   └── Article.js       # MongoDB schema and model
├── src/
│   ├── config/          # Configuration files
│   │   ├── sources.js   # News source scraping rules
│   │   ├── llm.js       # AI model configuration
│   │   └── email.js     # Email settings
│   ├── modules/         # Core business logic
│   │   ├── scraping/    # Web scraping utilities
│   │   ├── assessments/ # AI relevance scoring
│   │   ├── email/       # Email composition and delivery
│   │   └── mongoStore/  # Database operations
│   └── samples/         # Sample HTML for testing
├── scripts/
│   ├── mail.js          # Manual email trigger
│   ├── show.js          # Display articles
│   └── delete.js        # Database cleanup
├── logs/                # Application logs
└── output/             # Development output files
```

## Development

### Adding New News Sources
1. Add configuration in `src/config/sources.js`
2. Test scraping selectors with sample HTML
3. Update error handling as needed

### Customizing AI Prompts
Modify the prompt templates in:
- `src/modules/assessments/instructionHeadlines.js` - headline assessment
- `src/modules/assessments/instructionArticle.js` - article content assessment

### Monitoring and Debugging
- **Real-time logs**: Check `logs/` directory for comprehensive logging
- **Error tracking**: AI assessment errors, network issues, and parsing problems are logged
- **Email verification**: Use `npm run mail` to test email delivery

## Architecture

### Data Pipeline Flow
```
News Websites → Headlines Scraping → Freshness Filter → Headline AI Assessment → Content Enrichment → Article AI Assessment → MongoDB Storage → Email Newsletter → Recipients
```

### AI Processing
- **Headline Level**: Quick relevance scoring for broad filtering
- **Content Level**: Detailed analysis of full article content
- **Cumulative Scoring**: Combines both scores for final curation

### Storage Model
MongoDB documents track:
- Original article content and metadata
- AI assessment results and scores
- Processing status and errors
- Email delivery status
- Full audit trail with timestamps

## Troubleshooting

### Common Issues

**"The 'mail-queue' worker is not running"**
- Ensure `node email.worker.js` is running in a separate terminal
- Check Redis connection and availability

**"No headlines fetched"**
- Verify news source website structure hasn't changed
- Check selectors in `sources.js` against current site HTML

**"AI assessment failures"**
- Verify LLM API key is valid
- Check provider configuration in `src/config/llm.js`
- Review rate limits and quota status

### Environment Variables Reference

| Variable | Description | Required |
|---|---|---|
| `MONGO_URI` | MongoDB connection string | Yes |
| `OPENAI_API_KEY` | OpenAI API key (if using OpenAI) | Either OpenAI or Groq |
| `GROQ_API_KEY` | Groq API key (if using Groq) | Either OpenAI or Groq |
| `EMAIL_HOST` | SMTP server hostname | Yes |
| `EMAIL_USER` | SMTP username | Yes |
| `EMAIL_PASS` | SMTP password | Yes |
| `EMAIL_FROM` | From address for emails | Yes |
| `HEADLINE_RECIPIENTS_STR` | Comma-separated email recipients | Yes |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with appropriate tests
4. Submit a pull request with detailed description

## License

Specify license information here.

## Support

For issues and questions:
1. Check the logs in the `logs/` directory
2. Verify all prerequisite services are running
3. Ensure environment variables are correctly configured
4. Review error messages in console output