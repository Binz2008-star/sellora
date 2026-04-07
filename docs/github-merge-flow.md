# GitHub Merge Flow

Repo-side setup is committed.

Configured workflows:

- `PR Validation`
- `Codex PR Review`

Remaining GitHub settings:

1. Open `https://github.com/Binz2008-star/sellora`.
2. Go to `Settings` -> `Secrets and variables` -> `Actions`.
3. Add a repository secret named `OPENAI_API_KEY`.
4. Go to `Settings` -> `Actions` -> `General` and allow GitHub Actions if they are disabled.
5. Go to `Settings` -> `Rules` -> `Rulesets` or `Branches`.
6. Add or update the rule for `main`:
   - require a pull request before merging
   - require status checks before merging
   - select the required check `PR Validation / validate`
7. In the same `main` rule, enable merge queue.
8. Keep both PRs targeting `main`.
9. Enqueue or merge in this order:
   - `feat/storefront-settings`
   - `feat/retrieval-benchmark`

Notes:

- `PR Validation` runs on both `pull_request` and `merge_group`, so it is compatible with merge queue.
- `Codex PR Review` runs on pull requests and posts review comments when `OPENAI_API_KEY` is configured.
