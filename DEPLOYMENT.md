# CURIO deployment

Keep the Java Spring Boot API on Render Free, PostgreSQL on Supabase Free,
and the Next.js frontend on Vercel Hobby (personal, non-commercial use).
Render Free sleeps after 15 minutes without traffic; the next request may be slow.

## Supabase

Create a dedicated CURIO project. Use the Connect panel's session pooler for
the persistent Java backend. Configure these secrets in Render, never in Git:

- `CURIO_DB_URL`: `jdbc:postgresql://POOLER-HOST:5432/postgres?sslmode=require`
- `CURIO_DB_USERNAME`: the username supplied by the Connect panel
- `CURIO_DB_PASSWORD`: the database password

Flyway runs the existing migrations when the backend starts. The Java backend
uses JDBC; do not expose its tables through the Supabase Data API without RLS
and appropriate grants. No database credentials belong in frontend variables.

## Render

Import this repository as a Blueprint using `render.yaml`. It explicitly sets
`plan: free`. Supply the three database variables and `CURIO_ALLOWED_ORIGINS`
(the exact Vercel frontend origin, with no trailing slash). The Docker image
builds and runs Java 21. Verify `/actuator/health` after startup.

## Vercel

Import `mmrk254/curio`, select Next.js, and set Root Directory to `frontend`.
Set `NEXT_PUBLIC_API_URL` to the Render API's HTTPS origin before building.
Set the resulting frontend origin in Render's `CURIO_ALLOWED_ORIGINS`.
Verify registration, login, and dashboard against the deployed backend.

## Release blocker

The current API permits all requests and its login token is unsigned Base64.
Before using real school data, implement verified authentication and school
authorization on every protected endpoint, and send the token from the frontend.
Deployment configuration alone does not resolve this access-control issue.
