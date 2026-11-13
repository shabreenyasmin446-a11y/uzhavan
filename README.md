# Uzhavan backend

Uzhavan now has one FastAPI backend in `app.py`. It serves the web app and provides API routes for configurable OTP login, scheme and bank listings, and optional object detection. `main.py` is only a compatibility launcher for the same backend.

## Start it on Windows

Open PowerShell in this folder and run:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Then open **http://127.0.0.1:8000**. To use the existing Live Server page on port 5500, keep the backend running at port 8000; the browser app calls that backend automatically.

## What the backend provides

- `GET /health` reports the authentication mode, database, SMS setup, and optional detection model status.
- `POST /api/login` sends a randomly generated six-digit OTP in SMS mode. In demo mode it returns the fixed code `1234` and sends no SMS.
- `POST /api/verify-otp` verifies the active code, saves the farmer account, and creates a session that lasts up to seven days.
- `POST /api/logout` ends that session.
- `GET /api/schemes` and `GET /api/banks` read their dashboard data from SQLite. These require an authenticated session.
- `POST /api/detect` accepts multipart image field `file` and returns model detections. It requires an authenticated session.

Farmer accounts, active sessions, schemes, banks, and SMS verification challenges are stored in `uzhavan.db` in this folder by default. The database is created and filled with the starter listings on first launch. Set `DATABASE_PATH` before starting the server to store the database elsewhere. SMS codes expire after five minutes by default, allow at most five attempts, and are rate limited by phone number and IP address. Session tokens are stored as hashes.

## Enable real SMS login

Demo mode remains the default so the local preview works without paid services. To enable real OTP delivery, create a Twilio account and get its account SID, auth token, and sending number. In PowerShell, copy the template and open your private settings file:

```powershell
Copy-Item .env.example .env
notepad .env
```

In `.env`, change `AUTH_MODE=demo` to `AUTH_MODE=sms`, add your Twilio values, and set `OTP_SECRET` to a random secret. Generate one locally with `py -c "import secrets; print(secrets.token_urlsafe(48))"`, then paste the result into `.env`. Do not send these credentials in chat or commit `.env`; Git ignores it. Restart Uvicorn after saving. SMS mode fails closed if credentials or a 32-character OTP secret are missing; it never falls back to the fixed demo code. The phone field currently accepts 10-digit Indian mobile numbers and sends them with the `+91` country code. SMS delivery requires a valid provider account and sender configuration. A public launch still needs deployment and operational security review.

## Hosting note

The GitHub Pages workflow in `.github/workflows` publishes static files only; it does not run this FastAPI backend. The login, schemes, banks, and image API need the FastAPI server to be running. For a public deployment, host the backend on a service that runs Python containers (the included `Dockerfile` is one option), then edit `config.js` and set `window.UZHAVAN_API_BASE_URL` to the backend's public HTTPS address. Set `FRONTEND_ORIGINS` on the backend to the frontend's exact origin (for example, `https://example.github.io`). Use `AUTH_MODE=sms` with valid SMS credentials for real authentication; demo mode with fixed code `1234` is only for local demonstration.

For a local frontend served from a different port, set `FRONTEND_ORIGINS` to its exact origin before starting the backend. Separate multiple origins with commas. Local ports 5500 and 8000 are allowed by default.

The old `mock_server.py` has been removed because it returned randomly generated pest detections without analyzing the uploaded image. Use `/api/detect` from `app.py`; it returns an unavailable response until a compatible model is installed.

## Optional object detection model

The backend can serve the site and login APIs without a model file. To enable detection, set `MODEL_PATH` to an existing Ultralytics YOLO weights file before starting the server:

```powershell
$env:MODEL_PATH = "C:\path\to\your-model.pt"
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

This project does not include trained weights. A standard `yolov8n.pt` model recognizes general COCO objects; it is **not trained to diagnose crop pests or diseases**. Crop-specific labels need a suitable model trained for that task. The browser displays detections as experimental labels, not crop diagnosis or pesticide advice.
