# Interchange Requirements

## Background

Interchange is a lightweight tool for AI-assisted development teams. The user often needs to share objective project information with different human and AI roles, but each role cares about different details. Rewriting the same facts repeatedly costs time and increases information loss.

The product should transform one source message into role-specific messages and help send timely notifications to the team.

## Goals

- Accept objective source information in common working formats.
- Convert the same information into role-specific content using DeepSeek.
- Let the user maintain recipients and assign roles to each recipient.
- Let the user customize each existing role according to their speaking habits.
- Let the user preview and edit generated messages before sending.
- Send confirmed messages through a generic webhook.
- Provide a responsive web page first.
- After the web version works, package the workflow as an Agent Skill for other AI tools.

## Supported Inputs

- Plain text
- Markdown
- Word `.docx`
- PDF
- Excel `.xlsx` and CSV exports
- Screenshots and images

Images are processed with OCR first. The extracted text is editable before it is sent to DeepSeek.

Legacy binary `.xls` files are not part of the MVP parser. Users should save those spreadsheets as `.xlsx` or `.csv`.

## Built-in Roles

- Product
- QA / Test
- Tech Lead
- Department Leader
- Customer
- My AI Coding Tool
- Teammate AI Coding Tool

Each role has a default communication preference. Users can override role preferences and recipient-level preferences.

## Notification Policy

- The MVP uses generic webhook delivery.
- Generated messages are not sent automatically.
- The user must confirm which recipient messages should be sent.
- Each send attempt is recorded with success or failure details.

## Acceptance Criteria

- The user can create and edit recipients with roles and webhook URLs.
- The user can upload or type objective information.
- The app can extract editable text from supported files.
- The app can call DeepSeek when `DEEPSEEK_API_KEY` is configured.
- The app returns one draft per selected recipient.
- The user can edit each draft before sending.
- The app can POST confirmed messages to each recipient webhook.
- Missing DeepSeek configuration produces a clear error without exposing secrets.
- The layout works at 375px, 768px, 1024px, and 1440px widths.
