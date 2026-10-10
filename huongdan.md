# AGENT_CONTEXT.md — Personal Finance Tracker

## 1. Project Overview

Build a personal finance management application that automatically synchronizes bank transactions from MB Bank and tracks income, expenses, budgets, recurring payments, and savings goals.

The primary objective is to eliminate manual transaction entry.

The application is for personal use initially. Keep the architecture simple, maintainable, secure, and easy to deploy. Do not introduce unnecessary microservices or infrastructure.

### Core requirements

1. Automatically ingest transactions through SePay where supported.
2. Reconcile bank transactions at the end of each day.
3. Investigate an alternative MB Bank web API integration if SePay cannot provide complete transaction history, especially outgoing transactions.
4. Deduplicate transactions reliably.
5. Categorize income and expenses using configurable rules.
6. Track monthly budgets and savings goals.
7. Display financial summaries in a React dashboard.
8. Send notifications through Telegram when configured.
9. Keep a reliable audit trail of synchronization and reconciliation.

## 2. Technology Stack — Fixed Decisions

Use the following stack. Do not replace it without explicit authorization.

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL |
| ORM and migrations | Prisma |
| API | REST, JSON |
| Scheduled jobs | `@nestjs/schedule` |
| Bank integration | SePay API + Webhook |
| Notifications | Telegram Bot API |
| Deployment | Docker Compose + Nginx + HTTPS |
| Testing | Jest or the existing project test framework |
| Package manager | Follow the existing repository lockfile |

### Explicitly prohibited without approval

- Go, Python, or another backend language.
- Microservice architecture.
- Kubernetes.
- Unnecessary message brokers.
- An additional analytics database.
- Manual transaction entry as the primary workflow.
- Replacing React + Vite with Next.js or Nuxt.
- Storing bank credentials, OTPs, or reusable authentication cookies in plaintext.
- Implementing unofficial bank integration through unauthorized access or bypassing bank security controls.

Use a modular monolith in NestJS. PostgreSQL is the single source of truth for application data.

## 3. Financial Context and Initial Budget

All monetary amounts are in Vietnamese đồng (VND).

The following values describe the initial planning scenario, not hard-coded application constants. They must be editable in the application.

| Item | Initial value |
|---|---:|
| Current available cash | 18,000,000 |
| Expected monthly net salary | 20,300,000 |
| Salary payment date | Day 10 |
| Monthly rent | 7,000,000 |
| Rent due date | Before day 5 |
| Monthly living expense target, excluding rent and gym | 3,560,000 |
| Monthly gym budget | 500,000 |
| Driving license budget | 20,000,000 |
| AWS DEA-C01 budget | 4,000,000 |
| Gift budget | Up to 500,000 |
| Expected Tet bonus | 20,300,000 |
| Savings target | 60,000,000 |
| Target date | 2027-03-10 |

Planning assumptions:
- The October 2026 rent has already been paid.
- Employment is expected to continue through February 2027.
- Salary is expected on the 10th of each month, with the final relevant salary paid on 2027-03-10.
- The expected bonus is uncertain and must not be treated as guaranteed income.
- The savings target depends on actual transactions and confirmed income.

The system must never assume that planned income has arrived. Forecasts and actual balances must be displayed separately.

### Budgeting behavior

- Reserve money for rent before allocating discretionary spending.
- Track rent obligations independently from ordinary living expenses.
- Track planned one-time expenses separately from monthly recurring expenses.
- Display the remaining amount for each budget.
- Display actual savings and projected savings separately.
- Warn when spending is approaching a limit.
- Warn when available funds may be insufficient for an upcoming rent payment.
- Support revisions to budget amounts and target dates without code changes.

Suggested default alert thresholds: 70%, 90%, and 100% of a budget.

Do not count transfers between the user's own accounts as income or expenses when both accounts are linked and the transfer can be identified reliably.

## 4. Architecture

Use a modular NestJS application.

```text
personal-finance-tracker/
├── apps/
│   ├── api/                    # NestJS backend
│   └── web/                    # React + Vite frontend
├── docker-compose.yml
├── .env.example
├── README.md
└── AGENT_CONTEXT.md
```

Adapt this structure to the existing repository if it already has a valid structure. Do not create a duplicate application unnecessarily.

### Backend modules

