import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.config_version import ConfigVersion
from app.models.domain_substrate import Announcement
from app.models.user import User
from app.services.config.config_service import ConfigService
from app.core.utils import get_utc_now
from app.services.admin.admin_action_service import AdminActionService


KILL_SWITCH_DEFAULTS: Dict[str, bool] = {
    "ai.global": True,
    "ai.analysis": True,
    "ai.chat": True,
    "chat.enabled": True,
    "emergency_card.public": True,
    "registration.open": True,
    "voice.enabled": True,
    "maintenance_mode": False,
}


class FlagsSettingsService:
    """
    AC-02: Feature Flags, Governed Settings, Hard Kill Switches & UI Layout Compositions.
    """

    @classmethod
    def evaluate_flag(
        cls,
        key: str,
        user_id: Optional[int],
        role: Optional[str],
        db: Session,
    ) -> Dict[str, Any]:
        """
        Evaluates flag across types:
        - boolean
        - percentage_rollout
        - per_role
        - per_user
        - scheduled
        """
        payload = ConfigService.get_published(namespace="flags", key=key, db=db)
        if not payload:
            return {"key": key, "is_enabled": False, "enabled": False, "reason": "Flag not configured"}

        flag_type = payload.get("type", "boolean")

        # 1. Boolean flag
        if flag_type == "boolean":
            enabled = bool(payload.get("enabled", False))
            return {"key": key, "is_enabled": enabled, "enabled": enabled, "type": "boolean"}

        # 2. Percentage Rollout (deterministic hash on user_id)
        if flag_type == "percentage_rollout":
            if not user_id:
                return {"key": key, "is_enabled": False, "enabled": False, "reason": "user_id required for percentage rollout"}
            pct = float(payload.get("percentage", 0))
            hash_input = f"{key}:{user_id}".encode("utf-8")
            bucket = int(hashlib.sha256(hash_input).hexdigest(), 16) % 100
            is_enabled = (bucket < pct)
            return {"key": key, "is_enabled": is_enabled, "enabled": is_enabled, "type": "percentage_rollout", "bucket": bucket, "percentage": pct}

        # 3. Per-Role
        if flag_type == "per_role":
            allowed_roles = payload.get("allowed_roles", [])
            is_enabled = bool(role and role in allowed_roles)
            return {"key": key, "is_enabled": is_enabled, "enabled": is_enabled, "type": "per_role", "allowed_roles": allowed_roles}

        # 4. Per-User
        if flag_type == "per_user":
            allowed_users = payload.get("allowed_users", [])
            is_enabled = bool(user_id and user_id in allowed_users)
            return {"key": key, "is_enabled": is_enabled, "enabled": is_enabled, "type": "per_user", "allowed_users": allowed_users}

        # 5. Scheduled
        if flag_type == "scheduled":
            eff_str = payload.get("effective_at")
            if not eff_str:
                return {"key": key, "is_enabled": False, "enabled": False, "reason": "Missing effective_at"}
            eff_dt = datetime.fromisoformat(eff_str)
            if not eff_dt.tzinfo:
                eff_dt = eff_dt.replace(tzinfo=timezone.utc)
            is_enabled = (get_utc_now() >= eff_dt)
            return {"key": key, "is_enabled": is_enabled, "enabled": is_enabled, "type": "scheduled", "effective_at": eff_str}

        return {"key": key, "is_enabled": False, "enabled": False, "reason": f"Unknown flag type '{flag_type}'"}

    @classmethod
    def get_flag_status(
        cls,
        db: Session,
        flag_name: str,
        user_id: Optional[int] = None,
        role: Optional[str] = None,
    ) -> Dict[str, Any]:
        return cls.evaluate_flag(key=flag_name, user_id=user_id, role=role, db=db)

    @classmethod
    def list_flags(cls, db: Session, environment: str = "production") -> Dict[str, Any]:
        configs = (
            db.query(ConfigVersion)
            .filter(ConfigVersion.namespace == "flags", ConfigVersion.status == "PUBLISHED")
            .all()
        )
        flags = [
            {
                "flag_name": c.key,
                "version": c.version,
                "config": c.payload,
                "updated_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in configs
        ]
        return {"flags": flags, "environment": environment}

    @classmethod
    def set_flag(
        cls,
        db: Session,
        actor: User,
        flag_name: str,
        flag_type: str = "boolean",
        enabled: bool = True,
        percentage: Optional[float] = None,
        allowed_roles: Optional[List[str]] = None,
        allowed_user_ids: Optional[List[int]] = None,
        effective_at: Optional[datetime] = None,
        reason: str = "",
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"type": flag_type, "enabled": enabled}
        if flag_type == "percentage_rollout":
            payload["percentage"] = percentage or 0.0
        elif flag_type == "per_role":
            payload["allowed_roles"] = allowed_roles or []
        elif flag_type == "per_user":
            payload["allowed_user_ids"] = allowed_user_ids or []
        elif flag_type == "scheduled":
            payload["effective_at"] = effective_at.isoformat() if effective_at else get_utc_now().isoformat()

        def action_fn(s: Session):
            before = ConfigService.get_published(namespace="flags", key=flag_name, db=s)
            ConfigService.publish_config(
                namespace="flags",
                key=flag_name,
                payload=payload,
                actor_id=actor.id,
                db=s,
                note=reason,
            )
            return before, payload

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="FLAG_SET",
            required_permission="perm.admin.flags.manage",
            target_type="flag",
            target_id=flag_name,
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )
        return {**res, "flag_name": flag_name, "config": payload}

    @classmethod
    def get_kill_switch_states(cls, db: Session) -> Dict[str, bool]:
        """Returns the current runtime state of all 8 core kill switches."""
        states = {}
        for switch_key, default_val in KILL_SWITCH_DEFAULTS.items():
            conf = ConfigService.get_published(namespace="kill_switches", key=switch_key, db=db)
            if conf and "enabled" in conf:
                states[switch_key] = bool(conf["enabled"])
            else:
                states[switch_key] = default_val
        return states

    @classmethod
    def list_kill_switches(cls, db: Session) -> Dict[str, Any]:
        states = cls.get_kill_switch_states(db)
        items = [
            {
                "switch_name": k,
                "name": k,
                "active": v,
                "default": KILL_SWITCH_DEFAULTS.get(k, True),
                "description": f"Operational kill switch for {k}",
            }
            for k, v in states.items()
        ]
        return {"kill_switches": items}

    @classmethod
    def is_kill_switch_active(cls, switch_key: str, db: Session) -> bool:
        conf = ConfigService.get_published(namespace="kill_switches", key=switch_key, db=db)
        if conf and "enabled" in conf:
            return bool(conf["enabled"])
        return KILL_SWITCH_DEFAULTS.get(switch_key, True)

    @classmethod
    def toggle_kill_switch(
        cls,
        db: Session,
        actor: User,
        switch_name: Optional[str] = None,
        switch_key: Optional[str] = None,
        enabled: bool = True,
        reason: str = "",
    ) -> Dict[str, Any]:
        key = switch_name or switch_key
        if not key or key not in KILL_SWITCH_DEFAULTS:
            raise HTTPException(status_code=400, detail=f"Unrecognized kill switch '{key}'.")

        def action_fn(s: Session):
            before = {"switch": key, "enabled": cls.is_kill_switch_active(key, s)}
            ConfigService.publish_config(
                namespace="kill_switches",
                key=key,
                payload={"enabled": enabled},
                actor_id=actor.id,
                db=s,
                note=reason,
            )
            after = {"switch": key, "enabled": enabled}
            return before, after

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="KILL_SWITCH_TOGGLE",
            required_permission="perm.admin.flags.manage",
            target_type="kill_switch",
            target_id=key,
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )
        return {
            **res,
            "switch_name": key,
            "active": enabled,
        }

    @classmethod
    def list_settings(cls, db: Session, namespace: Optional[str] = None) -> Dict[str, Any]:
        q = db.query(ConfigVersion).filter(ConfigVersion.status.in_(["published", "PUBLISHED"]))
        if namespace:
            q = q.filter(ConfigVersion.namespace == namespace)
        configs = q.all()
        return {
            "settings": [
                {
                    "namespace": c.namespace,
                    "key": c.key,
                    "version": c.version,
                    "checksum": c.checksum,
                    "value": c.payload,
                    "updated_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in configs
            ]
        }

    @classmethod
    def update_setting(
        cls,
        db: Session,
        actor: User,
        namespace: str,
        key: str,
        value: Any,
        reason: str,
    ) -> Dict[str, Any]:
        payload = value if isinstance(value, dict) else {"value": value}

        def action_fn(s: Session):
            before = ConfigService.get_published(namespace=namespace, key=key, db=s)
            rec = ConfigService.publish_config(
                namespace=namespace,
                key=key,
                payload=payload,
                actor_id=actor.id,
                db=s,
                note=reason,
            )
            return {"payload": before}, {"payload": payload, "version": rec.version}

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="SETTING_UPDATE",
            required_permission="perm.admin.flags.manage",
            target_type="setting",
            target_id=f"{namespace}:{key}",
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )
        # Fetch newly created published version
        latest = db.query(ConfigVersion).filter(
            ConfigVersion.namespace == namespace,
            ConfigVersion.key == key,
            ConfigVersion.status.in_(["published", "PUBLISHED"])
        ).order_by(ConfigVersion.version.desc()).first()

        return {
            **res,
            "namespace": namespace,
            "key": key,
            "version": latest.version if latest else 1,
            "checksum": latest.checksum if latest else None,
            "value": payload,
        }

    @classmethod
    def rollback_setting(
        cls,
        db: Session,
        actor: User,
        namespace: str,
        key: str,
        target_version: int,
        reason: str,
    ) -> Dict[str, Any]:
        target_rec = (
            db.query(ConfigVersion)
            .filter(
                ConfigVersion.namespace == namespace,
                ConfigVersion.key == key,
                ConfigVersion.version == target_version,
            )
            .first()
        )
        if not target_rec:
            raise HTTPException(status_code=404, detail=f"Config version {target_version} not found.")

        target_payload = target_rec.payload

        def action_fn(s: Session):
            current_pub = ConfigService.get_published(namespace, key, s)
            before = {"payload": current_pub}
            new_rec = ConfigService.publish_config(
                namespace=namespace,
                key=key,
                payload=target_payload,
                actor_id=actor.id,
                db=s,
                note=f"Rollback to version {target_version}: {reason}",
            )
            after = {"version": new_rec.version, "rolled_back_to": target_version}
            return before, after

        res = AdminActionService.execute_admin_action(
            actor=actor,
            action_code="CONFIG_ROLLBACK",
            required_permission="perm.admin.flags.manage",
            target_type="config_version",
            target_id=f"{namespace}:{key}:v{target_version}",
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )

        latest = db.query(ConfigVersion).filter(
            ConfigVersion.namespace == namespace,
            ConfigVersion.key == key,
            ConfigVersion.status.in_(["published", "PUBLISHED"])
        ).order_by(ConfigVersion.version.desc()).first()

        return {
            **res,
            "restored_version": latest.version if latest else target_version + 1,
            "checksum": latest.checksum if latest else target_rec.checksum,
        }

    @classmethod
    def get_panel_layout(cls, db: Session, role: str = "patient") -> Dict[str, Any]:
        payload = ConfigService.get_published(namespace="ui_layout", key=role, db=db)
        if not payload:
            if role == "clinician":
                return {
                    "role": role,
                    "visible_cards": ["queue", "case_detail", "review_summary", "differentials", "trends", "audit_trail"],
                    "intake_sections": ["chief_complaint", "vitals", "history", "screens"],
                    "default_language": "en",
                    "elder_mode": False,
                }
            elif role in ("patient", "caregiver"):
                return {
                    "role": role,
                    "visible_cards": ["symptom_intake", "chat_companion", "daily_checkin", "visit_prep", "emergency_card"],
                    "intake_sections": ["simple_symptoms", "micro_screens"],
                    "default_language": "hi",
                    "elder_mode": True,
                }
            else:
                return {
                    "role": role,
                    "visible_cards": ["control_room", "needs_attention", "users", "flags", "dpdp", "audit_chain"],
                    "default_language": "en",
                    "elder_mode": False,
                }
        return payload

    @classmethod
    def update_panel_layout(
        cls,
        db: Session,
        actor: User,
        role: str,
        layout_config: Dict[str, Any],
        reason: str,
    ) -> Dict[str, Any]:
        def action_fn(s: Session):
            before = ConfigService.get_published(namespace="ui_layout", key=role, db=s)
            ConfigService.publish_config(
                namespace="ui_layout",
                key=role,
                payload=layout_config,
                actor_id=actor.id,
                db=s,
                note=reason,
            )
            return before, layout_config

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="LAYOUT_CONFIG_UPDATE",
            required_permission="perm.admin.flags.manage",
            target_type="ui_layout",
            target_id=role,
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )

    @classmethod
    def list_announcements(
        cls,
        db: Session,
        audience: Optional[str] = None,
        active_only: bool = True,
    ) -> Dict[str, Any]:
        now = get_utc_now()
        q = db.query(Announcement)
        if active_only:
            q = q.filter(Announcement.is_active == True)
            q = q.filter(Announcement.effective_at <= now)
            q = q.filter((Announcement.expires_at == None) | (Announcement.expires_at > now))

        if audience and audience != "all":
            q = q.filter(Announcement.audience.in_(["all", audience]))

        announcements = q.order_by(Announcement.effective_at.desc()).all()
        return {
            "announcements": [
                {
                    "id": a.id,
                    "title": a.title,
                    "message": a.message,
                    "audience": a.audience,
                    "banner_type": a.banner_type,
                    "effective_at": a.effective_at.isoformat() if a.effective_at else None,
                    "expires_at": a.expires_at.isoformat() if a.expires_at else None,
                    "is_active": a.is_active,
                }
                for a in announcements
            ]
        }

    @classmethod
    def create_announcement(
        cls,
        db: Session,
        actor: User,
        title: str,
        message: str,
        audience: str,
        banner_type: str,
        effective_at: datetime,
        expires_at: Optional[datetime],
        reason: str,
    ) -> Dict[str, Any]:
        def action_fn(s: Session):
            eff = effective_at
            if not eff.tzinfo:
                eff = eff.replace(tzinfo=timezone.utc)
            exp = expires_at
            if exp and not exp.tzinfo:
                exp = exp.replace(tzinfo=timezone.utc)

            ann = Announcement(
                title=title,
                message=message,
                audience=audience,
                banner_type=banner_type,
                effective_at=eff,
                expires_at=exp,
                is_active=True,
                created_by=actor.id,
                created_at=get_utc_now(),
            )
            s.add(ann)
            s.flush()
            return None, {"id": ann.id, "title": title, "audience": audience}

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="ANNOUNCEMENT_CREATE",
            required_permission="perm.admin.flags.manage",
            target_type="announcement",
            target_id=title,
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )

    @classmethod
    def update_announcement(
        cls,
        db: Session,
        actor: User,
        announcement_id: int,
        data: Dict[str, Any],
        reason: str,
    ) -> Dict[str, Any]:
        def action_fn(s: Session):
            ann = s.query(Announcement).filter(Announcement.id == announcement_id).first()
            if not ann:
                raise HTTPException(status_code=404, detail=f"Announcement {announcement_id} not found.")

            before = {"title": ann.title, "is_active": ann.is_active}
            if "title" in data:
                ann.title = data["title"]
            if "message" in data:
                ann.message = data["message"]
            if "audience" in data:
                ann.audience = data["audience"]
            if "banner_type" in data:
                ann.banner_type = data["banner_type"]
            if "is_active" in data:
                ann.is_active = data["is_active"]
            if "expires_at" in data:
                exp = data["expires_at"]
                if exp and not exp.tzinfo:
                    exp = exp.replace(tzinfo=timezone.utc)
                ann.expires_at = exp

            after = {"title": ann.title, "is_active": ann.is_active}
            return before, after

        return AdminActionService.execute_admin_action(
            actor=actor,
            action_code="ANNOUNCEMENT_UPDATE",
            required_permission="perm.admin.flags.manage",
            target_type="announcement",
            target_id=str(announcement_id),
            action_fn=action_fn,
            db=db,
            reason=reason,
            stepup_verified=True,
        )
