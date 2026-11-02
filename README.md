
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

The development server listens on http://localhost:3000 by default.
Stop it with Ctrl+C.
