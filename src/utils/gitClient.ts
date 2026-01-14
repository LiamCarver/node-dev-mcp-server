import { execFile } from "child_process";
import type { ExecFileOptions } from "child_process";
import util from "util";
import type { WorkspaceManager } from "./workspaceManager.js";

export class GitClient {
  private readonly workspaceManager: WorkspaceManager;
  private readonly execFileAsync: (
    file: string,
    args?: readonly string[],
    options?: ExecFileOptions
  ) => Promise<{ stdout: string; stderr: string }>;

  constructor(workspaceManager: WorkspaceManager) {
    this.workspaceManager = workspaceManager;
    this.execFileAsync = util.promisify(execFile);
  }

  async runGitAsync(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return this.execFileAsync("git", args, {
      cwd: this.workspaceManager.getWorkspaceDir(),
    });
  }

  statusAsync(): Promise<{ stdout: string; stderr: string }> {
    return this.runGitAsync(["status"]);
  }

  diffAsync({
    staged,
    file,
  }: {
    staged?: boolean;
    file?: string;
  } = {}): Promise<{ stdout: string; stderr: string }> {
    const args = ["diff"];
    if (staged) {
      args.push("--staged");
    }
    if (file) {
      args.push(file);
    }
    return this.runGitAsync(args);
  }

  addAsync(files: string[]): Promise<{ stdout: string; stderr: string }> {
    return this.runGitAsync(["add", ...files]);
  }

  commitAsync(message: string): Promise<{ stdout: string; stderr: string }> {
    return this.runGitAsync(["commit", "-m", message]);
  }

  pushAsync(
    remote = "origin",
    branch?: string
  ): Promise<{ stdout: string; stderr: string }> {
    const args = ["push", remote];
    if (branch) {
      args.push(branch);
    }
    return this.runGitAsync(args);
  }

  logAsync(limit = 10): Promise<{ stdout: string; stderr: string }> {
    return this.runGitAsync(["log", "-n", String(limit)]);
  }

  pullAsync(): Promise<{ stdout: string; stderr: string }> {
    return this.runGitAsync(["pull"]);
  }

  setRemoteUrlFromEnvAsync(): Promise<{ stdout: string; stderr: string }> {
    const repo = process.env.PROJECT_REPO;
    const token = process.env.GITHUB_TOKEN;
    if (!repo || !token) {
      throw new Error("Missing PROJECT_REPO or GITHUB_TOKEN environment variable.");
    }

    const repoWithoutScheme = repo
      .replace(/^https?:\/\//, "")
      .replace(/^[^@]+@/, "")
      .replace(/\/+$/, "");
    const url = `https://${token}@${repoWithoutScheme}`;
    return this.runGitAsync(["remote", "set-url", "origin", url]);
  }

  deleteBranchAsync(
    branch: string,
    force?: boolean
  ): Promise<{ stdout: string; stderr: string }> {
    const flag = force ? "-D" : "-d";
    return this.runGitAsync(["branch", flag, branch]);
  }

  async createAndPushBranchAsync(
    branch: string,
    startPoint?: string
  ): Promise<{ stdout: string }> {
    const createArgs = ["checkout", "-b", branch];
    if (startPoint) {
      createArgs.push(startPoint);
    }
    const { stdout: createStdout } = await this.runGitAsync(createArgs);
    const { stdout: pushStdout } = await this.runGitAsync([
      "push",
      "-u",
      "origin",
      branch,
    ]);
    return { stdout: `${createStdout}${pushStdout}` };
  }
}
