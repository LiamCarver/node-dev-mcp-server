import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorkspaceManager } from "../utils/workspaceManager.js";
import type { GitClient } from "../utils/gitClient.js";
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

export const registerFileTools = (
  server: McpServer,
  workspaceManager: WorkspaceManager,
  gitClient: GitClient
): void => {
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
