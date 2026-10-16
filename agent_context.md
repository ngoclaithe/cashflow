# AGENT_CONTEXT.md — Cashflow

## 1. Project Context

Build and maintain a personal finance tracking application named **Cashflow**.

The application automatically synchronizes bank transactions, categorizes income and expenses, tracks budgets, and displays financial summaries.

This document defines the project's fixed technical stack, personal deployment environment, operational constraints, and implementation requirements.

Treat this document as the source of truth unless the repository or a subsequent explicit instruction establishes a newer decision.

## 2. Fixed Technology Stack

| Component | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Scheduling | `@nestjs/schedule`, if needed |
| Process management | Existing PM2 installation on the VPS |
| Web server / reverse proxy | Existing Nginx installation |
| Source control | GitHub |
| Deployment | Git push → SSH to VPS → pull latest code → build and restart affected PM2 processes |

### Prohibited changes

- Do not introduce Go or Python.
- Do not introduce Docker or Docker Compose.
- Do not introduce Kubernetes.
- Do not replace Vite with Next.js or Nuxt.
- Do not add unnecessary services, databases, or message brokers.
- Do not create a new deployment platform when the existing VPS can host the application.
- Do not change existing PM2 process configurations without inspecting their current state.
- Do not assume that a port is available before checking it.

Keep the application as a modular monolith with separate frontend and backend applications.

## 3. Personal VPS and Deployment Configuration

### Git repository

Repository:

`https://github.com/ngoclaithe/cashflow`

All changes must be committed and pushed to this repository before deploying, following the workflow below.

### VPS

- SSH user: `root`
- SSH host: `160.191.89.94`
- Project deployment directory: `/home/cashflow`

Connect using:

`ssh root@160.191.89.94`

The remote working directory is initially `/home`. Clone the repository into `/home/cashflow` if it does not already exist. If the repository already exists, inspect it and pull the appropriate branch rather than cloning a duplicate.

Use the repository's actual default branch unless explicitly instructed otherwise.

### Domains

Frontend:

`cashflow.dosutech.site`

Backend API:

`api-cashflow.dosutech.site`

DNS records and these domain names have already been configured. Do not create alternative domains or change the domain names.

Inspect the existing Nginx configuration before adding or modifying virtual hosts. Preserve unrelated sites and configurations.

### PostgreSQL

The local development environment and VPS use the same PostgreSQL connection settings.

- Database: `cashflow`
- Username: `cashflow`
- Password: `test1234`

Connection settings must be configured through environment variables, not hard-coded in application source files.

Use a `DATABASE_URL` appropriate to the actual PostgreSQL host and port in each environment. If PostgreSQL is local to the machine, use the appropriate loopback address; verify the real setup rather than assuming it.

The shared username, password, and database name do not imply that the local and remote database servers are the same server.

The password above is the explicitly supplied development/deployment configuration. Do not print it in logs, commit it to Git, or expose it in frontend bundles. Before exposing PostgreSQL to any external network, verify its access restrictions. Prefer loopback or a private network when possible.

Maintain `.env` files separately from version control. Do not overwrite an existing `.env` blindly during deployment.

## 4. Mandatory Deployment Workflow

The required deployment workflow is:

1. Implement and test changes locally.
2. Run the relevant formatting, linting, type-checking, build, and test commands.
3. Inspect `git status` and review the intended changes.
4. Add the intended files, commit, and push to `https://github.com/ngoclaithe/cashflow`.
5. SSH into `root@160.191.89.94`.
6. Inspect the existing VPS configuration and running services.
7. Change to `/home`.
8. Clone the repository to `/home/cashflow` if necessary, or pull the intended branch if it already exists.
9. Install dependencies using the repository's package manager and lockfile.
10. Build the frontend and backend.
11. Apply database migrations only after reviewing their impact and confirming the target database.
12. Configure or update the PM2 processes without disrupting unrelated applications.
13. Configure Nginx for the two specified domains.
14. Validate the deployment and report its results.

