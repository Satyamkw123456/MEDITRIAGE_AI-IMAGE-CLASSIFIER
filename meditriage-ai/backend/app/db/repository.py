from typing import Optional, List, TypeVar, Type
from sqlalchemy.orm import Session, Query
from app.models.case import Case

T = TypeVar("T")

class BaseRepository:
    """Base repository providing soft-delete scoping by default."""
    def __init__(self, db: Session, model_cls: Type[T]):
        self.db = db
        self.model_cls = model_cls

    def query(self, include_deleted: bool = False) -> Query:
        q = self.db.query(self.model_cls)
        if not include_deleted and hasattr(self.model_cls, "deleted_at"):
            q = q.filter(getattr(self.model_cls, "deleted_at").is_(None))
        return q

    def get_by_id(self, item_id: int, include_deleted: bool = False) -> Optional[T]:
        return self.query(include_deleted=include_deleted).filter(getattr(self.model_cls, "id") == item_id).first()


class CaseRepository(BaseRepository):
    def __init__(self, db: Session):
        super().__init__(db, Case)

    def get_case(self, case_id: int, include_deleted: bool = False) -> Optional[Case]:
        return self.query(include_deleted=include_deleted).filter(Case.id == case_id).first()

    def list_cases(self, patient_id: Optional[int] = None, include_deleted: bool = False) -> List[Case]:
        q = self.query(include_deleted=include_deleted)
        if patient_id is not None:
            q = q.filter(Case.patient_id == patient_id)
        return q.order_by(Case.created_at.desc()).all()
