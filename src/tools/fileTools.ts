import { z } from "zod";
import fs from "fs/promises";
import os from "os";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorkspaceManager } from "../utils/workspaceManager.js";
import type { GitClient } from "../utils/gitClient.js";
import { runCommandAsync } from "../utils/commandRunner.js";
import { commitAndPushAsync } from "../utils/gitCommit.js";
import {
  errorResponse,
  getErrorMessage,
  textResponse,
} from "../utils/toolResponses.js";
import { formatCommandFailure, formatCommandOutput } from "../utils/commandOutput.js";

type NameInput = {
  name: string;
};

type WriteInput = {
  name: string;
  content: string;
  commitMessage: string;
};

type DeleteInput = {
  name: string;
  commitMessage: string;
};

type ListDirInput = {
  name?: string;
};

type CopyFolderInput = {
  name: string;
  newName: string;
  commitMessage: string;
};

type SearchInput = {
  pattern: string;
  flags?: string;
};

type ApplyPatchInput = {
  patch: string;
  dryRun?: boolean;
  reverse?: boolean;
  fuzz?: number;
  commitMessage: string;
};

type SearchContentInput = {
  pattern: string;
  flags?: string;
  path?: string;
};

const normalizePatchPath = (rawPath: string): string | null => {
  const trimmed = rawPath.trim();
  if (!trimmed || trimmed === "/dev/null") {
    return null;
  }
  let normalized = trimmed.replace(/^[ab]\//, "");
  if (!normalized) {
    return null;
  }
  return normalized;
};

const extractPatchPaths = (patch: string): string[] => {
  const paths = new Set<string>();
  const lines = patch.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith("--- ") && !line.startsWith("+++ ")) {
      continue;
    }
    const rawPath = line.slice(4).split(/\s+/)[0];
    if (!rawPath) {
      continue;
    }
    const normalized = normalizePatchPath(rawPath);
    if (normalized) {
      paths.add(normalized);
    }
  }
  return Array.from(paths);
};

const buildPatchArgs = (options: { reverse?: boolean; fuzz?: number }): string[] => {
  const args: string[] = [];
  if (options.reverse) {
    args.push("--reverse");
  }
  if (options.fuzz !== undefined) {
    args.push("-C", String(options.fuzz));
  }
  return args;
};

const validatePatchPaths = (
  workspaceManager: WorkspaceManager,
  paths: string[]
): string | null => {
  if (paths.length === 0) {
    return "Patch does not include any file paths.";
  }
  for (const patchPath of paths) {
    try {
      workspaceManager.resolvePath(patchPath);
    } catch (error) {
      return `Invalid patch path "${patchPath}": ${getErrorMessage(error)}`;
    }
  }
  return null;
};

const resolveSearchTargetAsync = async (
  workspaceManager: WorkspaceManager,
  searchPath?: string
): Promise<string> => {
  if (!searchPath) {
    return ".";
  }
  const resolvedPath = workspaceManager.resolvePath(searchPath);
  await fs.stat(resolvedPath);
  const relativePath = path.relative(workspaceManager.getWorkspaceDir(), resolvedPath);
  return relativePath || ".";
};