Do not claim that deployment succeeded unless the commands and health checks confirm success.

### 4.1 Inspect the VPS before changing anything

The VPS already hosts other applications managed by PM2. Port conflicts are a critical operational risk.

Before starting or restarting Cashflow, inspect:

- Running PM2 applications, IDs, names, scripts, working directories, and restart behavior.
- PM2 ecosystem configuration files, if any.
- Processes listening on TCP ports.
- Existing Nginx sites and upstream definitions.
- Existing Node.js and package-manager versions.
- PostgreSQL service status and the actual database connection configuration.
- Existing Cashflow-related processes or files.
- Current application logs and health endpoints, if available.

Useful commands include:

```bash
pm2 list
pm2 jlist
pm2 describe <process-name-or-id>
ss -ltnp
ps aux
nginx -t
nginx -T
systemctl status nginx
systemctl status postgresql
node --version
npm --version
git -C /home/cashflow status
```

These are diagnostic examples. Adapt commands to the actual VPS state.

Do not assume any specific port is free. Select frontend and backend ports only after checking existing listeners and PM2 configurations.

### 4.2 PM2 management rules

- Reuse the existing PM2 installation.
- Give the frontend and backend distinct, recognizable process names.
- Configure the correct working directories.
- Use explicit environment configuration.
- Restart only the affected Cashflow processes.
- Do not run `pm2 delete all`, `pm2 kill`, or broad restart commands.
- Do not overwrite the global PM2 ecosystem configuration.
- Do not change another application's ports to make room for Cashflow.
- Verify that the processes survive an application restart.
- Persist the PM2 process list only after confirming that doing so will not disrupt existing applications.

Prefer an application-specific ecosystem configuration file inside the repository if appropriate.

### 4.3 Nginx rules

Configure the frontend domain:

`cashflow.dosutech.site`

Configure the backend domain:

`api-cashflow.dosutech.site`

Requirements:

- Frontend requests must reach the React/Vite production build, served by the configured static server or an existing appropriate Nginx pattern.
- API requests must be reverse-proxied to the backend's verified local listening port.
- Configure SPA fallback routing where needed.
- Configure the correct API CORS origin.
- Preserve existing Nginx virtual hosts.
- Test the Nginx configuration before reloading it.
- Reload Nginx gracefully only after validation.
- Check HTTPS certificates and renewal configuration rather than assuming they exist.
- Do not expose internal application ports publicly unless explicitly required.

Follow existing VPS conventions when they are safe and applicable.

### 4.4 Deployment verification

After deployment, verify:

- Frontend domain responds successfully over HTTPS.
- Backend domain responds successfully over HTTPS.
- The backend health endpoint returns the expected result.
- Frontend API requests work without CORS errors.
- PM2 reports both Cashflow processes as online.
- No port conflicts were introduced.
- Nginx configuration tests pass.
- Database connectivity works.
- Prisma migrations are at the expected version.
- Existing unrelated PM2 processes remain operational.
- Application logs contain no new startup or configuration errors.

Report the deployed commit hash, actual listening ports, PM2 process names, health-check results, and any unresolved issues. Never include secrets in the report.

## 5. Environment Configuration

Keep local and VPS environment files outside Git.

Create or maintain `.env.example` with placeholder values only.

Expected backend variables may include:

```dotenv
NODE_ENV=development
PORT=<verified-backend-port>
DATABASE_URL=<postgresql-connection-string>
GEMINI_API_KEY=
GEMINI_MODEL=gemini-flash-latest
```

Use only variables required by the implemented application. Add bank-provider credentials when the integration is implemented.

The frontend may use Vite variables such as:

```dotenv
VITE_API_BASE_URL=<backend-api-origin>
```

Anything prefixed with `VITE_` is potentially exposed in the browser bundle. Never put database credentials, bank secrets, Telegram bot tokens, or private API keys in frontend variables.

