# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This repo uses a multi-context layout. Read `CONTEXT-MAP.md` at the repo root to find the relevant context docs for the area being changed.

Known contexts:

| Context | Context file | Context ADRs | Scope |
| ------- | ------------ | ------------ | ----- |
| `react-dashboard` | `panel/CONTEXT.md` | `panel/docs/adr/` | React custom panel for visual curve editing |

System-wide architectural decisions live in `docs/adr/`.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root if it exists. It points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **Context-specific `CONTEXT.md` files** listed in `CONTEXT-MAP.md`, such as `panel/CONTEXT.md` for `react-dashboard` work.
- **`docs/adr/`** for system-wide decisions that touch the area you're about to work in.
- **Context-specific ADRs**, such as `panel/docs/adr/`, for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

Expected multi-context structure:

```text
/
├── CONTEXT-MAP.md
├── docs/adr/                  # system-wide decisions
└── panel/
    ├── CONTEXT.md             # react-dashboard context
    └── docs/adr/              # react-dashboard decisions
```

## Use the glossary's vocabulary

When your output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use, or there's a real gap to note for `/grill-with-docs`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because..._
