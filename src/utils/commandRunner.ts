import { execFile } from "child_process";
import type { ExecFileOptions } from "child_process";

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export const runCommandAsync = (
  file: string,
  args: readonly string[],
  options?: ExecFileOptions
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const execOptions: ExecFileOptions = { ...options, encoding: "utf8" };
    const normalizeOutput = (value: string | Buffer | undefined): string =>
      value ? (typeof value === "string" ? value : value.toString("utf8")) : "";
    execFile(file, args, execOptions, (error, stdout, stderr) => {
      if (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (typeof code === "number") {
          resolve({
            stdout: normalizeOutput(stdout),
            stderr: normalizeOutput(stderr),
            exitCode: code,
          });
          return;
        }
        reject(error);
        return;
      }
      resolve({
        stdout: normalizeOutput(stdout),
        stderr: normalizeOutput(stderr),
        exitCode: 0,
      });
    });
  });
