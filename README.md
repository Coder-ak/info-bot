# Info‑Bot

A lightweight, TypeScript‑based Express service that reads a curated JSON dataset, detects the query language (Ukrainian or Russian), tokenizes and stems the input, and then uses TF‑IDF scoring to return the most relevant scripted response. Designed for quick deployments with pm2.

## How It Works

- Loads `data.json` on startup and builds an in-memory TF-IDF index.
- Detects whether a request is in Ukrainian or Russian, then tokenizes, removes stop words, and stems the query terms.
- Scores each document by TF-IDF and returns the highest scoring scripted message, falling back to a “not found” response when nothing matches.
- Exposes `/api/health` for runtime metrics and `/api/classify` for querying.

## Features

- **TypeScript** – type safety and modern syntax.
- **ESBuild** – fast bundling for production builds.
- **pm2** – process manager for reliable uptime.
- **Environment-based configuration** – `.env` file for PORT and DATA_PATH.
- **Health endpoint** – `/api/health` returns RSS & heap usage in MB.
- **Query endpoint** – `/api/classify` matches queries against the keyword dataset.

## Getting Started

### Prerequisites

- Node.js v18+ (recommended)
- npm or yarn
- pm2 globally installed (`npm i -g pm2`)

### Installation

```bash
# Clone the repository
git clone <repository_url>
cd info-bot

# Install dependencies
npm install
```

### Environment

Create a `.env` file at the project root:

```bash
PORT=3000
DATA_PATH=data/data.json
```

### Development

```bash
# Watch & rebuild on changes
npm run dev
```

The server will be available at `http://localhost:3000`.

### Production

```bash
# Build the application
npm run build

# Start with pm2
npm run start
```

The pm2 ecosystem configuration is defined in `ecosystem.config.js`.  
You can monitor the process:

```bash
pm2 status
pm2 logs info-bot
```

### Testing the Endpoints

```bash
# Health check
curl http://localhost:3000/api/health
# => { "status":"ok","rss":"12.34 MB","heapUsed":"10.56 MB" }

# Query example
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"query":"диспетчер"}'
# => { "message":"...", "caption":"...", "type":0 }
```

## Project Structure

```
info-bot/
├─ src/
│  ├─ server.ts            # Express entry point
│  ├─ types/               # TypeScript type definitions
├─ data/
│  └─ data.json            # Sample keyword/message payloads
├─ .env
├─ .gitignore
├─ ecosystem.config.js     # pm2 configuration
├─ package.json
├─ tsconfig.json
└─ README.md
```

## Contributing

Feel free to open issues or pull requests.  
Make sure to run the linter and tests (if added) before submitting.

## License

ISC © Coder_AK
