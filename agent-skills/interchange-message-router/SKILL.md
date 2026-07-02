---
name: interchange-message-router
description: Use the local Interchange web service to transform objective project updates into role-specific messages for product, QA, tech leads, leaders, customers, and AI coding tools, then send only after user confirmation.
---

# Interchange Message Router

Use this skill when the user wants to distribute objective project information to multiple human or AI roles without rewriting the message manually. Contacts may send through generic webhooks or DingTalk group robots, depending on their saved delivery channel.

## Requirements

- The Interchange server must be running locally.
- Default local API base: `http://127.0.0.1:4120/api`.
- Do not send messages until the user explicitly confirms the drafts.

## Workflow

1. Collect the objective source information.
2. Check service status with `GET /health`.
3. Load recipients with `GET /contacts` and roles with `GET /roles`.
4. If the user provides a file, submit it to `POST /inputs/parse` as multipart form data and use the returned editable text.
5. Ask the user which recipients should receive the update if the request does not specify them.
6. Call `POST /generate` with:

```json
{
  "sourceText": "objective source text",
  "inputRecordId": null,
  "contactIds": [1, 2, 3]
}
```

7. Show the generated drafts to the user for review.
8. Only after confirmation, call `POST /send`. The server sends each confirmed message through the contact's configured delivery channel:

```json
{
  "messages": [
    {
      "generationRecordId": 1,
      "contactId": 1,
      "content": "confirmed message"
    }
  ]
}
```

## Guardrails

- Preserve objective facts. Do not add commitments, dates, owners, or release promises that were not present in the source.
- If DeepSeek is not configured, tell the user to configure `DEEPSEEK_API_KEY` in the Interchange `.env`.
- If a contact has no webhook URL, keep the draft as copyable text and report that it was not sent.
- DingTalk robot contacts send Markdown messages. Do not ask for or expose DingTalk secrets; the local server only reports whether a secret is configured.
- When interacting with another codebase, do not infer project changes from memory. Read the relevant files or ask the user for source information.

