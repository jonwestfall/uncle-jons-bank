# Versioning And Releases

## Versioning policy

Use Semantic Versioning (`MAJOR.MINOR.PATCH`) for tagged releases.

- `MAJOR`: incompatible API or behavior changes.
- `MINOR`: backward-compatible features.
- `PATCH`: backward-compatible fixes and docs-only hotfixes.

## Changelog process

- Source of truth: repository `CHANGELOG.md`.
- Keep entries grouped by upcoming version under `## [Unreleased]`.
- Add entries as part of each PR, not at release time only.

Recommended sections:

- Added
- Changed
- Fixed
- Security
- Docs

## Release notes process

1. Create release branch/tag candidate.
2. Promote selected `Unreleased` entries into new version section with date.
3. Summarize user impact, migration notes, and known risks.
4. Publish GitHub release notes using same grouped sections.
5. Reset `Unreleased` section for next cycle.

## Breaking change requirements

When shipping a breaking change:

- Add `BREAKING` label in changelog entry.
- Document migration steps in release notes.
- Update affected API examples and user workflows in `/docs`.
