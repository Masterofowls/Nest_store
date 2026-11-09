This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

For local API development, run the web server on port 3001 and the API on port
3000. The development-only rewrite forwards `/backend/*` to `API_ORIGIN`
from `apps/web/.env.local`. If it is unset, Next.js warns and uses
`http://localhost:3000`. Set it to an HTTP or HTTPS origin without credentials,
a path, query or fragment. Set the API's `TRUSTED_FRONTEND_ORIGIN` to the web
origin, for example `http://localhost:3001`. Browser auth requests use
`/backend/api/auth/*`; email/password signup, sign-in and authenticated user
requests have been checked through the development rewrite. OAuth callbacks and
production routing have not been verified.

`getProducts` accepts an absolute API base URL. A base containing a path must
end in `/`, for example `http://localhost:3001/backend/`.

The marketplace entity modules provide response schemas, parsers and GET
functions for categories, sellers, images, cart, orders, favourites, ratings,
views and recommendations. GET functions accept an absolute base URL ending
in `/` and, where supported, pagination and search options. They throw an
`ApiError` with the HTTP status for unsuccessful responses and preserve Zod
errors as the cause of invalid-response errors.

Private GETs use same-origin browser cookies; server-side calls do not
automatically forward the user's cookie. The user API also provides `signIn`,
`signOut` and `signUp`. Sign-in and sign-up validate their inputs before
sending a request. For browser calls, `signInAndGetCurrentUser` and
`signUpAndGetCurrentUser` authenticate and then load the current user. A user
request can fail after sign-up has already created the account.
`getOptionalCurrentUser` returns `null` for a 401 and propagates other failures.
Other write operations are not implemented. The production proxy is not configured.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Tests

[vitest.config.mts](./vitest.config.mts) runs colocated `.test.ts`/`.spec.ts`
files in Node without global test functions. Import test APIs from `vitest`.
Vitest resolves the path aliases in `tsconfig.json`.
Component tests use React Testing Library and user-event. Add
`@vitest-environment jsdom` to a component test and call `cleanup` after each
test; logic tests continue to run in Node.

Coverage includes untested source and writes reports to ignored `coverage/`.
Tests, test-only directories and type declarations are excluded.
Product API tests use MSW to intercept requests in Node. Unhandled requests
fail rather than reaching the network. An empty suite is not treated as a
passing test run.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
