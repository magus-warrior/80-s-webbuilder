import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/fastapi_app",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_owner_column("projects")
    _ensure_owner_column("assets")


def _ensure_owner_column(table_name: str) -> None:
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    if "owner_id" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN owner_id INTEGER"))
        connection.execute(
            text(
                f"ALTER TABLE {table_name} "
                f"ADD CONSTRAINT {table_name}_owner_id_fkey "
                "FOREIGN KEY (owner_id) REFERENCES users(id)"
            )
        )
        connection.execute(
            text(
                f"CREATE INDEX IF NOT EXISTS ix_{table_name}_owner_id "
                f"ON {table_name} (owner_id)"
            )
        )
        row_count = connection.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar_one()
        if row_count == 0:
            connection.execute(
                text(f"ALTER TABLE {table_name} ALTER COLUMN owner_id SET NOT NULL")
            )
