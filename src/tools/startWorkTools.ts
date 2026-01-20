import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitClient } from "../utils/gitClient.js";
import type { NpmClient } from "../utils/npmClient.js";
import { formatCommandFailure, formatCommandOutput } from "../utils/commandOutput.js";
import { commitAndPushAsync } from "../utils/gitCommit.js";
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
          installWithLegacyPeerDependencies: z
            .boolean()
            .optional()
            .describe("Use npm --legacy-peer-deps to bypass peer dependency conflicts."),
          startPoint: z.string().min(1).optional(),
          commitMessage: z.string().min(1).describe("Commit message for git"),
        })
        .strict(),
    },
    async ({
      branch,
      currentWorkingDirectory,
      installWithLegacyPeerDependencies,
      startPoint,
      commitMessage,
    }) => {
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
        const installResult = await npmClient.installAllAsync(currentWorkingDirectory, {
          legacyPeerDeps: installWithLegacyPeerDependencies ?? false,
        });
        if (installResult.exitCode !== 0) {
          return errorResponse(
            `Error installing dependencies.\n\n${formatCommandFailure(installResult)}`
          );
        }
        const commitOutcome = await commitAndPushAsync(gitClient, commitMessage);
        if (!commitOutcome.ok) {
          return errorResponse(
            `Error ${commitOutcome.step} start_work changes.\n\n${formatCommandFailure(
              commitOutcome.result
            )}`
          );
        }

        const setUrlOutput = formatCommandOutput(setUrlResult);
        const pullOutput = formatCommandOutput(pullResult);
        const createBranchOutput = formatCommandOutput(createBranchResult);
        const installOutput = formatCommandOutput(installResult);
        const commitOutput = commitOutcome.outputs.length
          ? `\n\n${commitOutcome.outputs.join("\n\n")}`
          : "";
        const commitNote = commitOutcome.skipped
          ? `\n\n${commitOutcome.skipReason ?? "No changes to commit."}`
          : "";

        const setUrlMessage = setUrlOutput
          ? `Git remote set-url output:\n${setUrlOutput}`
          : "Git remote set-url completed.";
        const pullMessage = pullOutput ? `Git pull output:\n${pullOutput}` : "Git pull completed.";
        const createBranchMessage = createBranchOutput
          ? `Git branch create/push output:\n${createBranchOutput}`
          : "Git branch create/push completed.";
        const installMessage = installOutput
          ? `Dependency install output:\n${installOutput}${commitOutput}${commitNote}`
          : `Dependency install completed.${commitOutput}${commitNote}`;

        return textResponse(
          `${setUrlMessage}\n\n${pullMessage}\n\n${createBranchMessage}\n\n${installMessage}`
        );
      } catch (error) {
        return errorResponse(`Error starting work: ${getErrorMessage(error)}`);
      }
    }
  );
};
