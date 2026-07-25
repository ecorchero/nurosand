from __future__ import annotations

import os
from sqlmodel import SQLModel, Session, create_engine

def _default_db_path() -> str:
    # Vercel's deployed filesystem is read-only outside /tmp.
    if os.environ.get("VERCEL"):
        return "/tmp/nurosand.db"
    return os.path.join(os.path.dirname(__file__), "..", "nurosand.db")


DB_PATH = os.environ.get("NUROSAND_DB", _default_db_path())
DB_URL = f"sqlite:///{os.path.abspath(DB_PATH)}"

engine = create_engine(DB_URL, echo=False, connect_args={"check_same_thread": False})


def init_db() -> None:
    # Import models so metadata is registered before create_all.
    from . import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    return Session(engine)
