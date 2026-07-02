# Cursor Rules for Interchange

Apply these rules when using Interchange in Cursor:

- Use `agent-skills-v2/core/roles.md` to draft role-specific messages.
- Use `agent-skills-v2/core/workflow.md` for no-config standalone operation.
- Do not require a local server or model API key.
- Inspect code and tests before deriving codebase facts.
- Preserve objective facts; do not invent commitments.
- Use `需要确认：` for missing facts.
- Do not call webhook scripts or Connected Mode send APIs without explicit confirmation.
