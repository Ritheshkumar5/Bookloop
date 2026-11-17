# BookLoop Deployment Guide

This repository contains a **Vite + React** frontend and a **Django REST Framework** backend. Deploy them as separate services: Vercel hosts the frontend and Render hosts Django and PostgreSQL. The frontend is not a Next.js app, so use Vercel's Vite settings; `NEXT_PUBLIC_API_URL` is explicitly exposed to Vite for the requested API configuration.

## Before you start

- Push this repository to a Git provider supported by Render and Vercel.
- Have a Gmail account with 2-Step Verification enabled and create a Gmail App Password. Use the App Password, not your Gmail sign-in password.
- Never commit `.env` files or paste secrets into source files. Set secrets in each service's environment-variable dashboard.
- Create the Render PostgreSQL database in the same region as the backend service.

## 1. Deploy PostgreSQL and the backend on Render

1. In Render, choose **New → PostgreSQL**. Create a database and wait until it is available. Copy its **Internal Database URL**; it will be the backend's `DATABASE_URL`.
2. Choose **New → Web Service**, connect the repository, and set:
   - **Root Directory:** `backend`
   - **Runtime:** Python (the checked-in `runtime.txt` selects Python 3.12.8)
   - **Build Command:**

     ```sh
     pip install -r requirements.txt && python manage.py collectstatic --no-input && python manage.py migrate
     ```

   - **Start Command:**

     ```sh
     gunicorn bookloop_backend.wsgi:application --bind 0.0.0.0:$PORT
     ```

     This module path matches `backend/bookloop_backend/wsgi.py`. The `Procfile` contains the same command. Do not use `backend.wsgi:application`; that module does not exist in this repository.
3. In the new web service's **Environment** settings, add the following variables. Replace the sample domains with the actual deployment URLs.

   | Variable | Value |
   | --- | --- |
   | `DEBUG` | `False` |
   | `SECRET_KEY` | A new, unique Django secret. Generate locally with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` and keep it private. |
   | `ALLOWED_HOSTS` | Render backend hostname only, without scheme; e.g. `bookloop-api.onrender.com` |
   | `DATABASE_URL` | The PostgreSQL **Internal Database URL** copied from Render |
   | `FRONTEND_URL` | Full deployed frontend origin, e.g. `https://bookloop-app.vercel.app` (no trailing slash) |
   | `CORS_ALLOWED_ORIGINS` | Same frontend origin, e.g. `https://bookloop-app.vercel.app` (no trailing slash) |
   | `CSRF_TRUSTED_ORIGINS` | Same frontend origin, e.g. `https://bookloop-app.vercel.app` (no trailing slash) |
   | `EMAIL_HOST_USER` | Gmail address used to send reset emails |
   | `EMAIL_HOST_PASSWORD` | Gmail App Password (16 characters; enter as generated) |
   | `ADMIN_USERNAME` | Username/email configured for BookLoop's custom admin login |
   | `ADMIN_PASSWORD` | A strong, unique password for BookLoop's custom admin login |

   `DATABASE_URL` takes precedence over the local MySQL `DB_*` settings. Do not set `DB_*` for Render. Render supplies `PORT`; do not add it yourself. `BACKEND_URL` is not read by this project: use the Render URL as `NEXT_PUBLIC_API_URL` in Vercel below.
4. Create the web service. After the first successful deploy, note its public HTTPS URL (for example, `https://bookloop-api.onrender.com`). If it differs from the values entered above, update `ALLOWED_HOSTS` and the frontend-origin variables and redeploy.
5. In Render, set the health-check path to `/api/books/` if you configure a health check. Confirm the API responds at `https://<your-backend-host>/api/books/`.

### Django admin account

The `ADMIN_USERNAME` and `ADMIN_PASSWORD` variables are used by the app's custom admin API login. Create a Django superuser separately if you also need Django's `/admin/` site. In Render's service Shell, run:

```sh
python manage.py createsuperuser
```

## 2. Deploy the frontend on Vercel

1. In Vercel, choose **Add New → Project**, import the repository, and configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
2. In **Project Settings → Environment Variables**, add:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | The Render backend's public HTTPS origin, e.g. `https://bookloop-api.onrender.com` (no trailing slash) |

   Add it for **Production** and any other deployment environments you use. This Vite project is configured to expose `NEXT_PUBLIC_*` variables. Do not use a localhost URL here.
3. Deploy the project. Open the Vercel-provided URL and verify that the application loads. Vercel's `vercel.json` rewrite supports direct navigation and refresh on React Router paths.
4. Copy the final frontend origin and ensure Render's `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` exactly match it. Include a second origin in each comma-separated list if you use a custom domain or a separate production alias. Redeploy the backend after changing its variables.

## Environment-variable summary

**Render backend:** `DEBUG`, `SECRET_KEY`, `ALLOWED_HOSTS`, `DATABASE_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`.

**Vercel frontend:** `NEXT_PUBLIC_API_URL`.

For example, if the deployed URLs are `https://bookloop-app.vercel.app` and `https://bookloop-api.onrender.com`:

```text
Render:
  DEBUG=False
  ALLOWED_HOSTS=bookloop-api.onrender.com
  FRONTEND_URL=https://bookloop-app.vercel.app
  CORS_ALLOWED_ORIGINS=https://bookloop-app.vercel.app
  CSRF_TRUSTED_ORIGINS=https://bookloop-app.vercel.app
  DATABASE_URL=<Render PostgreSQL Internal Database URL>

Vercel:
  NEXT_PUBLIC_API_URL=https://bookloop-api.onrender.com
```

Set `SECRET_KEY`, both email values, and both admin values in Render's dashboard; do not put their real values in this guide or commit them. The angle-bracketed database URL is a placeholder, not a literal value.

## 3. Test password reset on a phone

1. Confirm the deployed Vercel origin appears in Render's `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS`, with `https://` and no trailing slash.
2. On a phone, open the Vercel URL in a browser. Use **Forgot password** and enter an account email that you can access.
3. Open the received email on that phone and tap the reset link. Its host must be the deployed Vercel domain, not `localhost`.
4. Enter and submit a new password. The app validates and consumes the email reset token through the backend API, so the flow does not depend on cross-site cookies.
5. Return to the deployed app and log in using the new password. A reset token is single-use; request another email if it expires or has already been used.
6. If it fails, check the Render logs and confirm `EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD`, the frontend origin values, and the Vercel `NEXT_PUBLIC_API_URL`. Test using the deployed HTTPS sites, not a local development URL.

## Important: uploaded book images

Static Django assets are collected and served by WhiteNoise. User-uploaded images are a separate concern: the current app saves uploads to `backend/media`, and Render's normal filesystem is ephemeral. Uploaded images may disappear after a redeploy/restart, and the current URL configuration only serves local media in debug mode. Before relying on image uploads in production, configure durable object storage (such as S3-compatible storage or Cloudinary) and update the app to use it. This deployment configuration does not silently present Render's temporary disk as durable media storage.

The database created on Render starts empty; local MySQL data and files under `backend/media` are not copied automatically. Migrate/import existing data and media separately if they need to be retained.
