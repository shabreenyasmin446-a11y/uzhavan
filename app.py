"""Uzhavan web app API with configurable demo or SMS OTP authentication."""

from __future__ import annotations

import io
import base64
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent


def load_local_environment() -> None:
    """Read simple KEY=value settings from .env without overriding shell values."""
    env_file = BASE_DIR / ".env"
    if not env_file.is_file():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key and key.replace("_", "").isalnum():
            os.environ.setdefault(key, value)


load_local_environment()

MODEL_PATH = Path(os.environ.get("MODEL_PATH", str(BASE_DIR / "yolov8n.pt")))
MODEL_DEVICE = os.environ.get("MODEL_DEVICE", "cpu")
DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", str(BASE_DIR / "uzhavan.db")))
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
AUTH_MODE = os.environ.get("AUTH_MODE", "demo").strip().lower()
OTP_TTL_SECONDS = int(os.environ.get("OTP_TTL_SECONDS", "300"))
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_SECONDS = 60
OTP_SECRET = os.environ.get("OTP_SECRET", "")
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")
DEMO_CODE = "1234"
FRONTEND_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.environ.get(
        "FRONTEND_ORIGINS",
        "http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if origin.strip()
]

try:
    from ultralytics import YOLO
except Exception:  # The web app and its other API routes work without YOLO.
    YOLO = None

