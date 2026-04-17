from datetime import datetime, timezone
import copy
import io
from pathlib import Path
import json
import re
import uuid
from typing import Any, Iterable

from fastapi import Body, Depends, FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps
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
COMPRESSIBLE_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_IMAGE_DIMENSION = 1920
WEBP_QUALITY = 82
MAX_ANALYTICS_EVENTS = 5000

app.include_router(auth_router)


def no_cache_headers() -> dict[str, str]:
    return {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }


def serve_index_file() -> FileResponse:
    return FileResponse(INDEX_FILE, headers=no_cache_headers())


@app.middleware("http")
async def spa_refresh_fallback(request: Request, call_next):
    if request.method == "GET" and request.url.path.startswith("/projects/"):
        accept = request.headers.get("accept", "")
        if "text/html" in accept and "application/json" not in accept and INDEX_FILE.exists():
            return serve_index_file()
    return await call_next(request)


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
        return serve_index_file()
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
    public_page_id = payload.get("publicPageId")
    if is_published:
        project.is_published = True
        if public_slug_input:
            public_slug = normalize_public_slug(public_slug_input)
            if not is_public_slug_available(public_slug, project, db):
                raise HTTPException(status_code=400, detail="Public slug already in use")
            project.public_slug = public_slug
        if not project.public_slug:
            project.public_slug = build_public_slug(project, db)
        project_data = coerce_project_data(project)
        pages = project_data.get("pages")
        if isinstance(public_page_id, str) and public_page_id.strip() and isinstance(pages, list):
            matched_page_id = next(
                (
                    page.get("id")
                    for page in pages
                    if isinstance(page, dict) and page.get("id") == public_page_id
                ),
                None,
            )
            if matched_page_id is not None:
                project_data["publicPageId"] = matched_page_id
                project.data = project_data
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
        apply_project_metadata(
            project,
            data,
            db=db,
            owner_id=current_user.id,
            name=name,
            description=description,
        )
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
    apply_project_metadata(
        project,
        data,
        db=db,
        owner_id=current_user.id,
        name=name,
        description=description,
        require_name=True,
    )
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
    project_id: int | None = Query(None, alias="projectId"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    query = db.query(Asset).filter(Asset.owner_id == current_user.id)
    if project_id is not None:
        query = query.filter(Asset.project_id == project_id)
    assets = query.order_by(Asset.created_at.desc()).all()
    return [serialize_asset(asset) for asset in assets]


@app.post("/assets", status_code=201)
def upload_asset(
    file: UploadFile = File(...),
    project_id: str | None = Form(None, alias="projectId"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    project = None
    if project_id:
        if not project_id.isdigit():
            raise HTTPException(status_code=400, detail="Project id must be numeric")
        project = (
            db.query(Project)
            .filter(Project.id == int(project_id), Project.owner_id == current_user.id)
            .first()
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

    stored_name, asset_bytes = build_asset_storage_payload(file)
    destination = UPLOAD_DIR / stored_name
    with destination.open("wb") as buffer:
        buffer.write(asset_bytes)

    asset = Asset(
        owner_id=current_user.id,
        project_id=project.id if project else None,
        url=f"/uploads/{stored_name}",
        filename=file.filename,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return serialize_asset(asset)


def build_asset_storage_payload(file: UploadFile) -> tuple[str, bytes]:
    extension = Path(file.filename).suffix
    file.file.seek(0)
    raw_bytes = file.file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        with Image.open(io.BytesIO(raw_bytes)) as image:
            image.load()
            if image.format not in COMPRESSIBLE_IMAGE_FORMATS:
                return f"{uuid.uuid4().hex}{extension}", raw_bytes

            normalized = ImageOps.exif_transpose(image)
            if normalized.mode == "RGBA":
                background = Image.new("RGB", normalized.size, (0, 0, 0))
                background.paste(normalized, mask=normalized.getchannel("A"))
                normalized = background
            else:
                normalized = normalized.convert("RGB")

            normalized.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            normalized.save(output, format="WEBP", quality=WEBP_QUALITY, method=6)
            return f"{uuid.uuid4().hex}.webp", output.getvalue()
    except OSError:
        return f"{uuid.uuid4().hex}{extension}", raw_bytes


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
    slug = build_unique_project_slug(name, current_user.id, db)
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
    db: Session,
    owner_id: int,
    name: Any | None = None,
    description: Any | None = None,
    require_name: bool = False,
) -> None:
    next_name = None
    if name is not None:
        next_name = validate_project_name(name)
        project.name = next_name
        project.slug = build_unique_project_slug(
            next_name,
            owner_id,
            db,
            exclude_project_id=project.id,
        )
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
    if "backgroundColor" in mutation:
        background_color = mutation.get("backgroundColor")
        if background_color is not None and not isinstance(background_color, str):
            raise HTTPException(status_code=400, detail="Page backgroundColor must be a string")
        updated["backgroundColor"] = (background_color or "").strip()
    if "backgroundImage" in mutation:
        background_image = mutation.get("backgroundImage")
        if background_image is not None and not isinstance(background_image, str):
            raise HTTPException(status_code=400, detail="Page backgroundImage must be a string")
        updated["backgroundImage"] = (background_image or "").strip()
    if "backgroundSize" in mutation:
        background_size = mutation.get("backgroundSize")
        allowed_sizes = {"cover", "contain", "auto"}
        if background_size is not None and (
            not isinstance(background_size, str) or background_size not in allowed_sizes
        ):
            raise HTTPException(status_code=400, detail="Page backgroundSize is invalid")
        updated["backgroundSize"] = background_size or "cover"
    if "backgroundPosition" in mutation:
        background_position = mutation.get("backgroundPosition")
        if background_position is not None and not isinstance(background_position, str):
            raise HTTPException(
                status_code=400, detail="Page backgroundPosition must be a string"
            )
        updated["backgroundPosition"] = (background_position or "center").strip()
    if "backgroundRepeat" in mutation:
        background_repeat = mutation.get("backgroundRepeat")
        allowed_repeat = {"no-repeat", "repeat", "repeat-x", "repeat-y"}
        if background_repeat is not None and (
            not isinstance(background_repeat, str)
            or background_repeat not in allowed_repeat
        ):
            raise HTTPException(status_code=400, detail="Page backgroundRepeat is invalid")
        updated["backgroundRepeat"] = background_repeat or "no-repeat"
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


def is_project_slug_available(
    slug: str,
    owner_id: int,
    db: Session,
    *,
    exclude_project_id: int | None = None,
) -> bool:
    query = db.query(Project).filter(Project.owner_id == owner_id, Project.slug == slug)
    if exclude_project_id is not None:
        query = query.filter(Project.id != exclude_project_id)
    return query.first() is None


def build_unique_project_slug(
    name: str,
    owner_id: int,
    db: Session,
    *,
    exclude_project_id: int | None = None,
) -> str:
    base_slug = build_slug(name)
    candidate = base_slug
    suffix = 1
    while not is_project_slug_available(
        candidate,
        owner_id,
        db,
        exclude_project_id=exclude_project_id,
    ):
        suffix += 1
        candidate = f"{base_slug}-{suffix}"
    return candidate


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
        "projectId": str(asset.project_id) if asset.project_id is not None else None,
        "url": asset.url,
        "filename": asset.filename,
        "createdAt": asset.created_at.isoformat() if asset.created_at else None,
    }


def coerce_project_data(project: Project) -> dict[str, Any]:
    data = project.data
    if isinstance(data, dict):
        return copy.deepcopy(data)
    if isinstance(data, str):
        try:
            parsed = json.loads(data)
        except json.JSONDecodeError:
            return {}
        return copy.deepcopy(parsed) if isinstance(parsed, dict) else {}
    return {}


def ensure_project_analytics(data: dict[str, Any]) -> dict[str, Any]:
    analytics = data.get("analytics")
    if not isinstance(analytics, dict):
        analytics = {}

    summary = analytics.get("summary")
    if not isinstance(summary, dict):
        summary = {}

    by_node = analytics.get("byNode")
    if not isinstance(by_node, dict):
        by_node = {}

    events = analytics.get("events")
    if not isinstance(events, list):
        events = []

    normalized = {
        "summary": {
            "pageViews": int(summary.get("pageViews", 0) or 0),
            "formSubmissions": int(summary.get("formSubmissions", 0) or 0),
            "pollVotes": int(summary.get("pollVotes", 0) or 0),
        },
        "byNode": by_node,
        "events": events[-MAX_ANALYTICS_EVENTS:],
        "updatedAt": analytics.get("updatedAt"),
    }
    data["analytics"] = normalized
    return normalized


def sanitize_event_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    sanitized: dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, (str, int, float, bool)) or value is None:
            sanitized[key] = value
            continue
        if isinstance(value, list):
            sanitized[key] = [
                entry
                for entry in value
                if isinstance(entry, (str, int, float, bool)) or entry is None
            ][:30]
    return sanitized


def append_project_event(project: Project, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = coerce_project_data(project)
    analytics = ensure_project_analytics(data)
    timestamp = datetime.now(timezone.utc).isoformat()
    node_id = str(payload.get("nodeId") or "unknown")

    if event_type == "page_view":
        analytics["summary"]["pageViews"] = int(analytics["summary"]["pageViews"]) + 1
    elif event_type == "form_submit":
        analytics["summary"]["formSubmissions"] = int(analytics["summary"]["formSubmissions"]) + 1
    elif event_type == "poll_vote":
        analytics["summary"]["pollVotes"] = int(analytics["summary"]["pollVotes"]) + 1
    else:
        raise HTTPException(status_code=400, detail="Unsupported analytics event type")

    by_node = analytics["byNode"]
    node_entry = by_node.get(node_id)
    if not isinstance(node_entry, dict):
        node_entry = {}
    node_entry["type"] = payload.get("nodeType", node_entry.get("type") or "unknown")
    node_entry["name"] = payload.get("nodeName", node_entry.get("name") or "Untitled node")
    node_entry["views"] = int(node_entry.get("views", 0) or 0)
    node_entry["submissions"] = int(node_entry.get("submissions", 0) or 0)
    node_entry["votes"] = int(node_entry.get("votes", 0) or 0)
    if event_type == "page_view":
        node_entry["views"] += 1
    elif event_type == "form_submit":
        node_entry["submissions"] += 1
    elif event_type == "poll_vote":
        node_entry["votes"] += 1
    by_node[node_id] = node_entry

    events = analytics["events"]
    events.append(
        {
            "id": uuid.uuid4().hex,
            "eventType": event_type,
            "createdAt": timestamp,
            "nodeId": node_id,
            "nodeType": payload.get("nodeType"),
            "nodeName": payload.get("nodeName"),
            "payload": sanitize_event_payload(payload),
        }
    )
    analytics["events"] = events[-MAX_ANALYTICS_EVENTS:]
    analytics["updatedAt"] = timestamp
    project.data = data
    return analytics


def serialize_analytics(project: Project) -> dict[str, Any]:
    data = coerce_project_data(project)
    analytics = ensure_project_analytics(data)
    by_node = analytics.get("byNode")
    sorted_nodes = []
    if isinstance(by_node, dict):
        sorted_nodes = sorted(
            [
                {
                    "nodeId": node_id,
                    "type": entry.get("type"),
                    "name": entry.get("name"),
                    "views": int(entry.get("views", 0) or 0),
                    "submissions": int(entry.get("submissions", 0) or 0),
                    "votes": int(entry.get("votes", 0) or 0),
                }
                for node_id, entry in by_node.items()
                if isinstance(entry, dict)
            ],
            key=lambda item: item["views"] + item["submissions"] + item["votes"],
            reverse=True,
        )
    return {
        "summary": analytics.get("summary", {}),
        "byNode": sorted_nodes,
        "updatedAt": analytics.get("updatedAt"),
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


@app.get("/projects/validate-name")
def validate_project_name_endpoint(
    name: str = Query(...),
    project_id: int | None = Query(None, alias="projectId"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    normalized = validate_project_name(name)
    if project_id is not None:
        project = (
            db.query(Project)
            .filter(Project.id == project_id, Project.owner_id == current_user.id)
            .first()
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
    slug = build_slug(normalized)
    return {
        "name": normalized,
        "slug": slug,
        "available": is_project_slug_available(
            slug,
            current_user.id,
            db,
            exclude_project_id=project_id,
        ),
    }


@app.get("/api/public/{slug}")
def get_public_project(
    slug: str, response: Response, db: Session = Depends(get_db)
) -> dict[str, Any]:
    project = (
        db.query(Project)
        .filter(Project.public_slug == slug, Project.is_published.is_(True))
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    response.headers.update(no_cache_headers())
    return serialize_project(project)


@app.post("/api/public/{slug}/events")
def track_public_project_event(
    slug: str,
    response: Response,
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = (
        db.query(Project)
        .filter(Project.public_slug == slug, Project.is_published.is_(True))
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    event_type = str(payload.get("eventType") or "").strip().lower()
    analytics = append_project_event(project, event_type, payload)
    db.commit()
    response.headers.update(no_cache_headers())
    return {
        "ok": True,
        "summary": analytics.get("summary", {}),
        "updatedAt": analytics.get("updatedAt"),
    }


@app.get("/projects/{project_id}/analytics")
def get_project_analytics(
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
    return serialize_analytics(project)


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
        return serve_index_file()
    raise HTTPException(status_code=404, detail="Public site not available")


@app.get("/{slug}", response_model=None)
def public_slug_site(slug: str) -> FileResponse:
    if is_reserved_public_slug(slug):
        raise HTTPException(status_code=404, detail="Public site not available")
    if INDEX_FILE.exists():
        return serve_index_file()
    raise HTTPException(status_code=404, detail="Public site not available")


app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
