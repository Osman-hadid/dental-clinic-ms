# Sourire Dental Clinic Management System

Sourire is a dental clinic management system for handling patients, appointments, clinical records, treatments, invoices, payments, staff, inventory, reports, user accounts, roles, and permissions from one workspace.

**Live application:** [dental-clinic-ms-production.up.railway.app](https://dental-clinic-ms-production.up.railway.app)

## Contents

- [Features](#features)
- [Architecture and technology](#architecture-and-technology)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Local setup](#local-setup)
- [Database and seed data](#database-and-seed-data)
- [Development commands](#development-commands)
- [Production deployment](#production-deployment)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

- Patient, staff, appointment, visit, treatment, tooth, invoice, and payment management.
- Clinic profile, inventory, backups, and operational reporting.
- User, role, permission, and module administration.
- English, Dari, and Pashto locales with right-to-left support where appropriate.
- Session-based authentication backed by Laravel Sanctum and Fortify.
- Optional AI integrations for supported workflows; these require separately configured provider credentials.

## Architecture and technology

The application is split into two main parts:

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, and `next-intl`. Next.js exports static files for production.
- **Backend:** Laravel 12 on PHP 8.2+, with PostgreSQL, Sanctum, Fortify, and Spatie permissions/activity logging.

In production, the generated frontend files are served by Laravel from `backend/public`, while Laravel provides the API under `/api`. The Railway service uses the Dockerfile in `backend/` and connects to PostgreSQL.

## Repository layout

```text
.
├── backend/       Laravel application, API, migrations, seeders, and Dockerfile
├── frontend/      Next.js application and static-export scripts
├── datasets/      Project datasets and supporting files
└── third_party/   Third-party projects and model resources
```

## Requirements

- PHP 8.2 or newer with the extensions required by Laravel, including PDO PostgreSQL and ZIP.
- Composer 2.
- Node.js 20 or newer and npm.
- PostgreSQL for a local database.

## Local setup

Run commands from the repository root unless a command says otherwise.

1. Install the root and frontend JavaScript dependencies:

   ```bash
   npm install
   cd frontend
   npm install
   cd ..
   ```

2. Install PHP dependencies and create the backend environment file:

   ```bash
   cd backend
   composer install
   cp .env.example .env
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp` if needed.

3. Edit `backend/.env` and configure the local database connection (`DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD`). Set `APP_URL` to `http://localhost:8000` and `FRONTEND_URL` to `http://localhost:3000` for local development.

4. Configure the two user-seeder passwords in `backend/.env` before seeding:

   ```dotenv
   SOURIRE_ADMIN_PASSWORD=use-a-strong-local-password
   SOURIRE_SUPERADMIN_PASSWORD=use-another-strong-local-password
   SOURIRE_SEED_DEMO_DATA=false
   ```

   Keep these values private and use unique passwords. Do not commit `.env` files or real credentials.

5. Generate the application key, run migrations and seed the base roles/users, then install Laravel's frontend dependencies:

   ```bash
   php artisan key:generate
   php artisan migrate --seed
   npm install
   cd ..
   ```

   The migration and seeding commands above run inside `backend/`.

6. Start Laravel and Next.js together from the repository root:

   ```bash
   npm run dev
   ```

   The Laravel API is available at `http://localhost:8000`; the Next.js development UI is available at `http://localhost:3000`.

## Database and seed data

`DatabaseSeeder` creates the system modules, permissions, roles, role-permission assignments, and the configured Super Admin and Admin accounts. User passwords are read from `SOURIRE_SUPERADMIN_PASSWORD` and `SOURIRE_ADMIN_PASSWORD` when a user is first created. Set these values before running the seeder.

Demo data is disabled by default. To seed demo records in a disposable local or test database only, explicitly set:

```dotenv
SOURIRE_SEED_DEMO_DATA=true
SOURIRE_ENABLE_DEMO_DATA=true
SOURIRE_DEMO_USER_PASSWORD=use-a-strong-demo-password
```

Then run `php artisan db:seed` from `backend/`. Do not enable demo data in production. To apply schema changes without seeding, run `php artisan migrate`.

## Development commands

| Purpose | Command | Directory |
| --- | --- | --- |
| Run Laravel and Next.js together | `npm run dev` | Repository root |
| Start Laravel only | `php artisan serve` | `backend/` |
| Start Next.js only | `npm run dev` | `frontend/` |
| Build the frontend | `npm run build` | `frontend/` |
| Build and sync static files into Laravel | `npm run build:laravel` | `frontend/` |
| Run frontend lint | `npm run lint` | `frontend/` |
| Run backend tests | `php artisan test` | `backend/` |

The static sync command replaces generated files in `backend/public` while preserving Laravel's `.htaccess`, `index.php`, and `storage` entries. Review the resulting changes before committing a frontend release.

## Production deployment

The production application is deployed to Railway. The backend service builds from the `backend/` directory with its Dockerfile, and the PostgreSQL service supplies the database.

Before deploying frontend changes, build and sync the static export:

```bash
cd frontend
npm install
npm run build:laravel
```

Commit the updated files in `backend/public` along with the frontend source changes, then push to the connected GitHub branch. Railway applies database migrations with:

```bash
php artisan migrate --force
```

Configure production secrets and environment values in Railway Variables. At minimum, configure the database connection, `APP_KEY`, `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL`, and the administrator passwords used by the user seeders. Never put production secrets in source control. Run the user seeders intentionally as a one-time operation after setting their passwords; routine deployments should run migrations only.

## Security notes

- Never commit `.env`, API keys, database credentials, or real account passwords.
- Use strong, unique passwords for administrator and demo accounts.
- Keep `APP_DEBUG=false` in production.
- Keep demo seeding disabled in production.
- Report security concerns through a private channel to the repository maintainers rather than posting credentials or exploit details publicly.

## Troubleshooting

- **Database connection errors:** Check PostgreSQL is running and verify the `DB_*` values in `backend/.env`.
- **Login CSRF or session errors:** Confirm `APP_URL`, `FRONTEND_URL`, `SESSION_DRIVER`, cookie settings, and the Sanctum stateful domains match the browser origin. For HTTPS production, enable secure cookies and configure the allowed origins in Railway Variables.
- **Frontend changes do not appear in production:** Run `npm run build:laravel` from `frontend/`, commit the generated `backend/public` changes, and wait for the Railway deployment to complete.
- **Seeder cannot create an administrator:** Set the matching administrator password environment variable before running `php artisan db:seed`.

## Contributing

Use a focused branch for each change, keep secrets and generated local configuration out of commits, and include a clear summary of behavior changes. Run the relevant frontend lint/build or backend tests before opening a pull request.

## License

No project-level license is currently specified. Check with the maintainers before redistributing or reusing this project.
