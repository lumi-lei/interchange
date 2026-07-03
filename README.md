# Interchange

Interchange is a local-first collaboration tool for AI-assisted development teams. It turns one piece of objective project information into role-specific messages for humans and AI coding tools, then helps the team confirm, forward, and archive that context.

It is designed for a common workflow in AI programming teams: requirements, meeting notes, bug reports, and release notes often need to be rewritten for product, QA, tech leads, customers, and multiple AI coding agents. Interchange keeps the facts in one place, adapts the message for each role, and preserves the handoff as reusable project knowledge.

## Highlights

- **Multi-format input to Markdown**: uses Microsoft's open-source MarkItDown CLI to convert Word, PDF, Excel, PowerPoint, HTML, CSV, and other working files into Markdown-like text for review and download.
- **Role-based analysis**: generates different drafts for product, QA, tech leads, department leaders, customers, the user's AI coding tool, and a teammate's AI coding tool.
- **AI coding prompts**: the two AI coding tool roles produce implementation-ready prompts for multi-agent collaboration, including scope, documents to read, acceptance criteria, and coordination boundaries.
- **Human confirmation first**: drafts can be reviewed and edited before being copied or sent.
- **DingTalk and webhook delivery**: confirmed messages can be forwarded through generic webhooks or DingTalk group robots.
- **Skill-based workflow**: packages the project communication workflow as Agent Skills, including an OpenSpec-like loop for long-term project documentation and change archiving.
- **Local-first parsing boundary**: uploaded files are parsed locally by default. Original files are not sent to external file or vision models unless future providers are explicitly configured.

## Demo Flow

1. Paste project facts or upload a working file.
2. Convert the input into editable text, with Markdown download available for supported MarkItDown conversions.
3. Select recipients and assign each one a role.
4. Generate role-specific drafts through the configured text model.
5. Review and edit each draft.
6. Send confirmed messages through DingTalk or webhook.
7. Use the packaged Agent Skills to turn approved changes into OpenSpec-like project documents and archive verified module updates.

## Built-in Roles

- Product
- QA / Test
- Tech Lead
- Department Leader
- Customer
- My AI Coding Tool
- Teammate AI Coding Tool

The AI coding roles are intentionally different from ordinary human notification roles. They are optimized to generate prompts that ask downstream agents to read project instructions, inspect relevant docs, respect task boundaries, confirm open questions, and run verification before implementation.

## Tech Stack

- Frontend: Vite, React, TypeScript
- Backend: Express, TypeScript
- Storage: SQLite via `better-sqlite3`
- AI model routing: OpenAI-compatible Chat Completions, defaulting to DeepSeek
- File parsing: MarkItDown, Mammoth, pdf-parse, read-excel-file, Tesseract.js
- Delivery: generic webhook and DingTalk robot Markdown messages
- Testing: Vitest and Supertest

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example environment file:

```bash
cp .env.example .env
```

Then configure at least:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-v4-flash
TEXT_MODEL_PROVIDER=deepseek
PORT=4120
SQLITE_PATH=./data/interchange.sqlite
MARKITDOWN_COMMAND=markitdown
MARKITDOWN_TIMEOUT_MS=15000
```

Generation requires `DEEPSEEK_API_KEY`. Without it, the app still starts, but draft generation returns a clear configuration error.

### 3. Install MarkItDown

Interchange expects a `markitdown` command to be available on the system path:

```bash
pip install "markitdown[all]"
```

If MarkItDown is installed somewhere else, set `MARKITDOWN_COMMAND` in `.env` to the executable path or command name.

### 4. Run locally

```bash
npm run dev
```

The Express API runs on `PORT` from `.env`, and the Vite frontend runs through the dev script.

### 5. Build and test

```bash
npm run build
npm test
```

## Important Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | empty | API key used by the server for text generation. |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | Default DeepSeek model. |
| `TEXT_MODEL_PROVIDER` | `deepseek` | Text model provider used by the model router. |
| `VISION_MODEL_PROVIDER` | `none` | External vision providers are disabled by default. |
| `FILE_MODEL_PROVIDER` | `none` | External file model providers are disabled by default. |
| `SQLITE_PATH` | `./data/interchange.sqlite` | Local SQLite database path. |
| `UPLOAD_LIMIT_MB` | `25` | Maximum upload size. |
| `MARKITDOWN_COMMAND` | `markitdown` | MarkItDown CLI command. |
| `MARKITDOWN_TIMEOUT_MS` | `15000` | MarkItDown conversion timeout. |

## Project Structure

```text
.
├── src/                  # React frontend
├── server/               # Express API, parsing, delivery, AI routing, SQLite persistence
├── docs/                 # Requirements, solution notes, API research, demo materials
├── tests/                # API, parser, prompt, delivery, and provider tests
├── agent-skills/         # Early project-local skill package
├── agent-skills-v2/      # Portable Agent Skills and OpenSpec-like workflow
└── agent-skills-dist/    # Built skill distribution artifacts
```

## API Overview

- `GET /api/health`: service status and model configuration
- `GET /api/roles`: built-in roles and custom preferences
- `PUT /api/roles/:key`: update role preference
- `GET /api/contacts`: list recipients
- `POST /api/contacts`: create recipient
- `PUT /api/contacts/:id`: update recipient
- `DELETE /api/contacts/:id`: delete recipient
- `POST /api/inputs/parse`: parse typed text or uploaded file
- `POST /api/generate`: generate role-specific drafts
- `POST /api/send`: send confirmed messages
- `GET /api/records`: recent generation and send records

## Security and Compliance Notes

- The browser never receives model API keys.
- DingTalk robot secrets are stored server-side and are not returned through contact APIs.
- Uploaded source files are parsed locally by default.
- External vision and file model providers default to `none`.
- Generated drafts are not sent automatically; users must confirm selected messages before delivery.

## Agent Skills

The `agent-skills-v2` package extends Interchange beyond the web app. It provides skills for:

- role-specific message transformation
- AI coding context generation
- human confirmation gates
- webhook sending after confirmation
- an OpenSpec-like project workflow: explore, propose, context, apply, archive

This allows project changes to start from shared facts, become implementation prompts for one or more AI agents, and finally be archived into long-term project specifications after verification.

## License

No license has been declared yet. Add a license before publishing or accepting external contributions.