```text
src/
├── auth/
├── users/
├── accounts/
├── transactions/
├── bank-integrations/
│   ├── sepay/
│   ├── mbbank/
│   └── synchronization/
├── categories/
├── categorization-rules/
├── budgets/
├── recurring-transactions/
├── savings-goals/
├── dashboard/
├── notifications/
├── reconciliation/
├── audit-logs/
├── scheduler/
├── prisma/
├── common/
└── main.ts
```

Responsibilities:

- `accounts`: connected bank accounts and their metadata.
- `transactions`: normalized transaction storage and query operations.
- `bank-integrations`: provider-specific integration adapters.
- `synchronization`: orchestration of incremental and historical imports.
- `categories`: expense and income categories.
- `categorization-rules`: configurable matching rules.
- `budgets`: budget limits, periods, and calculations.
- `recurring-transactions`: recurring obligations and expected payment dates.
- `savings-goals`: target amounts and progress.
- `dashboard`: aggregated data for the frontend.
- `notifications`: Telegram integration and notification preferences.
- `reconciliation`: comparison between provider data and stored transactions.
- `audit-logs`: synchronization history and security-relevant events.
- `scheduler`: scheduled reconciliation and maintenance tasks.

Do not place all business logic in controllers or scheduler methods. Controllers validate and delegate. Services own business logic. Database access should be encapsulated in appropriate services or repositories.

## 5. Bank Integration Strategy

### 5.1 SePay as the primary integration

Implement a SePay adapter using documented APIs and webhook capabilities.

Important: verify the actual capabilities of the connected MBBank account before relying on SePay for complete expense tracking.

Specifically verify:
- Whether the account can be connected successfully.
- Whether incoming transactions are supported.
- Whether outgoing transactions are supported.
- Whether historical transaction queries are available.
- Transaction identifiers and pagination behavior.
- API authentication requirements.
- Webhook authentication and event retry behavior.
- API limits and subscription costs.

Do not assume that webhook support for incoming transactions means outgoing transactions are also available.

If SePay cannot provide outgoing transactions, document the limitation and implement a provider-neutral reconciliation interface so another approved source can be added.

### 5.2 Provider adapter interface

Define an interface conceptually similar to:

```typescript
interface BankProvider {
  verifyWebhook(
    request: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<boolean>;

  parseWebhook(payload: unknown): Promise<NormalizedBankTransaction[]>;

  fetchTransactions(
    options: TransactionSyncOptions,
  ): Promise<BankSyncPage>;

  getCapabilities(): Promise<BankProviderCapabilities>;
}
```

This is a conceptual contract. Adapt it to the actual provider API and NestJS conventions.

Define normalized types for transactions, pagination, provider capabilities, and synchronization results.

Do not invent provider endpoints, authentication headers, payload formats, or transaction identifiers. Read the official documentation and verify actual response formats before implementing the adapter.

### 5.3 Unofficial MB Bank API

An unofficial MB Bank web API is a possible future integration, not a guaranteed source.

Before implementation:
1. Investigate whether a documented or authorized transaction-history interface is available.
2. Evaluate its terms of use and security implications.
3. Verify whether it returns outgoing transactions and stable transaction IDs.
4. Assess session expiration, authentication requirements, and failure modes.
5. Record the result and propose a safe implementation.

Never bypass MFA, CAPTCHA, access controls, or other bank security mechanisms.

Do not store bank passwords, OTPs, or reusable session cookies in plaintext. Do not log credentials or sensitive authentication data.

If secure and authorized integration cannot be established, keep the adapter unimplemented and report the limitation. Do not silently substitute scraping or claim that integration is complete.

### 5.4 Daily reconciliation

Implement a scheduled reconciliation job, initially configurable to run at 23:30 in `Asia/Ho_Chi_Minh`.

The job should:
1. Determine the relevant synchronization window.
2. Fetch transactions from each enabled provider.
3. Normalize the results.
4. Validate amounts, dates, direction, and provider identifiers.
5. Insert missing transactions.
6. Update provider metadata when appropriate.
7. Avoid overwriting user-defined category assignments without an explicit rule.
8. Record synchronization checkpoints and errors.
9. Detect incomplete coverage and notify the user.
10. Record reconciliation results for later inspection.

Do not assume that all transactions from a day are available immediately at 23:30. Support a configurable overlap window to account for delayed bank updates.

