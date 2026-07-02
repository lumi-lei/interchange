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

1. Maintain recipients and assign each one a built-in role.
2. Input source information by typing text or uploading a file.
3. Parse uploaded files into editable text.
4. Select recipients.
5. Generate role-specific message drafts through DeepSeek.
6. Review and edit each draft.
7. Confirm and send selected drafts through the selected contact delivery channel.
8. Review send records and retry failures if needed.

## API Design

- `GET /api/health`: check service status and DeepSeek configuration.
- `GET /api/roles`: list role definitions and current custom preferences.
- `PUT /api/roles/:key`: update a role custom preference.
- `GET /api/contacts`: list recipients.
- `POST /api/contacts`: create a recipient.
- `PUT /api/contacts/:id`: update a recipient.
- `DELETE /api/contacts/:id`: delete a recipient.
- `POST /api/inputs/parse`: parse text or uploaded files into normalized text.
- `POST /api/generate`: generate role-specific drafts for selected recipients.
- `POST /api/send`: send confirmed drafts through each contact's configured delivery channel.
- `GET /api/records`: list recent generation and send records.

## Data Model

- `roles`: built-in role key, label, default preference, custom preference.
- `contacts`: name, role key, delivery type, webhook URL, optional DingTalk robot secret and safety keyword, custom preference, active flag.
- `input_records`: source type, original filename, normalized text, created time.
- `generation_records`: input record, contact, role key, draft content, status.
- `send_records`: generation record, delivery type, webhook URL, payload, response status, error, created time.

## Notification Delivery

- `generic_webhook`: sends the existing Interchange JSON payload to the contact webhook URL.
- `dingtalk_robot`: sends a DingTalk Markdown robot message with `msgtype: "markdown"`, title `Interchange - {contact.name}`, and the user-confirmed draft as `markdown.text`.
- DingTalk robot signing is optional per contact. When a secret is configured, the server appends `timestamp` and `sign` query parameters, where `sign` is HmacSHA256 over `timestamp + "\n" + secret`, Base64 encoded.
- DingTalk safety keywords are optional per contact. If configured and absent from the confirmed draft, the server prefixes the keyword before sending to avoid DingTalk keyword-security rejection.
- DingTalk secrets are stored server-side only. Contact APIs return `dingtalkSecretConfigured: boolean` and never return the secret value.

## AI Prompting

The server builds a structured prompt with:

- Objective source information.
- Recipient role and role preference.
- Recipient-specific preference.
- Requirements to preserve facts, avoid inventing commitments, and output immediately usable Chinese content.

The default model is `deepseek-v4-flash`. `DEEPSEEK_MODEL` can override it, and `deepseek-v4-pro` can be used when higher reasoning quality is needed.

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

## Agent Skill

After the web app is implemented, a project-local skill is added under `agent-skills/interchange-message-router`. It instructs other AI agents to:

- Gather objective information.
- Call the local Interchange API.
- Review generated role-specific messages.
- Trigger send only after explicit user confirmation.

The skill reuses the web backend and does not duplicate business logic.
