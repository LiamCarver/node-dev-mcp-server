import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorkspaceManager } from "../utils/workspaceManager.js";
import type { GitClient } from "../utils/gitClient.js";
import {
  errorResponse,
  getErrorMessage,
  textResponse,
} from "../utils/toolResponses.js";

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

const commitAndPushAsync = async (
  gitClient: GitClient,
  commitMessage: string
): Promise<string> => {
  const { stdout: commitStdout } = await gitClient.commitAsync(commitMessage);
  const { stdout: pushStdout } = await gitClient.pushAsync();
  return [commitStdout, pushStdout].filter(Boolean).join("\n");
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
        await gitClient.addAsync([name]);
        const gitOutput = await commitAndPushAsync(gitClient, commitMessage);
        const message = gitOutput
          ? `Successfully wrote to ${name}.\n\n${gitOutput}`
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
        await gitClient.addAsync(["-A"]);
        const gitOutput = await commitAndPushAsync(gitClient, commitMessage);
        const message = gitOutput
          ? `Successfully deleted ${name}.\n\n${gitOutput}`
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
        await gitClient.addAsync(["-A"]);
        const gitOutput = await commitAndPushAsync(gitClient, commitMessage);
        const message = gitOutput
          ? `Successfully deleted ${name}.\n\n${gitOutput}`
          : `Successfully deleted ${name}.`;
        return textResponse(message);
      } catch (error) {
        return errorResponse(`Error deleting folder: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "list_dir",
    {
      description: "List files and folders in the workspace folder",
      inputSchema: z.object({}).strict(),
    },
    async () => {
      try {
        const entries = await workspaceManager.listEntriesAsync();
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
