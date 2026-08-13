# Interchange Solution Plan

## Architecture

Interchange is a local-first full-stack web app:

- Frontend: Vite + React + TypeScript
- Backend: Express 5 + TypeScript
- Storage: local SQLite through `better-sqlite3`
- AI: DeepSeek OpenAI-compatible Chat Completions API
- Upload parsing: Multer memory storage plus format-specific parsers
- Notification: contact-level delivery channels, including generic webhook POST and DingTalk group robot webhook

The browser never receives `DEEPSEEK_API_KEY`. All AI calls are made by the Express server.

## Product Flow

1. Input objective facts by typing text or uploading a file.
2. Parse uploaded files into editable text.
3. Select recipients, or configure a reusable custom role, its focus areas, preference set, and any recipient-specific preference.
4. Generate role-specific, reviewable drafts through DeepSeek.
5. Review and edit the drafts; use them to support a human decision or confirm selected drafts for delivery.
6. Send only user-confirmed drafts through the configured delivery channel.
7. Review send records and retry failures if needed.

The application assists people in identifying relevant information, risks, open questions, and next actions. It does not automatically determine or execute a management decision.

## API Design

- `GET /api/health`: check service status and DeepSeek configuration.
- `GET /api/roles`: list user-created role definitions, preferences, and preference sets.
- `GET /api/role-profiles`: list role-profile presets used when creating or suggesting a role configuration.
- `GET /api/role-focus-presets`: list local focus presets and optional preference templates.
- `POST /api/roles`: create a reusable role.
- `PUT /api/roles/:key`: update a role custom preference.
- `PATCH /api/roles/:key`: update a reusable custom role and its profile details.
- `DELETE /api/roles/:key`: delete an unused custom role.
- `POST /api/roles/:key/preference-sets`: create a reusable preference set for a role.
- `PATCH /api/preference-sets/:id`: update a preference set.
- `DELETE /api/preference-sets/:id`: delete a preference set.
- `POST /api/role-suggestions`: use a local focus preset when matched, otherwise generate an editable focus-area or preference-set suggestion.
- `GET /api/contacts`: list recipients.
- `POST /api/contacts`: create a recipient with a role or recipient-specific role.
- `PUT /api/contacts/:id`: update a recipient.
- `DELETE /api/contacts/:id`: delete a recipient.
- `POST /api/inputs/parse`: parse text or uploaded files into normalized text.
- `POST /api/generate`: generate role-specific drafts for selected recipients.
- `POST /api/send`: send confirmed drafts through each contact's configured delivery channel.
- `GET /api/records`: list recent generation and send records.

## Data Model

- `roles`: built-in or custom role key, label, default focus/preference, optional role-profile metadata, and reusable preference sets.
- `contacts`: name, selected role or recipient-specific role, selected preference set, recipient-specific preference, delivery type, webhook URL, optional DingTalk robot secret and safety keyword, and active flag.
- `input_records`: source type, original filename, normalized text, created time.
- `generation_records`: input record, contact, role key, draft content, status.
- `send_records`: generation record, delivery type, webhook URL, payload, response status, error, created time.

## Notification Delivery

- `generic_webhook`: sends the existing Interchange JSON payload to the contact webhook URL.
- `dingtalk_robot`: sends a DingTalk Markdown robot message with `msgtype: "markdown"`, title `Interchange - {contact.name}`, and the user-confirmed draft as `markdown.text`.
- DingTalk robot signing is optional per contact. When a secret is configured, the server appends `timestamp` and `sign` query parameters, where `sign` is HmacSHA256 over `timestamp + "\n" + secret`, Base64 encoded.
- DingTalk safety keywords are optional per contact. If configured and absent from the confirmed draft, the server prefixes the keyword before sending to avoid DingTalk keyword-security rejection.
- DingTalk secrets are stored server-side only. Contact APIs return `dingtalkSecretConfigured: boolean` and never return the secret value.
- No generated message is delivered until the user has reviewed and explicitly confirmed it.

## AI Prompting

The server builds a structured prompt with:

- Objective source information.
- Recipient role, default focus, and reusable preference set.
- Recipient-specific preference.
- Requirements to preserve facts, avoid inventing commitments or conclusions, surface unknowns for confirmation, and output immediately usable Chinese content.

The default model is `deepseek-v4-flash`. `DEEPSEEK_MODEL` can override it, and `deepseek-v4-pro` can be used when higher reasoning quality is needed.

The current API produces editable role-specific drafts. A future general decision-support experience may add a more structured, reviewable presentation of priorities, risks, open questions, and alternative actions. It must retain the fact-preservation and human-confirmation boundaries; it is not part of the current API contract.

## External Model and File Compliance Boundary

By default, the only external model path is the DeepSeek text model. It receives `sourceText` plus recipient role and preference context from `/api/generate`.

Original uploaded files are not sent to third-party vision or file models by default. `VISION_MODEL_PROVIDER=none` and `FILE_MODEL_PROVIDER=none` are the default safety policy, where `none` means the external provider is disabled.

Word, PDF, Excel, image, and scanned PDF uploads are parsed locally first. Images use local Tesseract.js OCR, and only the editable OCR text can enter the later DeepSeek generation flow. `/api/generate` continues to consume only `sourceText`; it does not accept, read, or upload original attachments.

If local parsing returns no text, the API returns a readable 422 error explaining that the relevant vision or file model provider is not configured and the file was not sent to an external model. Enabling any future external vision or file provider requires explicit environment configuration plus business confirmation of cost, compliance, data scope, and user-facing notice.

## File Parsing

- Text and Markdown: decode UTF-8 buffer.
- Word: use Mammoth `extractRawText({ buffer })`.
- PDF: use `PDFParse({ data: buffer }).getText()` and destroy the parser.
- Excel: use `read-excel-file` for `.xlsx` buffers and direct UTF-8 decoding for `.csv`.
- Images: use Tesseract.js worker OCR and return editable text.

## Specialist AI Development Workflow

The AI development workflow remains a specialist capability. The project-local Agent Skill under `agent-skills/interchange-message-router` and the portable `agent-skills-v2` package support AI coding contexts, human confirmation, webhook delivery, and an OpenSpec-like `explore -> propose -> context -> apply -> archive` workflow. These workflows remain development-specific and do not imply equivalent general-user automation.
