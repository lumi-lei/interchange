# Interchange Requirements

## Product Positioning

Interchange is a local-first role-based information transformation and collaboration tool for ordinary individuals, collaborative teams, and responsible people. A user provides confirmed source facts once, then adapts them for each recipient or custom role according to that role's focus and communication preference.

AI-assisted development teams and multi-agent collaboration are important specialist scenarios, not the product's only audience. The product also supports everyday collaboration, project communication, and management reporting. It provides decision support by clarifying relevant information; it does not make or execute management decisions on the user's behalf.

## Goals

- Accept objective source information in common working formats.
- Convert the same information into role-specific, reviewable content using DeepSeek.
- Let users maintain recipients and assign a built-in or custom role to each recipient.
- Let users define reusable custom roles, default focus areas, preference sets, and recipient-level preferences.
- Let users preview and edit generated messages before making a decision or sending them.
- Send only user-confirmed messages through a generic webhook or DingTalk robot webhook.
- Provide a responsive web page first.
- Package the AI-assisted development workflow as an Agent Skill after the web version works.

## Decision-Support Boundary

- Generated content may help users surface priorities, risks, open questions, and next actions from the supplied facts.
- The system must preserve facts and must not invent conclusions, commitments, owners, dates, or business decisions.
- The user remains responsible for interpreting drafts, making management decisions, editing content, and confirming any external delivery.
- The system must not automatically make a management decision or send generated content.

## Supported Inputs

- Plain text
- Markdown
- Word `.docx`
- PDF
- Excel `.xlsx` and CSV exports
- Screenshots and images

Images are processed with OCR first. The extracted text is editable before it is sent to DeepSeek.

Legacy binary `.xls` files are not part of the MVP parser. Users should save those spreadsheets as `.xlsx` or `.csv`.

Original uploaded files are not sent to third-party vision or file models by default. The default configuration keeps `VISION_MODEL_PROVIDER=none` and `FILE_MODEL_PROVIDER=none`; only editable `sourceText` is sent to the DeepSeek text model during generation.

## Roles and Preferences

The built-in roles are:

- Product
- QA / Test
- Tech Lead
- Department Leader
- Customer
- My AI Coding Tool
- Teammate AI Coding Tool

Each role has a default communication preference. In addition, users can create any reusable custom role, define its default focus area, add reusable preference sets, or use a recipient-specific role and preference. These are general-purpose capabilities and are not limited to software-development roles.

The two AI Coding Tool roles remain specialist roles. They generate development-oriented context for downstream AI agents, including implementation boundaries, relevant documents, acceptance criteria, collaboration constraints, and testing expectations.

## Notification Policy

- The MVP uses generic webhook and DingTalk robot delivery.
- Generated messages are not sent automatically.
- The user must review, edit if necessary, and confirm which recipient messages should be sent.
- Each send attempt is recorded with success or failure details.

## Acceptance Criteria

- The user can create and edit recipients with built-in roles, custom roles, and webhook URLs.
- The user can create reusable custom roles, focus areas, and preference sets, and set recipient-specific preferences.
- The user can upload or type objective information.
- The app can extract editable text from supported files.
- The app can call DeepSeek when `DEEPSEEK_API_KEY` is configured.
- The app returns one reviewable draft per selected recipient.
- The user can edit each draft before using it for a decision or sending it.
- The app can POST only confirmed messages to each recipient webhook.
- Missing DeepSeek configuration produces a clear error without exposing secrets.
- The layout works at 375px, 768px, 1024px, and 1440px widths.
