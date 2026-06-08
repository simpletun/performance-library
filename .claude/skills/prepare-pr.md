# Skill: prepare-pr

Prepare and post a pull request for the current feature branch against `main`.

## Prerequisites

Before doing anything else, verify both prerequisites are met:

1. **`gh` CLI is installed** — run `gh --version`. If it fails, stop and tell the user:
   > `gh` CLI is required. Install it from https://cli.github.com and run `gh auth login` before using this skill.

2. **No uncommitted changes** — run `git status --porcelain`. If there is any output, stop and tell the user to commit or stash their changes first.

## Steps

### 1. Gather branch context

Run all of these in parallel:

```bash
git branch --show-current
git log main..HEAD --oneline
git diff main...HEAD --stat
```

Also run the full diff for analysis (may be large — read it to understand what changed):

```bash
git diff main...HEAD
```

If `git log main..HEAD` is empty, stop and tell the user there are no commits ahead of `main` on this branch.

### 2. Analyze the changes

Using the commit messages, diff stat, and full diff, determine:

- **Summary bullets** — a concise list of what changed and why (2–5 bullets, written from the reader's perspective)
- **Motivation** — why this change was needed; pull from commit messages where clear, otherwise infer from the code
- **Type of change** — which checkbox(es) apply: Bug fix / New feature / Breaking change / Refactor / Documentation / CI/tooling
- **Steps to validate** — concrete numbered steps a reviewer can follow to confirm correctness (e.g., run a specific test, invoke a specific command, observe specific output). Tailor these to the actual nature of the diff — don't write generic steps.
- **New dependencies** — run `git diff main...HEAD -- package.json` and extract any packages added to `dependencies` or `devDependencies`. For each, note the package name, the version pinned in `package.json`, and a brief purpose (infer from the package name and how it appears in the diff).

### 3. Read the PR template

Read `.github/PULL_REQUEST_TEMPLATE.md` to get the current template structure.

### 4. Render the filled template

Produce the complete PR body by filling in the template with the generated content:
- Replace the `Summary` placeholder with the bullet list
- Pre-check the appropriate `Type of Change` checkboxes (replace `[ ]` with `[x]`)
- Fill in `Motivation & Context`
- Pre-check the `How Has This Been Tested` boxes that apply given the diff
- Replace the `Steps to Validate` placeholder with the numbered steps
- Fill the `New Dependencies` table with any newly added packages; if none were added, write "None" and remove the table
- Leave the `Checklist` section for the author to complete

### 5. Present for review

Show the user the proposed PR title and the full rendered body. Ask:

> Does this look good, or would you like to make any changes before I post the PR?

Wait for the user to confirm or provide edits. If they provide edits, incorporate them and show the revised version before proceeding.

### 6. Post the PR

Once the user confirms, run:

```bash
gh pr create \
  --title "<title>" \
  --body "$(cat <<'PREOF'
<filled body>
PREOF
)" \
  --base main
```

Derive the title from the branch name: convert the branch name to title case, replacing `/` and `-` and `_` with spaces (e.g., `feature/multi-output-support` → `Feature: Multi Output Support`). If the user suggested a different title during review, use that instead.

Return the PR URL to the user.
