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
npm test -- --runInBand --coverage
```

`npm ci` installs dependencies from the lockfile without updating it.
Use `npm install` when intentionally changing dependencies.

Run `.\scripts\check.ps1` in PowerShell to format the backend, then run lint,
type-checking, and build. It stops on the first failure. Formatting edits files;
tests and the non-mutating format check remain separate commands.

The development server listens on http://localhost:3000 by default.

The web app uses Tailwind CSS and Aceternity UI for the storefront and
management screens. Aceternity components are installed from its registry.

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

Migrations 0000-0002 have been applied to the development and local test
databases. The Products API uses PostgreSQL through the shared database
provider. Migrations 0003–0005 (admin permissions, images, cleanup scheduling and
order idempotency) are applied to local `store_test` only. Apply them before
running the updated app against Supabase; that operation requires separate
approval.

The schema deletes a user's sessions, accounts, cart, favourites, views, ratings,
and seller profile when that user is deleted. Deleting a seller profile also
deletes its products. Orders keep their items and clear the deleted buyer's
reference. Product deletion clears product references in other users' orders,
ratings, and favourites; saved product names and order prices remain. Views and
cart items for the deleted product are removed.

Checkout copies names and prices from server-side products into order items.
Favourites and ratings also save product names. Clearing an order's user reference
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

The auth integration suite also mounts the Nest users, sellers, products and images
routes with the local database and real session/seller guards. It tests profile
creation, conflicts, product ownership, literal name/ID search, pagination,
sign-out, and seller deletion with retained buyer snapshots. It deletes only
tracked test users, orders, and categories. Database-free HTTP tests mock the
product/seller services and the session lookup; PostgreSQL behavior is checked
by the integration suite.

Cart/order tests check concurrent checkout, stock restoration, exact-cent totals
and idempotency with real PostgreSQL. Collection tests cover account deletion,
favourites, ratings and distinct-viewer recommendations. Image tests use real
PostgreSQL, Sharp and guards, but replace remote storage with an isolated fake;
no test provisions buckets or uploads to Supabase.

Verified on 2026-11-08: 468 unit tests, 34 database-free HTTP tests and 63
local integration tests. Unit coverage: 74.68% statements, 73.93% branches,
82.60% functions and 76.52% lines, including untested bootstrap/module files.

The integration app now uses the production `AuthService` with a local
database provider and fake configuration. Admin tests verify signup/update
cannot grant access and that grants/revocation affect an existing session.
The admin probe endpoint exists only in the integration test module.

### Admin permissions

Users default to `isAdmin: false`. Better Auth exposes the field as
server-controlled (`input: false`); signup cannot grant it and user updates
cannot change it. Seller access still comes from a seller profile, independently
of admin access.

Protect admin routes with `SessionGuard` followed by `AdminGuard` (and
`WriteOriginGuard` for writes). The admin guard reads the current database
flag on every request rather than trusting a cached session flag. Missing
sessions return 401, non-admin users return 403, and database failures propagate.
No public endpoint grants admin access. Initial admin provisioning is a separate,
explicitly authorized database operation.

Apply pending migrations only to the guarded local test database:

```powershell
npm exec --workspace apps/api -- drizzle-kit migrate --config drizzle.test.config.ts
```

### Backend stages

Implemented: admin permissions, categories, product images/storage, cart,
orders without payment, favourites/ratings, account operations,
views/recommendations, banners, and the admin CMS API (users, orders, any
product, stats, CSV import, JSON/CSV export). Fake payments are handled in the
web app only; auth completion and operational setup are still pending; complete
deployment safeguards before any public release.

### Seller and product API

Any signed-in user can create one seller profile and continue shopping as a
buyer. Store names are unique. Public seller responses contain `id`, `storeName`,
`description`, `createdAt`, and `updatedAt`, without the auth user ID.

| Method       | Route             | Access                                                                |
| ------------ | ----------------- | --------------------------------------------------------------------- |
| GET          | `/sellers`      | Public; `search`, `page`, `limit`                               |
| GET          | `/sellers/:id`  | Public; UUID seller ID                                                |
| GET          | `/sellers/me`   | Signed in; own profile                                                |
| POST         | `/sellers`      | Signed in; create own profile                                         |
| PATCH        | `/sellers/me`   | Signed in; update own profile                                         |
| DELETE       | `/sellers/me`   | Signed in; delete own profile and its products                        |
| GET          | `/products`     | Public; `search`, `categoryId`, `sellerId`, `page`, `limit` |
| GET          | `/products/:id` | Public; UUID product ID                                               |
| POST         | `/products`     | Signed-in seller                                                      |
| PATCH/DELETE | `/products/:id` | Product's owning seller                                               |

Seller creation requires a trimmed `storeName` (1–200 characters); `description`
is optional, nullable, and limited to 5,000 characters. PATCH accepts at least
one of these fields. Clearing a description uses `null`.

Product creation now requires `name`, an existing UUID `categoryId`, integer
`stockQuantity`, and decimal-string `price` (for example `"29.99"`).
`description` and `discountPercent` are optional. PATCH accepts at least one
allowed field and preserves omitted fields. IDs and ownership fields are
server-controlled; request bodies containing `id`, `userId`, or `sellerId`
are rejected. Admins manage category IDs through the category API.

Product responses now include the database fields: `id`, `name`, `sellerId`,
`categoryId`, `description`, `stockQuantity`, `price`, and `discountPercent`.
Prices remain strings. List responses remain arrays, ordered by UUID, with
default `page=1`, `limit=10`, and maximum `limit=100`. Product search matches
case-insensitive literal name substrings or an exact product UUID.

Protected writes require an `Origin` header matching the origin of
`BETTER_AUTH_URL` or the optional `TRUSTED_FRONTEND_ORIGIN`, even for
command-line clients. Both Better Auth and the NestJS write guard trust the
configured frontend origin. The write guard rejects missing, `null`, and
untrusted origins. The frontend setting must be an HTTP(S) origin without a
path, credentials, query, fragment, or wildcard. Use this setting rather than
Better Auth's `BETTER_AUTH_TRUSTED_ORIGINS` environment variable, which the API
rejects to prevent unvalidated additional origins.

Missing sessions return 401; a missing seller profile or another seller's
product returns 403. Malformed IDs/bodies/queries or unknown categories return
400; unknown resource UUIDs return 404; duplicate profiles/store names return
409. Creates return 201 with `Location`; deletes return 204 without a body.

### Category API

| Method | Route               | Access                                  |
| ------ | ------------------- | --------------------------------------- |
| GET    | `/categories`     | Public; `search`, `page`, `limit` |
| GET    | `/categories/:id` | Public; UUID category ID                |
| POST   | `/categories`     | Admin                                   |
| PATCH  | `/categories/:id` | Admin                                   |
| DELETE | `/categories/:id` | Admin                                   |

Create and update accept only `{ "name": "Keyboards" }`; names are trimmed,
required, limited to 200 characters, and unique (case-sensitive). Responses
contain `id` and `name`. Lists use the shared pagination defaults and cap, with
literal case-insensitive name search and UUID ordering.

Writes require a session, current database admin access, and a trusted `Origin`
header. Creates return 201 with `Location`, updates 200, and deletes 204.
Duplicate names and deletion of a category still referenced by products return
409. Reassign or delete those products first; deleting a category never cascades
to products. Invalid input returns 400 and missing category UUIDs return 404.
The existing category table is reused without a new migration.

### Product images and storage

| Method | Route                                    | Access                                      |
| ------ | ---------------------------------------- | ------------------------------------------- |
| GET    | `/products/:productId/images`          | Public; ready images only                   |
| POST   | `/products/:productId/images`          | Product's owning seller; multipart `file` |
| DELETE | `/products/:productId/images/:imageId` | Product's owning seller                     |
| POST   | `/admin/products/:productId/images`          | Admin; multipart `file`                |
| DELETE | `/admin/products/:productId/images/:imageId` | Admin                                  |
| POST   | `/product-images/cleanup`              | Admin; retry queued object removal          |

Images are limited to eight per product and 5 MiB per upload. The server decodes
JPEG/PNG/WebP content instead of trusting the filename or MIME label, rejects
unsupported/animated content and dimensions above 4096, strips metadata and
stores WebP at at most 2048 pixels per side. Responses contain `id`, `productId`,
`url` and `createdAt`, without separate bucket/path fields. URLs identify public
product images; this bucket must not contain private account data.

Configure `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY` together.
Use a dedicated public `SUPABASE_STORAGE_BUCKET` (default `product-images`).
Provision that bucket separately with no public upload/update/delete policies;
the backend uses its service key. Storage writes return 503 until configured.
No hosted bucket or storage credentials have been configured by this change.

Metadata deletions, including product/seller/account cascades, enqueue remote
objects through a database trigger. Failed removal retains the queue entry.
Uploads reserve cleanup metadata before network calls; unfinished uploads have
a one-minute cleanup grace period, and abandoned pending rows expire after one
hour. Cleanup runs on image writes and the admin retry route, at most 100
eligible objects per call. It is not a scheduled worker yet. A failed deletion
may return 503 after metadata has been removed; retry through the cleanup route.

### Cart and orders without payment

| Method | Route               | Access                                    |
| ------ | ------------------- | ----------------------------------------- |
| GET    | `/cart`           | Own cart                                  |
| POST   | `/cart/items`     | Signed in; `{productId, quantity}`      |
| PATCH  | `/cart/items/:id` | Own item; `{quantity}`                  |
| DELETE | `/cart/items/:id` | Own item                                  |
| GET    | `/orders`         | Own orders; `page`, `limit`           |
| POST   | `/orders`         | Own cart; UUID `Idempotency-Key` header |
| GET    | `/orders/:id`     | Own order with snapshot items             |
| PATCH  | `/orders/:id`     | Own order; `{status:"cancelled"}`       |

Quantities are integers from 1 to 999 and must fit current stock. Checkout takes
prices and discounts from the database, calculates in integer cents, locks
cart/product rows, creates pending order snapshots, decrements stock and clears
the cart in one transaction. Retrying the same user/key returns the same order
(201) without purchasing again. Cancellation (200) restores surviving products
once and is idempotent. Totals/stock exceeding database limits return 409 and
roll back. Foreign orders return 404. No payment is taken and no route marks an
order paid or fulfilled.

### Favourites, ratings, account and recommendations

| Method           | Route                             | Access                                                 |
| ---------------- | --------------------------------- | ------------------------------------------------------ |
| GET/POST         | `/favourites`                   | Own list; create with `{productId}`                  |
| DELETE           | `/favourites/:id`               | Own saved item                                         |
| GET/POST         | `/ratings`                      | Own list; create with `{productId, score, comment?}` |
| PATCH/DELETE     | `/ratings/:id`                  | Own rating                                             |
| GET              | `/products/:id/ratings`         | Public                                                 |
| GET/PATCH/DELETE | `/users/me`                     | Own account                                            |
| POST             | `/products/:id/views`           | Signed in; record own view                             |
| GET              | `/users/me/views`               | Own history                                            |
| GET              | `/products/:id/recommendations` | Public                                                 |

Scores are integers from 1 to 5; comments are optional/nullable, at most 2,000
characters. Each user can rate a product once. Account updates accept only
`name` (trimmed, 1–100 characters); deletion invalidates sessions and cascades
owned marketplace data while retaining order snapshots.

Lists use `page=1`, `limit=10` by default, maximum 100. Own ratings support
comment search; view history supports product-name search. Recommendations
count distinct users who viewed both products, exclude the target, sort by
shared-viewer count then UUID, and expose no viewer identities. No shared
viewers yields `[]`; anonymous browsing is not recorded yet.

All new writes require a valid session and the trusted `Origin` described
above; ownership/admin checks apply independently of client-supplied fields.

`/users/me` responses include `isAdmin`, which the web app uses to show the CMS.

### Admin CMS API and banners

| Method             | Route                       | Access                                                |
| ------------------ | --------------------------- | ----------------------------------------------------- |
| GET                | `/banners`                  | Public; up to 10 active banners by `sortOrder`        |
| GET/POST           | `/admin/banners`            | Admin; list (`page`, `limit`) or create               |
| PATCH/DELETE       | `/admin/banners/:id`        | Admin                                                 |
| GET                | `/admin/stats`              | Admin; counts and non-cancelled revenue               |
| GET/POST           | `/admin/users`              | Admin; `search`, `role=admin\|customer`; create      |
| GET/PATCH/DELETE   | `/admin/users/:id`          | Admin; detail with orders; `name`, `isAdmin`, `emailVerified` |
| GET                | `/admin/orders`             | Admin; `status`, `userId`, `page`, `limit`            |
| GET/PATCH          | `/admin/orders/:id`         | Admin; detail; cancel with `{status: "cancelled"}`    |
| POST               | `/admin/products`           | Admin; product fields plus `sellerId`                 |
| PATCH/DELETE       | `/admin/products/:id`       | Admin; any seller's product                           |
| POST               | `/admin/import/products`    | Admin; `{csv}`                                        |
| POST               | `/admin/import/users`       | Admin; `{csv}`                                        |
| GET                | `/admin/export/:resource`   | Admin; `products`, `categories`, `users`, `orders`, `banners`; `format=json\|csv` |
| GET                | `/admin/export/backup`      | Admin; JSON export of store records and image links |
| POST               | `/admin/products/bulk/delete`, `/admin/products/bulk/discount` | Admin; selected products |
| POST               | `/seller/products/bulk/delete`, `/seller/products/bulk/discount` | Seller; owned products only |
| POST               | `/seller/import/products`   | Seller; `{csv}`, owned products only |
| GET                | `/seller/export/backup`     | Seller; own profile, products, categories and image links |

Banner `linkUrl` must be a site path starting with `/` or an http(s) URL;
`imageUrl` must be http(s). Admins cannot remove their own admin access or
delete their own account. Admin-created accounts get a hashed password through
Better Auth and no session.

Imports are sent as JSON `{ "csv": "..." }` (at most 90,000 characters).
Product CSV columns: `name,categoryId,sellerId,price,stockQuantity` plus
optional `description,discountPercent`; all rows are validated and inserted in
one transaction, up to 1,000 rows, or nothing is imported. User CSV columns:
`name,email,password` plus optional `isAdmin`; up to 100 rows, existing emails
are skipped and reported. Exports are attachments capped at 10,000 rows per
resource; CSV cells that start with `= + - @` are prefixed with `'` so
spreadsheets do not run them as formulas.

