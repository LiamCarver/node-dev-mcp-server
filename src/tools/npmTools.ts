import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NpmClient } from "../utils/npmClient.js";
import { errorResponse, getErrorMessage, textResponse } from "../utils/toolResponses.js";

type InstallPackageInput = {
  currentWorkingDirectory: string;
  name: string;
};

type InstallDependenciesInput = {
  currentWorkingDirectory: string;
  legacyPeerDeps?: boolean;
};

type RunScriptInput = {
  currentWorkingDirectory: string;
  script: string;
};

export const registerNpmTools = (server: McpServer, npmClient: NpmClient): void => {
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
        })
        .strict(),
    },
    async ({ currentWorkingDirectory, legacyPeerDeps }: InstallDependenciesInput) => {
      try {
        const { stdout } = await npmClient.installAllAsync(currentWorkingDirectory, { legacyPeerDeps });
        return textResponse(stdout || "Dependency install completed.");
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
      }),
    },
    async ({ currentWorkingDirectory, name }: InstallPackageInput) => {
      try {
        const { stdout } = await npmClient.installPackageAsync(currentWorkingDirectory, name);
        return textResponse(stdout || `Package install completed for ${name}.`);
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
        currentWorkingDirectory: z.string().min(1)
      }).strict(),
    },
    async ({currentWorkingDirectory}) => {
      try {
        const { stdout } = await npmClient.runScriptAsync(currentWorkingDirectory, "build");
        return textResponse(stdout || "Build script completed.");
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
      }),
    },
    async ({ currentWorkingDirectory, script }: RunScriptInput) => {
      try {
        const { stdout } = await npmClient.runScriptAsync(currentWorkingDirectory, script);
        return textResponse(stdout || `Script ${script} completed.`);
      } catch (error) {
        return errorResponse(
          `Error running script ${script}: ${getErrorMessage(error)}`
        );
      }
    }
  );
};