Use a stored synchronization cursor or checkpoint where supported. Otherwise use an overlapping time window and reliable deduplication.

A reconciliation failure must not corrupt previously imported data.

## 6. Transaction Data Model

Design the Prisma schema based on the actual provider capabilities and the following conceptual entities.

### User

- `id`
- `email` or username
- `passwordHash` if password authentication is used
- `createdAt`
- `updatedAt`

Even for a single-user deployment, associate private financial data with a user or an explicit owner context.

### Account

- `id`
- `userId`
- `provider`
- `externalAccountId`, if available
- `displayName`
- `currency`
- `isActive`
- `createdAt`
- `updatedAt`

Do not store complete bank credentials in this entity.

### Transaction

- `id`
- `accountId`
- `provider`
- `externalTransactionId`, nullable only when the provider truly does not provide one
- `transactionFingerprint`, where needed
- `transactionDate`
- `bookedAt`, optional
- `amount`, stored using PostgreSQL `NUMERIC`, not floating-point arithmetic
- `currency`
- `direction`: `INCOME`, `EXPENSE`, or `TRANSFER`
- `description`
- `counterparty`, optional
- `categoryId`, optional
- `userCategoryOverride`, or equivalent explicit override mechanism
- `sourcePayload`, sanitized JSON where appropriate
- `createdAt`
- `updatedAt`

Choose the sign convention consistently. A simple option is to store a positive absolute amount and represent direction in a separate field. Document the choice and apply it everywhere.

Use UTC timestamps internally and display them in `Asia/Ho_Chi_Minh`. Preserve the original bank transaction date and timezone semantics when necessary.

### Category

- `id`
- `userId`
- `name`
- `type`: income, expense, or transfer
- `parentId`, optional
- `isSystem`
- `createdAt`
- `updatedAt`

### CategorizationRule

- `id`
- `userId`
- `name`
- `priority`
- `field`
- `operator`
- `value`
- `categoryId`
- `isActive`
- `createdAt`
- `updatedAt`

Use an explicit allowlist of supported fields and operators. Never evaluate arbitrary user-provided JavaScript, SQL, or executable expressions.

### Budget

- `id`
- `userId`
- `categoryId`, optional for an overall budget
- `name`
- `amount`
- `period`
- `startDate`
- `endDate`, optional
- `isActive`
- `createdAt`
- `updatedAt`

### SavingsGoal

- `id`
- `userId`
- `name`
- `targetAmount`
- `targetDate`
- `createdAt`
- `updatedAt`

### SyncRun

- `id`
- `provider`
- `accountId`
- `startedAt`
- `finishedAt`, optional
- `status`
- `transactionsFetched`
- `transactionsInserted`
- `transactionsUpdated`
- `transactionsSkipped`
- `errorSummary`, sanitized
- `checkpoint`, if applicable

Add any other entities only when required by a real use case.

### Database constraints

- Unique constraints for stable provider transaction identifiers within the correct provider/account scope.
- Foreign keys for ownership and related entities.
- Indexes on transaction date, account, category, direction, and common dashboard query combinations.
- Appropriate decimal precision for monetary values.
- Transactions and their related synchronization metadata should be updated atomically when required.

If a provider does not expose stable transaction IDs, design a conservative fallback fingerprint. Do not deduplicate exclusively by amount and date because legitimate transactions may share those values.

## 7. Idempotency and Data Integrity

This is a critical requirement.

A bank transaction can arrive multiple times through:
- Webhook retries.
- Scheduled synchronization.
- Manual reconciliation.
- Historical imports.
- Overlapping synchronization windows.

Implement deduplication at the database level, not only with an application-level existence check.

Expected behavior:
- Reprocessing an existing transaction must not create another row.
- Concurrent webhook and scheduled-sync requests must remain safe.
- A retry after a partial failure must be recoverable.
- Existing user category overrides must not be overwritten by automatic classification.
- Failed sync runs must be visible and retryable.
- A transaction that cannot be identified confidently must be flagged for review rather than silently discarded.

Use PostgreSQL transactions and suitable unique constraints or conflict-handling operations.

## 8. Transaction Categorization

Implement deterministic rule-based categorization first. Do not require an LLM.

Examples of configurable categories:
- Housing and rent.
- Food and groceries.
- Transportation.
- Gym and fitness.
- Education and AWS certification.
- Gifts.
- Salary.
- Bonus.
- Bank fees.
- Internal transfers.
- Other income.
- Other expenses.

