import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitClient } from "../utils/gitClient.js";
import {
  errorResponse,
  getErrorMessage,
  textResponse,
} from "../utils/toolResponses.js";

type DiffInput = {
  staged?: boolean;
  file?: string;
  base?: string;
  head?: string;
};

type LogInput = {
  limit?: number;
};


export const registerGitTools = (
  server: McpServer,
  gitClient: GitClient
): void => {
  server.registerTool(
    "vcs_status",
    {
      description: "Get the status of the repository",
      inputSchema: z.object({}).strict(),
    },
    async () => {
      try {
        const { stdout } = await gitClient.statusAsync();
        return textResponse(stdout);
      } catch (error) {
        return errorResponse(`Error getting repository status: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "vcs_diff",
    {
      description: "Get repository diff",
      inputSchema: z.object({
        staged: z.boolean().optional().describe("Whether to show staged changes"),
        file: z.string().optional().describe("Specific file to diff"),
        base: z.string().optional().describe("Base ref to compare against"),
        head: z.string().optional().describe("Head ref to compare against"),
      }),
    },
    async ({ staged, file, base, head }: DiffInput) => {
      try {
        if (base || head) {
          if (!base || !head) {
            return errorResponse("Both base and head must be provided when diffing refs.");
          }
          const { stdout } = await gitClient.runGitAsync([
            "diff",
            `${base}...${head}`,
            ...(file ? ["--", file] : []),
          ]);
          return textResponse(stdout);
        }

        const { stdout } = await gitClient.diffAsync({ staged, file });
        return textResponse(stdout);
      } catch (error) {
        return errorResponse(`Error getting repository diff: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "vcs_log",
    {
      description: "Show commit log",
      inputSchema: z.object({
        limit: z.number().optional().default(10).describe("Number of commits to show"),
      }),
    },
    async ({ limit }: LogInput) => {
      try {
        const { stdout } = await gitClient.logAsync(limit);
        return textResponse(stdout);
      } catch (error) {
        return errorResponse(`Error getting commit log: ${getErrorMessage(error)}`);
      }
    }
  );

};
