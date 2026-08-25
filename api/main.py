"""
AI-Rabotnik Lead API — лёгкая CRM для ИИ-работников (self-host).

Запуск (локально):
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000

В docker-compose сервис `api` монтирует этот файл и ставит зависимости.

БД: по умолчанию SQLite (файл leads.db в томе). Для Postgres задайте
DATABASE_URL=postgresql+psycopg://user:pass@postgres:5432/airabotnik
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import (
    Boolean,
    DateTime,
    Integer,
    String,
    create_engine,
    func,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

# ---------- Конфигурация БД ----------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./leads.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


# ---------- Модель ----------
class Base(DeclarativeBase):
    pass


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    channel: Mapped[str] = mapped_column(String(32), default="site")  # site|telegram|email
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    task: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0-100
    segment: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # hot|warm|cold
    reason: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="new")  # new|pending_approval|approved|rejected|contacted
    approved_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    consent: Mapped[bool] = mapped_column(Boolean, default=False)  # согласие на обработку PII

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "ts": self.ts.isoformat() if self.ts else None,
            "channel": self.channel,
            "name": self.name,
            "company": self.company,
            "email": self.email,
            "phone": self.phone,
            "task": self.task,
            "score": self.score,
            "segment": self.segment,
            "reason": self.reason,
            "status": self.status,
            "approved_by": self.approved_by,
            "consent": self.consent,
        }


# ---------- Pydantic схемы ----------
class LeadCreate(BaseModel):
    channel: str = "site"
    name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    task: Optional[str] = None
    consent: bool = False


class LeadScore(BaseModel):
    score: int = Field(ge=0, le=100)
    segment: str
    reason: Optional[str] = None


class LeadUpdate(BaseModel):
    status: Optional[str] = None
    approved_by: Optional[str] = None
    score: Optional[int] = Field(default=None, ge=0, le=100)
    segment: Optional[str] = None
    reason: Optional[str] = None


class LeadOut(BaseModel):
    id: int
    ts: Optional[str] = None
    channel: str
    name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    task: Optional[str] = None
    score: Optional[int] = None
    segment: Optional[str] = None
    reason: Optional[str] = None
    status: str
    approved_by: Optional[str] = None
    consent: bool


# ---------- Приложение ----------
app = FastAPI(title="AI-Rabotnik Lead API", version="1.0.0")


@app.on_event("startup")
def _startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/leads", response_model=LeadOut, status_code=201)
def create_lead(payload: LeadCreate) -> dict:
    """n8n вызывает этот эндпоинт при получении лида с любого канала."""
    with SessionLocal() as db:
        lead = Lead(
            channel=payload.channel,
            name=payload.name,
            company=payload.company,
            email=payload.email,
            phone=payload.phone,
            task=payload.task,
            consent=payload.consent,
        )
        db.add(lead)
        db.commit()
        db.refresh(lead)
        return lead.to_dict()


@app.patch("/leads/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: int, payload: LeadUpdate) -> dict:
    """Обновление скоринга (n8n/Ollama) или статуса апрува (менеджер)."""
    with SessionLocal() as db:
        lead = db.get(Lead, lead_id)
        if lead is None:
            raise HTTPException(status_code=404, detail="Lead not found")
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            setattr(lead, key, value)
        db.commit()
        db.refresh(lead)
        return lead.to_dict()


@app.get("/leads", response_model=list[LeadOut])
def list_leads(
    channel: Optional[str] = None,
    status: Optional[str] = None,
    segment: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    with SessionLocal() as db:
        stmt = select(Lead)
        if channel:
            stmt = stmt.where(Lead.channel == channel)
        if status:
            stmt = stmt.where(Lead.status == status)
        if segment:
            stmt = stmt.where(Lead.segment == segment)
        stmt = stmt.order_by(Lead.ts.desc()).limit(limit)
        return [l.to_dict() for l in db.scalars(stmt).all()]


@app.get("/metrics")
def metrics() -> dict:
    """Агрегаты воронки для аналитики (PRODUCT_BACKLOG R0)."""
    with SessionLocal() as db:
        total = db.scalar(select(func.count()).select_from(Lead)) or 0
        by_channel = {
            ch: db.scalar(select(func.count()).select_from(Lead).where(Lead.channel == ch)) or 0
            for ch in ("site", "telegram", "email")
        }
        by_segment = {
            seg: db.scalar(select(func.count()).select_from(Lead).where(Lead.segment == seg)) or 0
            for seg in ("hot", "warm", "cold")
        }
        by_status = {
            st: db.scalar(select(func.count()).select_from(Lead).where(Lead.status == st)) or 0
            for st in ("new", "pending_approval", "approved", "rejected", "contacted")
        }
        approved = by_status.get("approved", 0)
        hot = by_segment.get("hot", 0)
        conversion = round(approved / hot, 3) if hot else 0.0
        return {
            "total": total,
            "by_channel": by_channel,
            "by_segment": by_segment,
            "by_status": by_status,
            "hot_to_approved_conversion": conversion,
        }
