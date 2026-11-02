# iOS build and unit test gate

This repository tool runs `xcodebuild test` once with explicit unit test bundles.
The test action compiles the app and tests. It creates a raw log, an invocation
record, a summary with the actual process exit code, and an Xcode result bundle.
A successful build must also produce a valid test summary with at least one
passing test and zero failed tests. Zero-test and all-skipped runs fail closed.
It does not edit Git state or change application source.

Requirements: macOS, full Xcode 16 or later, an installed iOS Simulator, and Node.js on PATH.
Use the same Node version required by the SDK runner. Install the shared
TypeScript and `tsx` dependencies from the repository root:

```bash
npm install
```

## Configure once

From the repository root, copy the example if you do not already have a config:

```bash
cp -n tools/ios-harness/config.example.json tools/ios-harness/config.json
xcodebuild -version
xcode-select -p
xcrun simctl list devices available
```

Edit `config.json`. Set `workspace`, `scheme`, the installed simulator's UUID,
and `unitTestTargets` to the exact unit test bundle names from Xcode. For a
project-only app, replace the `workspace` key with `project` and its value with
the relative `.xcodeproj` path. Do not set both keys.

To discover schemes and supported destinations, replace these example names:

```bash
xcodebuild -list -json -workspace MyApp.xcworkspace
xcodebuild -showdestinations -workspace MyApp.xcworkspace -scheme MyApp
```

Use `-project MyApp.xcodeproj` instead of `-workspace` for a project-only app.
An example configuration after discovering the real values is:

```json
{
  "project": "MyApp.xcodeproj",
  "scheme": "MyApp",
  "simulatorUDID": "REPLACE_WITH_SIMULATOR_UDID",
  "unitTestTargets": ["MyAppTests"],
  "timeoutSeconds": 1800
}
```

The UUID shown above is intentionally a placeholder. Test bundle names are
validated for syntax; this script cannot infer whether a bundle contains unit
tests or UI tests. Select **unit test bundles only**. After a successful
`xcodebuild` exit, this gate reads `xcresulttool get test-results summary` and
requires valid top-level counts with `passedTests + failedTests > 0` and
`failedTests == 0`. Missing result bundles, extraction errors, unrecognized
count schemas, and zero executed tests block the gate with exit code 2.

## Run

```bash
npm run harness:dry-run
npm run harness
```

From the repository root, the direct equivalents are
`npx tsx tools/ios-harness/check.ts --dry-run` and
`npx tsx tools/ios-harness/check.ts`. The shell entry point also remains available:
`bash tools/ios-harness/check.sh [--dry-run]`. It runs the repository-local `tsx`
runtime and reports how to install dependencies if that runtime is missing.

Dry run works without Xcode, does not build, and creates no run directories. If
`config.json` does not exist, dry run reads `config.example.json`. Real runs
require a configured file and refuse placeholders. The repository root is
derived from the script location, so the invoking working directory is irrelevant.

Each real invocation creates `.orchestrator/gates/<unique-run>/` with its own
`DerivedData`, `Tests.xcresult`, `xcodebuild.log`, `invocation.json`, and
`summary.json`. Following a successful build, it also saves raw
`test-summary.json` and an `xcresulttool.log`. The JSON summary includes the
validated counts, extraction status, and raw file paths, and goes to stdout as
well. `.xcresult` may be absent
when Xcode fails before producing results. Keep `.orchestrator/` ignored by Git.

Read results using Xcode or, replacing the run path:

```bash
xcrun xcresulttool get test-results summary --path .orchestrator/gates/RUN/Tests.xcresult
```

The gate preserves nonzero xcodebuild exit codes, including 65 for ordinary
build/test failure; it uses 124 for build timeout, 130 for build interruption,
143 for build termination, and 127 for failure to spawn xcodebuild. Configuration,
setup, missing-result, zero-test, and result-extraction errors return 2 so the
orchestrator can stop for configuration repair. Interactive builds and Simulator runs use XcodeBuildMCP instead (see the root README); they read this file's project, scheme, and simulator, and wait while this gate holds its build lock. The orchestrator also blocks, rather than repairs, on xcodebuild's 64 (usage) and 70 (destination or internal error). Failed tests found in a result
bundle also return 65, even if xcodebuild returned 0. `summary.json.exitCode`
retains the raw xcodebuild code, including `null` if terminated by a signal.
`gateExitCode` is the final interpreted code. The summary extraction has a
separate 60-second timeout.

## Concurrency and cancellation

An atomic `.orchestrator/build-lock` directory allows one invocation of **this
gate in this repository** at a time. Other builds launched directly or from a
different worktree are not locked. `-parallel-testing-enabled NO` controls
Xcode's test runners; it is not a machine-wide simulator lock. Give simultaneous
worktrees separate simulators, or serialize them with your coordinator.

The timeout defaults to 30 minutes and accepts 10–7200 seconds. Interrupt or
timeout sends SIGTERM to the process group spawned for this invocation, followed
by SIGKILL after 10 seconds if needed. It never uses a broad process-name kill.
Managed Xcode services or simulator daemons outside that group are not terminated.

Normal completion removes the lock. A hard kill or machine crash may leave it
behind. Inspect `build-lock/owner.json` and verify that its gate is no longer
running before manually removing that stale directory. Never delete a live lock.

## Existing project build systems

If your repository already has a trusted Makefile, Tuist, or other verification
entry point, deliberately adapt this gate to call that entry point. Do not add
parallel competing build conventions or bypass project generation requirements.
No signing, provisioning, lint, test target, or application architecture is
automatically changed here.

## Primary reading

- [Apple: command-line Xcode FAQ](https://developer.apple.com/library/archive/technotes/tn2339/_index.html) — schemes, destinations, scoped tests.
- [Apple: running tests and interpreting results](https://developer.apple.com/documentation/xcode/running-tests-and-interpreting-results) — test selection and identifiers.
- [Apple: save and inspect result bundles](https://help.apple.com/xcode/mac/current/en.lproj/devc38fc7392.html) — `-resultBundlePath` and `.xcresult`.
- [Apple: Xcode 16.3 release notes](https://developer.apple.com/documentation/Xcode-Release-Notes/xcode-16_3-release-notes) — modern `xcresulttool get test-results` commands.
- [MobileBuildMCP's xcresult parser](https://github.com/getsentry/MobileBuildMCP/blob/2847efff/src/utils/test-common.ts) — primary implementation confirming the top-level count field names. This gate is intentionally stricter about missing counts and zero execution.
- Local `man xcodebuild` and `xcrun xcresulttool --help` — the authority for your installed Xcode version.

The result validator has focused tests for zero execution, all-skipped runs,
failures, malformed schemas, and nested counters. Run them with:

```bash
npx tsx --test tools/ios-harness/validate-summary.test.ts
```

These tests and dry runs validate the harness without building an iOS app.
Verify the build and unit tests with your configured project and Xcode.
