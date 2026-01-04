from pathlib import Path
from typing import Any

from fastapi import Body, Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from database import get_db, init_db
from models import Project
from routers.auth import router as auth_router

app = FastAPI()
ROOT_DIR = Path(__file__).resolve().parent
DIST_DIR = ROOT_DIR / "dist"
INDEX_FILE = DIST_DIR / "index.html"

app.include_router(auth_router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/", response_model=None)
def root() -> dict | FileResponse:
    if INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)
    return {"status": "ok"}


@app.get("/projects/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    data = project.data or {}
    if "id" not in data:
        data = {**data, "id": str(project.id)}
    return data


@app.put("/projects/{project_id}")
def update_project(
    project_id: int,
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = db.query(Project).filter(Project.id == project_id).first()
    name = payload.get("name") or f"Project {project_id}"
    if project:
        project.name = name
        project.data = payload
    else:
        project = Project(id=project_id, name=name, data=payload)
        db.add(project)
    db.commit()
    db.refresh(project)
    data = project.data or {}
    if "id" not in data:
        data = {**data, "id": str(project.id)}
    return data


if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
