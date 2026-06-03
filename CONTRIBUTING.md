# Contributing

## Making changes

1. Fork or branch from `main`.
2. Make your changes.
3. Bump the version in `package.json` to reflect the scope of the change:
   - Bug fixes → `npm version patch`
   - Backwards-compatible new features → `npm version minor`
   - Breaking changes → `npm version major`
4. Open a pull request against `main`.
5. Once the PR is merged, the publish workflow runs automatically — no manual publish step needed.

## How publishing works

Merging to `main` triggers `.github/workflows/publish.yml`, which runs the test suite and publishes the package to npm using OIDC Trusted Publishing. No npm token or credentials are required from contributors.

If you forget to bump the version, the workflow will fail with a version collision error on npm. Update the version in a follow-up PR to resolve it.
