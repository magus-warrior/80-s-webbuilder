from datetime import datetime, timezone
from pathlib import Path
import json
import re
import shutil
import uuid
from typing import Any, Iterable

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
PUBLIC_DIR = ROOT_DIR / "public"
INDEX_FILE = DIST_DIR / "index.html"
UPLOAD_DIR = ROOT_DIR / "public" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
RESERVED_PUBLIC_SLUGS = {"projects", "assets", "auth", "uploads", "public"}
MAX_PROJECT_NAME_LENGTH = 80
MAX_PROJECT_DESCRIPTION_LENGTH = 280

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
        project_data = coerce_project_data(project)
        project_data["publicSlug"] = project.public_slug
        project.data = project_data
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
    data = coerce_project_data(project)
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Project payload must be an object")
    page_mutations = payload.pop("pageMutations", None)
    incoming_pages = payload.get("pages")
    data.update(payload)
    if incoming_pages is not None:
        if not isinstance(incoming_pages, list):
            raise HTTPException(status_code=400, detail="Pages must be a list")
        data["pages"] = incoming_pages
    if page_mutations is not None:
        data["pages"] = apply_page_mutations(data, page_mutations)
    name = payload.get("name")
    description = payload.get("description")
    if name is not None or description is not None:
        apply_project_metadata(project, data, name=name, description=description)
    project.data = data
    db.commit()
    db.refresh(project)
    return serialize_project(project)


@app.put("/projects/{project_id}/metadata")
def update_project_metadata(
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
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Metadata payload must be an object")
    data = coerce_project_data(project)
    name = payload.get("name")
    description = payload.get("description")
    apply_project_metadata(project, data, name=name, description=description, require_name=True)
    project.data = data
    db.commit()
    db.refresh(project)
    return serialize_project(project)


@app.delete("/projects/{project_id}")
def delete_project(
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
    db.delete(project)
    db.commit()
    return {"status": "deleted", "id": str(project_id)}


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
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Project payload must be an object")
    name = payload.get("name") or "Untitled Project"
    name = validate_project_name(name)
    description = payload.get("description")
    if description is not None:
        description = validate_project_description(description)
        payload["description"] = description
    payload["name"] = name
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


def validate_project_name(name: Any) -> str:
    if not isinstance(name, str):
        raise HTTPException(status_code=400, detail="Project name must be a string")
    normalized = name.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Project name is required")
    if len(normalized) > MAX_PROJECT_NAME_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Project name must be {MAX_PROJECT_NAME_LENGTH} characters or fewer",
        )
    return normalized


def validate_project_description(description: Any) -> str:
    if not isinstance(description, str):
        raise HTTPException(status_code=400, detail="Project description must be a string")
    normalized = description.strip()
    if len(normalized) > MAX_PROJECT_DESCRIPTION_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=(
                "Project description must be "
                f"{MAX_PROJECT_DESCRIPTION_LENGTH} characters or fewer"
            ),
        )
    return normalized


def apply_project_metadata(
    project: Project,
    data: dict[str, Any],
    *,
    name: Any | None = None,
    description: Any | None = None,
    require_name: bool = False,
) -> None:
    next_name = None
    if name is not None:
        next_name = validate_project_name(name)
        project.name = next_name
        project.slug = build_slug(next_name)
        data["name"] = next_name
    elif require_name:
        raise HTTPException(status_code=400, detail="Project name is required")
    if description is not None:
        next_description = validate_project_description(description)
        data["description"] = next_description


