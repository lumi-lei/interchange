---
name: interchange
description: Transform objective project facts into role-specific Chinese drafts, AI coding tool context, OpenSpec-like project change workflows, and confirmed delivery payloads. Use when a user wants Interchange-style communication, AI coding context, the "agree before implementation, then archive" workflow, proposal/context/design/tasks/delta-spec files, or teammate handoffs; use Connected Mode only when the user explicitly asks to reuse a running local Interchange server.
---

# Interchange

Use this skill to turn objective project facts into clear handoffs for humans and AI coding tools. Default to standalone mode: use the current AI tool's own reasoning and do not require a local Interchange server, database, DeepSeek key, OpenAI key, or webhook URL.

## Mode Selection

- Use standalone drafting for ordinary message rewriting, AI coding context, OpenSpec-like change packages, and review-ready drafts.
- Use the OpenSpec-like flow for project changes that need agreement before implementation and long-term spec archival.
- Use Connected Mode only when the user explicitly asks to reuse a running Interchange web app or its saved contacts, roles, parsing, generation, records, or send API.
- Use webhook sending only after the user confirms the exact final recipient, destination URL, and message content.

## Required References

Read only the references needed for the task:

- `references/workflow.md`: default standalone workflow and source priority.
- `references/roles.md`: role-specific focus areas and recipient expectations.
- `references/prompt-patterns.md`: reusable draft patterns.
- `references/confirmation-policy.md`: required boundary before external sending.
- `references/openspec-like.md`: proposal, design, tasks, delta spec, and archive artifacts.
- `references/connected-api.md`: optional local Interchange API endpoints and safety boundary.

## Message Drafting

1. Gather objective facts from the user, inspected project files, issue text, specs, meeting notes, logs, tests, or imported documents.
2. Identify target roles. If no target is specified, ask which roles to draft for.
3. Read `references/workflow.md`, `references/roles.md`, `references/prompt-patterns.md`, and `references/confirmation-policy.md`.
4. Separate confirmed facts from assumptions and missing information.
5. Produce one editable Chinese draft per target role.
6. Preserve facts exactly. Do not invent owners, dates, commitments, release status, business conclusions, or delivery promises.
7. Put missing information under `需要确认：`.
8. Stop after showing drafts unless the user explicitly asks for a next step.

Return drafts grouped by role:

```md
## Product
...

## QA
...

## My AI Coding Tool
...
```

For machine-readable output, run `node scripts/format_drafts.mjs` after drafting if the user asks for JSON or a formatted handoff file.

## AI Coding Context

When preparing a prompt for an AI coding tool, focus on executable context:

- objective and user-visible outcome
- files, modules, routes, tests, or logs to inspect
- constraints and safety boundaries
- implementation scope
- acceptance criteria
- verification commands
- open questions under `需要确认：`

Distinguish whether the prompt is for the user's current AI coding tool or a teammate's AI coding tool. For a teammate, include more repository orientation and avoid relying on unstated local context.

## OpenSpec-Like Flow

For project change planning, read `references/openspec-like.md`. Create only the artifacts requested by the user. If unspecified, produce a compact package with:

- proposal
- context
- design notes
- tasks
- delta spec
- archive notes when the implementation is complete and verified

Keep artifacts factual, testable, and small enough for an AI coding tool to execute.

For a new project change, follow this loop:

```text
explore -> propose -> context -> apply -> archive
```

Before modifying product code, create or update:

```text
interchange/changes/<change-id>/
  change.yaml
  proposal.md
  context.md
  design.md
  tasks.md
  delta-spec.md
  implementation-notes.md
  review.md
```

Prefer the bundled scaffold script:

```bash
node scripts/create_change_package.mjs --id <change-id> --domain <domain> --goal "<goal>"
```

Do not enter the apply phase until the user explicitly confirms the proposal, design, tasks, and delta spec. Archive only after implementation and verification, then merge the confirmed delta into `interchange/specs/<domain>/`.

## Connected Mode

Use Connected Mode only on explicit request. Read `references/connected-api.md` first.

Default API base:

```text
http://127.0.0.1:4120/api
```

Check health:

```bash
node scripts/interchange_api.mjs health
```

Use `--base-url` when the Interchange server is on another device:

```bash
node scripts/interchange_api.mjs health --base-url http://HOST_OR_IP:4120/api
```

If the server is unavailable or an API call fails, say Connected Mode is unavailable and continue in standalone mode when possible.

## Sending Boundary

Never send messages through a webhook or `/api/send` until the user has reviewed and explicitly confirmed:

- recipient or contact
- destination URL or connected API target
- exact final content

Use `node scripts/send_webhook.mjs` for confirmed direct webhook delivery. Use `node scripts/interchange_api.mjs send --messages messages.json` only for connected server sending. Prefer `--dry-run` before live delivery.
