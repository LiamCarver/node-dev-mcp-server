import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NpmClient } from "../utils/npmClient.js";
import { errorResponse, getErrorMessage, textResponse } from "../utils/toolResponses.js";

type InstallPackageInput = {
  name: string;
};

type RunScriptInput = {
  script: string;
};

export const registerNpmTools = (server: McpServer, npmClient: NpmClient): void => {
  server.registerTool(
    "install_dependencies",
    {
      description: "Install all dependencies in the workspace",
      inputSchema: z.object({}).strict(),
    },
    async () => {
      try {
        const { stdout } = await npmClient.installAllAsync();
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
        name: z
          .string()
          .min(1)
          .describe("Package name or specifier (e.g. lodash or lodash@4.17.21)"),
      }),
    },
    async ({ name }: InstallPackageInput) => {
      try {
        const { stdout } = await npmClient.installPackageAsync(name);
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
      inputSchema: z.object({}).strict(),
    },
    async () => {
      try {
        const { stdout } = await npmClient.runScriptAsync("build");
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
        script: z.string().min(1).describe("Script name to run (e.g. test, lint)"),
      }),
    },
    async ({ script }: RunScriptInput) => {
      try {
        const { stdout } = await npmClient.runScriptAsync(script);
        return textResponse(stdout || `Script ${script} completed.`);
      } catch (error) {
        return errorResponse(
          `Error running script ${script}: ${getErrorMessage(error)}`
        );
      }
    }
  );
};
