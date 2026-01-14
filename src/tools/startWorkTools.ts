import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitClient } from "../utils/gitClient.js";
import type { NpmClient } from "../utils/npmClient.js";
import { errorResponse, getErrorMessage, textResponse } from "../utils/toolResponses.js";

export const registerStartWorkTools = (
  server: McpServer,
  gitClient: GitClient,
  npmClient: NpmClient
): void => {
  server.registerTool(
    "start_work",
    {
      description:
        "Set remote URL from env, pull latest changes, create and push a branch, and install dependencies",
      inputSchema: z
        .object({
          branch: z.string().min(1),
          startPoint: z.string().min(1).optional(),
        })
        .strict(),
    },
    async ({ branch, startPoint }) => {
      try {
        const { stdout: setUrlStdout } = await gitClient.setRemoteUrlFromEnvAsync();
        const { stdout: pullStdout } = await gitClient.pullAsync();
        const { stdout: createBranchStdout } = await gitClient.createAndPushBranchAsync(
          branch,
          startPoint
        );
        const { stdout: installStdout } = await npmClient.installAllAsync();

        const setUrlMessage = setUrlStdout
          ? `Git remote set-url output:\n${setUrlStdout}`
          : "Git remote set-url completed.";
        const pullMessage = pullStdout ? `Git pull output:\n${pullStdout}` : "Git pull completed.";
        const createBranchMessage = createBranchStdout
          ? `Git branch create/push output:\n${createBranchStdout}`
          : "Git branch create/push completed.";
        const installMessage = installStdout
          ? `Dependency install output:\n${installStdout}`
          : "Dependency install completed.";

        return textResponse(
          `${setUrlMessage}\n\n${pullMessage}\n\n${createBranchMessage}\n\n${installMessage}`
        );
      } catch (error) {
        return errorResponse(`Error starting work: ${getErrorMessage(error)}`);
      }
    }
  );
};
