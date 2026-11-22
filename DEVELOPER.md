# SnapVault — Mandatory Operating Protocol

> **This is the supreme governance document for the SnapVault project.**
> Every future development prompt, phase, hotfix, and refactor **MUST** comply with every rule defined here. No exceptions, no shortcuts, no "we'll fix it later." If a rule conflicts with convenience, the rule wins.

---

## 1. Team Role Division

On every prompt, work is divided across five specialized roles. Each role has explicit responsibilities and boundaries. No role may bypass another role's gate.

### 1.1 Project Manager (PM)

The PM is the first to act on every prompt and the last to verify document consistency.

**Start-of-Prompt Ritual (mandatory, every prompt):**

1. Read `PLAN.md` in full — confirm the current phase and its goals.
2. Read `ROADMAP.md` — identify which tasks are `[ ]` (pending), `[-]` (in-progress), or `[x]` (done).
3. Read `ISSUES.md` — check for open blockers, regressions, or deferred items.
4. Cross-reference all three documents for consistency. If any conflict exists (e.g., `ROADMAP.md` says a task is done but `ISSUES.md` has an open bug against it), resolve the conflict before proceeding.

**Responsibilities:**

| Duty | Detail |
|---|---|
| **Decompose the prompt** | Break the user's request into atomic subtasks. Each subtask has a unique ID (e.g., `P3-T04`), a one-line title, a bulleted list of acceptance criteria, and an assignee (Backend or Frontend). |
| **Assign subtasks** | Route Rust/SQLite/filesystem work to the Backend Engineer. Route React/TypeScript/Tailwind/UI work to the Frontend Engineer. Shared concerns (e.g., IPC contract) are co-assigned with one owner. |
| **Track status** | Update `ROADMAP.md` checkboxes after each subtask passes Task QA. Mark tasks `[-]` while in progress, `[x]` only after Task QA sign-off. |
| **Update ISSUES.md** | Log new issues discovered during the prompt. Close resolved issues with a resolution note and the commit/phase reference. |
| **Ensure cross-document consistency** | At prompt end, verify that `PLAN.md`, `ROADMAP.md`, `ISSUES.md`, and the phase report all tell the same story. |

### 1.2 Backend Engineer (Rust / SQLite)

The Backend Engineer owns everything that runs inside the Tauri Rust process.

**Ownership Scope:**

- Chunking engine (content-defined chunking with configurable parameters)
- BLAKE3 hashing for chunk deduplication and integrity verification
- Filesystem traversal, filtering, and snapshot diffing
- Windows API integration (VSS shadow copies, long-path support, file locking detection)
- SQLite schema design, migrations, and query optimization
- Tauri IPC command handlers (`#[tauri::command]`)
- All `src-tauri/` code

**Mandatory Practices:**

