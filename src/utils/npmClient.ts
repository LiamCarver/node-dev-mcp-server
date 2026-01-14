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

  async runNpmAsync(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const packageRoot = await this.workspaceManager.getPackageRootAsync();
    return this.execFileAsync(this.npmCommand, args, { cwd: packageRoot });
  }

  installAllAsync(options: { legacyPeerDeps?: boolean } = {}): Promise<{
    stdout: string;
    stderr: string;
  }> {
    const args = ["install"];
    if (options.legacyPeerDeps) {
      args.push("--legacy-peer-deps");
    }
    return this.runNpmAsync(args);
  }

  installPackageAsync(packageName: string): Promise<{ stdout: string; stderr: string }> {
    return this.runNpmAsync(["install", packageName]);
  }

  runScriptAsync(script: string): Promise<{ stdout: string; stderr: string }> {
    return this.runNpmAsync(["run", script]);
  }
}
