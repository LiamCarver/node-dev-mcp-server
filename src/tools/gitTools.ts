import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitClient } from "../utils/gitClient.js";
import { formatCommandFailure, formatCommandOutput } from "../utils/commandOutput.js";
import { errorResponse, getErrorMessage, textResponse } from "../utils/toolResponses.js";

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
        const result = await gitClient.statusAsync();
        if (result.exitCode !== 0) {
          return errorResponse(
            `Error getting repository status.\n\n${formatCommandFailure(result)}`
          );
        }
        const output = formatCommandOutput(result);
        return textResponse(output || "Repository status completed.");
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
          const result = await gitClient.runGitAsync([
            "diff",
            `${base}...${head}`,
            ...(file ? ["--", file] : []),
          ]);
          if (result.exitCode !== 0) {
            return errorResponse(
              `Error getting repository diff.\n\n${formatCommandFailure(result)}`
            );
          }
          const output = formatCommandOutput(result);
          return textResponse(output || "Repository diff completed.");
        }

        const result = await gitClient.diffAsync({ staged, file });
        if (result.exitCode !== 0) {
          return errorResponse(
            `Error getting repository diff.\n\n${formatCommandFailure(result)}`
          );
        }
        const output = formatCommandOutput(result);
        return textResponse(output || "Repository diff completed.");
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
        const result = await gitClient.logAsync(limit);
        if (result.exitCode !== 0) {
          return errorResponse(
            `Error getting commit log.\n\n${formatCommandFailure(result)}`
          );
        }
        const output = formatCommandOutput(result);
        return textResponse(output || "Commit log completed.");
      } catch (error) {
        return errorResponse(`Error getting commit log: ${getErrorMessage(error)}`);
      }
    }
  );

};
