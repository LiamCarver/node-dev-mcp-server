import { z } from "zod";
import fs from "fs/promises";
import os from "os";
import path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorkspaceManager } from "../utils/workspaceManager.js";
import type { GitClient } from "../utils/gitClient.js";
import { runCommandAsync } from "../utils/commandRunner.js";
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
        })
        .strict(),
    },
    async ({ patch, dryRun, reverse, fuzz }: ApplyPatchInput) => {
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

        const output = formatCommandOutput(applyResult);
        const message = output
          ? `Patch applied successfully.\n\nFiles:\n${patchPaths.join(
              "\n"
            )}\n\n${output}`
          : `Patch applied successfully.\n\nFiles:\n${patchPaths.join("\n")}`;
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
        const addResult = await gitClient.addAsync([name]);
        if (addResult.exitCode !== 0) {
          return errorResponse(
            `Error staging ${name}.\n\n${formatCommandFailure(addResult)}`
          );
        }
        const commitResult = await gitClient.commitAsync(commitMessage);
        if (commitResult.exitCode !== 0) {
          return errorResponse(
            `Error committing ${name}.\n\n${formatCommandFailure(commitResult)}`
          );
        }
        const pushResult = await gitClient.pushAsync();
        if (pushResult.exitCode !== 0) {
          return errorResponse(
            `Error pushing changes for ${name}.\n\n${formatCommandFailure(pushResult)}`
          );
        }
        const outputs = [
          formatCommandOutput(addResult),
          formatCommandOutput(commitResult),
          formatCommandOutput(pushResult),
        ].filter(Boolean);
        const message = outputs.length
          ? `Successfully wrote to ${name}.\n\n${outputs.join("\n\n")}`
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
        const addResult = await gitClient.addAsync(["-A"]);
        if (addResult.exitCode !== 0) {
          return errorResponse(
            `Error staging deletion for ${name}.\n\n${formatCommandFailure(addResult)}`
          );
        }
        const commitResult = await gitClient.commitAsync(commitMessage);
        if (commitResult.exitCode !== 0) {
          return errorResponse(
            `Error committing deletion for ${name}.\n\n${formatCommandFailure(commitResult)}`
          );
        }
        const pushResult = await gitClient.pushAsync();
        if (pushResult.exitCode !== 0) {
          return errorResponse(
            `Error pushing deletion for ${name}.\n\n${formatCommandFailure(pushResult)}`
          );
        }
        const outputs = [
          formatCommandOutput(addResult),
          formatCommandOutput(commitResult),
          formatCommandOutput(pushResult),
        ].filter(Boolean);
        const message = outputs.length
          ? `Successfully deleted ${name}.\n\n${outputs.join("\n\n")}`
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
      }),
    },
    async ({ name }: NameInput) => {
      try {
        await workspaceManager.createFolderAsync(name);
        return textResponse(`Successfully created ${name}`);
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
        const addResult = await gitClient.addAsync(["-A"]);
        if (addResult.exitCode !== 0) {
          return errorResponse(
            `Error staging deletion for ${name}.\n\n${formatCommandFailure(addResult)}`
          );
        }
        const commitResult = await gitClient.commitAsync(commitMessage);
        if (commitResult.exitCode !== 0) {
          return errorResponse(
            `Error committing deletion for ${name}.\n\n${formatCommandFailure(commitResult)}`
          );
        }
        const pushResult = await gitClient.pushAsync();
        if (pushResult.exitCode !== 0) {
          return errorResponse(
            `Error pushing deletion for ${name}.\n\n${formatCommandFailure(pushResult)}`
          );
        }
        const outputs = [
          formatCommandOutput(addResult),
          formatCommandOutput(commitResult),
          formatCommandOutput(pushResult),
        ].filter(Boolean);
        const message = outputs.length
          ? `Successfully deleted ${name}.\n\n${outputs.join("\n\n")}`
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
        })
        .strict(),
    },
    async ({ name, newName }: CopyFolderInput) => {
      try {
        await workspaceManager.copyFolderAsync(name, newName);
        return textResponse(`Successfully copied ${name} to ${newName}`);
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
