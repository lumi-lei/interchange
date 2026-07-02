# OpenSpec-like Workflow

Use this workflow to prepare reviewable project change artifacts before implementation.

## Change Package

```text
proposal.md
context.md
design.md
tasks.md
delta-spec.md
review.md
```

## proposal.md

Include:

- background
- goals
- non-goals
- affected scope
- risks
- acceptance criteria

## context.md

Include:

- task goal
- must-read specs or docs
- must-read code paths
- business rules
- forbidden changes
- verification commands
- open questions

## design.md

Include:

- intended approach
- public interfaces or schemas
- data flow
- failure modes
- compatibility notes

## tasks.md

Use an executable checklist. Keep tasks small enough for an AI coding tool to complete and verify.

## delta-spec.md

Separate changes into:

- ADDED
- MODIFIED
- REMOVED
- affected specs
- questions needing human confirmation

## archive

Only archive after implementation and verification. Merge confirmed delta-spec changes into long-term specs, then move the change package to archive.