Do not hard-code environment-specific ports, credentials, or production URLs into business logic.

## 6. Financial Data and Personal Context

All personal financial values belong to the user's individual planning context. They are not universal defaults for Cashflow.

If personal financial data is supplied, treat it as user-owned, editable data that can be stored in the database.

Do not hard-code:
- Salary amounts.
- Rent amounts.
- Living expenses.
- Gym expenses.
- Driving-license budgets.
- Certification budgets.
- Gifts.
- Bonuses.
- Savings targets.
- Payment dates or financial planning assumptions.

Represent such values as database records or user-configurable settings.

Initial setup may optionally seed user-specific data, but:
- Seed data must be clearly separated from application logic.
- Do not reinsert or overwrite personal settings on every deployment.
- Do not replace actual transaction history with example transactions.
- Do not treat projected income as money already received.
- Do not assume that planned expenses have already occurred.
- Do not assume that a bonus or future salary is guaranteed.
- Do not present a forecast as a verified bank balance.

The application must remain useful if all personal budget values are changed or removed.

## 7. Bank Integration

The primary objective is automatic transaction synchronization.

### SePay

Use SePay's documented API and webhook capabilities where supported.

Verify actual support for the connected MB Bank account, especially:
- Incoming transactions.
- Outgoing transactions.
- Historical transaction queries.
- Stable transaction identifiers.
- Pagination and synchronization windows.
- Webhook verification and retry behavior.
- API rate limits and costs.

Do not assume that receiving incoming-transfer webhooks means the application can observe every outgoing expense.

### MB Bank alternative

An unofficial MB Bank web API may be investigated as a separate adapter if SePay does not provide complete transaction data.

Before implementing it:
- Verify the interface and actual response format.
- Evaluate the security and terms-of-use implications.
- Verify whether it can return outgoing transactions and historical data.
- Document authentication, expiration, and operational failure modes.
- Never bypass MFA, CAPTCHA, or access controls.
- Never store passwords, OTPs, or reusable session cookies in plaintext.
- Do not fabricate API endpoints or report unverified integration success.

If an approved and safe integration cannot be established, explain the limitation and keep the adapter isolated.

### Synchronization requirements

- Webhook ingestion where available.
- Scheduled reconciliation, initially configurable for 23:30 in `Asia/Ho_Chi_Minh`.
- Overlapping sync windows to accommodate delayed transactions.
- Persistent checkpoints when supported.
- Sync history and retry handling.
- Clear visibility into incomplete synchronization.

## 8. Transaction Integrity

Use PostgreSQL as the source of truth.

- Store money using PostgreSQL `NUMERIC` and an appropriate Prisma decimal representation.
- Never use JavaScript floating-point arithmetic as the authoritative monetary calculation.
- Use database unique constraints for stable provider transaction identifiers.
- Make webhook processing idempotent.
- Handle concurrent webhook and reconciliation requests safely.
- Do not deduplicate only by amount and date.
- Preserve user-assigned category overrides.
- Distinguish income, expenses, transfers, refunds, and reversals.
- Do not count transfers between the user's own accounts as expenses when they can be identified reliably.
- Preserve enough source metadata for reconciliation without unnecessarily storing sensitive information.

Use UTC internally where appropriate and display timestamps in `Asia/Ho_Chi_Minh`.

## 9. Application Modules

Implement a modular NestJS application. Adapt the structure to the existing repository.

Suggested modules:

```text
auth/
users/
accounts/
transactions/
bank-integrations/
  sepay/
  mbbank/
  synchronization/
categories/
categorization-rules/
budgets/
recurring-transactions/
savings-goals/
dashboard/
notifications/
reconciliation/
audit-logs/
```

Implement only the modules required by the actual scope. Avoid creating empty modules simply to match this list.

### Core frontend screens