def apply_page_mutations(
    data: dict[str, Any],
    mutations: Any,
) -> list[dict[str, Any]]:
    if not isinstance(mutations, Iterable) or isinstance(mutations, (str, bytes, dict)):
        raise HTTPException(status_code=400, detail="Page mutations must be a list")
    existing_pages = data.get("pages")
    pages: list[dict[str, Any]] = (
        existing_pages if isinstance(existing_pages, list) else []
    )
    updated_pages = [page.copy() for page in pages if isinstance(page, dict)]
    for mutation in mutations:
        if not isinstance(mutation, dict):
            raise HTTPException(status_code=400, detail="Each page mutation must be an object")
        action = mutation.get("action")
        if action == "create":
            created = build_page_from_mutation(mutation)
            updated_pages.append(created)
        elif action == "update":
            page_id = mutation.get("id")
            if not page_id or not isinstance(page_id, str):
                raise HTTPException(status_code=400, detail="Page id is required for updates")
            updated_pages = [
                update_page_from_mutation(page, mutation)
                if page.get("id") == page_id
                else page
                for page in updated_pages
            ]
            if not any(page.get("id") == page_id for page in updated_pages):
                raise HTTPException(status_code=404, detail="Page not found")
        elif action == "delete":
            page_id = mutation.get("id")
            if not page_id or not isinstance(page_id, str):
                raise HTTPException(status_code=400, detail="Page id is required for deletion")
            next_pages = [page for page in updated_pages if page.get("id") != page_id]
            if len(next_pages) == len(updated_pages):
                raise HTTPException(status_code=404, detail="Page not found")
            updated_pages = next_pages
        else:
            raise HTTPException(status_code=400, detail="Invalid page mutation action")
    return updated_pages


def build_page_from_mutation(mutation: dict[str, Any]) -> dict[str, Any]:
    title = mutation.get("title")
    path = mutation.get("path")
    if not isinstance(title, str) or not title.strip():
        raise HTTPException(status_code=400, detail="Page title is required")
    if not isinstance(path, str) or not path.strip():
        raise HTTPException(status_code=400, detail="Page path is required")
    page_id = mutation.get("id")
    if page_id is None:
        page_id = f"page-{uuid.uuid4().hex[:8]}"
    if not isinstance(page_id, str):
        raise HTTPException(status_code=400, detail="Page id must be a string")
    nodes = mutation.get("nodes")
    if nodes is None:
        nodes = []
    if not isinstance(nodes, list):
        raise HTTPException(status_code=400, detail="Page nodes must be a list")
    return {
        "id": page_id,
        "title": title.strip(),
        "path": path.strip(),
        "nodes": nodes,
    }


def update_page_from_mutation(
    page: dict[str, Any],
    mutation: dict[str, Any],
) -> dict[str, Any]:
    updated = {**page}
    if "title" in mutation:
        title = mutation.get("title")
        if not isinstance(title, str) or not title.strip():
            raise HTTPException(status_code=400, detail="Page title is required")
        updated["title"] = title.strip()
    if "path" in mutation:
        path = mutation.get("path")
        if not isinstance(path, str) or not path.strip():
            raise HTTPException(status_code=400, detail="Page path is required")
        updated["path"] = path.strip()
    if "nodes" in mutation:
        nodes = mutation.get("nodes")
        if not isinstance(nodes, list):
            raise HTTPException(status_code=400, detail="Page nodes must be a list")
        updated["nodes"] = nodes
    return updated


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


def is_reserved_public_slug(slug: str) -> bool:
    return slug in RESERVED_PUBLIC_SLUGS


def serialize_project(project: Project) -> dict[str, Any]:
    data = coerce_project_data(project)
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
    data = coerce_project_data(project)
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


def coerce_project_data(project: Project) -> dict[str, Any]:
    data = project.data
    if isinstance(data, dict):
        return data
    if isinstance(data, str):
        try:
            parsed = json.loads(data)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


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


@app.get("/sample-project.json", response_model=None)
def get_sample_project() -> FileResponse:
    dist_sample = DIST_DIR / "sample-project.json"
    public_sample = PUBLIC_DIR / "sample-project.json"
    if dist_sample.exists():
        return FileResponse(dist_sample, media_type="application/json")
    if public_sample.exists():
        return FileResponse(public_sample, media_type="application/json")
    raise HTTPException(status_code=404, detail="Sample project not available")


@app.get("/public/{path:path}", response_model=None)
def public_site(path: str) -> FileResponse:
    if INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)
    raise HTTPException(status_code=404, detail="Public site not available")


@app.get("/{slug}", response_model=None)
def public_slug_site(slug: str) -> FileResponse:
    if is_reserved_public_slug(slug):
        raise HTTPException(status_code=404, detail="Public site not available")
    if INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)
    raise HTTPException(status_code=404, detail="Public site not available")


app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
