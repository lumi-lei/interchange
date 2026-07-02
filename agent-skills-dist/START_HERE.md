# Interchange Agent Skills Distribution

This folder contains two ways to use Interchange from other AI coding tools.

## Packages

- `portable/interchange-agent-skills`: Copy this folder to any project or device. Use the adapter for the target AI tool.
- `codex/interchange`: Copy this folder to `~/.codex/skills/interchange` for native Codex Skill use.

## AI Tool Adapters

- Codex: install `codex/interchange`, then invoke `$interchange`.
- Claude Code: copy `portable/interchange-agent-skills` into the target project and include `adapters/claude-code/CLAUDE.md`.
- Cursor: copy `portable/interchange-agent-skills` and place `adapters/cursor/rules.md` into Cursor rules.
- OpenCode: copy `portable/interchange-agent-skills` and use `adapters/opencode/instructions.md`.
- Other AI tools: paste `adapters/generic/start-prompt.md` and include the `core` folder as reference material.

## Default Behavior

Use standalone mode by default. It requires no Interchange server, database, model API key, or webhook URL. The target AI coding tool uses its own model to draft role-specific Chinese messages, AI coding context, and OpenSpec-like artifacts.

For project changes, use the OpenSpec-like flow:

```text
explore -> propose -> context -> apply -> archive
```

Codex users can invoke `$interchange` and ask for a change package. Portable users should start from `portable/interchange-agent-skills/START_HERE.md` or the target adapter. The flow creates proposal/context/design/tasks/delta-spec artifacts first and pauses for confirmation before implementation.

Use Connected Mode only when a running Interchange server is explicitly requested. For cross-device use, pass a reachable base URL such as:

```bash
node scripts/interchange_api.mjs health --base-url http://HOST_OR_IP:4120/api
```

Do not send through webhooks or Connected Mode until the user confirms the exact recipient, destination, and final content.