- Dashboard: income, expenses, net cash flow, spending breakdown, budget progress, savings progress, synchronization status.
- Transactions: search, date filters, categories, direction, pagination, manual classification corrections.
- Budgets: create and edit configurable limits.
- Savings goals: targets, dates, actual progress, and clearly labeled forecasts.
- Integrations: provider status, supported capabilities, sync history, failures, and retry controls.
- Settings: categories, budget defaults, timezone, notifications, and export.

All financial calculations must be performed by backend business logic and tested centrally.

## 10. Database and Migrations

Use Prisma migrations.

Before any production migration:
1. Inspect the current schema and migration history.
2. Confirm the target database connection.
3. Determine whether the migration is destructive or potentially locks large tables.
4. Preserve existing production data.
5. Apply the migration using the repository's established procedure.
6. Verify the resulting schema and application health.

Never reset, drop, or recreate the production database as a deployment shortcut.

Do not run `prisma db push` against production as a replacement for reviewed migrations.

Do not seed demo transactions into production.

## 11. Development Workflow

Before editing code:

1. Inspect the repository structure and Git status.
2. Read the existing README and package manifests.
3. Check the package manager and lockfile.
4. Identify the actual frontend and backend entry points.
5. Inspect existing API routes, Prisma schema, and environment configuration.
6. Identify existing deployment conventions where available.
7. Prepare a phased implementation plan.

When implementing:
- Use strict TypeScript.
- Validate incoming DTOs.
- Keep controllers thin.
- Use NestJS dependency injection.
- Keep business logic out of UI components.
- Add tests for financial calculations and transaction integrity.
- Avoid unnecessary dependencies.
- Do not overwrite existing work blindly.
- Do not fabricate bank data or integration capabilities.
- Do not commit `.env`, secrets, or personal authentication data.

## 12. Git and Release Procedure

Use the following release workflow for changes intended for deployment:

1. Implement changes locally.
2. Run relevant tests, type checks, linting, and production builds.
3. Review `git diff` and `git status`.
4. Stage only the intended files.
5. Commit with a descriptive message.
6. Push to `https://github.com/ngoclaithe/cashflow`.
7. SSH into `root@160.191.89.94`.
8. Inspect PM2, listening ports, Nginx, environment files, and repository status.
9. Pull the intended commit into `/home/cashflow`.
10. Install dependencies using the existing lockfile.
11. Build the applications.
12. Apply reviewed Prisma migrations if necessary.
13. Restart only the relevant Cashflow PM2 processes.
14. Validate both domains, API health, database connectivity, and logs.

Before pulling or switching branches, check for uncommitted server-side changes. Do not destroy unexpected changes without investigation.

Never deploy uncommitted local changes or claim that a push or deployment succeeded without verifying the command result.

## 13. Definition of Done

A task is complete only when:
- The implementation matches the existing repository and fixed stack.
- Relevant tests and type checks pass.
- Database changes are reviewed and safe.
- Financial values are configurable, not hard-coded.
- Synchronization behavior is idempotent.
- Environment-specific configuration stays outside source code.
- The deployment process does not disrupt unrelated applications.
- Any required Git changes are committed and pushed.
- If deployment is requested, the VPS deployment is verified.
- Remaining limitations and unverified integrations are documented.

## 14. First Instructions to the AI Agent

Start by inspecting the current repository and reporting:
1. Current branch and Git status.
2. Existing frontend and backend structure.
3. Existing Prisma schema and migration state.
4. Existing environment-variable names without revealing their values.
5. Existing build and test commands.
6. Existing deployment-related files.
7. Missing requirements and concrete implementation steps.

Do not generate a new project from scratch if a working application already exists.

Do not introduce Docker.

Do not hard-code the user's personal budget values.

When deployment is required, inspect the real VPS ports and PM2 processes before making changes. Preserve all unrelated applications.

Proceed incrementally, test each phase, and report actual results rather than assumptions.