A rule may match:
- Description contains a keyword.
- Counterparty equals a known value.
- Description matches a validated pattern.
- Account or transaction direction meets a condition.

Rules must have explicit priorities and deterministic execution order.

Expected classification flow:
1. Normalize the transaction description.
2. Detect probable internal transfers.
3. Apply matching categorization rules in priority order.
4. Preserve manual category overrides.
5. Assign a default category if no rule matches.
6. Record enough information to explain the classification.

Never classify a transaction as a transfer solely because its description contains a generic word such as "transfer". Use reliable account/counterparty evidence where possible.

Provide a UI for reviewing and correcting categories.

## 9. Budget and Financial Calculations

Implement calculations in backend services. The frontend should not independently reproduce financial business logic.

Required metrics:
- Total income for a selected period.
- Total expenses for a selected period.
- Net cash flow.
- Spending by category.
- Monthly budget used and remaining.
- Actual savings based on recorded financial data.
- Upcoming recurring obligations.
- Projected balance and savings, based on clearly stated assumptions.
- Last successful bank synchronization.
- Transactions awaiting categorization or review.

### Important distinctions

**Actual balance**: use a verified bank balance if the provider supplies it reliably, or calculate from a trustworthy opening balance and complete transaction history.

**Available cash**: a user-defined or verified value representing current available funds. Do not pretend it is a verified bank balance.

**Actual savings**: a defined calculation based on recorded income, expenses, and opening balance. Explain the calculation.

**Projected savings**: a forecast that may include future salaries, expected bonuses, and planned expenses. Label assumptions clearly.

**Budget remaining**: budget limit minus qualifying expenses during that budget period. Define treatment of refunds and reversals.

Do not mix transfers, pending transactions, and posted transactions without explicit rules.

## 10. Frontend Requirements

Build a responsive personal finance dashboard using React, TypeScript, and Vite.

Use the existing UI library if one is already configured. Otherwise choose a small, maintainable component system.

### Main screens

#### Dashboard

Display:
- Current available cash or verified bank balance, with its source clearly labeled.
- Income and expenses for the current month.
- Net cash flow.
- Spending by category.
- Budget progress.
- Upcoming rent and recurring payments.
- Savings goal progress.
- Latest transactions.
- Last synchronization status.

#### Transactions

Provide:
- Paginated transaction list.
- Date range filters.
- Account, category, and direction filters.
- Text search.
- Category editing.
- Transfer review.
- Transaction details and source metadata.
- Indicators for unclassified or uncertain transactions.

#### Budgets

Provide:
- Monthly and custom-period budgets.
- Used and remaining amounts.
- Progress indicators.
- Alerts and historical comparisons.

#### Savings Goals

Provide:
- Target amount.
- Target date.
- Actual progress.
- Projected progress where sufficient data exists.

#### Integrations

Provide:
- Provider connection status.
- Enabled capabilities.
- Last successful synchronization.
- Last reconciliation result.
- Failed runs and retry controls.
- Clear disclosure when outgoing transactions or historical data are unavailable.

#### Settings

Provide:
- Currency and timezone.
- Budget defaults.
- Categorization rules.
- Telegram notification settings.
- Synchronization schedule.
- Data export.

### UX principles

- Make financial figures readable and consistent.
- Use VND formatting.
- Default to `Asia/Ho_Chi_Minh`.
- Clearly distinguish actual values from forecasts.
- Do not show fake bank connection statuses or fabricated transaction data.
- Include loading, empty, error, and retry states.
- Avoid unnecessary animations and complex visual effects.

## 11. REST API Design

Follow the conventions of the existing project. Suggested endpoints:

```text
GET    /api/health

GET    /api/accounts
GET    /api/accounts/:id

GET    /api/transactions
GET    /api/transactions/:id
PATCH  /api/transactions/:id
POST   /api/transactions/:id/reclassify

GET    /api/categories
POST   /api/categories
PATCH  /api/categories/:id

GET    /api/categorization-rules
POST   /api/categorization-rules
PATCH  /api/categorization-rules/:id
DELETE /api/categorization-rules/:id

GET    /api/budgets
POST   /api/budgets
PATCH  /api/budgets/:id
DELETE /api/budgets/:id

GET    /api/savings-goals
POST   /api/savings-goals
PATCH  /api/savings-goals/:id

GET    /api/dashboard/summary
GET    /api/dashboard/cash-flow
GET    /api/dashboard/category-breakdown

POST   /api/integrations/sepay/webhook
GET    /api/integrations/status
POST   /api/integrations/sync
GET    /api/integrations/sync-runs
POST   /api/integrations/sync-runs/:id/retry

POST   /api/integrations/telegram/test
GET    /api/reconciliation/status
POST   /api/reconciliation/run
```

