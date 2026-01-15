import type { CommandResult } from "./commandRunner.js";

const DEFAULT_MAX_LINES = 300;

const formatStream = (label: string, text: string, maxLines: number): string | null => {
  const normalized = text.replace(/\r\n/g, "\n").trimEnd();
  if (!normalized) {
    return null;
  }
  const lines = normalized.split("\n");
  if (lines.length <= maxLines) {
    return `${label}:\n${normalized}`;
  }
  const trimmedCount = lines.length - maxLines;
  const tail = lines.slice(-maxLines).join("\n");
  return `${label}:\n... trimmed ${trimmedCount} lines ...\n${tail}`;
};

export const formatCommandOutput = (
  result: CommandResult,
  options: { maxLines?: number } = {}
): string => {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const parts = [
    formatStream("stdout", result.stdout, maxLines),
    formatStream("stderr", result.stderr, maxLines),
  ].filter(Boolean) as string[];
  return parts.join("\n\n");
};

export const formatCommandFailure = (
  result: CommandResult,
  options: { maxLines?: number } = {}
): string => {
  const output = formatCommandOutput(result, options);
  if (!output) {
    return `Command failed with exit code ${result.exitCode}.`;
  }
  return `Command failed with exit code ${result.exitCode}.\n\n${output}`;
};
