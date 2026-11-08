
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

Check the PostgreSQL connection using `DATABASE_URL` from `apps/api/.env`:

```powershell
.\scripts\check-db.ps1
```

The script runs `select 1`, closes the connection, and exits nonzero on failure.
It does not print credentials or apply migrations.

Generate migrations without connecting to a database:

```powershell
npm exec --workspace apps/api -- drizzle-kit generate
```

The existing schema migrations have been applied to the development database
and local test database. The Products API uses PostgreSQL through the shared
database provider. This feature does not require another migration.

The schema deletes a user's sessions, accounts, cart, favourites, views, ratings,
and seller profile when that user is deleted. Deleting a seller profile also
deletes its products. Orders keep their items and clear the deleted buyer's
reference. Product deletion clears product references in other users' orders,
ratings, and favourites; saved product names and order prices remain. Views and
cart items for the deleted product are removed.

Future write endpoints must copy product names into history rows and prices into
order items from server-side product data. Clearing an order's user reference
does not anonymize any personal data added to other columns in future.

### Local database integration tests

Set `TEST_DATABASE_URL` in `apps/api/.env` to the local `store_test` database
on port 5432. Remote hosts and other database names are rejected.

```powershell
npm run test:integration --workspace apps/api
```

Run backend unit tests with source coverage using the VM-enabled Jest runner:

```powershell
npm test --workspace apps/api -- --runInBand --coverage
```

Product constraint/deletion tests roll back fixtures. Auth tests exercise the
Better Auth request handler with local Drizzle configuration and a fake secret,
then delete only their unique test accounts and verify account/session cleanup.
They cover signup, password storage, sign-in, sessions, sign-out, and rejected
credentials. They do not use Supabase or replace Nest HTTP routing tests.

The auth integration suite also mounts the Nest users, sellers, and products
routes with the local database and real session/seller guards. It tests profile
creation, conflicts, product ownership, literal name/ID search, pagination,
sign-out, and seller deletion with retained buyer snapshots. It deletes only
tracked test users, orders, and categories. Database-free HTTP tests mock the
product/seller services and the session lookup; PostgreSQL behavior is checked
by the integration suite.

### Seller and product API

Any signed-in user can create one seller profile and continue shopping as a
buyer. Store names are unique. Public seller responses contain `id`, `storeName`,
`description`, `createdAt`, and `updatedAt`, without the auth user ID.

| Method | Route | Access |
| --- | --- | --- |
| GET | `/sellers` | Public; `search`, `page`, `limit` |
| GET | `/sellers/:id` | Public; UUID seller ID |
| GET | `/sellers/me` | Signed in; own profile |
| POST | `/sellers` | Signed in; create own profile |
| PATCH | `/sellers/me` | Signed in; update own profile |
| DELETE | `/sellers/me` | Signed in; delete own profile and its products |
| GET | `/products` | Public; `search`, `categoryId`, `sellerId`, `page`, `limit` |
| GET | `/products/:id` | Public; UUID product ID |
| POST | `/products` | Signed-in seller |
| PATCH/DELETE | `/products/:id` | Product's owning seller |

Seller creation requires a trimmed `storeName` (1–200 characters); `description`
is optional, nullable, and limited to 5,000 characters. PATCH accepts at least
one of these fields. Clearing a description uses `null`.

Product creation now requires `name`, an existing UUID `categoryId`, integer
`stockQuantity`, and decimal-string `price` (for example `"29.99"`).
`description` and `discountPercent` are optional. PATCH accepts at least one
allowed field and preserves omitted fields. IDs and ownership fields are
server-controlled; request bodies containing `id`, `userId`, or `sellerId`
are rejected. Category administration is not implemented yet.

Product responses now include the database fields: `id`, `name`, `sellerId`,
`categoryId`, `description`, `stockQuantity`, `price`, and `discountPercent`.
Prices remain strings. List responses remain arrays, ordered by UUID, with
default `page=1`, `limit=10`, and maximum `limit=100`. Product search matches
case-insensitive literal name substrings or an exact product UUID.

All seller/product writes require an `Origin` header matching the origin of
`BETTER_AUTH_URL`, even for command-line clients. This strict origin check
blocks cross-site cookie-authenticated writes; missing, `null`, and foreign
origins are rejected. A separate frontend origin is not supported yet.

Missing sessions return 401; a missing seller profile or another seller's
product returns 403. Malformed IDs/bodies/queries or unknown categories return
400; unknown resource UUIDs return 404; duplicate profiles/store names return
409. Creates return 201 with `Location`; deletes return 204 without a body.
