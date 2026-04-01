<p align="center">
  <a href="https://docs.anthropic.com/en/docs/claude-code/mcp"><img alt="Claude" src="https://img.shields.io/badge/Claude-MCP-D97757.svg?logo=claude&logoColor=white"></a>
  <a href="https://developers.openai.com/codex/mcp"><img alt="Codex" src="https://img.shields.io/badge/Codex-MCP-1F70C1.svg?logo=icloud&logoColor=white"></a>
  <a href="https://www.npmjs.com/package/@thatfactory/xcode-cloud-mcp"><img alt="NPM" src="https://img.shields.io/badge/NPM-ready-CB3837.svg?logo=npm&logoColor=white"></a>
  <a href="https://en.wikipedia.org/wiki/MIT_License"><img alt="License" src="https://img.shields.io/badge/License-MIT-67ac5b.svg?logo=googledocs&logoColor=white"></a>
  <a href="https://github.com/thatfactory/xcode-cloud-mcp/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/thatfactory/xcode-cloud-mcp/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/thatfactory/xcode-cloud-mcp/actions/workflows/nightly.yml"><img alt="Nightly" src="https://github.com/thatfactory/xcode-cloud-mcp/actions/workflows/nightly.yml/badge.svg"></a>
</p>

# xcode-cloud-mcp

Minimal MCP server for discovering Xcode Cloud products, inspecting and editing workflows, monitoring build runs, and retrieving build issues, logs, test summaries, and UI test artifacts through the App Store Connect API.

## Features

| Feature | Tool(s) | Example use | Example return |
| --- | --- | --- | --- |
| Discover products | `list_products` | "Show me the Xcode Cloud products available in this account." | `Demo App`, `productType: APP`, `createdDate: 2026-03-30T10:00:00Z` |
| Discover workflows | `list_workflows` | "List the workflows for product `def456`." | `Feature Branch`, `description`, `isEnabled: true`, `containerFilePath: Chauffeur.xcodeproj` |
| Inspect workflow configuration | `get_workflow_details` | "Show me the full workflow details for `abc123`, including environment and actions." | `general`, `environment`, `startConditions`, `actions`, `postActions` |
| Monitor running or recent builds | `list_build_runs` | "Show me the running builds for workflow `abc123` so I can monitor them." | `number: 93`, `executionProgress: RUNNING`, `completionStatus: null`, `startedDate: ...` |
| Enable or disable a workflow | `set_workflow_enabled` | "Disable workflow `abc123` while we are testing new settings." | `operation.type: set_workflow_enabled`, `workflow.general.isEnabled: false` |
| Update name, description, or clean mode | `update_workflow_general` | "Rename workflow `abc123` to `Feature Branch v2` and adjust its description." | `changedFields: [name, description]`, updated `workflow.general` |
| Update start conditions explicitly | `update_workflow_start_conditions` | "Change workflow `abc123` so pull-request builds no longer auto-cancel." | updated `workflow.startConditions.pullRequest.autoCancel: false` |
| Replace the workflow action list | `update_workflow_actions` | "Remove the archive action from workflow `abc123`, then add it back once the experiment is done." | `actionCount: 4` after removal, then `actionCount: 5` after restore |
| See build health quickly | `get_build_issues` | "What went wrong in the latest failing build for workflow `abc123`?" | `issueCounts: { errors: 1, testFailures: 3, warnings: 2 }` |
| Read compact build log summaries | `get_build_logs` | "Retrieve logs of build `81` and summarize the failure." | `failedTests`, `highlights`, `excerpt`, `savedLogsDirectory` |
| Materialize logs for local grep | `materialize_build_logs` | "Download the logs for build `81` so I can grep them locally." | `savedLogsDirectory: /var/folders/...`, `savedLogs: [...]` |
| Summarize test outcomes | `get_test_results` | "Summarize the test results for the latest failing build." | `testFailures`, `issueCounts`, `summary` |
| Jump straight to failed tests | `get_failed_tests` | "What tests failed in build `81`?" | `displayExpiryDateReturnsFormattedDateWhenExpiryDateExists()`, assertion message, saved log paths |
| Retrieve UI test artifacts | `get_test_artifacts` | "Show me the screenshots and videos from the latest failing UI test run." | `screenshots`, `videos`, `resultBundles`, `downloadUrl` |
| Clean up local temp files | `cleanup_saved_logs` | "Remove saved logs older than 24 hours." | `removedDirectories: [...]`, `retainedDirectories: [...]` |

Build lookup is workflow-scoped. Retrieval tools accept a direct `buildRunId`, or a `workflowId` plus `buildNumber`, or a `workflowId` plus `buildSelector: "latest" | "latestFailing"`.

`list_build_runs` also supports `status: "all" | "failed" | "succeeded" | "running" | "pending"`, so agents can poll active workflows without post-processing every run locally.

## Requirements

- Node.js `20+`
- App Store Connect API credentials with access to Xcode Cloud

## Environment Variables

Primary names:

- `APPSTORE_CONNECT_API_KEY_ID`
- `APPSTORE_CONNECT_API_ISSUER_ID`
- `APPSTORE_CONNECT_API_KEY_CONTENT`

Compatibility aliases:

- `APP_STORE_KEY_ID`
- `APP_STORE_ISSUER_ID`
- `APP_STORE_PRIVATE_KEY`

The private key can be passed as literal multi-line PEM content or as a string with escaped `\n`.

## Claude Setup

