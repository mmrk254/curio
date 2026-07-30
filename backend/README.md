# CURIO Backend

Spring Boot backend for CURIO Version 1.0.

## Stack

- Java 21 target
- Spring Boot 3.5
- Spring Web
- Spring Security
- Spring JDBC/JPA dependency
- PostgreSQL
- Flyway migrations
- Swagger/OpenAPI
- Actuator health endpoint

## Local URLs

- API: http://127.0.0.1:8080
- Health: http://127.0.0.1:8080/actuator/health
- Swagger: http://127.0.0.1:8080/swagger-ui.html

## Database

Default development connection:

- Database: `curio`
- Username: `postgres`
- Password: `postgres`

Override with environment variables:

- `CURIO_DB_URL`
- `CURIO_DB_USERNAME`
- `CURIO_DB_PASSWORD`

## Current V1 Scope

Implemented:

- School registration
- Login
- Password hashing
- Core V1 schema
- Dashboard summary API
- Create/list APIs for core school records
- Audit logging

Not final yet:

- Production JWT enforcement
- Cloudflare R2 file upload
- Deployment to Vercel/Railway/Supabase
- Deep workflows for every module
