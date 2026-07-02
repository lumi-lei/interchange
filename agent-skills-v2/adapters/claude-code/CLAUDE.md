# Claude Code Interchange Instructions

Use `agent-skills-v2/core` as the source of truth for Interchange workflows.

- Default to no-config standalone mode.
- Do not require model API keys or a running Interchange server.
- Read `core/roles.md` for role behavior.
- Read `core/workflow.md` for the default flow.
- Read `core/confirmation-policy.md` before any external send.
- Use `core/openspec-like.md` for project change artifacts.
- For project changes, follow the OpenSpec-like loop: explore -> propose -> context -> apply -> archive.
- Do not modify product code until proposal, design, tasks, and delta-spec exist and the user confirms implementation.

When asked to send a message, first show final recipient, webhook URL, and content. Send only after explicit confirmation.
