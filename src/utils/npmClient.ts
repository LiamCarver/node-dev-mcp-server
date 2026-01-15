import { execFile } from "child_process";
import type { ExecFileOptions } from "child_process";
import util from "util";
import type { WorkspaceManager } from "./workspaceManager.js";

export class NpmClient {
  private readonly workspaceManager: WorkspaceManager;
  private readonly execFileAsync: (
    file: string,
    args?: readonly string[],
    options?: ExecFileOptions
  ) => Promise<{ stdout: string; stderr: string }>;
  private readonly npmCommand: string;

  constructor(workspaceManager: WorkspaceManager) {
    this.workspaceManager = workspaceManager;
    this.execFileAsync = util.promisify(execFile);
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

  async runNpmAsync(currentWorkingDirectory: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    const cwd = await this.resolveWorkingDirectory(currentWorkingDirectory);
    return this.execFileAsync(this.npmCommand, args, { cwd });
  }

  installAllAsync(currentWorkingDirectory: string, options: { legacyPeerDeps?: boolean } = {}): Promise<{
    stdout: string;
    stderr: string;
  }> {
    const args = ["install"];
    if (options.legacyPeerDeps) {
      args.push("--legacy-peer-deps");
    }
    return this.runNpmAsync(currentWorkingDirectory, args);
  }

  installPackageAsync(currentWorkingDirectory: string, packageName: string): Promise<{ stdout: string; stderr: string }> {
    return this.runNpmAsync(currentWorkingDirectory, ["install", packageName]);
  }

  runScriptAsync(currentWorkingDirectory: string, script: string): Promise<{ stdout: string; stderr: string }> {
    return this.runNpmAsync(currentWorkingDirectory, ["run", script]);
  }
}
