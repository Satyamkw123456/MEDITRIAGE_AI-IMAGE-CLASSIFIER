from app.db.session import SessionLocal
from app.models.rbac import Permission
from app.services.auth.rbac_service import ALL_PERMISSIONS

def seed_permissions():
    db = SessionLocal()
    try:
        existing = {p.code for p in db.query(Permission).all()}
        added = 0
        for code, meta in ALL_PERMISSIONS.items():
            if code not in existing:
                db.add(Permission(
                    code=code,
                    description=meta.get("desc", ""),
                    is_sensitive=bool(meta.get("sensitive", False)),
                    requires_stepup=bool(meta.get("stepup", False)),
                    requires_dual_control=bool(meta.get("dual", False)),
                ))
                added += 1
        db.commit()
        print(f"Seeded {added} permissions into database. Total now: {len(db.query(Permission).all())}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_permissions()
