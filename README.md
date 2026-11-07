
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

### Database schema

Generate migrations without connecting to a database:

```powershell
npm exec --workspace apps/api -- drizzle-kit generate
```

Database setup and migration application are deferred. The Products API still
uses an in-memory collection.

The schema deletes a user's sessions, accounts, cart, favourites, views, ratings,
and seller profile when that user is deleted. Deleting a seller profile also
deletes its products. Orders keep their items and clear the deleted buyer's
reference. Product deletion clears product references in other users' orders,
ratings, and favourites; saved product names and order prices remain. Views and
cart items for the deleted product are removed.

Future write endpoints must copy product names into history rows and prices into
order items from server-side product data. Clearing an order's user reference
does not anonymize any personal data added to other columns in future.
