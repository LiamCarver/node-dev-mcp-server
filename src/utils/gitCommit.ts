import type { GitClient } from "./gitClient.js";
import type { CommandResult } from "./commandRunner.js";
import { formatCommandOutput } from "./commandOutput.js";

type CommitFailureStep = "stage" | "commit" | "push";

export type CommitOutcome =
  | {
      ok: true;
      outputs: string[];
      skipped: boolean;
      skipReason?: string;
    }
  | {
      ok: false;
      step: CommitFailureStep;
      result: CommandResult;
    };

const isNoChangesCommit = (result: CommandResult): boolean => {
  const combined = `${result.stdout}\n${result.stderr}`;
  return /nothing to commit|no changes added to commit/i.test(combined);
};

const formatOutputs = (results: CommandResult[]): string[] =>
  results.map((result) => formatCommandOutput(result)).filter(Boolean);

export const commitAndPushAsync = async (
  gitClient: GitClient,
  commitMessage: string,
  paths?: string[]
): Promise<CommitOutcome> => {
  const addArgs = paths && paths.length > 0 ? paths : ["-A"];
  const addResult = await gitClient.addAsync(addArgs);
  if (addResult.exitCode !== 0) {
    return { ok: false, step: "stage", result: addResult };
  }

  const commitResult = await gitClient.commitAsync(commitMessage);
  if (commitResult.exitCode !== 0) {
    if (isNoChangesCommit(commitResult)) {
      return {
        ok: true,
        outputs: formatOutputs([addResult, commitResult]),
        skipped: true,
        skipReason: "No changes to commit.",
      };
    }
    return { ok: false, step: "commit", result: commitResult };
  }

  const pushResult = await gitClient.pushAsync();
  if (pushResult.exitCode !== 0) {
    return { ok: false, step: "push", result: pushResult };
  }

  return {
    ok: true,
    outputs: formatOutputs([addResult, commitResult, pushResult]),
    skipped: false,
  };
};
