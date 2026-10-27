import os
import tempfile

# Ensure test suite runs against isolated SQLite database
_TMP_DB = os.path.join(tempfile.gettempdir(), "meditriage_sec_regression.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB}"
os.environ.setdefault("GEMINI_API_KEY", "")
