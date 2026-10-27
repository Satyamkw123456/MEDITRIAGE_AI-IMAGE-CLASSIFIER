import time
from typing import Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.config_version import ConfigVersion, compute_payload_checksum, get_utc_now
from app.services.audit.audit_service import AuditService


class ConfigService:
    """
    Governed Configuration Service.
    Maintains an in-process cache with TTL <= 5s.
    get_published(namespace, key) is the ONLY way runtime code reads config.
    """

    _cache: Dict[Tuple[str, str], Tuple[Dict[str, Any], float]] = {}

    @classmethod
    def get_published(cls, namespace: str, key: str, db: Session) -> Optional[Dict[str, Any]]:
        """Reads published configuration payload with in-process 5s TTL cache."""
        now_ts = time.time()
        cache_key = (namespace, key)

        # Check cache
        if cache_key in cls._cache:
            cached_val, cached_time = cls._cache[cache_key]
            if (now_ts - cached_time) < settings.CONFIG_CACHE_TTL_SECONDS:
                return cached_val

        # Query database for latest published version
        config_rec = (
            db.query(ConfigVersion)
            .filter(
                ConfigVersion.namespace == namespace,
                ConfigVersion.key == key,
                ConfigVersion.status == "published",
            )
            .order_by(ConfigVersion.version.desc())
            .first()
        )

        if not config_rec:
            return None

        payload = config_rec.payload
        cls._cache[cache_key] = (payload, now_ts)
        return payload

    @classmethod
    def publish_config(
        cls,
        namespace: str,
        key: str,
        payload: Dict[str, Any],
        actor_id: int,
        db: Session,
        note: Optional[str] = None,
    ) -> ConfigVersion:
        """Publishes a new governed config version and logs an admin action."""
        # Find latest version number
        latest = (
            db.query(ConfigVersion)
            .filter(ConfigVersion.namespace == namespace, ConfigVersion.key == key)
            .order_by(ConfigVersion.version.desc())
            .first()
        )

        new_ver = (latest.version + 1) if latest else 1
        checksum = compute_payload_checksum(payload)
        now = get_utc_now()

        # Archive old published versions
        if latest:
            db.query(ConfigVersion).filter(
                ConfigVersion.namespace == namespace,
                ConfigVersion.key == key,
                ConfigVersion.status == "published",
            ).update({"status": "archived"})

        config_rec = ConfigVersion(
            namespace=namespace,
            key=key,
            version=new_ver,
            status="published",
            payload=payload,
            checksum=checksum,
            parent_version=latest.version if latest else None,
            created_by=actor_id,
            published_by=actor_id,
            published_at=now,
            note=note or f"Published version {new_ver}",
            created_at=now,
        )

        db.add(config_rec)
        db.flush()

        # Write admin action
        AuditService.write_admin_action(
            actor_id=actor_id,
            action_code=f"CONFIG_PUBLISH_{namespace.upper()}",
            target_type="config_versions",
            target_id=f"{namespace}:{key}:v{new_ver}",
            before_state=latest.payload if latest else None,
            after_state=payload,
            reason=note or f"Published config {namespace}:{key} version {new_ver}",
            status="APPLIED",
            db=db,
        )

        db.commit()

        # Invalidate cache
        cls._cache.pop((namespace, key), None)
        return config_rec
