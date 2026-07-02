# Generic Interchange Start Prompt

Use the Interchange workflow in this folder.

Rules:

- Work in no-config standalone mode by default.
- Do not require a local server, model API key, or database.
- Use `core/roles.md`, `core/workflow.md`, `core/prompt-patterns.md`, and `core/confirmation-policy.md`.
- Analyze the provided facts or inspect relevant project files when asked.
- Create role-specific Chinese drafts.
- Preserve objective facts and label missing information as `需要确认：`.
- Show drafts for human review.
- Do not send anything until the user explicitly confirms final content and destination.

User task:

```text
<paste objective facts or ask the AI tool to inspect project files>
```