These are proposed routes, not evidence that provider endpoints exist.

Requirements:
- Validate request DTOs.
- Return consistent HTTP status codes and error formats.
- Use pagination for transaction queries.
- Validate all user-provided IDs and filter parameters.
- Protect private endpoints with authentication.
- Protect webhooks using the provider's documented verification mechanism.
- Do not expose secrets or raw sensitive provider payloads in API responses.
- Enforce ownership checks for every private resource.

## 12. Security

This application processes sensitive personal financial data.

Implement:
- Authentication appropriate for a private personal application.
- Secure password hashing if passwords are used.
- HTTP-only, secure cookies or another appropriately protected session/token design.
- CSRF protection when applicable to the chosen authentication method.
- Rate limiting on authentication and sensitive endpoints.
- Strict input validation.
- Parameterized database access through Prisma.
- HTTPS in deployment.
- Restricted CORS origins.
- Secure secret management through environment variables.
- Redaction of secrets and sensitive information from logs.
- Webhook signature or token verification according to official provider documentation.
- Authorization checks for all private resources.
- Database backups and a documented restore procedure.

Do not assume a public webhook URL is secure simply because it is difficult to guess.

Never commit `.env`, bank credentials, Telegram bot tokens, production database credentials, or session cookies.

Use `.env.example` containing placeholder values only.

## 13. Telegram Notifications

Make Telegram optional and configurable.

Suggested notifications:
- Budget reached 70%, 90%, or 100%.
- Upcoming rent obligation.
- Insufficient funds for a known upcoming payment.
- Failed synchronization.
- Missing or incomplete transaction history.
- Daily spending summary.
- Daily reconciliation completed.

Prevent notification spam. Store enough state to avoid repeatedly sending the same threshold notification for the same budget period.

Do not send sensitive full transaction descriptions or account details unless explicitly configured.

## 14. Testing Requirements

### Unit tests

Test:
- Transaction normalization.
- Transaction direction.
- Idempotency logic.
- Categorization priority.
- Manual category override.
- Internal transfer handling.
- Budget calculations.
- Refund and reversal treatment.
- Date and timezone boundaries.
- Savings and forecast calculations.

### Integration tests

Test:
- Webhook authentication.
- Duplicate webhook delivery.
- Concurrent insertion of the same transaction.
- Pagination across synchronization windows.
- Partial synchronization failures.
- Retry behavior.
- Reconciliation with overlapping windows.
- Database constraints and transaction rollback.
- Ownership and authorization checks.

### Frontend tests

Test critical flows:
- Transaction filtering.
- Category editing.
- Budget updates.
- Integration status and errors.
- Empty, loading, and failure states.

Use mocked provider responses in tests. Never use real bank credentials in automated tests.

## 15. Deployment and Operations

Use Docker Compose for the initial deployment.

Expected services:
- `web`: React production build served through Nginx or an equivalent static server.
- `api`: NestJS application.
- `postgres`: PostgreSQL database.
- Optional reverse proxy and HTTPS termination, depending on deployment environment.

Requirements:
- Persistent PostgreSQL volume.
- Health checks.
- Database migrations as a controlled deployment step.
- Restart policies.
- Log rotation or bounded logs.
- Backup and restore instructions.
- Separate development and production configuration.
- No production secrets in Docker images.

The application must not require Kubernetes or a distributed architecture.

## 16. Agent Workflow

Before writing code, follow this workflow.

### Phase 1 — Repository inspection

1. Inspect the current repository, package manifests, lockfiles, source files, tests, and Docker configuration.
2. Determine whether an application already exists.
3. Identify existing conventions and reusable components.
4. Check Node.js and package-manager versions.
5. Review existing environment variables and integrations without printing secret values.
6. Report the current state and implementation plan.

