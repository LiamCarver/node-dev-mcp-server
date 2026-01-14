import type { Dirent } from "fs";
import fs from "fs/promises";
import path from "path";

export class WorkspaceManager {
  private readonly workspaceRoot: string;

  constructor({ workspaceRoot }: { workspaceRoot: string }) {
    this.workspaceRoot = workspaceRoot;
  }

  getWorkspaceDir(): string {
    return this.workspaceRoot;
  }

  resolvePath(fileName: string): string {
    const workspaceDir = this.getWorkspaceDir();
    const resolvedWorkspaceDir = path.resolve(workspaceDir);
    const resolvedPath = path.resolve(workspaceDir, fileName);
    if (!resolvedPath.startsWith(resolvedWorkspaceDir + path.sep)) {
      throw new Error("Invalid file name.");
    }
    return resolvedPath;
  }

  async readFileAsync(name: string): Promise<string> {
    return fs.readFile(this.resolvePath(name), "utf-8");
  }

  async writeFileAsync(name: string, content: string): Promise<void> {
    await fs.writeFile(this.resolvePath(name), content, "utf-8");
  }

  async deleteFileAsync(name: string): Promise<void> {
    await fs.unlink(this.resolvePath(name));
  }

  async createFolderAsync(name: string): Promise<void> {
    await fs.mkdir(this.resolvePath(name), { recursive: true });
  }

  async deleteFolderAsync(name: string): Promise<void> {
    await fs.rm(this.resolvePath(name), { recursive: true, force: true });
  }

  async listEntriesAsync(): Promise<Dirent[]> {
    return fs.readdir(this.getWorkspaceDir(), { withFileTypes: true });
  }
}
