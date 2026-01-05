from datetime import datetime, timezone
from pathlib import Path
import re
import shutil
import uuid
from typing import Any

from fastapi import Body, Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db, init_db
from models import Asset, Project, User
from routers.auth import router as auth_router

app = FastAPI()
ROOT_DIR = Path(__file__).resolve().parent
DIST_DIR = ROOT_DIR / "dist"
INDEX_FILE = DIST_DIR / "index.html"
UPLOAD_DIR = ROOT_DIR / "public" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.include_router(auth_router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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


@app.post("/projects/{project_id}/publish")
def publish_project(
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
    is_published = bool(payload.get("isPublished"))
    public_slug_input = payload.get("publicSlug")
    if is_published:
        project.is_published = True
        if public_slug_input:
            public_slug = normalize_public_slug(public_slug_input)
            if not is_public_slug_available(public_slug, project, db):
                raise HTTPException(status_code=400, detail="Public slug already in use")
            project.public_slug = public_slug
        if not project.public_slug:
            project.public_slug = build_public_slug(project, db)
        if project.published_at is None:
            project.published_at = datetime.now(timezone.utc)
    else:
        project.is_published = False
        project.published_at = None
    if project.public_slug:
        project.data = {**(project.data or {}), "publicSlug": project.public_slug}
    db.commit()
    db.refresh(project)
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


@app.get("/assets")
def list_assets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    assets = (
        db.query(Asset)
        .filter(Asset.owner_id == current_user.id)
        .order_by(Asset.created_at.desc())
        .all()
    )
    return [serialize_asset(asset) for asset in assets]


@app.post("/assets", status_code=201)
def upload_asset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    extension = Path(file.filename).suffix
    stored_name = f"{uuid.uuid4().hex}{extension}"
    destination = UPLOAD_DIR / stored_name
    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    asset = Asset(
        owner_id=current_user.id,
        url=f"/uploads/{stored_name}",
        filename=file.filename,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return serialize_asset(asset)


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
        is_published=False,
        data=payload,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return serialize_project(project)


def build_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "project"


def normalize_public_slug(value: str) -> str:
    if not value.strip():
        raise HTTPException(status_code=400, detail="Public slug is required")
    return build_slug(value)


def build_public_slug(project: Project, db: Session) -> str:
    base_slug = project.slug or build_slug(project.name)
    candidate = base_slug
    suffix = 1
    while (
        db.query(Project)
        .filter(Project.public_slug == candidate, Project.id != project.id)
        .first()
    ):
        suffix += 1
        candidate = f"{base_slug}-{suffix}"
    return candidate


def is_public_slug_available(slug: str, project: Project, db: Session) -> bool:
    existing = (
        db.query(Project)
        .filter(Project.public_slug == slug, Project.id != project.id)
        .first()
    )
    return existing is None


def serialize_project(project: Project) -> dict[str, Any]:
    data = project.data or {}
    response = {
        **data,
        "id": str(project.id),
        "name": project.name,
        "slug": project.slug,
        "publicSlug": project.public_slug,
        "isPublished": project.is_published,
        "publishedAt": project.published_at.isoformat() if project.published_at else None,
    }
    return response


def serialize_project_summary(project: Project) -> dict[str, Any]:
    data = project.data or {}
    return {
        "id": str(project.id),
        "name": project.name,
        "slug": project.slug,
        "publicId": project.public_id,
        "publicSlug": project.public_slug,
        "isPublished": project.is_published,
        "publishedAt": project.published_at.isoformat() if project.published_at else None,
        "updatedAt": data.get("updatedAt"),
    }


def serialize_asset(asset: Asset) -> dict[str, Any]:
    return {
        "id": str(asset.id),
        "url": asset.url,
        "filename": asset.filename,
        "createdAt": asset.created_at.isoformat() if asset.created_at else None,
    }


@app.get("/projects/{project_id}/public-slug/validate")
def validate_public_slug(
    project_id: int,
    slug: str = Query(...),
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
    normalized = normalize_public_slug(slug)
    return {
        "slug": normalized,
        "available": is_public_slug_available(normalized, project, db),
    }


@app.get("/api/public/{slug}")
def get_public_project(slug: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    project = (
        db.query(Project)
        .filter(Project.public_slug == slug, Project.is_published.is_(True))
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return serialize_project(project)


@app.get("/public/{path:path}", response_model=None)
def public_site(path: str) -> FileResponse:
    if INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)
    raise HTTPException(status_code=404, detail="Public site not available")


app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