```text
1. Every public function MUST have at least one `#[test]` unit test.
2. Every `#[tauri::command]` MUST return `Result<T, String>` — never panic across the IPC boundary.
3. All file paths MUST be processed through the long-path normalizer (`\\?\` prefix) before any OS call.
4. All file I/O MUST handle `PermissionDenied`, `NotFound`, and `FileLocked` gracefully — log and continue.
5. All SQLite writes MUST be wrapped in explicit transactions with rollback on error.
6. All disk writes MUST use atomic write pattern: write `.tmp` → fsync → rename.
7. No `unwrap()` or `expect()` on any I/O operation, IPC input, or database query.
8. No `unsafe` blocks without a `// SAFETY:` comment explaining the invariant.
```

### 1.3 Frontend Engineer (React / TypeScript / Tailwind)

The Frontend Engineer owns everything that renders in the Tauri WebView.

**Ownership Scope:**

- All React components (`src/components/`)
- All pages/views (`src/pages/`)
- All custom hooks (`src/hooks/`)
- All TypeScript type definitions (`src/types/`)
- Tailwind CSS configuration and utility classes
- Tauri IPC invocations via `@tauri-apps/api/core`
- State management (Zustand stores or React Context)

**Mandatory Practices:**

```text
1. Functional components ONLY — no class components, ever.
2. All component props MUST have explicit TypeScript interfaces — no `any` type.
3. All IPC calls MUST use typed wrappers with proper error handling and loading states.
4. Keyboard navigation MUST work for every interactive element (Tab, Enter, Escape, Arrow keys).
5. All text MUST be screen-reader accessible (semantic HTML, ARIA labels where needed).
6. High-contrast mode MUST be supported (respect `prefers-contrast` media query).
7. All user-facing strings MUST be centralized in a constants file for future i18n.
8. No inline styles — Tailwind utilities only, extract to `@apply` components at 3+ repetitions.
9. Every component rendering a list MUST handle the empty state gracefully.
10. Loading and error states MUST be visually distinct and informative.
```

### 1.4 Task QA Verifier (Per-Task Verification Loop)

The Task QA Verifier inspects every subtask **immediately** after a developer marks it as implemented. This is not optional. This is not "if there's time." This runs on every single subtask.

**Verification Checklist (run in order):**

| Step | Command / Action | Pass Criteria |
|---|---|---|
| 1 | `cargo check` | Zero errors |
| 2 | `cargo test` | All tests pass, zero failures |
| 3 | `cargo clippy -- -D warnings` | Zero warnings, zero errors |
| 4 | `npm run build` | Successful production build, zero TypeScript errors |
| 5 | `npm run lint` | Zero lint errors, zero lint warnings |
| 6 | Manual acceptance criteria review | Every bullet point from PM's task description is demonstrably satisfied |
| 7 | Edge case audit | Verify handling of: empty input, Unicode paths, locked files, max-length paths, concurrent access |

**The Mandatory Verify → Fix → Recheck Loop:**

```
┌─────────────────────────────────────────────────────────┐
│                   DEVELOPER SUBMITS TASK                │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              TASK QA VERIFIER RUNS CHECKLIST            │
└──────────────────────────┬──────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │ ALL PASS?   │
                    └──────┬──────┘
                     YES   │   NO
              ┌────────────┤────────────────┐
              ▼                             ▼
   ┌──────────────────┐         ┌───────────────────────┐
   │  MARK TASK [x]   │         │  REJECT WITH DETAILS  │
   │  Update ROADMAP  │         │  - Exact failure msg  │
   └──────────────────┘         │  - File + line number │
                                │  - Expected vs actual │
                                └───────────┬───────────┘
                                            │
                                            ▼
                                ┌───────────────────────┐
                                │  DEVELOPER FIXES      │
                                └───────────┬───────────┘
                                            │
                                            ▼
                                   (Back to QA check)
```

> **IRON-CLAD RULE:** A task is NEVER marked `[x]` on assumption, on "it should work," or on partial passing. 100% of the checklist must pass. The loop repeats as many times as necessary. There is no skip. There is no override.

### 1.5 Central Tester (End-of-Phase Gatekeeper)

After all subtasks in a phase pass their individual Task QA, the Central Tester runs the full integration and regression suite. Only the Central Tester can declare a phase complete.

**Full Test Suite (run in order):**

| Step | Command / Action | Pass Criteria |
|---|---|---|
| 1 | `cargo build --release` | Successful release build, zero errors |
| 2 | `cargo test` | All backend tests pass (unit + integration) |
| 3 | `cargo clippy -- -D warnings` | Zero warnings under deny-all policy |
| 4 | `npm run build` | Frontend production build succeeds |
| 5 | `npm run lint` | Zero lint errors or warnings |
| 6 | App launch smoke test | App window opens, renders correctly, no console errors |
| 7 | Regression test | Verify ALL features from previous phases still work correctly |
| 8 | Performance sanity check | No obvious UI freezes, backup operations complete in reasonable time |

**Phase Verdicts:**

| Verdict | Meaning | Action Required |
|---|---|---|
| **PASS** | All tests pass, all features work, no regressions. | Merge to `main`, generate phase report, proceed to next phase. |
| **PASS WITH WARNINGS** | All tests pass, but minor non-blocking issues exist (e.g., cosmetic UI glitches, non-critical clippy suggestions suppressed with justification). | Merge to `main`, log warnings in `ISSUES.md` as low-priority, generate phase report. |
| **BLOCKED** | One or more tests fail, a regression is detected, or a critical feature is incomplete. | Do NOT merge. All blocking issues must be fixed and the full test suite re-run. The phase remains open. |

---

## 2. Mandatory Post-Prompt Reporting Rule

At the conclusion of **every** prompt or phase of work, the following three actions are **mandatory** and **non-negotiable**:

### 2.1 Generate Phase Report

Create the file `reports/PHASE_<N>_REPORT.md` using the template defined in `reports/REPORT_TEMPLATE.md`.

The report must include:

```markdown
# Phase <N> Report — <Phase Title>
**Date:** YYYY-MM-DD
**Verdict:** PASS | PASS WITH WARNINGS | BLOCKED

## Summary
<2-3 sentence overview of what was accomplished>

## Subtasks Completed
| Task ID | Title | Assignee | Status | Notes |
|---------|-------|----------|--------|-------|
| P<N>-T01 | ... | Backend | ✅ Done | ... |
| P<N>-T02 | ... | Frontend | ✅ Done | ... |

## Test Results
| Test Suite | Result | Details |
|------------|--------|---------|
| cargo build --release | ✅ PASS | Build time: Xs |
| cargo test | ✅ PASS | N tests passed |
| cargo clippy | ✅ PASS | Zero warnings |
| npm run build | ✅ PASS | Bundle size: X KB |
| npm run lint | ✅ PASS | Zero issues |

## Issues Discovered
| Issue ID | Severity | Description | Status |
|----------|----------|-------------|--------|
| ... | ... | ... | Open/Resolved |

## Regressions Checked
<List of previous-phase features verified to still work>

## Files Changed
<List of files added, modified, or deleted with brief descriptions>

## Next Steps
<What the next prompt/phase should focus on>
```

### 2.2 Update ROADMAP.md

- Mark completed tasks as `[x]`.
- Mark in-progress tasks as `[-]`.
- Add any newly discovered tasks as `[ ]` under the appropriate phase.
- Update percentage-complete estimates for each phase.

### 2.3 Update ISSUES.md

- Add new issues with unique IDs, severity, description, and reproduction steps.
- Close resolved issues with a resolution note referencing the fix.
- Re-prioritize existing issues if the landscape has changed.

### 2.4 Present Summary in Chat

After generating the report and updating documents, present a concise summary in the chat response:

```
Phase N Complete — Verdict: PASS
- Completed: X/Y subtasks
- Tests: all passing (N backend, M frontend)
- New issues: Z (N critical, M minor)
- Next: <brief description of next phase focus>
```

---

## 3. Non-Negotiable Engineering Standards

These rules are **absolute**. They cannot be relaxed for deadlines, convenience, prototyping, or "temporary" code. Code that violates any of these standards will be rejected by Task QA and must be fixed before proceeding.

### 3.1 Offline-First & Zero Telemetry

```
┌─────────────────────────────────────────────────────────────┐
│  ZERO OUTBOUND NETWORK CALLS IN THE PRODUCTION BINARY.     │
│  NO EXCEPTIONS. NO "OPTIONAL" ANALYTICS. NO UPDATE CHECKS. │
│  NO CRASH REPORTING THAT PHONES HOME. NOTHING.             │
└─────────────────────────────────────────────────────────────┘
```

| Rule | Detail |
|---|---|
| No analytics SDK | No Google Analytics, Sentry, Mixpanel, or any telemetry library. |
| No update checker | The app does not check for updates. Updates come through the Microsoft Store only. |
| No crash reporter | Crash logs are written to local disk only. Never transmitted. |
| No network permissions | The Tauri `allowlist` must NOT include any network/HTTP permissions. |
| Full offline operation | Every feature must work identically with no internet connection. No degraded modes. |
| Dependency audit | Every new crate and npm package must be audited for hidden network calls. |

### 3.2 Atomic Writes & Data Integrity

All disk write operations must follow the atomic write protocol to prevent data corruption under any failure condition (power loss, process crash, OS shutdown, disk full).

**The Atomic Write Protocol:**

```rust
// CORRECT — Atomic write pattern
fn atomic_write(target: &Path, data: &[u8]) -> Result<()> {
    let tmp_path = target.with_extension("tmp");
    
    // Step 1: Write to temporary file
    let mut file = File::create(&tmp_path)?;
    file.write_all(data)?;
    
    // Step 2: Flush all buffers to disk
    file.sync_all()?;
    
    // Step 3: Atomic rename (guaranteed atomic on NTFS)
    std::fs::rename(&tmp_path, target)?;
    
    Ok(())
}

// WRONG — Never do this
fn bad_write(target: &Path, data: &[u8]) -> Result<()> {
    let mut file = File::create(target)?;  // Truncates existing file!
    file.write_all(data)?;                 // Partial write on crash = corruption
    Ok(())
}
```

**Snapshot Integrity Rules:**

| Rule | Detail |
|---|---|
| `COMMITTED` snapshots are immutable | Once a snapshot reaches `COMMITTED` status, its chunk data and metadata are never modified. |
| Interrupted writes → `INTERRUPTED` status | If a backup operation is interrupted, the snapshot is marked `INTERRUPTED`, never `COMMITTED`. |
| `INTERRUPTED` snapshots are resumable | The user can retry an interrupted snapshot. The engine resumes from the last known-good chunk. |
| Chunk verification on restore | Before restoring any chunk, verify its BLAKE3 hash matches the stored hash. Abort restore on mismatch with a clear error message. |

### 3.3 Windows Safety

SnapVault runs exclusively on Windows 11. Every file operation must account for Windows filesystem quirks.

**Long Path Support:**

```rust
/// Normalize a path for Windows long-path support.
/// All paths passed to Windows API calls MUST go through this function.
fn normalize_path(path: &Path) -> PathBuf {
    let path_str = path.to_string_lossy();
    if path_str.starts_with("\\\\?\\") {
        path.to_path_buf()
    } else if path_str.starts_with("\\\\") {
        // UNC path: \\server\share → \\?\UNC\server\share
        PathBuf::from(format!("\\\\?\\UNC\\{}", &path_str[2..]))
    } else {
        PathBuf::from(format!("\\\\?\\{}", path.canonicalize().unwrap_or_else(|_| path.to_path_buf()).display()))
    }
}
```

**Windows Reserved Names:**

The following filenames are reserved on Windows and must be handled gracefully (skip with a logged warning, never crash):

```
CON, PRN, AUX, NUL,
COM0–COM9, LPT0–LPT9
```

Also reserved when followed by an extension: `CON.txt`, `NUL.log`, etc.

**Additional Windows Safety Rules:**

| Rule | Detail |
|---|---|
| Unicode filenames | Full support for emoji (🎉), CJK characters (日本語), RTL scripts (العربية), and combining diacritics (café). |
| NTFS junctions | Detect and skip NTFS junctions by default to avoid infinite loops. Log a warning. Optionally follow if user explicitly configures it. |
| Symlinks | Detect symlinks. Follow only if the target exists and is within the backup scope. Log a warning for broken symlinks. |
| Reparse points | Detect and skip unknown reparse points. Log the reparse tag for debugging. |
| File locks | If a file is locked by another process, log the lock, skip the file, and continue. Never block the entire backup on a single locked file. Record skipped files in the snapshot metadata. |
| Max path length | Support paths up to 32,767 characters (Windows API maximum with `\\?\` prefix). |

### 3.4 Error Resilience

SnapVault must never crash, hang, or corrupt data due to a single file or operation failing.

**Error Handling Philosophy:**

```
"Log it, skip it, continue. Never crash. Never corrupt. Always inform the user."
```

**Error Categories and Required Handling:**

| Error Type | Backend Action | User-Facing Message |
|---|---|---|
| File not found | Log path + timestamp, skip file, continue | "1 file was moved or deleted during backup and was skipped." |
| Permission denied | Log path + error code, skip file, continue | "1 file could not be read (access denied). Check file permissions." |
| File locked | Log path + locking process (if detectable), skip file, continue | "1 file was in use by another program and was skipped." |
| Disk full | Abort current operation gracefully, mark snapshot as `INTERRUPTED` | "Backup stopped: not enough disk space. Free up X GB and retry." |
| Database corruption | Attempt WAL recovery, fall back to last known-good checkpoint | "SnapVault detected a database issue and recovered automatically." |
| Chunk hash mismatch | Abort restore of affected file, continue with remaining files | "1 file could not be restored (data verification failed). The original backup data may be damaged." |

**Logging Requirements:**

```rust
// Every error log entry MUST include:
// 1. Timestamp (ISO 8601, local timezone)
// 2. Error category (FileNotFound, PermissionDenied, FileLocked, etc.)
// 3. Affected path (full normalized path)
// 4. OS error code (when available)
// 5. Operation context (what was being attempted)

tracing::warn!(
    path = %normalized_path.display(),
    error_code = %e.raw_os_error().unwrap_or(0),
    operation = "backup_file_read",
    "Skipping file: permission denied"
);
```

### 3.5 Trial & Licensing Integrity

SnapVault uses a 14-day free trial with a $19.99 one-time purchase through the Microsoft Store. The licensing model is designed to be fair and user-respecting.

**Trial Behavior Timeline:**

| Day | Behavior |
|---|---|
| 1–11 | Full-featured, no nag screens, no banners, no reminders. The user experiences the complete product. |
| 12 | A single, dismissible, non-modal notification: "Your trial ends in 3 days. Purchase SnapVault to keep creating backups." |
| 13 | Same notification as day 12, shown once per app launch. |
| 14 | Final day notification: "Your trial ends today." Shown once per app launch. |
| 15+ (expired) | Backup **creation** is disabled. A clear message explains why. A "Purchase" button links to the Microsoft Store. |

**Post-Expiry Rights (Non-Negotiable):**

```
┌──────────────────────────────────────────────────────────────────┐
│  AFTER TRIAL EXPIRY, THE USER RETAINS PERMANENT ACCESS TO:      │
│                                                                  │
│  ✅ Browse all existing snapshots                                │
│  ✅ Search files across all snapshots                            │
│  ✅ Compare snapshots (diff view)                                │
│  ✅ Restore ANY file from ANY existing snapshot                  │
│  ✅ Restore entire snapshots                                     │
│  ✅ Export snapshot data                                         │
│                                                                  │
│  THE ONLY THING DISABLED IS CREATING NEW BACKUPS.               │
│  THE USER'S EXISTING DATA IS NEVER HELD HOSTAGE.                │
└──────────────────────────────────────────────────────────────────┘
```

**License Validation Rules:**

| Rule | Detail |
|---|---|
| Local-only validation | License status is checked against the Microsoft Store API locally. No custom license server. |
| No server pings | The app never contacts any server to validate the license. |
| Clock tamper resistance | Store the trial start date as a BLAKE3-keyed hash in SQLite. Detect obvious clock rollbacks (current time < last recorded app launch time) and freeze the trial countdown until the clock advances past the last recorded time. Do not punish ambiguous cases (e.g., timezone changes). |
| Graceful degradation | If the license check mechanism fails for any reason, default to granting access. Never lock a paying user out due to a bug. |

---

## 4. Git Workflow

All development follows a structured branching model to maintain code quality and traceability.

### 4.1 Branch Naming Convention

```
Format: phase-<N>/<feature-name>

Examples:
  phase-1/project-scaffolding
  phase-2/chunking-engine
  phase-3/snapshot-ui
  phase-5/restore-flow
  hotfix/sqlite-wal-corruption
```

### 4.2 Commit Message Format

```
Format: Simple text only (e.g. "add this", "update database schema", "scaffold UI")
Rule: NO "feat", "fix", or prefix labels will be used. Purely simple descriptive text.

Examples:
  add this
  update database schema and models
  scaffold tauri backend and react frontend
  implement fastcdc chunking engine
  add timeline scrubber component
  clean up clippy warnings
```

### 4.3 Branch Rules

| Rule | Detail |
|---|---|
| No direct commits to `main` | All work goes through feature branches. |
| One branch per phase/feature | Do not mix unrelated work in a single branch. |
| Squash merge to `main` | At phase completion, squash merge the phase branch to `main` with a summary commit message. |
| Delete merged branches | After squash merge, delete the source branch. |
| Tag releases | After merging a phase, tag `main` with `phase-N-complete` (e.g., `phase-3-complete`). |

### 4.4 Pre-Merge Checklist

Before any merge to `main`, verify:

```
[ ] All Task QA verifications passed
[ ] Central Tester declared PASS or PASS WITH WARNINGS
[ ] Phase report generated in reports/
[ ] ROADMAP.md updated
[ ] ISSUES.md updated
[ ] No unresolved BLOCKED issues
[ ] cargo build --release succeeds
[ ] cargo test passes all tests
[ ] cargo clippy -- -D warnings produces zero warnings
[ ] npm run build succeeds
[ ] npm run lint passes
```

---

## 5. Code Style & Conventions

### 5.1 Rust (Backend)

| Setting | Value |
|---|---|
| Formatter | `rustfmt` with default settings |
| Linter | `clippy` with `-D warnings` (all warnings are errors) |
| Edition | Rust 2021 |
| Error handling | `thiserror` for library errors, `anyhow` prohibited in library code |
| Serialization | `serde` with `#[serde(rename_all = "camelCase")]` for IPC types |
| Async runtime | Tokio (bundled with Tauri) |
| Logging | `tracing` crate with structured fields |
| Testing | Built-in `#[test]` with `#[cfg(test)]` modules, `tempfile` for filesystem tests |

**Rust File Organization:**

```
src-tauri/src/
├── main.rs              # Entry point, Tauri builder setup
├── lib.rs               # Library root, module declarations
├── commands/            # Tauri IPC command handlers
│   ├── mod.rs
│   ├── backup.rs
│   ├── restore.rs
│   ├── snapshot.rs
│   └── settings.rs
├── core/                # Core business logic (no Tauri dependency)
│   ├── mod.rs
│   ├── chunker.rs
│   ├── hasher.rs
│   ├── differ.rs
│   └── scheduler.rs
├── db/                  # SQLite database layer
│   ├── mod.rs
│   ├── migrations.rs
│   ├── models.rs
│   └── queries.rs
├── fs/                  # Filesystem operations
│   ├── mod.rs
│   ├── walker.rs
│   ├── atomic.rs
│   └── windows.rs
├── trial/               # Trial and licensing
│   ├── mod.rs
│   └── store_api.rs
└── error.rs             # Centralized error types
```

### 5.2 TypeScript / React (Frontend)

| Setting | Value |
|---|---|
| TypeScript | `strict: true` in `tsconfig.json` |
| Linter | ESLint with `@typescript-eslint/recommended` and `react-hooks/recommended` |
| Formatter | Prettier with default settings |
| `any` type | **Absolutely forbidden.** Use `unknown` with type guards if the type is truly dynamic. |
| Components | Functional components with hooks. No class components. No `React.FC` (use explicit return types). |
| State management | Zustand for global state, React `useState`/`useReducer` for local state |
| CSS | Tailwind CSS utility classes. No CSS modules. No styled-components. |
| Testing | Vitest with React Testing Library |

**Frontend File Organization:**

```
src/
├── App.tsx              # Root app component with router
├── main.tsx             # Entry point, React mount
├── components/          # Reusable UI components
│   ├── ui/              # Primitive UI elements (Button, Input, Card, etc.)
│   ├── layout/          # Layout components (Sidebar, Header, etc.)
│   └── features/        # Feature-specific components
├── pages/               # Page-level components (one per route)
│   ├── DashboardPage.tsx
│   ├── SnapshotsPage.tsx
│   ├── RestorePage.tsx
│   └── SettingsPage.tsx
├── hooks/               # Custom React hooks
│   ├── useBackup.ts
│   ├── useSnapshots.ts
│   └── useSettings.ts
├── stores/              # Zustand state stores
│   ├── backupStore.ts
│   └── settingsStore.ts
├── types/               # TypeScript type definitions
│   ├── backup.ts
│   ├── snapshot.ts
│   └── ipc.ts
├── lib/                 # Utility functions and helpers
│   ├── ipc.ts           # Typed Tauri IPC wrappers
│   ├── format.ts        # Date, size, path formatters
│   └── constants.ts     # App-wide constants and strings
└── styles/
    └── globals.css       # Tailwind base imports and custom utilities
```

### 5.3 File Naming Conventions

| Language / Type | Convention | Example |
|---|---|---|
| Rust source files | `snake_case.rs` | `chunk_hasher.rs`, `atomic_write.rs` |
| Rust test files | `snake_case.rs` (in `tests/` or `#[cfg(test)]`) | `chunker_tests.rs` |
| React components | `PascalCase.tsx` | `SnapshotCard.tsx`, `RestorePage.tsx` |
| React hooks | `camelCase.ts` (prefixed with `use`) | `useBackupProgress.ts` |
| TypeScript utilities | `camelCase.ts` | `formatBytes.ts`, `ipcWrapper.ts` |
| TypeScript types | `camelCase.ts` | `snapshot.ts`, `backup.ts` |
| Zustand stores | `camelCase.ts` (suffixed with `Store`) | `backupStore.ts` |
| Test files | `*.test.ts` or `*.test.tsx` | `SnapshotCard.test.tsx` |
| Config files | Framework default | `tailwind.config.ts`, `vite.config.ts` |

### 5.4 Tailwind CSS Rules

```
1. Utility-first: use Tailwind classes directly in JSX.
2. Extract to @apply component classes when the same combination appears 3+ times.
3. Use the project's design tokens (colors, spacing, radii) — never hardcode values.
4. Respect Windows 11 Fluent Design language:
   - Mica/Acrylic material effects where supported
   - Rounded corners (rounded-lg for cards, rounded-md for buttons)
   - Subtle shadows and elevation
   - System font stack (Segoe UI Variable)
5. Dark mode support via Tailwind's `dark:` variant, following system preference.
```

---

## 6. Document Cross-References

The following governance documents form SnapVault's project management system. Each has a specific purpose and must be consulted at the appropriate time.

| Document | Purpose | When to Consult |
|---|---|---|
| **`DEVELOPER.md`** (this file) | Supreme operating protocol. Defines roles, rules, standards, and processes. | At the start of every prompt. Before making any architectural decision. When in doubt about any rule. |
| **`PLAN.md`** | High-level project plan. Defines the product vision, feature set, tech stack decisions, and phase breakdown. | At the start of every prompt (PM reads it). When planning a new phase. When evaluating feature requests. |
| **`ROADMAP.md`** | Detailed task tracker. Lists every subtask across all phases with checkbox status. | At the start of every prompt (PM reads it). When assigning work. When updating progress. When generating reports. |
| **`ISSUES.md`** | Bug and issue tracker. Logs all discovered issues, their severity, status, and resolution. | At the start of every prompt (PM reads it). When a bug is found. When a bug is fixed. When prioritizing work. |
| **`README.md`** | Public-facing project overview. Describes what SnapVault is, how to build it, and how to contribute. | When onboarding. When updating build instructions. Before publishing or releasing. |
| **`PRD.md`** | Product Requirements Document. Detailed functional and non-functional requirements. | When implementing a new feature. When writing acceptance criteria. When resolving ambiguity about expected behavior. |
| **`ARCHITECTURE.md`** | Technical architecture overview. System diagrams, data flow, component boundaries. | When designing new components. When debugging cross-component issues. When evaluating technical debt. |
| **`reports/REPORT_TEMPLATE.md`** | Template for phase completion reports. | When generating a phase report (mandatory at end of every prompt). |
| **`reports/PHASE_<N>_REPORT.md`** | Completed phase reports. Historical record of what was done, tested, and decided. | When performing regression checks. When investigating when a bug was introduced. When reviewing project history. |

---

## Appendix A: Quick Reference Card

```
╔══════════════════════════════════════════════════════════════╗
║                 SNAPVAULT DEVELOPER QUICK REF                ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  START OF EVERY PROMPT:                                      ║
║    1. PM reads PLAN.md, ROADMAP.md, ISSUES.md                ║
║    2. PM decomposes into atomic subtasks                     ║
║    3. PM assigns to Backend / Frontend                       ║
║                                                              ║
║  DURING DEVELOPMENT:                                         ║
║    • Backend: cargo test after every function                ║
║    • Frontend: npm run lint after every component            ║
║    • Both: follow atomic write, long-path, error rules       ║
║                                                              ║
║  AFTER EVERY SUBTASK:                                        ║
║    • Task QA runs full checklist                             ║
║    • Fail → Fix → Recheck loop until 100% pass              ║
║                                                              ║
║  END OF EVERY PHASE:                                         ║
║    • Central Tester runs full suite                          ║
║    • Generate reports/PHASE_<N>_REPORT.md                    ║
║    • Update ROADMAP.md and ISSUES.md                         ║
║    • Present summary in chat                                 ║
║                                                              ║
║  NEVER:                                                      ║
║    • Make network calls                                      ║
║    • Use unwrap() on I/O                                     ║
║    • Write directly to target files (use .tmp + rename)      ║
║    • Use `any` type in TypeScript                            ║
║    • Mark a task [x] without QA verification                 ║
║    • Skip long-path normalization                            ║
║    • Lock users out of restoring their data                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Appendix B: Report Template Location

The phase report template must exist at `reports/REPORT_TEMPLATE.md`. If it does not exist, create it using the structure defined in Section 2.1 before generating the first phase report.

---

*This document was established at project inception and governs all future development. Any proposed changes to this protocol must be explicitly justified, documented in `ISSUES.md` as a process-change request, and approved before taking effect.*
