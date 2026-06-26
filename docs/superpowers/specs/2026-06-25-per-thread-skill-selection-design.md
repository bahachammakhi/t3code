# Per-Thread Skill Selection — Design

**Date:** 2026-06-25
**Status:** Approved (ready for implementation plan)

## Summary

Let users choose, per thread, which Claude Code SKILL.md-based skills the agent
should use. Skills are already a first-class concept in t3code: each provider
snapshot carries a `skills` array (`ServerProviderSkill`) discovered by the
underlying CLI and surfaced in the UI. This feature adds a **per-thread
selection** of those skills and **steers the agent toward them** by injecting
the existing `$skillname` directive into the turn.

Selection is **off by default**, **opt-in per thread**, and **changeable
anytime** (the next turn uses the updated set).

## Scope decision: "Direction", not "Gating"

The backend does **not** currently control which skills the agent uses. Skills
are discovered by the underlying CLI (Codex/Claude) from disk; t3code calls
`skills/list` only to *display* them, and the `ServerProviderSkill.enabled`
flag is display-only (`apps/web/src/providerSkillSearch.ts:74`,
`apps/web/src/components/ComposerPromptEditor.tsx:465`). Nothing in the turn
invocation passes a skill set to the agent.

Because true *gating* (restricting availability) would require each provider CLI
to support a per-turn skill allowlist — unconfirmed and provider-specific — this
design ships the **certain, t3code-only** path: per-thread selection that
**steers** the agent by injecting selected skills as `$skillname` directives.
This works for every provider with no CLI dependency. It directs the agent to
the selected skills; it does not forbid others.

True gating and extra skill-source folders are captured under
[Future work](#future-work) and intentionally **not** implemented now.

## Architecture

Data flows: **SkillSelector UI → draft store → send context → message text →
agent**. No contract or backend change is required.

```
ChatComposer (SkillSelector popover)
  └─ toggles selectedSkillNames
       │
composerDraftStore  (per-thread, persisted to localStorage)
  └─ ComposerThreadDraftState.selectedSkillNames: string[]
       │
ChatView.onSend → getSendContext()
  └─ builds a "Use these skills for this turn: $a $b" directive
     for selected skills not already referenced inline, and
     prepends it to message.text
       │
ThreadTurnStartCommand.message.text   (unchanged schema)
  └─ $skillname tokens are the existing signal the agent understands
```

## Components

### 1. Draft-store state (`apps/web/src/composerDraftStore.ts`)

Add one field to both the runtime and persisted shapes:

- `ComposerThreadDraftState.selectedSkillNames: string[]` (runtime,
  ~lines 250-285)
- `PersistedComposerThreadDraftState.selectedSkillNames` (persisted,
  ~lines 128-175)
- `createEmptyThreadDraft()` initializes it to `[]` (~line 595)
- Persisted-draft upgrade/migration logic defaults missing values to `[]` so
  existing drafts load cleanly

New store actions (mirroring existing per-thread setters):

- `setComposerDraftSelectedSkills(target, names: string[])`
- `toggleComposerDraftSkill(target, name: string)`
- `clearComposerDraftSkills(target)`

**Rationale — store skill `name`s, flat array, client-side:** folder/grouping
metadata (`scope`, `path`) already lives on each `ServerProviderSkill`, so the
UI derives grouping at render time. The per-thread state only needs to remember
*which* skills are on. Keeping it in the draft store matches exactly how
`activeProvider`, `runtimeMode`, `interactionMode`, and
`modelSelectionByProvider` already persist per thread. Promotion to server-side
thread state is a future option if cross-device sync is ever needed.

### 2. Send-time injection (`apps/web/src/components/ChatView.tsx`,
`apps/web/src/components/chat/ChatComposer.tsx`)

- `getSendContext()` includes `selectedSkillNames` (read from the draft).
- `onSend()` computes the set of selected skills **not already referenced
  inline** in the prompt text, and if non-empty prepends a single directive
  line to `message.text`:

  ```
  Use these skills for this turn: $skill-a $skill-b
  ```

- When the selection is empty, no directive is added — message text is
  unchanged.
- The directive is re-derived from the draft on every send, so a mid-thread
  selection change is reflected on the next turn automatically.

