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

  async copyFolderAsync(sourceName: string, destinationName: string): Promise<void> {
    const sourcePath = this.resolvePath(sourceName);
    const destinationPath = this.resolvePath(destinationName);
    const sourceStats = await fs.stat(sourcePath);
    if (!sourceStats.isDirectory()) {
      throw new Error("Source path is not a folder.");
    }
    await fs.cp(sourcePath, destinationPath, { recursive: true, errorOnExist: true });
  }

  async searchEntriesAsync(
    pattern: string,
    flags?: string
  ): Promise<Array<{ path: string; type: "dir" | "file" }>> {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, flags);
    } catch (error) {
      throw new Error(
        `Invalid regular expression: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    const results: Array<{ path: string; type: "dir" | "file" }> = [];
    const queue: Array<{ absPath: string; relPath: string }> = [
      { absPath: this.getWorkspaceDir(), relPath: "" },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      const entries = await fs.readdir(current.absPath, { withFileTypes: true });
      for (const entry of entries) {
        const relPath = current.relPath
          ? path.join(current.relPath, entry.name)
          : entry.name;
        if (entry.isDirectory()) {
          if (this.packageDirIgnore.has(entry.name)) {
            continue;
          }
          if (regex.test(relPath)) {
            results.push({ path: relPath, type: "dir" });
          }
          queue.push({
            absPath: path.join(current.absPath, entry.name),
            relPath,
          });
          continue;
        }

        if (regex.test(relPath)) {
          results.push({ path: relPath, type: "file" });
        }
      }
    }

    return results;
  }

  async listEntriesAsync(name?: string): Promise<Dirent[]> {
    if (!name) {
      return fs.readdir(this.getWorkspaceDir(), { withFileTypes: true });
    }
    return fs.readdir(this.resolvePath(name), { withFileTypes: true });
  }
}
