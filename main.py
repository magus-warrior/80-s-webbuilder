from pathlib import Path
import re
import uuid
from typing import Any

from fastapi import Body, Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db, init_db
from models import Project, User
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
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return serialize_project(project)


@app.put("/projects/{project_id}")
def update_project(
    project_id: int,
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    name = payload.get("name") or f"Project {project_id}"
    project.name = name
    project.data = payload
    db.commit()
    db.refresh(project)
    return serialize_project(project)


@app.get("/projects")
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    projects = (
        db.query(Project)
        .filter(Project.owner_id == current_user.id)
        .order_by(Project.id.desc())
        .all()
    )
    return [serialize_project_summary(project) for project in projects]


@app.post("/projects", status_code=201)
def create_project(
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    name = payload.get("name") or "Untitled Project"
    slug = build_slug(name)
    project = Project(
        owner_id=current_user.id,
        name=name,
        slug=slug,
        public_id=uuid.uuid4().hex,
        data=payload,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return serialize_project(project)


def build_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "project"


def serialize_project(project: Project) -> dict[str, Any]:
    data = project.data or {}
    if "id" not in data:
        data = {**data, "id": str(project.id)}
    return data


def serialize_project_summary(project: Project) -> dict[str, Any]:
    data = project.data or {}
    return {
        "id": str(project.id),
        "name": project.name,
        "slug": project.slug,
        "publicId": project.public_id,
        "updatedAt": data.get("updatedAt"),
    }


if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