app = FastAPI(title="Uzhavan Farming Demo API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

model = None
model_error: str | None = None
pending_demo_codes: dict[str, str] = {}

SCHEMES = [
    {
        "name": "PM-Kisan Samman Nidhi",
        "desc": "Get ₹6,000 yearly in three installments directly into your bank account.",
        "tags": "Income Support",
        "link": "https://pmkisan.gov.in/",
    },
    {
        "name": "Pradhan Mantri Fasal Bima Yojana",
        "desc": "Crop insurance information and application services from the official portal.",
        "tags": "Crop Insurance",
        "link": "https://pmfby.gov.in/",
    },
    {
        "name": "Kisan Credit Card (KCC)",
        "desc": "Credit facility for eligible agricultural needs. Ask a participating bank about current terms.",
        "tags": "Farm Credit",
        "link": "https://www.myscheme.gov.in/schemes/kcc",
    },
    {
        "name": "National Agriculture Market (e-NAM)",
        "desc": "Government agriculture market portal with mandi trading and price information.",
        "tags": "Market Access",
        "link": "https://enam.gov.in/",
    },
]

BANKS = [
    {"name": "State Bank of India", "dist": "Example bank", "rate": "Ask your local branch"},
    {"name": "Canara Bank", "dist": "Example bank", "rate": "Ask your local branch"},
    {"name": "Indian Overseas Bank", "dist": "Example bank", "rate": "Ask your local branch"},
    {"name": "Union Bank of India", "dist": "Example bank", "rate": "Ask your local branch"},
    {"name": "Bank of Baroda", "dist": "Example bank", "rate": "Ask your local branch"},
]


def open_database() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(DATABASE_PATH), timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def database_connection():
    connection = open_database()
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize_database() -> None:
    with database_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS farmers (
                phone TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_login_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                phone TEXT NOT NULL REFERENCES farmers(phone) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
            CREATE TABLE IF NOT EXISTS schemes (
                name TEXT PRIMARY KEY,
                description TEXT NOT NULL,
                tags TEXT NOT NULL,
                link TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS banks (
                name TEXT PRIMARY KEY,
                district TEXT NOT NULL,
                rate TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS otp_challenges (
                phone TEXT PRIMARY KEY,
                code_hash TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                last_sent_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS otp_send_events (
                id INTEGER PRIMARY KEY,
                phone TEXT NOT NULL,
                remote_ip TEXT NOT NULL,
                sent_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS otp_send_phone_idx ON otp_send_events(phone, sent_at);
            CREATE INDEX IF NOT EXISTS otp_send_ip_idx ON otp_send_events(remote_ip, sent_at);
            """
        )
        if connection.execute("SELECT COUNT(*) FROM schemes").fetchone()[0] == 0:
            connection.executemany(
                "INSERT INTO schemes(name, description, tags, link) VALUES (?, ?, ?, ?)",
                [(item["name"], item["desc"], item["tags"], item["link"]) for item in SCHEMES],
            )
        if connection.execute("SELECT COUNT(*) FROM banks").fetchone()[0] == 0:
            connection.executemany(
                "INSERT INTO banks(name, district, rate) VALUES (?, ?, ?)",
                [(item["name"], item["dist"], item["rate"]) for item in BANKS],
            )


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def otp_digest(phone: str, code: str) -> str:
    message = f"{phone}:{code}".encode("utf-8")
    return hmac.new(OTP_SECRET.encode("utf-8"), message, hashlib.sha256).hexdigest()


def sms_is_configured() -> bool:
    return bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER)


def send_twilio_sms(phone: str, code: str) -> None:
    endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    message = f"Your Uzhavan verification code is {code}. It expires in {max(1, OTP_TTL_SECONDS // 60)} minutes."
    payload = urllib.parse.urlencode({"To": phone, "From": TWILIO_FROM_NUMBER, "Body": message}).encode("utf-8")
    credentials = base64.b64encode(f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode("utf-8")).decode("ascii")
    request = urllib.request.Request(
        endpoint,
        data=payload,
        headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.status >= 300:
                raise RuntimeError("SMS provider rejected the request")
    except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail="SMS could not be sent. Please try again later.") from exc


class LoginRequest(BaseModel):
    phone: str
    country_code: str = "+91"


class VerifyOtpRequest(BaseModel):
    phone: str
    otp: str
    country_code: str = "+91"


def require_demo_session(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in to the Uzhavan demo first")
    token = authorization.split(" ", 1)[1].strip()
    digest = token_digest(token)
    now = int(time.time())
    with database_connection() as connection:
        connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
        session = connection.execute(
            "SELECT phone FROM sessions WHERE token_hash = ? AND expires_at > ?",
            (digest, now),
        ).fetchone()
    if session is None:
        raise HTTPException(status_code=401, detail="Demo session expired; sign in again")
    return str(session["phone"])


def sms_phone_number(request: LoginRequest) -> str:
    local_number = request.phone.strip()
    country_code = request.country_code.strip()
    if not re.fullmatch(r"\d{6,12}", local_number):
        raise HTTPException(status_code=422, detail="Enter a valid mobile number")
    if not re.fullmatch(r"\+[1-9]\d{0,2}", country_code):
        raise HTTPException(status_code=422, detail="Choose a valid country code")
    if len(country_code[1:]) + len(local_number) > 15:
        raise HTTPException(status_code=422, detail="Mobile number is too long")
    return f"{country_code}{local_number}"


@app.on_event("startup")
def load_detection_model() -> None:
    global model, model_error
    if AUTH_MODE not in {"demo", "sms"}:
        raise RuntimeError("AUTH_MODE must be either 'demo' or 'sms'")
    if not 60 <= OTP_TTL_SECONDS <= 900:
        raise RuntimeError("OTP_TTL_SECONDS must be between 60 and 900")
    if AUTH_MODE == "sms" and not sms_is_configured():
        raise RuntimeError("SMS mode requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER")
    if AUTH_MODE == "sms" and len(OTP_SECRET) < 32:
        raise RuntimeError("SMS mode requires OTP_SECRET to contain at least 32 characters")
    initialize_database()
    if YOLO is None:
        model_error = "Ultralytics is not installed; web and account demo APIs are available."
        return
    if not MODEL_PATH.is_file():
        model_error = f"Model file not found: {MODEL_PATH}"
        return
    try:
        model = YOLO(str(MODEL_PATH))
        model_error = None
        print(f"Detection model loaded: {MODEL_PATH}")
    except Exception as exc:
        model = None
        model_error = f"Could not load detection model: {exc}"
        print(model_error)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "uzhavan",
        "database": "sqlite",
        "auth_mode": AUTH_MODE,
        "demo_login": AUTH_MODE == "demo",
        "sms_provider_configured": sms_is_configured(),
        "model_loaded": model is not None,
        "model_path": str(MODEL_PATH),
        "model_message": model_error,
    }


@app.get("/")
def index() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


@app.get("/style.css")
def style() -> FileResponse:
    return FileResponse(BASE_DIR / "style.css")


@app.get("/config.js")
def config() -> FileResponse:
    return FileResponse(BASE_DIR / "config.js")


@app.get("/script.js")
def script() -> FileResponse:
    return FileResponse(BASE_DIR / "script.js")


@app.post("/api/login")
def login(request: LoginRequest, http_request: Request) -> dict[str, str | bool]:
    phone = request.phone.strip()
    if AUTH_MODE == "demo":
        if not re.fullmatch(r"\d{10}", phone):
            raise HTTPException(status_code=422, detail="Enter a valid 10-digit mobile number")
        pending_demo_codes[phone] = DEMO_CODE
        return {
            "status": "demo",
            "message": "Demo mode: no SMS was sent. Enter the code shown here.",
            "demo_code": DEMO_CODE,
        }

    phone = sms_phone_number(request)
    now = int(time.time())
    remote_ip = http_request.client.host if http_request.client else "unknown"
    with database_connection() as connection:
        previous = connection.execute(
            "SELECT last_sent_at FROM otp_challenges WHERE phone = ?", (phone,)
        ).fetchone()
        if previous and now - int(previous["last_sent_at"]) < OTP_RESEND_SECONDS:
            raise HTTPException(status_code=429, detail="Wait one minute before requesting another code")
        phone_sends = connection.execute(
            "SELECT COUNT(*) FROM otp_send_events WHERE phone = ? AND sent_at > ?", (phone, now - 86400)
        ).fetchone()[0]
        ip_sends = connection.execute(
            "SELECT COUNT(*) FROM otp_send_events WHERE remote_ip = ? AND sent_at > ?", (remote_ip, now - 3600)
        ).fetchone()[0]
        if phone_sends >= 5 or ip_sends >= 10:
            raise HTTPException(status_code=429, detail="Too many code requests. Try again later.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    send_twilio_sms(phone, code)
    with database_connection() as connection:
        connection.execute(
            "INSERT INTO otp_challenges(phone, code_hash, expires_at, attempts, last_sent_at) "
            "VALUES (?, ?, ?, 0, ?) ON CONFLICT(phone) DO UPDATE SET "
            "code_hash = excluded.code_hash, expires_at = excluded.expires_at, "
            "attempts = 0, last_sent_at = excluded.last_sent_at",
            (phone, otp_digest(phone, code), now + OTP_TTL_SECONDS, now),
        )
        connection.execute("DELETE FROM otp_send_events WHERE sent_at <= ?", (now - 86400,))
        connection.execute(
            "INSERT INTO otp_send_events(phone, remote_ip, sent_at) VALUES (?, ?, ?)",
            (phone, remote_ip, now),
        )
    return {"status": "sent", "message": "If this number can receive SMS, your verification code has been sent."}


@app.post("/api/verify-otp")
def verify_otp(request: VerifyOtpRequest) -> dict[str, str]:
    phone = request.phone.strip()
    if AUTH_MODE == "demo":
        if pending_demo_codes.get(phone) != request.otp.strip():
            raise HTTPException(status_code=400, detail="Incorrect demo code. Request a new code and try again.")
        pending_demo_codes.pop(phone, None)
    else:
        phone = sms_phone_number(LoginRequest(phone=phone, country_code=request.country_code))
        now = int(time.time())
        verification_error: tuple[int, str] | None = None
        with database_connection() as connection:
            challenge = connection.execute(
                "SELECT code_hash, expires_at, attempts FROM otp_challenges WHERE phone = ?", (phone,)
            ).fetchone()
            if challenge is None:
                verification_error = (400, "Request a new verification code")
            elif int(challenge["expires_at"]) <= now:
                connection.execute("DELETE FROM otp_challenges WHERE phone = ?", (phone,))
                verification_error = (400, "The code expired. Request a new one.")
            elif int(challenge["attempts"]) >= OTP_MAX_ATTEMPTS:
                connection.execute("DELETE FROM otp_challenges WHERE phone = ?", (phone,))
                verification_error = (429, "Too many incorrect attempts. Request a new code.")
            else:
                submitted = request.otp.strip()
                if not re.fullmatch(r"\d{6}", submitted) or not hmac.compare_digest(
                    str(challenge["code_hash"]), otp_digest(phone, submitted)
                ):
                    attempts = int(challenge["attempts"]) + 1
                    connection.execute("UPDATE otp_challenges SET attempts = ? WHERE phone = ?", (attempts, phone))
                    if attempts >= OTP_MAX_ATTEMPTS:
                        connection.execute("DELETE FROM otp_challenges WHERE phone = ?", (phone,))
                        verification_error = (429, "Too many incorrect attempts. Request a new code.")
                    else:
                        verification_error = (400, "Incorrect code. Please try again.")
                else:
                    connection.execute("DELETE FROM otp_challenges WHERE phone = ?", (phone,))
        if verification_error:
            raise HTTPException(status_code=verification_error[0], detail=verification_error[1])
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    with database_connection() as connection:
        connection.execute(
            "INSERT INTO farmers(phone, last_login_at) VALUES (?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(phone) DO UPDATE SET last_login_at = CURRENT_TIMESTAMP",
            (phone,),
        )
        connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
        connection.execute(
            "INSERT INTO sessions(token_hash, phone, expires_at) VALUES (?, ?, ?)",
            (token_digest(token), phone, now + SESSION_TTL_SECONDS),
        )
    return {"status": "success", "token": token}


@app.post("/api/logout")
def logout(phone: str = Depends(require_demo_session), authorization: str = Header(default="")) -> dict[str, str]:
    token = authorization.split(" ", 1)[1].strip()
    with database_connection() as connection:
        connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_digest(token),))
    return {"status": "success"}


@app.get("/api/schemes")
def get_schemes(_: str = Depends(require_demo_session)) -> list[dict[str, str]]:
    with database_connection() as connection:
        rows = connection.execute(
            "SELECT name, description, tags, link FROM schemes ORDER BY rowid"
        ).fetchall()
    return [
        {"name": row["name"], "desc": row["description"], "tags": row["tags"], "link": row["link"]}
        for row in rows
    ]


@app.get("/api/banks")
def get_banks(_: str = Depends(require_demo_session)) -> list[dict[str, str]]:
    with database_connection() as connection:
        rows = connection.execute("SELECT name, district, rate FROM banks ORDER BY rowid").fetchall()
    return [{"name": row["name"], "dist": row["district"], "rate": row["rate"]} for row in rows]


@app.post("/api/detect")
async def detect(file: UploadFile = File(...), _: str = Depends(require_demo_session)) -> dict[str, list[dict[str, Any]]]:
    if model is None:
        raise HTTPException(status_code=503, detail=model_error or "Detection model is not loaded")
    contents = await file.read(10 * 1024 * 1024 + 1)
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be 10 MB or smaller")

    try:
        from PIL import Image
        import numpy as np

        image = Image.open(io.BytesIO(contents)).convert("RGB")
        results = model.predict(source=np.array(image), device=MODEL_DEVICE, imgsz=640, conf=0.25)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not process image: {exc}") from exc

    detections: list[dict[str, Any]] = []
    result = results[0]
    names = getattr(result, "names", None) or getattr(model, "names", {})
    boxes = getattr(result, "boxes", None)
    if boxes is None:
        return {"detections": detections}

    xyxy = boxes.xyxy.cpu().numpy()
    scores = boxes.conf.cpu().numpy()
    classes = boxes.cls.cpu().numpy()
    for coords, score, class_id in zip(xyxy, scores, classes):
        x1, y1, x2, y2 = (float(value) for value in coords)
        numeric_id = int(class_id)
        label = names.get(numeric_id, str(numeric_id)) if isinstance(names, dict) else str(numeric_id)
        detections.append({
            "bbox": [x1, y1, x2 - x1, y2 - y1],
            "class": label,
            "score": float(score),
        })
    return {"detections": detections}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), reload=False)
