# Features

Each phase of WAVIVI lives in its own feature module. A feature is a
self-contained slice of the app and should expose its public surface via an
`index.ts` barrel.

```
features/
  <feature>/
    components/   UI specific to this feature
    hooks/        React hooks
    api/          data access (Supabase queries, server actions)
    types.ts      feature-local types
    index.ts      public exports
```

Planned feature modules (see `src/config/phases.ts`):

| Folder       | Phase | Scope                          |
| ------------ | ----- | ------------------------------ |
| `auth/`      | 2     | Authentication & profiles      |
| `map/`       | 3     | Live map system                |
| `discovery/` | 4     | Traveler discovery             |
| `chat/`      | 5     | Group chat ecosystem           |
| `events/`    | 6     | Events & meetups               |
| `vibe/`      | 7     | Vibe / heat system             |
| `recommend/` | 8     | AI recommendation layer        |
| `venues/`    | 9     | Partner / venue system         |
| `safety/`    | 11    | Safety & verification          |

Rules:
- Features may import from `lib/`, `components/`, `config/`, `types/`.
- Features must **not** import from each other directly — share via `lib/`
  or lift shared code up.
- Cross-cutting UI primitives go in `src/components/ui/`.
