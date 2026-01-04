from typing import Any

from fastapi import Body, Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from database import get_db, init_db
from models import Project

app = FastAPI()


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/")
def root() -> dict:
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
