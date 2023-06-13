import * as core from "@actions/core";

import {
  createStatusReportBase,
  getActionsStatus,
  getOptionalInput,
  getRequiredInput,
  getTemporaryDirectory,
  sendStatusReport,
} from "./actions-util";
import { getGitHubVersion } from "./api-client";
import * as configUtils from "./config-utils";
import { Language, resolveAlias } from "./languages";
import { getActionsLogger } from "./logging";
import { runResolveBuildEnvironment } from "./resolve-environment";
import { checkForTimeout, checkGitHubVersionInRange, wrapError } from "./util";

const ACTION_NAME = "resolve-environment";

async function run() {
  const startedAt = new Date();
  const logger = getActionsLogger();
  const language: Language = resolveAlias(getRequiredInput("language"));

  try {
    if (
      !(await sendStatusReport(
        await createStatusReportBase(ACTION_NAME, "starting", startedAt)
      ))
    ) {
      return;
    }

    const gitHubVersion = await getGitHubVersion();
    checkGitHubVersionInRange(gitHubVersion, logger);

    const config = await configUtils.getConfig(getTemporaryDirectory(), logger);
    if (config === undefined) {
      throw new Error(
        "Config file could not be found at expected location. Has the 'init' action been called?"
      );
    }

    const workingDirectory = getOptionalInput("working-directory");
    const result = await runResolveBuildEnvironment(
      config.codeQLCmd,
      logger,
      workingDirectory,
      language
    );
    core.setOutput("environment", result);
  } catch (unwrappedError) {
    const error = wrapError(unwrappedError);
    core.setFailed(
      `Failed to resolve a build environment suitable for automatically building your code. ${error.message}`
    );
    await sendStatusReport(
      await createStatusReportBase(
        ACTION_NAME,
        getActionsStatus(error),
        startedAt,
        error.message,
        error.stack
      )
    );
    return;
  }

  await sendStatusReport(
    await createStatusReportBase(ACTION_NAME, "success", startedAt)
  );
}

async function runWrapper() {
  try {
    await run();
  } catch (error) {
    core.setFailed(`${ACTION_NAME} action failed: ${wrapError(error).message}`);
  }
  await checkForTimeout();
}

void runWrapper();
