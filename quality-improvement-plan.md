Quality Improvement Plan
========================

Scope assumptions
-----------------
- In scope: this MCP server's tooling, agent I/O behavior, install/test workflows, and documentation it owns.
- Out of scope: upstream Codex CLI behavior unless this server can expose equivalent MCP tools.

Findings and actions
--------------------
| Item | Scope (Server vs External) | Status (Fixed?) | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| "run command" lacks full stdout/stderr | Server MCP tool | Fixed | High | Capture full stdout/stderr and include the tail (200-500 lines) in tool results on failure. |
| `apply_patch` path limitations | Server MCP tool | Fixed | Medium | Add an MCP-native patch/update tool (diff-style input) or a reliable single-file edit primitive. |
| Missing MCP "content search" (rg-like) | Server MCP tool | Fixed | High | Add a content search tool with regex/glob support and line-numbered matches. |
| Test/build outputs not captured | Server MCP tool | Fixed | High | Persist test/build stdout/stderr in tool output; include tail on failure. |

Prioritized plan
----------------
1. Reliability and debuggability (completed)
   - Add stdout/stderr capture to "run command" and test/build tooling.
   - Return last 200-500 lines on failure for quick triage.
2. Developer velocity (completed)
   - Implement content search (rg-like) MCP tool.
   - Provide patch/update capability or a safe single-file edit tool.
3. Install ergonomics
   - Surface npm install flags and env overrides in MCP install step.
4. Instruction clarity
   - Consolidate and document precedence rules in README/AGENTS.

Open questions
--------------
- Which items are already fixed, and in which version?
- Should content search be server-native or delegated to local tools when available?