export const registerFileTools = (
  server: McpServer,
  workspaceManager: WorkspaceManager,
  gitClient: GitClient
): void => {
  server.registerTool(
    "search_content",
    {
      description: "Search file contents in the workspace using ripgrep (rg)",
      inputSchema: z
        .object({
          pattern: z.string().min(1).describe("Regular expression pattern to search"),
          flags: z
            .string()
            .optional()
            .describe("Optional regex flags (currently supports 'i' for ignore-case)"),
          path: z
            .string()
            .optional()
            .describe("Optional path inside the workspace to scope the search"),
        })
        .strict(),
    },
    async ({ pattern, flags, path: searchPath }: SearchContentInput) => {
      try {
        const target = await resolveSearchTargetAsync(workspaceManager, searchPath);
        const args = [
          "--with-filename",
          "--line-number",
          "--column",
          "--no-heading",
          "--color",
          "never",
        ];
        if (flags?.includes("i")) {
          args.push("-i");
        }
        args.push(pattern, target);

        const result = await runCommandAsync("rg", args, {
          cwd: workspaceManager.getWorkspaceDir(),
        });

        if (result.exitCode === 1) {
          return textResponse("No matches found.");
        }
        if (result.exitCode !== 0) {
          return errorResponse(
            `Error searching content.\n\n${formatCommandFailure(result)}`
          );
        }

        const output = formatCommandOutput(result);
        return textResponse(output || "Search completed with no output.");
      } catch (error) {
        return errorResponse(`Error searching content: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "apply_patch",
    {
      description: "Apply a unified diff patch in the workspace",
      inputSchema: z
        .object({
          patch: z.string().min(1).describe("Unified diff (git-style)"),
          dryRun: z.boolean().optional().describe("Validate without applying changes"),
          reverse: z.boolean().optional().describe("Apply the patch in reverse"),
          fuzz: z.number().int().min(0).optional().describe("Allow fuzz matching"),
          commitMessage: z.string().min(1).describe("Commit message for git"),
        })
        .strict(),
    },
    async ({ patch, dryRun, reverse, fuzz, commitMessage }: ApplyPatchInput) => {
      const patchPaths = extractPatchPaths(patch);
      const validationError = validatePatchPaths(workspaceManager, patchPaths);
      if (validationError) {
        return errorResponse(validationError);
      }

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-patch-"));
      const patchFilePath = path.join(tempDir, "patch.diff");
      const patchArgs = buildPatchArgs({ reverse, fuzz });

      try {
        await fs.writeFile(patchFilePath, patch, "utf8");

        const checkResult = await gitClient.runGitAsync([
          "apply",
          "--check",
          ...patchArgs,
          patchFilePath,
        ]);

        if (checkResult.exitCode !== 0) {
          return errorResponse(
            `Patch check failed (context not found or file missing).\n\n${formatCommandFailure(
              checkResult
            )}`
          );
        }

        if (dryRun) {
          return textResponse(
            `Patch check succeeded (dry run).\n\nFiles:\n${patchPaths.join("\n")}`
          );
        }

        const applyResult = await gitClient.runGitAsync([
          "apply",
          ...patchArgs,
          patchFilePath,
        ]);

        if (applyResult.exitCode !== 0) {
          return errorResponse(
            `Patch apply failed (partial apply possible).\n\n${formatCommandFailure(
              applyResult
            )}`
          );
        }

        const commitOutcome = await commitAndPushAsync(
          gitClient,
          commitMessage,
          patchPaths
        );
        if (!commitOutcome.ok) {
          return errorResponse(
            `Error ${commitOutcome.step} patch changes.\n\n${formatCommandFailure(
              commitOutcome.result
            )}`
          );
        }

        const output = formatCommandOutput(applyResult);
        const commitOutput = commitOutcome.outputs.length
          ? `\n\n${commitOutcome.outputs.join("\n\n")}`
          : "";
        const commitNote = commitOutcome.skipped
          ? `\n\n${commitOutcome.skipReason ?? "No changes to commit."}`
          : "";
        const message = output
          ? `Patch applied successfully.\n\nFiles:\n${patchPaths.join(
              "\n"
            )}\n\n${output}${commitOutput}${commitNote}`
          : `Patch applied successfully.\n\nFiles:\n${patchPaths.join(
              "\n"
            )}${commitOutput}${commitNote}`;
        return textResponse(message);
      } catch (error) {
        return errorResponse(`Error applying patch: ${getErrorMessage(error)}`);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  );

  server.registerTool(
    "read_file",
    {
      description: "Read the content of a file in the workspace folder",
      inputSchema: z.object({
        name: z.string().min(1).describe("File name inside the workspace folder"),
      }),
    },
    async ({ name }: NameInput) => {
      try {
        const content = await workspaceManager.readFileAsync(name);
        return textResponse(content);
      } catch (error) {
        return errorResponse(`Error reading file: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "write_file",
    {
      description: "Write content to a file in the workspace folder",
      inputSchema: z.object({
        name: z.string().min(1).describe("File name inside the workspace folder"),
        content: z.string().describe("The content to write to the file"),
        commitMessage: z.string().min(1).describe("Commit message for git"),
      }),
    },
    async ({ name, content, commitMessage }: WriteInput) => {
      try {
        await workspaceManager.writeFileAsync(name, content);
        const commitOutcome = await commitAndPushAsync(gitClient, commitMessage, [name]);
        if (!commitOutcome.ok) {
          return errorResponse(
            `Error ${commitOutcome.step} ${name}.\n\n${formatCommandFailure(
              commitOutcome.result
            )}`
          );
        }
        const message = commitOutcome.outputs.length
          ? `Successfully wrote to ${name}.\n\n${commitOutcome.outputs.join("\n\n")}`
          : `Successfully wrote to ${name}.`;
        return textResponse(message);
      } catch (error) {
        return errorResponse(`Error writing file: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "delete_file",
    {
      description: "Delete a file from the workspace folder",
      inputSchema: z.object({
        name: z.string().min(1).describe("File name inside the workspace folder"),
        commitMessage: z.string().min(1).describe("Commit message for git"),
      }),
    },
    async ({ name, commitMessage }: DeleteInput) => {
      try {
        await workspaceManager.deleteFileAsync(name);
        const commitOutcome = await commitAndPushAsync(gitClient, commitMessage, [name]);
        if (!commitOutcome.ok) {
          return errorResponse(
            `Error ${commitOutcome.step} deletion for ${name}.\n\n${formatCommandFailure(
              commitOutcome.result
            )}`
          );
        }
        const message = commitOutcome.outputs.length
          ? `Successfully deleted ${name}.\n\n${commitOutcome.outputs.join("\n\n")}`
          : `Successfully deleted ${name}.`;
        return textResponse(message);
      } catch (error) {
        return errorResponse(`Error deleting file: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "create_folder",
    {
      description: "Create a folder in the workspace folder",
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .describe("Folder name inside the workspace folder"),
        commitMessage: z.string().min(1).describe("Commit message for git"),
      }),
    },
    async ({ name, commitMessage }: DeleteInput) => {
      try {
        await workspaceManager.createFolderAsync(name);
        const commitOutcome = await commitAndPushAsync(gitClient, commitMessage, [name]);
        if (!commitOutcome.ok) {
          return errorResponse(
            `Error ${commitOutcome.step} folder creation for ${name}.\n\n${formatCommandFailure(
              commitOutcome.result
            )}`
          );
        }
        const note = commitOutcome.skipped
          ? `\n\n${commitOutcome.skipReason ?? "No changes to commit."}`
          : "";
        const message = commitOutcome.outputs.length
          ? `Successfully created ${name}.\n\n${commitOutcome.outputs.join(
              "\n\n"
            )}${note}`
          : `Successfully created ${name}.${note}`;
        return textResponse(message);
      } catch (error) {
        return errorResponse(`Error creating folder: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "delete_folder",
    {
      description: "Delete a folder from the workspace folder",
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .describe("Folder name inside the workspace folder"),
        commitMessage: z.string().min(1).describe("Commit message for git"),
      }),
    },
    async ({ name, commitMessage }: DeleteInput) => {
      try {
        await workspaceManager.deleteFolderAsync(name);
        const commitOutcome = await commitAndPushAsync(gitClient, commitMessage, [name]);
        if (!commitOutcome.ok) {
          return errorResponse(
            `Error ${commitOutcome.step} deletion for ${name}.\n\n${formatCommandFailure(
              commitOutcome.result
            )}`
          );
        }
        const message = commitOutcome.outputs.length
          ? `Successfully deleted ${name}.\n\n${commitOutcome.outputs.join("\n\n")}`
          : `Successfully deleted ${name}.`;
        return textResponse(message);
      } catch (error) {
        return errorResponse(`Error deleting folder: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "copy_folder",
    {
      description: "Copy a folder in the workspace folder",
      inputSchema: z
        .object({
          name: z
            .string()
            .min(1)
            .describe("Existing folder name inside the workspace folder"),
          newName: z
            .string()
            .min(1)
            .describe("New folder name inside the workspace folder"),
          commitMessage: z.string().min(1).describe("Commit message for git"),
        })
        .strict(),
    },
    async ({ name, newName, commitMessage }: CopyFolderInput) => {
      try {
        await workspaceManager.copyFolderAsync(name, newName);
        const commitOutcome = await commitAndPushAsync(
          gitClient,
          commitMessage,
          [newName]
        );
        if (!commitOutcome.ok) {
          return errorResponse(
            `Error ${commitOutcome.step} copy for ${newName}.\n\n${formatCommandFailure(
              commitOutcome.result
            )}`
          );
        }
        const message = commitOutcome.outputs.length
          ? `Successfully copied ${name} to ${newName}.\n\n${commitOutcome.outputs.join(
              "\n\n"
            )}`
          : `Successfully copied ${name} to ${newName}.`;
        return textResponse(message);
      } catch (error) {
        return errorResponse(`Error copying folder: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "search_entries",
    {
      description: "Search for files and folders in the workspace using a regular expression",
      inputSchema: z
        .object({
          pattern: z
            .string()
            .min(1)
            .describe("Regular expression pattern to match against relative paths"),
          flags: z
            .string()
            .optional()
            .describe("Optional regular expression flags, e.g. 'i' for case-insensitive"),
        })
        .strict(),
    },
    async ({ pattern, flags }: SearchInput) => {
      try {
        const matches = await workspaceManager.searchEntriesAsync(pattern, flags);
        const listing = matches
          .map((entry) => `${entry.type}\t${entry.path}`)
          .join("\n");
        return textResponse(listing);
      } catch (error) {
        return errorResponse(`Error searching entries: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "list_dir",
    {
      description: "List files and folders in the workspace folder or a subfolder",
      inputSchema: z
        .object({
          name: z
            .string()
            .min(1)
            .optional()
            .describe("Folder name inside the workspace folder"),
        })
        .strict(),
    },
    async ({ name }: ListDirInput) => {
      try {
        const entries = await workspaceManager.listEntriesAsync(name);
        const listing = entries
          .map((entry) => {
            const type = entry.isDirectory() ? "dir" : "file";
            return `${type}\t${entry.name}`;
          })
          .join("\n");
        return textResponse(listing);
      } catch (error) {
        return errorResponse(`Error listing directory: ${getErrorMessage(error)}`);
      }
    }
  );
};
