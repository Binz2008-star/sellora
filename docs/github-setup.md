# GitHub Setup

This repository now includes:

- `.github/workflows/pr-validation.yml` for scoped pull request tests
- `.github/workflows/codex-pr-review.yml` for Codex pull request review comments

Complete these GitHub steps after the branch is pushed:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Secrets and variables` -> `Actions`.
3. Create a new repository secret named `OPENAI_API_KEY`.
4. Paste your OpenAI API key as the value.
5. Open the `Actions` tab and enable workflows if GitHub prompts you.
6. Open or update a pull request to trigger the workflows.

Optional:

- Install and enable the Codex GitHub integration for native `@codex review` and automatic review flows.
- Configure branch protection to require the `PR Validation` workflow before merge.
