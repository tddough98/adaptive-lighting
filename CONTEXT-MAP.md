# Context Map

This repo uses a multi-context domain-doc layout. Engineering skills should use this map to find the context docs relevant to the area they are changing.

| Context | Context file | Context ADRs | Scope |
| ------- | ------------ | ------------ | ----- |
| `react-dashboard` | `panel/CONTEXT.md` | `panel/docs/adr/` | React custom panel for visual curve editing |

System-wide decisions live in `docs/adr/`.

If a referenced context file or ADR directory does not exist yet, proceed silently. Producer skills create them lazily when domain terms or decisions are resolved.
