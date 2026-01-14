# Code Quality Review - Local-IO-MCP-Server

Scope: `src/**`, `package.json`, and config defaults.

## Findings

1) High - Path traversal via symlinks in workspace resolution
- Evidence: `src/utils/workspaceManager.ts`
- Detail: `resolvePath()` validates with `path.resolve()` plus a string prefix check but does not resolve symlinks. If a symlink exists inside the workspace that points outside, `read_file`/`write_file`/`delete_file` can access data outside the intended root.
- Impact: A user can exfiltrate or modify files outside the workspace root by using a symlink inside the workspace.
- Recommendation: Use `fs.realpath()` on both the workspace root and target path before comparison, or disallow symlinks via `lstat` checks for path components.

2) Medium - Hardcoded workspace root reduces portability and can fail silently
- Evidence: `src/config/constants.ts`
- Detail: `WORKSPACE_ROOT` is fixed to "/workspace", which is not guaranteed to exist (especially on Windows) and is not configurable.
- Impact: The server can point at a non-existent or unintended directory, causing tool failures or unexpected file operations.
- Recommendation: Read from an environment variable (e.g., `WORKSPACE_ROOT`) with a sane default and validate existence on startup.

3) Medium - Git execution lacks timeouts and buffer limits
- Evidence: `src/utils/gitClient.ts`
- Detail: `execFile` runs without `timeout` or `maxBuffer`. Large diffs/logs can exceed Node's default buffer or hang.
- Impact: The server can crash or stall on large repositories or binary diffs.
- Recommendation: Set explicit `timeout` and `maxBuffer`, and consider paging large outputs or truncating with clear messaging.

4) Medium - Git tool inputs allow option injection
- Evidence: `src/tools/gitTools.ts`, `src/utils/gitClient.ts`
- Detail: User-provided `file`/`files` are passed directly as git args. This allows options like `--all` or `-u` that are outside the tool descriptions.
- Impact: Users can run unintended git behaviors and may affect repo state more broadly than intended.
- Recommendation: Validate pathspecs, insert `--` before user paths, and reject args starting with `-` unless explicitly allowed.

5) Low - Error responses hide stderr details
- Evidence: `src/utils/toolResponses.ts`, `src/tools/gitTools.ts`
- Detail: Error handling returns `error.message`, which often omits `stderr` content from `execFile` failures.
- Impact: Troubleshooting failed git commands is harder than necessary.
- Recommendation: Capture and return `stderr` (or include it in the error response) when available.

6) Low - Destructive operations are silent
- Evidence: `src/utils/workspaceManager.ts`, `src/tools/fileTools.ts`
- Detail: `delete_folder` uses `force: true` and does not report when a target is missing.
- Impact: Mistyped paths can appear to succeed without actually deleting anything, reducing operator confidence.
- Recommendation: Consider removing `force`, or return explicit messaging for not-found vs deleted.

## Strengths
- Consistent tool response shape and error wrapping via `toolResponses`.
- Centralized path resolution in `WorkspaceManager`.
- Clear separation between tool registration and underlying client logic.

## Notes
- No automated tests or linting were found in `package.json`. Adding minimal tests for path validation and git behavior would improve confidence.
