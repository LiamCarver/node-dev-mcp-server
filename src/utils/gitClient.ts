import type { WorkspaceManager } from "./workspaceManager.js";
import { runCommandAsync, type CommandResult } from "./commandRunner.js";

export class GitClient {
  private readonly workspaceManager: WorkspaceManager;

  constructor(workspaceManager: WorkspaceManager) {
    this.workspaceManager = workspaceManager;
  }

  async runGitAsync(args: string[]): Promise<CommandResult> {
    return runCommandAsync("git", args, {
      cwd: this.workspaceManager.getWorkspaceDir(),
    });
  }

  statusAsync(): Promise<CommandResult> {
    return this.runGitAsync(["status"]);
  }

  diffAsync({
    staged,
    file,
  }: {
    staged?: boolean;
    file?: string;
  } = {}): Promise<CommandResult> {
    const args = ["diff"];
    if (staged) {
      args.push("--staged");
    }
    if (file) {
      args.push(file);
    }
    return this.runGitAsync(args);
  }

  addAsync(files: string[]): Promise<CommandResult> {
    return this.runGitAsync(["add", ...files]);
  }

  commitAsync(message: string): Promise<CommandResult> {
    return this.runGitAsync(["commit", "-m", message]);
  }

  pushAsync(remote = "origin", branch?: string): Promise<CommandResult> {
    const args = ["push", remote];
    if (branch) {
      args.push(branch);
    }
    return this.runGitAsync(args);
  }

  logAsync(limit = 10): Promise<CommandResult> {
    return this.runGitAsync(["log", "-n", String(limit)]);
  }

  pullAsync(): Promise<CommandResult> {
    return this.runGitAsync(["pull"]);
  }

  setRemoteUrlFromEnvAsync(): Promise<CommandResult> {
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

  deleteBranchAsync(branch: string, force?: boolean): Promise<CommandResult> {
    const flag = force ? "-D" : "-d";
    return this.runGitAsync(["branch", flag, branch]);
  }

  async createAndPushBranchAsync(
    branch: string,
    startPoint?: string
  ): Promise<CommandResult> {
    const createArgs = ["checkout", "-b", branch];
    if (startPoint) {
      createArgs.push(startPoint);
    }
    const createResult = await this.runGitAsync(createArgs);
    if (createResult.exitCode !== 0) {
      return createResult;
    }
    const pushResult = await this.runGitAsync(["push", "-u", "origin", branch]);
    if (pushResult.exitCode !== 0) {
      return pushResult;
    }
    return {
      stdout: `${createResult.stdout}${pushResult.stdout}`,
      stderr: `${createResult.stderr}${pushResult.stderr}`,
      exitCode: 0,
    };
  }
}
