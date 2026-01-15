import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitClient } from "../utils/gitClient.js";
import type { NpmClient } from "../utils/npmClient.js";
import { formatCommandFailure, formatCommandOutput } from "../utils/commandOutput.js";
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
          currentWorkingDirectory: z.string().min(1),
          installWithLegacyPeerDependencies: z.boolean(),
          startPoint: z.string().min(1).optional(),
        })
        .strict(),
    },
    async ({ branch, currentWorkingDirectory, installWithLegacyPeerDependencies, startPoint }) => {
      try {
        const setUrlResult = await gitClient.setRemoteUrlFromEnvAsync();
        if (setUrlResult.exitCode !== 0) {
          return errorResponse(
            `Error setting git remote URL.\n\n${formatCommandFailure(setUrlResult)}`
          );
        }
        const pullResult = await gitClient.pullAsync();
        if (pullResult.exitCode !== 0) {
          return errorResponse(`Error pulling changes.\n\n${formatCommandFailure(pullResult)}`);
        }
        const createBranchResult = await gitClient.createAndPushBranchAsync(
          branch,
          startPoint
        );
        if (createBranchResult.exitCode !== 0) {
          return errorResponse(
            `Error creating/pushing branch.\n\n${formatCommandFailure(createBranchResult)}`
          );
        }
        const installResult = await npmClient.installAllAsync(currentWorkingDirectory, { legacyPeerDeps: installWithLegacyPeerDependencies });
        if (installResult.exitCode !== 0) {
          return errorResponse(
            `Error installing dependencies.\n\n${formatCommandFailure(installResult)}`
          );
        }

        const setUrlOutput = formatCommandOutput(setUrlResult);
        const pullOutput = formatCommandOutput(pullResult);
        const createBranchOutput = formatCommandOutput(createBranchResult);
        const installOutput = formatCommandOutput(installResult);

        const setUrlMessage = setUrlOutput
          ? `Git remote set-url output:\n${setUrlOutput}`
          : "Git remote set-url completed.";
        const pullMessage = pullOutput ? `Git pull output:\n${pullOutput}` : "Git pull completed.";
        const createBranchMessage = createBranchOutput
          ? `Git branch create/push output:\n${createBranchOutput}`
          : "Git branch create/push completed.";
        const installMessage = installOutput
          ? `Dependency install output:\n${installOutput}`
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