**Why prepend to `text`:** `$skillname` tokens in `message.text` are the
existing, provider-agnostic signal (rendered by `SkillInlineText.tsx`). Reusing
them avoids any schema/backend change and keeps the steer transparent in the
sent message.

### 3. SkillSelector UI (`apps/web/src/components/chat/SkillSelector.tsx` — new)

- A popover triggered from a control in the composer footer toolbar (alongside
  the existing mode/model controls in `ChatComposer.tsx`).
- Lists the **active provider's** discovered skills, **grouped by `scope` /
  `path`** (the folder structure already on `ServerProviderSkill`), each with a
  toggle.
- Footer shows a count ("N skills on") and a "Clear" action.
- Reads/writes `selectedSkillNames` via the new draft-store actions; toggles
  persist immediately.
- Default/empty state: nothing selected; a subtle, unobtrusive toolbar
  affordance.
- Reuse existing presentation helpers (`providerSkillPresentation.ts`,
  `providerSkillSearch.ts`) for labels/descriptions/ordering.

## Data flow (send)

1. User toggles skills in `SkillSelector` → `selectedSkillNames` updated in the
   draft (persisted).
2. User sends → `onSend` calls `getSendContext()` → reads `selectedSkillNames`.
3. For selected skills not already inline, build the directive line and prepend
   it to `message.text`.
4. `startThreadTurn` dispatches the unchanged `ThreadTurnStartCommand`; the
   agent sees the `$skillname` directives.

## Error / edge cases

- **Empty selection:** no directive; message text unchanged (default path).
- **Skill already referenced inline (`$name` typed by the user):** not
  duplicated in the directive.
- **Selected skill no longer present in the provider snapshot** (renamed/
  removed): silently skipped when building the directive; the UI shows only
  currently-discovered skills, so stale selections naturally fall away.
- **Provider switch mid-thread:** selection is by skill `name`; names absent
  from the new provider are skipped at send and not shown in the selector.
- **Migration:** drafts persisted before this change load with
  `selectedSkillNames` defaulted to `[]`.

## Testing

- **Draft store:** default `[]`; `set`/`toggle`/`clear` actions; persistence
  round-trip; migration defaults missing field to `[]`.
- **Injection:** directive built only for selected-but-not-already-inline
  skills; no directive when selection empty; updated selection reflected on the
  next send; inline `$name` not duplicated.
- **UI:** grouping by `scope`/`path`; toggle round-trips to the draft; count and
  clear behave; only currently-discovered skills are listed.

## Claude skill discovery (implemented 2026-06-25)

Only the Codex provider exposed skills (via its `skills/list` RPC); Claude's ACP
has no skills capability, so under Claude the selector had nothing to show. To
fix this, t3code now discovers Claude Code `SKILL.md` skills from disk:

- `apps/server/src/provider/claudeSkills.ts` — `parseSkillFrontmatter` /
  `toClaudeSkill` (pure) and `discoverClaudeSkills({ cwd?, extraDirs? })`, an
  Effect that recursively scans `~/.claude/skills`, `<cwd>/.claude/skills`, and
  any configured `extraDirs` for `SKILL.md` files (bounded depth, skipping
  `node_modules`/`.git`/etc.), parses frontmatter, dedupes by name, and never
  fails (problems resolve to `[]`).
- `ClaudeProvider.ts` calls it (providing `NodeServices.layer` locally so the
  driver's context type is unchanged) and passes the result to
  `buildServerProvider({ skills })`.
- **Configurable folders:** a new `skillDirectories` field on `ClaudeSettings`
  (`packages/contracts/src/settings.ts`) — a newline/comma-separated list shown
  in the Claude provider settings form — feeds `extraDirs`. This is how a user
  points t3code at e.g. `~/.claude/plugins` to surface plugin skills.

## Future work (not yet implemented)

- **True availability gating:** restrict which skills the agent may use, via a
  `ThreadSkillSelection` module mirroring `ThreadMcpSelection`
  (`ws.ts` → `CodexAdapter.ts`), injecting a skill allowlist as CLI config
  args. Still gated on confirming per-CLI support.
- **Server-side per-thread persistence:** promote `selectedSkillNames` onto
  `OrchestrationThread` for cross-device sync.
