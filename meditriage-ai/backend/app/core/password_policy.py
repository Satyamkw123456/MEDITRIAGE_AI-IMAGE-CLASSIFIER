import os
from typing import Optional

_COMMON_PASSWORDS = set()
_common_path = os.path.join(os.path.dirname(__file__), "common_passwords.txt")
if os.path.exists(_common_path):
    with open(_common_path, "r", encoding="utf-8") as f:
        _COMMON_PASSWORDS = {line.strip().lower() for line in f if line.strip()}


def validate_password_strength(password: str, email: Optional[str] = None) -> None:
    """
    Password policy:
    - min 10, max 128 characters
    - reject top-1000 common passwords
    - reject if contains email local-part
    - require >=3 of 4 character classes (lowercase, uppercase, digits, symbols)
    Raises ValueError with a clear message on failure.
    """
    if len(password) < 10:
        raise ValueError("Password must be at least 10 characters long.")
    if len(password) > 128:
        raise ValueError("Password must not exceed 128 characters.")

    if password.lower() in _COMMON_PASSWORDS:
        raise ValueError("Password is too common and easily guessed. Please choose a more complex password.")

    if email:
        local_part = email.split("@")[0].lower()
        if len(local_part) >= 3 and local_part in password.lower():
            raise ValueError("Password must not contain parts of your email address.")

    classes_count = 0
    if any(c.islower() for c in password):
        classes_count += 1
    if any(c.isupper() for c in password):
        classes_count += 1
    if any(c.isdigit() for c in password):
        classes_count += 1
    if any(not c.isalnum() for c in password):
        classes_count += 1

    if classes_count < 3:
        raise ValueError(
            "Password must contain characters from at least 3 of the 4 categories: "
            "lowercase letters, uppercase letters, numbers, and symbols."
        )