Seller product CSV omits `sellerId`; the authenticated seller is assigned on
the server. Both product imports are atomic. Bulk actions accept 1–100 unique
product IDs; they fail without changes if any selected product is missing or
not owned by the seller. Discount replaces the current percentage with an
integer from 0 to 100. The CMS selects products on the current page.

The admin JSON export contains products, categories, users, sellers, orders,
order items, banners, carts, cart items, favourites, views, ratings and ready
image URLs. Seller exports contain only their store, products, used categories
and ready image URLs. Neither export includes authentication data or image
files, and there is no restore function. They are not disaster-recovery
backups; use separate database and storage backups for recovery.

Migration `0006_banners.sql` adds the `banners` table.

### Management screens

The admin dashboard is available at `/admin` to accounts with admin access.
It manages products, categories, users, orders, banners and CSV transfers.
The shared `/seller` page loads the signed-in user's seller profile and
products; sellers can create or edit their store and products. Admins and
owning sellers can upload or delete product images, including when creating a
product. If an image upload fails, the product remains saved for retry. Product
ownership cannot be changed through the CMS. Image uploads require configured
Supabase storage.
Seller-specific order management is not available in the API yet.
The dashboard displays order totals, not payments or payment status.

The web development proxy uses `API_ORIGIN`. A production deployment must
provide an equivalent `/backend` proxy before these screens can reach the API.
