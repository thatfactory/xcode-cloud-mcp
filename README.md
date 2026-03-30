<p align="center">
  <a href="https://docs.anthropic.com/en/docs/claude-code/mcp"><img alt="Claude" src="https://img.shields.io/badge/Claude-MCP-D97757.svg?logo=claude&logoColor=white"></a>
  <a href="https://developers.openai.com/codex/mcp"><img alt="Codex" src="https://img.shields.io/badge/Codex-MCP-1F70C1.svg?logo=icloud&logoColor=white"></a>
  <a href="https://en.wikipedia.org/wiki/MIT_License"><img alt="License" src="https://img.shields.io/badge/License-MIT-67ac5b.svg?logo=googledocs&logoColor=white"></a>
  <a href="https://github.com/thatfactory/xcode-cloud-mcp/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/thatfactory/xcode-cloud-mcp/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/thatfactory/xcode-cloud-mcp/actions/workflows/nightly.yml"><img alt="Nightly" src="https://github.com/thatfactory/xcode-cloud-mcp/actions/workflows/nightly.yml/badge.svg"></a>
</p>

# xcode-cloud-mcp

Minimal MCP server for discovering Xcode Cloud products and workflows, then retrieving build issues, logs, test summaries, and UI test artifacts through the App Store Connect API.

## Features

- Discover Xcode Cloud products with `list_products`.
- Discover workflows for a product with `list_workflows`.
- List recent workflow runs with `list_build_runs`.
- Retrieve build issue counts with `get_build_issues`.
- Retrieve and summarize text-like build logs with `get_build_logs`.
- Materialize build logs into a local temp directory with `materialize_build_logs`.
- Save extracted logs to a local temporary directory and return file paths for agent-side inspection.
- Retrieve test summaries with `get_test_results`.
- Retrieve only detected failed tests with `get_failed_tests`.
- Retrieve screenshots, videos, result bundles, and test products with `get_test_artifacts`.
- Clean up saved local log directories with `cleanup_saved_logs`.

Build lookup is workflow-scoped. Retrieval tools accept a direct `buildRunId`, or a `workflowId` plus `buildNumber`, or a `workflowId` plus `buildSelector: "latest" | "latestFailing"`.

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
- `list_build_runs(workflowId, limit?, status?)`
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
