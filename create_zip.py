import os
import zipfile
from pathlib import Path

ROOT = Path(r"c:\Users\satyam\Downloads\meditriage-ai-triageflow\meditriage-ai")
OUTPUT_ZIP = Path(r"c:\Users\satyam\Downloads\meditriage-ai-triageflow\meditriage-ai-redesign.zip")

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    ".git",
    "__pycache__",
    ".venv",
    ".hypothesis",
    ".pytest_cache",
    "dist",
    "build",
    "coverage",
}

EXCLUDE_EXTS = {
    ".pyc",
    ".pyo",
    ".db",
}

def make_zip():
    print(f"Creating clean zip archive: {OUTPUT_ZIP}")
    count = 0
    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(ROOT):
            # Prune excluded directories in-place
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                p = Path(root) / file
                if p.suffix in EXCLUDE_EXTS:
                    continue
                if file.startswith(".env") and file != ".env.example":
                    continue
                
                rel_path = p.relative_to(ROOT)
                zipf.write(p, arcname=str(rel_path))
                count += 1
                
    size_mb = OUTPUT_ZIP.stat().st_size / (1024 * 1024)
    print(f"[OK] Successfully archived {count} files into {OUTPUT_ZIP} ({size_mb:.2f} MB)")

if __name__ == "__main__":
    make_zip()
