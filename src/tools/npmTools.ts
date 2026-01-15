import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NpmClient } from "../utils/npmClient.js";
import type { GitClient } from "../utils/gitClient.js";
import { commitAndPushAsync } from "../utils/gitCommit.js";
import { formatCommandFailure, formatCommandOutput } from "../utils/commandOutput.js";
import { errorResponse, getErrorMessage, textResponse } from "../utils/toolResponses.js";

type InstallPackageInput = {
  currentWorkingDirectory: string;
  name: string;
  commitMessage: string;
};

type InstallDependenciesInput = {
  currentWorkingDirectory: string;
  legacyPeerDeps?: boolean;
  commitMessage: string;
};

type RunScriptInput = {
  currentWorkingDirectory: string;
  script: string;
  commitMessage: string;
};

export const registerNpmTools = (
  server: McpServer,
  npmClient: NpmClient,
  gitClient: GitClient
): void => {
  server.registerTool(
    "install_dependencies",
    {
      description: "Install all dependencies in the workspace",
      inputSchema: z
        .object({
          currentWorkingDirectory: z.string().min(1),
          legacyPeerDeps: z
            .boolean()
            .optional()
            .describe("Use npm --legacy-peer-deps to bypass peer dependency conflicts."),
          commitMessage: z.string().min(1).describe("Commit message for git"),
        })
        .strict(),
    },
    async ({ currentWorkingDirectory, legacyPeerDeps, commitMessage }: InstallDependenciesInput) => {
      try {
        const result = await npmClient.installAllAsync(currentWorkingDirectory, { legacyPeerDeps });
        if (result.exitCode !== 0) {
          return errorResponse(
            `Error installing dependencies.\n\n${formatCommandFailure(result)}`
          );
        }
        const commitOutcome = await commitAndPushAsync(gitClient, commitMessage);
        if (!commitOutcome.ok) {
          return errorResponse(
            `Error ${commitOutcome.step} dependency changes.\n\n${formatCommandFailure(
              commitOutcome.result
            )}`
          );
        }
        const output = formatCommandOutput(result);
        const commitNote = commitOutcome.skipped
          ? `\n\n${commitOutcome.skipReason ?? "No changes to commit."}`
          : "";
        const commitOutput = commitOutcome.outputs.length
          ? `\n\n${commitOutcome.outputs.join("\n\n")}`
          : "";
        return textResponse(
          `${output || "Dependency install completed."}${commitOutput}${commitNote}`
        );
      } catch (error) {
        return errorResponse(`Error installing dependencies: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "install_package",
    {
      description: "Install a single package in the workspace",
      inputSchema: z.object({
        currentWorkingDirectory: z.string().min(1),
        name: z
          .string()
          .min(1)
          .describe("Package name or specifier (e.g. lodash or lodash@4.17.21)"),
        commitMessage: z.string().min(1).describe("Commit message for git"),
      }),
    },
    async ({ currentWorkingDirectory, name, commitMessage }: InstallPackageInput) => {
      try {
        const result = await npmClient.installPackageAsync(currentWorkingDirectory, name);
        if (result.exitCode !== 0) {
          return errorResponse(
            `Error installing package ${name}.\n\n${formatCommandFailure(result)}`
          );
        }
        const commitOutcome = await commitAndPushAsync(gitClient, commitMessage);
        if (!commitOutcome.ok) {
          return errorResponse(
            `Error ${commitOutcome.step} package changes.\n\n${formatCommandFailure(
              commitOutcome.result
            )}`
          );
        }
        const output = formatCommandOutput(result);
        const commitNote = commitOutcome.skipped
          ? `\n\n${commitOutcome.skipReason ?? "No changes to commit."}`
          : "";
        const commitOutput = commitOutcome.outputs.length
          ? `\n\n${commitOutcome.outputs.join("\n\n")}`
          : "";
        return textResponse(
          `${output || `Package install completed for ${name}.`}${commitOutput}${commitNote}`
        );
      } catch (error) {
        return errorResponse(
          `Error installing package ${name}: ${getErrorMessage(error)}`
        );
      }
    }
  );

  server.registerTool(
    "run_build",
    {
      description: "Run the build script in the workspace",
      inputSchema: z.object({
        currentWorkingDirectory: z.string().min(1),
        commitMessage: z.string().min(1).describe("Commit message for git"),
      }).strict(),
    },
    async ({currentWorkingDirectory, commitMessage}) => {
      try {
        const result = await npmClient.runScriptAsync(currentWorkingDirectory, "build");
        if (result.exitCode !== 0) {
          return errorResponse(`Error running build script.\n\n${formatCommandFailure(result)}`);
        }
        const commitOutcome = await commitAndPushAsync(gitClient, commitMessage);
        if (!commitOutcome.ok) {
          return errorResponse(
            `Error ${commitOutcome.step} build changes.\n\n${formatCommandFailure(
              commitOutcome.result
            )}`
          );
        }
        const output = formatCommandOutput(result);
        const commitNote = commitOutcome.skipped
          ? `\n\n${commitOutcome.skipReason ?? "No changes to commit."}`
          : "";
        const commitOutput = commitOutcome.outputs.length
          ? `\n\n${commitOutcome.outputs.join("\n\n")}`
          : "";
        return textResponse(
          `${output || "Build script completed."}${commitOutput}${commitNote}`
        );
      } catch (error) {
        return errorResponse(`Error running build script: ${getErrorMessage(error)}`);
      }
    }
  );

  server.registerTool(
    "run_script",
    {
      description: "Run a script in the workspace",
      inputSchema: z.object({
        currentWorkingDirectory: z.string().min(1),
        script: z.string().min(1).describe("Script name to run (e.g. test, lint)"),
        commitMessage: z.string().min(1).describe("Commit message for git"),
      }),
    },
    async ({ currentWorkingDirectory, script, commitMessage }: RunScriptInput) => {
      try {
        const result = await npmClient.runScriptAsync(currentWorkingDirectory, script);
        if (result.exitCode !== 0) {
          return errorResponse(
            `Error running script ${script}.\n\n${formatCommandFailure(result)}`
          );
        }
        const commitOutcome = await commitAndPushAsync(gitClient, commitMessage);
        if (!commitOutcome.ok) {
          return errorResponse(
            `Error ${commitOutcome.step} script changes.\n\n${formatCommandFailure(
              commitOutcome.result
            )}`
          );
        }
        const output = formatCommandOutput(result);
        const commitNote = commitOutcome.skipped
          ? `\n\n${commitOutcome.skipReason ?? "No changes to commit."}`
          : "";
        const commitOutput = commitOutcome.outputs.length
          ? `\n\n${commitOutcome.outputs.join("\n\n")}`
          : "";
        return textResponse(
          `${output || `Script ${script} completed.`}${commitOutput}${commitNote}`
        );
      } catch (error) {
        return errorResponse(
          `Error running script ${script}: ${getErrorMessage(error)}`
        );
      }
    }
  );
};
