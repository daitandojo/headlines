# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Headlines-Mongo** is a news processing application that scrapes Danish business news (Børsen, Berlingske, Politiken, Finans.dk), assesses relevance using AI/LLM, and sends curated newsletters via email.

## Architecture

The application uses a **data pipeline approach** with the following flow:

1. **Scraping** → Fetch headlines from configured sources
2. **Filtering** → Skip articles already in database
3. **AI Assessment** → LLM evaluates headline relevance (threshold: 10)
4. **Enrichment** → Extract full article content for relevant headlines
5. **Content Assessment** → LLM evaluates article content quality (threshold: 10)
6. **Storage** → Store relevant articles in MongoDB
7. **Email** → Send curated newsletters to configured recipients

## Core Components

### Key Configuration Files
- `src/config/sources.js` - Web scraping configuration for Danish news sites
- `src/config/llm.js` - LLM provider selection (OpenAI/Groq) and model settings  
- `src/config/env.js` - Environment variable handling
- `src/config/email.js` - SMTP and email content configuration

### Pipeline Modules
- `src/modules/scraping/fetchHeadlines.js` - Multi-source headline extraction
- `src/modules/assessments/assessHeadlines.js` - AI relevance scoring for headlines  
- `src/modules/assessments/assessArticles.js` - AI content quality scoring
- `src/modules/scraping/enrichWithBody.js` - Full article content extraction
- `src/modules/email/index.js` - Email composition and delivery
- `src/modules/mongoStore/articleOperations.js` - MongoDB CRUD operations

### Models
- `models/Article.js` - MongoDB schema with comprehensive fields for AI scoring and processing metadata

## Development Commands

### Core Operations
```bash
npm start          # Run full headlines processing pipeline
node email.worker.js  # Start email worker (required before npm start)
npm test          # Run Jest test suite
```

### Utility Scripts
```bash
npm run show      # Display all articles with relevance scores (CLI)
npm run mail      # Manual trigger email from existing articles
npm run delete    # Clean database (location: scripts/delete.js)
npm run migrate   # Run MongoDB migration scripts
```

## Environment Setup

### Prerequisites
1. **Email Worker**: Must run separately as `node email.worker.js` before main app
2. **MongoDB**: Connection string via `MONGO_URI` environment variable
3. **Redis**: Required for queue processing (`REDIS_URL`)
4. **LLM Access**: Either OpenAI API key or Groq API key

### Required Environment Variables
- `MONGO_URI`: MongoDB connection string
- `REDIS_URL`: Redis connection string for queues
- `OPENAI_API_KEY`: OpenAI API key (if using OpenAI)
- `GROQ_API_KEY`: Groq API key (if using Groq model)
- `HEADLINE_RECIPIENTS_STR`: Comma-separated email recipients
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`: SMTP configuration

## Key Configuration Points

### AI Relevance Thresholds
- `HEADLINES_RELEVANCE_THRESHOLD` = 10 (minimum score for headlines)
- `ARTICLES_RELEVANCE_THRESHOLD` = 10 (minimum score for full articles)

### Scraping Sources
Configured Danish business news sites in `sources.js` with:
- JSON selectors for headlines
- CSS selectors for article content
- Error handling for dynamic content

### Email Configuration
- Uses Nodemailer with configurable SMTP
- Styled email templates with responsive design
- Optional supervisor email reports for debugging

## Common Development Tasks

### Adding New News Sources
1. Add entry in `src/config/sources.js`
2. Define scraping selectors for headlines and article content
3. Test with sample HTML from target site

### Adjusting AI Relevance
Modify threshold values in `src/config/index.js` or tune AI prompts in assessment modules

### Debugging Pipeline Issues
- Check logs in `/logs/` directory for detailed tracking
- Use `npm run show` to inspect stored articles
- Monitor Redis queue health: check email worker status

### Testing Email Delivery
```bash
# Start email worker
node email.worker.js

# In another terminal, trigger email process
npm run mail
```

## File Structure Notes

- **app.js**: Environment loading and main application bootstrap
- **app-logic.js**: Complete pipeline orchestration with error handling
- **email.worker.js**: Background email worker for queue processing
- **logs/**: Comprehensive debugging logs for all components
- **output/**: JSON files for articles and headlines (used during development)