Do not delete or replace existing work without understanding its purpose.

### Phase 2 — Integration feasibility

1. Read current official SePay documentation.
2. Verify actual MBBank account support and transaction capabilities.
3. Determine whether outgoing transactions can be retrieved.
4. Document limitations and API costs.
5. Assess the safety and feasibility of any alternative MB Bank integration.
6. Implement only verified API contracts.

If credentials or account access are unavailable, create a mock adapter and clearly document what remains unverified. Never claim a live integration is operational without testing it.

### Phase 3 — Foundation

1. Configure the NestJS application.
2. Configure PostgreSQL and Prisma.
3. Create initial schema and migrations.
4. Implement authentication and ownership checks.
5. Implement transaction storage and deduplication.
6. Add automated tests.

### Phase 4 — Bank synchronization

1. Implement provider interfaces.
2. Implement the SePay adapter.
3. Implement webhook validation.
4. Implement transaction normalization.
5. Implement incremental synchronization.
6. Implement scheduled reconciliation.
7. Add synchronization history, retry handling, and monitoring.

### Phase 5 — Financial business logic

1. Implement categories and categorization rules.
2. Implement budgets.
3. Implement recurring obligations.
4. Implement savings goals.
5. Implement financial summaries.
6. Test all monetary calculations.

### Phase 6 — Frontend

1. Implement the dashboard.
2. Implement transaction search and filtering.
3. Implement category editing.
4. Implement budget management.
5. Implement savings goals.
6. Implement integration monitoring.
7. Connect screens to real backend APIs.

### Phase 7 — Delivery

1. Run formatting and linting.
2. Run type checking.
3. Run unit and integration tests.
4. Run database migrations against a clean development database.
5. Verify Docker Compose startup.
6. Verify frontend-to-backend communication.
7. Update README with setup, configuration, deployment, and troubleshooting.
8. Report completed work, tests, known limitations, and remaining tasks.

## 17. Implementation Rules

- Prefer small, reviewable changes.
- Keep TypeScript strict.
- Avoid `any` unless justified and isolated.
- Use dependency injection consistently with NestJS.
- Keep controllers thin.
- Avoid duplicated business logic.
- Avoid overengineering.
- Do not add libraries without a clear reason.
- Do not silently change the agreed stack.
- Do not hard-code personal financial values into business logic.
- Never fabricate bank transactions or live integration results.
- Do not suppress errors just to make tests pass.
- Preserve existing repository functionality.
- Document assumptions that affect financial correctness.
- Never use floating-point arithmetic for money.
- Never assume an API capability that has not been verified.
- Do not ask for production credentials in source code, chat logs, or committed files.

If a requirement cannot be completed because a provider API is unavailable, explain the limitation and implement the rest behind a clear interface.

## 18. Definition of Done

The initial usable version is complete when:

- [ ] React + TypeScript + Vite frontend runs.
- [ ] NestJS backend runs.
- [ ] PostgreSQL migrations work on a clean database.
- [ ] Authentication and ownership checks protect private data.
- [ ] Transactions can be ingested from a verified provider or deterministic mock adapter.
- [ ] Duplicate transactions are prevented by database constraints.
- [ ] Synchronization failures are visible and recoverable.
- [ ] Daily reconciliation works with a configurable timezone and schedule.
- [ ] Categorization rules work deterministically.
- [ ] Manual category overrides persist.
- [ ] Budgets and savings calculations have automated tests.
- [ ] Internal transfers are not incorrectly counted as spending.
- [ ] Dashboard values come from backend calculations.
- [ ] Integration capabilities and limitations are visible in the UI.
- [ ] Telegram notifications work when configured.
- [ ] Docker Compose starts the application.
- [ ] `.env.example` and setup documentation are complete.
- [ ] No real credentials or sensitive personal data are committed.
- [ ] All implemented features and known limitations are documented.

## 19. First Task for the Coding Agent

Start by inspecting the repository and reporting:

1. Existing project structure.
2. Current stack and versions.
3. What can be reused.
4. What is missing.
5. SePay/MB Bank integration assumptions requiring verification.
6. A phased implementation plan with concrete files and tests.

After inspection, proceed with implementation in small phases. Do not generate the entire application as one unreviewed code dump.

The most important priorities are financial data integrity, reliable transaction synchronization, correct budget calculations, and a maintainable architecture.
