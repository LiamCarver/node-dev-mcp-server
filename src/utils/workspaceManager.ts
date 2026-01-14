import type { Dirent } from "fs";
import fs from "fs/promises";
import path from "path";

export class WorkspaceManager {
  private readonly workspaceRoot: string;
  private packageRootCache?: string;
  private readonly packageDirIgnore = new Set([
    ".git",
    "node_modules",
    "build",
    "dist",
    "out",
  ]);

  constructor({ workspaceRoot }: { workspaceRoot: string }) {
    this.workspaceRoot = workspaceRoot;
  }

  getWorkspaceDir(): string {
    return this.workspaceRoot;
  }

  async getPackageRootAsync(): Promise<string> {
    if (this.packageRootCache) {
      return this.packageRootCache;
    }

    const workspaceDir = this.getWorkspaceDir();
    const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
    const hasRootPackage = entries.some(
      (entry) => entry.isFile() && entry.name === "package.json"
    );
    if (hasRootPackage) {
      this.packageRootCache = workspaceDir;
      return workspaceDir;
    }

    const matches: string[] = [];
    const queue: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (this.packageDirIgnore.has(entry.name)) {
        continue;
      }
      queue.push(path.join(workspaceDir, entry.name));
    }
    while (queue.length > 0) {
      const currentDir = queue.shift();
      if (!currentDir) {
        continue;
      }

      const currentEntries = await fs.readdir(currentDir, { withFileTypes: true });
      const hasPackageJson = currentEntries.some(
        (entry) => entry.isFile() && entry.name === "package.json"
      );
      if (hasPackageJson) {
        matches.push(currentDir);
        continue;
      }

      for (const entry of currentEntries) {
        if (!entry.isDirectory()) {
          continue;
        }
        if (this.packageDirIgnore.has(entry.name)) {
          continue;
        }
        queue.push(path.join(currentDir, entry.name));
      }
    }

    if (matches.length === 1) {
      this.packageRootCache = matches[0];
      return matches[0];
    }

    if (matches.length > 1) {
      throw new Error(
        `Multiple package.json files found in workspace. Set WORKSPACE_ROOT to the package root or remove extra packages.`
      );
    }

    throw new Error("No package.json found in workspace.");
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

  async listEntriesAsync(name?: string): Promise<Dirent[]> {
    if (!name) {
      return fs.readdir(this.getWorkspaceDir(), { withFileTypes: true });
    }
    return fs.readdir(this.resolvePath(name), { withFileTypes: true });
  }
}
