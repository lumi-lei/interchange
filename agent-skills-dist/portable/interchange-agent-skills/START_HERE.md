# Interchange Agent Skills v2

Use this folder to turn objective project facts into role-specific messages, AI coding context, and OpenSpec-like change artifacts.

## One-minute Start

1. Pick the adapter for your AI coding tool:
   - Codex: use `skills/*/SKILL.md` as native skills.
   - Claude Code: read `adapters/claude-code/CLAUDE.md`.
   - Cursor: read `adapters/cursor/rules.md`.
   - OpenCode: read `adapters/opencode/instructions.md`.
   - Any other tool: paste `adapters/generic/start-prompt.md`.
2. Provide objective facts, such as requirements, meeting notes, code paths, test output, or issue text.
3. Ask the AI tool to draft for the target roles.
4. Review and edit the drafts.
5. Send only after explicit confirmation.

## Default Mode

The default mode is no-config standalone use:

- no Interchange server required
- no DeepSeek or OpenAI API key required
- no database required
- no webhook required unless you want actual delivery

The AI coding tool you are already using performs the analysis and writing.

## Optional Enhancements

- Use `scripts/format_drafts.mjs` to turn drafts into Markdown or JSON.
- Use `scripts/send_webhook.mjs` only for confirmed webhook delivery.
- Use `scripts/interchange_api.mjs` only when a local Interchange server is already running.
