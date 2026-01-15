import type { WorkspaceManager } from "./workspaceManager.js";
import { runCommandAsync, type CommandResult } from "./commandRunner.js";

export class NpmClient {
  private readonly workspaceManager: WorkspaceManager;
  private readonly npmCommand: string;

  constructor(workspaceManager: WorkspaceManager) {
    this.workspaceManager = workspaceManager;
    this.npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  }

  private async resolveWorkingDirectory(currentWorkingDirectory: string): Promise<string> {
    try {
      return await this.workspaceManager.resolveDirectoryAsync(currentWorkingDirectory);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Invalid currentWorkingDirectory: ${message}`);
    }
  }

  async runNpmAsync(currentWorkingDirectory: string, args: string[]): Promise<CommandResult> {
    const cwd = await this.resolveWorkingDirectory(currentWorkingDirectory);
    return runCommandAsync(this.npmCommand, args, { cwd });
  }

  installAllAsync(
    currentWorkingDirectory: string,
    options: { legacyPeerDeps?: boolean } = {}
  ): Promise<CommandResult> {
    const args = ["install"];
    args.push("--include=dev");
    if (options.legacyPeerDeps) {
      args.push("--legacy-peer-deps");
    }
    return this.runNpmAsync(currentWorkingDirectory, args);
  }

  installPackageAsync(
    currentWorkingDirectory: string,
    packageName: string
  ): Promise<CommandResult> {
    return this.runNpmAsync(currentWorkingDirectory, ["install", packageName]);
  }

  runScriptAsync(currentWorkingDirectory: string, script: string): Promise<CommandResult> {
    return this.runNpmAsync(currentWorkingDirectory, ["run", script]);
  }
}
