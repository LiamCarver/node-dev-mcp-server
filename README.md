# Node Dev MCP Server

Lightweight MCP server for local workspace file operations and git commands.

## Tools

| Tool | Description | Input (JSON) |
| --- | --- | --- |
| start_work | Set remote URL from env, pull latest changes, create and push a branch, and install dependencies | `{ "branch": "feature-branch", "currentWorkingDirectory": ".", "startPoint": "main" }` |
| read_file | Read the content of a file in the workspace folder | `{ "name": "path/to/file.txt" }` |
| write_file | Write content to a file in the workspace folder | `{ "name": "path/to/file.txt", "content": "...", "commitMessage": "Update notes" }` |
| delete_file | Delete a file from the workspace folder | `{ "name": "path/to/file.txt", "commitMessage": "Remove obsolete file" }` |
| create_folder | Create a folder in the workspace folder | `{ "name": "path/to/folder" }` |
| delete_folder | Delete a folder from the workspace folder | `{ "name": "path/to/folder", "commitMessage": "Remove deprecated folder" }` |
| copy_folder | Copy a folder in the workspace folder | `{ "name": "path/to/folder", "newName": "path/to/new-folder" }` |
| search_entries | Search for files and folders in the workspace using a regular expression | `{ "pattern": "src/.*\\.ts$", "flags": "i" }` |
| list_dir | List files and folders in the workspace folder or a subfolder | `{ "name": "path/to/folder" }` or `{}` |
| vcs_status | Get the status of the repository | `{}` |
| vcs_diff | Get repository diff | `{ "staged": false, "file": "path/to/file.txt" }` or `{ "base": "main", "head": "HEAD" }` |
| vcs_log | Show commit log | `{ "limit": 10 }` |
| install_dependencies | Install all dependencies in the workspace | `{ "currentWorkingDirectory": "." }` |
| install_package | Install a single package in the workspace | `{ "currentWorkingDirectory": ".", "name": "lodash@4.17.21" }` |
| run_build | Run the build script in the workspace | `{ "currentWorkingDirectory": "." }` |
| run_script | Run a script in the workspace | `{ "currentWorkingDirectory": ".", "script": "test" }` |

Notes:
- `vcs_remote_set_url_from_env` expects `PROJECT_REPO` and `GITHUB_TOKEN` to be set.
- `currentWorkingDirectory` must resolve to a directory inside the workspace root. Use `.` for the workspace root.
