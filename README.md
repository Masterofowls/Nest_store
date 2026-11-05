
### Monorepo commands

Run these commands from the repository root:

```powershell
npm ci
npm run dev
npm run build
npm run lint
npm run format:check
npm run typecheck
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:cov -- --runInBand
```

`npm ci` installs dependencies from the lockfile without updating it.
Use `npm install` when intentionally changing dependencies.

Run `.\scripts\check.ps1` in PowerShell to format the backend, then run lint,
type-checking, and build. It stops on the first failure. Formatting edits files;
tests and the non-mutating format check remain separate commands.

The development server listens on http://localhost:3000 by default.
Stop it with Ctrl+C.
