Apply Patch Tool Plan
=====================

Context
-------
Goal: add an MCP tool that accepts a unified diff (git-style) with exact context lines, explicit +/- changes, and clear failure modes (context not found, file missing, partial apply). Optional: dryRun, reverse, fuzz.

Requirements implied by the attached spec
-----------------------------------------
- Inputs: file paths relative to workspace root, one or more hunks per file.
- Exact context matching (or fuzz if enabled).
- Result modes: success, partial apply, or failure with a reason.
- Optional flags: dryRun, reverse, fuzz level.
- Auditability: keep a predictable, git-like patch format.

Options and complexity
----------------------
| Option | Approach | Complexity | Pros | Cons |
| --- | --- | --- | --- | --- |
| A | Shell out to `git apply` or `patch` | Low-Med | Reuses mature tooling; exact diff support | Requires binary availability; harder to sandbox; parsing output needed for clear MCP errors |
| B | Use a JS diff/patch library (e.g., parse unified diff, apply with context matching) | Med | Pure JS; full control over failure messages | Library limits; careful handling of edge cases |
| C | Implement a minimal unified-diff parser + patch engine in-house | High | Full control and consistent error modes | More code, more tests, easy to miss edge cases |
| D | Hybrid: parse diff in JS, then call `git apply --check` for validation + `git apply` for apply | Med | Strong validation and standard semantics | Still depends on git; need to map errors cleanly |

Recommended path
----------------
Start with Option D if git is available (it already is for this server). It yields standard semantics, low implementation risk, and clear validation before apply. If git availability becomes a problem, fall back to Option B.

Implementation outline (Option D)
---------------------------------
1. Tool schema:
   - `patch` (string, unified diff)
   - `dryRun` (boolean, default false)
   - `reverse` (boolean, default false)
   - `fuzz` (number, optional)
2. Validation:
   - Parse file paths from diff headers and verify they resolve under workspace root.
   - Call `git apply --check` with options (`--reverse`, `--unidiff-zero` optional) and map stderr to MCP error modes.
3. Apply:
   - If `dryRun`, return a success summary without applying.
   - Else, call `git apply` with options and return a summary of files/hunks applied.
4. Error modes:
   - "context not found": map from `git apply` stderr.
   - "file missing": map from stderr + pre-validation.
   - "partial apply": report if `git apply` indicates partial; otherwise treat as failure.

Complexity notes
----------------
- Option D adds minimal code but needs robust error mapping.
- Option B needs careful handling of line endings and file encodings.
- Option C should be avoided unless git is unavailable and library options prove insufficient.

Open questions
--------------
- Should the tool auto-create new files when the diff adds them?
- Should we allow `--reject` style outputs, or always hard-fail?
- Do we want to expose `pathStrip` or expect "a/" and "b/" prefixes?