```bash
claude mcp add xcode-cloud \
  --env APPSTORE_CONNECT_API_KEY_ID="$APPSTORE_CONNECT_API_KEY_ID" \
  --env APPSTORE_CONNECT_API_ISSUER_ID="$APPSTORE_CONNECT_API_ISSUER_ID" \
  --env APPSTORE_CONNECT_API_KEY_CONTENT="$APPSTORE_CONNECT_API_KEY_CONTENT" \
  -- npx -y @thatfactory/xcode-cloud-mcp
```

## Codex Setup

```bash
codex mcp add xcode-cloud \
  --env APPSTORE_CONNECT_API_KEY_ID="$APPSTORE_CONNECT_API_KEY_ID" \
  --env APPSTORE_CONNECT_API_ISSUER_ID="$APPSTORE_CONNECT_API_ISSUER_ID" \
  --env APPSTORE_CONNECT_API_KEY_CONTENT="$APPSTORE_CONNECT_API_KEY_CONTENT" \
  -- npx -y @thatfactory/xcode-cloud-mcp
```

## Available Tools

- `list_products(limit?)`
- `list_workflows(productId, limit?)`
- `get_workflow_details(workflowId)`
- `list_build_runs(workflowId, limit?, status?)`
- `set_workflow_enabled(workflowId, enabled)`
- `update_workflow_general(workflowId, name?, description?, clean?)`
- `update_workflow_start_conditions(workflowId, branchStartCondition?, manualBranchStartCondition?, pullRequestStartCondition?, manualPullRequestStartCondition?, scheduledStartCondition?, tagStartCondition?, manualTagStartCondition?)`
- `update_workflow_actions(workflowId, actions)`
- `get_build_issues(buildRunId? workflowId? buildNumber? buildSelector?)`
- `get_build_logs(buildRunId? workflowId? buildNumber? buildSelector?, maxCharacters?)`
- `materialize_build_logs(buildRunId? workflowId? buildNumber? buildSelector?)`
- `get_test_results(buildRunId? workflowId? buildNumber? buildSelector?)`
- `get_failed_tests(buildRunId? workflowId? buildNumber? buildSelector?)`
- `get_test_artifacts(buildRunId? workflowId? buildNumber? buildSelector?)`
- `cleanup_saved_logs(buildRunId?, maxAgeHours?)`

## Log Retrieval Behavior

`get_build_logs` keeps the MCP response compact on purpose:

- it downloads and extracts text-like build log artifacts to a temporary local directory
- it returns `savedLogsDirectory` and `savedLogs` so local agents can inspect the extracted files with `rg`, `grep`, or `cat`
- it returns a compact `failedTests` summary, `highlights`, and a capped `excerpt`
- even if a caller passes a very large `maxCharacters`, the inline excerpt is clamped to avoid oversized MCP responses

Recommended agent workflow:

1. Call `get_failed_tests` or `get_build_logs`.
2. Read `savedLogsDirectory`.
3. Use `rg` inside that directory to inspect the exact failing test or assertion.
4. If needed, call `cleanup_saved_logs` when the investigation is done.

Temporary logs are written under the system temp directory in a path like:

```text
/tmp/xcode-cloud-mcp/build-logs/<buildRunId>
```

On macOS this typically resolves to a path under `/var/folders/.../T/`.

Cleanup policy:

- each new call for the same `buildRunId` deletes and recreates that build-specific temp directory first
- older build directories are pruned automatically when they are older than 24 hours
- you can also call `cleanup_saved_logs` directly for one `buildRunId` or for all directories older than a chosen retention window

## Example Prompts

```text
Retrieve logs of the latest failing build for workflow abc123.
```

```text
Retrieve logs of build 81, then inspect the returned savedLogsDirectory and grep for Expectation failed.
```

```text
Get the failed tests for build 81, then open the saved logs directory and inspect the failing test in context.
```

```text
Retrieve logs of build number 42 for workflow abc123.
```

```text
Show me the latest failing UI test artifacts for workflow abc123.
```

```text
List the workflows for product def456 and then summarize the latest build.
```

```text
Show me the full workflow details for workflow abc123, including environment, start conditions, actions, and whether it is enabled.
```

```text
Disable workflow abc123, remove the archive action, then restore the original action list after the experiment.
```

## Workflow Details Behavior

`get_workflow_details` returns the live workflow configuration exposed by App Store Connect, grouped into:

- `general`
- `environment`
- `startConditions`
- `actions`
- `postActions`

Notes:

- `environment` includes repository, `xcodeVersion`, and `macOsVersion` when App Store Connect returns them.
- `actions` includes action type, scheme, platform, destination, required-to-pass state, and test-plan details when present.
- `postActions` is currently returned as an empty array with a note because the App Store Connect workflow payload does not expose separate post-actions in the observed API response.

## Workflow Update Behavior

The workflow update tools are intentionally explicit:

- `set_workflow_enabled` only toggles `isEnabled`
- `update_workflow_general` only changes `name`, `description`, and `clean`
- `update_workflow_start_conditions` only changes the start-condition objects you pass
- `update_workflow_actions` replaces the full `actions` array, so callers should fetch the current workflow first and then send the final desired action list

Important restriction:

- if the workflow has `Restrict Editing` enabled in Xcode Cloud, edits can fail even when the App Store Connect API key has `App Manager` access
- for MCP edits to work reliably, disable the `Restrict Editing` checkbox for that workflow before using the write tools
- if Apple still rejects the request after that, use a stronger API key role such as `Admin`

## Local Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build the package:

```bash
npm run build
```
