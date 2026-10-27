#!/usr/bin/env python3
"""Pre-deployment hygiene gate. Exit code 1 if anything unsafe would ship.

Run from the repo root:  python scripts/predeploy_check.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP = {"node_modules", ".next", ".git", "__pycache__", ".venv", "dev-logbook", "dev-test-data", "dev-content-source"}
SECRET_RX = re.compile(r"AIza[0-9A-Za-z_\-]{30,}|sk-[A-Za-z0-9]{30,}|-----BEGIN (RSA |EC )?PRIVATE KEY-----|SUPABASE_[A-Z_]*KEY\s*=\s*eyJ")
TEXT_EXT = {".py", ".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".yaml", ".yml", ".toml", ".env", ".example", ".css", ".txt"}

problems = []
for path in ROOT.rglob("*"):
    if any(part in SKIP for part in path.parts) or not path.is_file():
        continue
    rel = path.relative_to(ROOT)
    if path.suffix == ".db" or path.name.startswith(".env") and path.name != ".env.example":
        problems.append(f"Must not ship: {rel}")
        continue
    if path.suffix in TEXT_EXT and path.stat().st_size < 2_000_000:
        try:
            if SECRET_RX.search(path.read_text(encoding="utf-8", errors="ignore")):
                problems.append(f"Possible secret in: {rel}")
        except OSError:
            pass

for required in ("backend/alembic.ini", "backend/app/data/skin_rag.json", "frontend/src/lib/api/schema.d.ts", "render.yaml"):
    if not (ROOT / required).exists():
        problems.append(f"Missing required file: {required}")

if problems:
    print("PREDEPLOY CHECK FAILED")
    print("\n".join(f" - {p}" for p in problems))
    sys.exit(1)
print("PREDEPLOY CHECK PASSED: no databases, env files or secrets; required files present.")
