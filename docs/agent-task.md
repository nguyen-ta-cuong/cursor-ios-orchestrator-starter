# Task contract — replace before a live run

## Goal

Add one small, reviewable feature to this iOS app. Replace this paragraph with the real user outcome. The starter does not contain your application source or assume your app's architecture.

## Existing project facts

- Workspace or project: REPLACE_WITH_REAL_PATH
- App scheme: REPLACE_WITH_REAL_SCHEME
- Unit-test target or selectors: REPLACE_WITH_REAL_TEST_TARGET
- Minimum iOS version: REPLACE_WITH_PROJECT_VALUE
- Architecture and state management: REPLACE_WITH_EXISTING_APPROACH
- Applicable instructions beyond root AGENTS.md: REPLACE_WITH_PATHS_OR_NONE

## Example milestone — empty-state screen

This is an example, not authorization to change an unspecified app.

- Show the supplied empty-state image and explanatory text when the feature has no records.
- Preserve the existing behavior when records are available.
- Make the primary action reachable with VoiceOver and the supported Dynamic Type sizes.
- Use existing typography, localization, navigation, and state-management conventions.
- Add a focused behavioral test when this changes application behavior; do not add tests that merely assert constants or mirror the implementation.

## Ownership

- Implementation paths: REPLACE_WITH_EXPLICIT_DIRECTORIES
- Asset inputs and destination: REPLACE_WITH_SUPPLIED_IMAGE_AND_IMAGESET_OR_NONE
- JavaScript resources: NONE_UNLESS_THIS_APP_ALREADY_USES_THEM
- Integration owner for shared project metadata: coordinator only

## Acceptance evidence

1. Configured serial build and scoped unit tests pass.
2. Correctness review completes against the current source.
3. UI/source review completes against the current source.
4. If visual acceptance is required, a human or the interactive coordinator inspects a real SwiftUI preview or simulator screenshot. The unattended SDK starter does not capture previews.
5. No unresolved mandatory review finding remains.

## Constraints

- Read applicable repository rules first. Preserve the current architecture.
- Keep all changes within the assigned milestone.
- Do not weaken checks, edit the harness, change the task contract, or change Git state.
- Report a missing image, dependency, simulator, credential, or requirement explicitly.
- This task does not authorize release, upload, publication, commits, or pushes.

## Done report

List changed files, explain the user-visible behavior, link the local gate results, and state any unverified acceptance item. A successful automated run does not satisfy an unperformed visual check.
