"""Compatibility launcher; the application backend lives in app.py."""

import os

import uvicorn


if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), reload=False)
