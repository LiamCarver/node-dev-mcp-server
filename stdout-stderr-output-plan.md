Stdout/Stderr Capture Plan
==========================

Goal
----
Improve command output visibility so tool results include stdout/stderr (or a tail) for npm and git operations, especially on failure.

What exists in this repo
------------------------
- There is no generic "run command" MCP tool in this server.
- Command execution currently happens via:
  - `src/utils/npmClient.ts` using `execFile` (returns stdout/stderr).
  - `src/utils/gitClient.ts` using `execFile` (returns stdout/stderr).
- Tool handlers in `src/tools/npmTools.ts`, `src/tools/startWorkTools.ts`, and `src/tools/gitTools.ts` only return stdout. stderr is dropped.
- Error responses use `getErrorMessage(error)` which typically omits stderr unless it is embedded in the Error message.

Impact of current behavior
--------------------------
- When commands fail, the agent sees "Error running ..." without the underlying stderr.
- For noisy outputs, there is no tail/limit, so tools either return nothing or too little.

Options
-------
| Option | Approach | Difficulty | Pros | Cons |
| --- | --- | --- | --- | --- |
| A | Minimal change: include stderr (and stdout when present) directly in tool responses for npm/git tools | Low | Small code change, fast to ship | No output size control, stderr still absent if failure throws before response |
| B | Centralize output handling in a utility (e.g., `runCommandWithOutput`) and update npm/git clients to always return stdout+stderr, even on non-zero exit | Medium | Consistent behavior across tools, easier to add tailing/limits | Requires refactoring clients and error handling |
| C | Switch to `spawn` with a ring buffer to keep last N lines/bytes; return tail on success/failure | Medium-High | Avoids memory spikes, best UX for large output | Larger change, more code paths to test |

Recommended path
----------------
Selected: Option B. Start with a small tail limit (e.g., 200-500 lines or 64-128 KB) returned when stderr/stdout are large or on failure. Option C can follow if output size becomes a real problem.

Implementation sketch (no code yet)
-----------------------------------
- Add a utility that runs a command and always returns `{ stdout, stderr, exitCode }`.
- On non-zero exit, include `stderr` in the error response (and tail if needed).
- Update tool handlers to present:
  - Success: stdout (and stderr if present).
  - Failure: stderr + last N lines of stdout for context.
- Apply this pattern to:
  - `src/tools/npmTools.ts`
  - `src/tools/startWorkTools.ts`
  - `src/tools/gitTools.ts`

Estimated effort
----------------
- Option A: ~0.5-1 hour.
- Option B: ~1-2 hours.
- Option C: ~2-4 hours.

Open questions
--------------
- Do you want tailing behavior on success, or only on failure?
- Do you prefer line-based or byte-based caps?
