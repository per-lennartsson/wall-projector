import hashlib
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import ImageNail, Project, ProjectImage, User
from ..normalize import normalize_state
from ..schemas import (
    Background,
    Defaults,
    Frame,
    Grid,
    ImageState,
    ImportResult,
    Keystone,
    Nail,
    NailGlobal,
    ProjectCreate,
    ProjectRename,
    ProjectState,
    ProjectSummary,
    Ruler,
    Wall,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])

# Without a cap, a single free account could create unlimited projects (each
# carrying up to 200 images at ~11MB apiece — see schemas.ImageState) and
# exhaust the database. Generous enough for any real usage.
MAX_PROJECTS_PER_USER = 100


async def _check_project_quota(db: AsyncSession, user: User, *, additional: int = 1) -> None:
    count = await db.scalar(select(func.count()).select_from(Project).where(Project.user_id == user.id))
    if (count or 0) + additional > MAX_PROJECTS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project limit reached (max {MAX_PROJECTS_PER_USER} per account)",
        )


async def _get_owned_project(db: AsyncSession, project_id: uuid.UUID, user: User) -> Project:
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.images).selectinload(ProjectImage.nails))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _project_to_state(project: Project) -> ProjectState:
    return ProjectState(
        wall=Wall(width=float(project.wall_width), height=float(project.wall_height), unit=project.wall_unit),
        images=[
            ImageState(
                id=im.local_id,
                src=im.src,
                name=im.name,
                xPct=float(im.x_pct),
                yPct=float(im.y_pct),
                wPct=float(im.w_pct),
                hPct=float(im.h_pct),
                rotation=float(im.rotation),
                naturalW=float(im.natural_w),
                naturalH=float(im.natural_h),
                aspectLocked=im.aspect_locked,
                crop=im.crop,
                snapToGrid=im.snap_to_grid,
                frame=Frame(enabled=im.frame_enabled, color=im.frame_color, width=float(im.frame_width)),
                nails=[Nail(xCm=float(n.x_cm), yCm=float(n.y_cm)) for n in im.nails],
            )
            for im in project.images
        ],
        ruler=Ruler(length=float(project.ruler_length), visible=project.ruler_visible, color=project.ruler_color),
        background=Background(enabled=project.bg_enabled, color=project.bg_color, projectToo=project.bg_project_too),
        defaults=Defaults(
            imageWidth=float(project.default_image_width),
            frameEnabled=project.default_frame_enabled,
            frameColor=project.default_frame_color,
            frameWidth=float(project.default_frame_width),
        ),
        grid=Grid(enabled=project.grid_enabled, size=float(project.grid_size), projectToo=project.grid_project_too),
        nail=NailGlobal(enabled=project.nail_enabled, color=project.nail_color, size=float(project.nail_size)),
        keystone=Keystone(
            enabled=project.keystone_enabled,
            vertical=float(project.keystone_vertical),
            horizontal=float(project.keystone_horizontal),
        ),
    )


def _apply_state_to_project(project: Project, state: ProjectState) -> None:
    project.wall_width = state.wall.width
    project.wall_height = state.wall.height
    project.wall_unit = state.wall.unit

    project.ruler_length = state.ruler.length
    project.ruler_visible = state.ruler.visible
    project.ruler_color = state.ruler.color

    project.bg_enabled = state.background.enabled
    project.bg_color = state.background.color
    project.bg_project_too = state.background.projectToo

    project.default_image_width = state.defaults.imageWidth
    project.default_frame_enabled = state.defaults.frameEnabled
    project.default_frame_color = state.defaults.frameColor
    project.default_frame_width = state.defaults.frameWidth

    project.grid_enabled = state.grid.enabled
    project.grid_size = state.grid.size
    project.grid_project_too = state.grid.projectToo

    project.nail_enabled = state.nail.enabled
    project.nail_color = state.nail.color
    project.nail_size = state.nail.size

    project.keystone_enabled = state.keystone.enabled
    project.keystone_vertical = state.keystone.vertical
    project.keystone_horizontal = state.keystone.horizontal

    # Whole-state replace-images-and-nails, mirroring how the local-mode
    # localStorage path already works (a full `state` write per save, no
    # diffing) — simplest correct approach given saves are whole-state.
    project.images.clear()
    for sort_order, im in enumerate(state.images):
        project.images.append(
            ProjectImage(
                local_id=im.id,
                name=im.name,
                src=im.src,
                content_hash=hashlib.sha256(im.src.encode()).hexdigest(),
                x_pct=im.xPct,
                y_pct=im.yPct,
                w_pct=im.wPct,
                h_pct=im.hPct,
                rotation=im.rotation,
                natural_w=im.naturalW,
                natural_h=im.naturalH,
                frame_enabled=im.frame.enabled,
                frame_color=im.frame.color,
                frame_width=im.frame.width,
                aspect_locked=im.aspectLocked,
                crop=im.crop,
                snap_to_grid=im.snapToGrid,
                sort_order=sort_order,
                nails=[ImageNail(x_cm=n.xCm, y_cm=n.yCm, sort_order=i) for i, n in enumerate(im.nails)],
            )
        )


def _default_project(user_id: uuid.UUID, name: str) -> Project:
    return Project(user_id=user_id, name=name)


@router.get("", response_model=list[ProjectSummary])
async def list_projects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.user_id == user.id).order_by(Project.updated_at.desc()))
    return [ProjectSummary(id=p.id, name=p.name, updated_at=p.updated_at) for p in result.scalars().all()]


@router.post("", response_model=ProjectSummary, status_code=status.HTTP_201_CREATED)
async def create_project(body: ProjectCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _check_project_quota(db, user)
    project = _default_project(user.id, body.name)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectSummary(id=project.id, name=project.name, updated_at=project.updated_at)


@router.get("/{project_id}", response_model=ProjectState)
async def get_project(project_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await _get_owned_project(db, project_id, user)
    return _project_to_state(project)


@router.put("/{project_id}", response_model=ProjectState)
async def put_project(
    project_id: uuid.UUID,
    body: ProjectState,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_owned_project(db, project_id, user)
    _apply_state_to_project(project, body)
    await db.commit()
    project = await _get_owned_project(db, project_id, user)
    return _project_to_state(project)


@router.patch("/{project_id}", response_model=ProjectSummary)
async def rename_project(
    project_id: uuid.UUID,
    body: ProjectRename,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_owned_project(db, project_id, user)
    project.name = body.name
    await db.commit()
    await db.refresh(project)
    return ProjectSummary(id=project.id, name=project.name, updated_at=project.updated_at)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await _get_owned_project(db, project_id, user)
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/export", response_model=ProjectState)
async def export_project(project_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await _get_owned_project(db, project_id, user)
    return _project_to_state(project)


@router.post("/import", response_model=ImportResult)
async def import_projects(body: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Mirrors the frontend's importProjectFromFile(): accepts either a single
    # ProjectState, or a {type:'wall-projector-workspaces', workspaces:[...]}
    # bundle (one project created per entry). `body` is a raw dict (not a
    # typed schema) precisely so malformed/legacy shapes can be normalized
    # below rather than rejected outright — so every field pulled off it here
    # must be validated first, or a crafted bundle (e.g. a workspace entry
    # that isn't a dict, or is missing "state") throws an unhandled 500
    # instead of a clean 400.
    bad_bundle = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No workspaces in bundle")
    entries: list[tuple[str, dict]]
    if isinstance(body, dict) and body.get("type") == "wall-projector-workspaces":
        workspaces = body.get("workspaces")
        if not isinstance(workspaces, list) or not workspaces:
            raise bad_bundle
        entries = []
        for w in workspaces:
            if not isinstance(w, dict) or not isinstance(w.get("state"), dict):
                raise bad_bundle
            name = w.get("name")
            entries.append((name if isinstance(name, str) and name else "Imported", w["state"]))
    else:
        entries = [("Imported", body)]

    # Cap how many projects one import call can create, both to keep this
    # bounded work and so it composes with the per-user project quota below.
    if len(entries) > 50:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Too many workspaces in one import (max 50)")
    await _check_project_quota(db, user, additional=len(entries))

    created_ids: list[uuid.UUID] = []
    for name, raw_state in entries:
        try:
            state = ProjectState.model_validate(normalize_state(raw_state))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid project state: {exc}")
        project = _default_project(user.id, name)
        _apply_state_to_project(project, state)
        db.add(project)
        await db.flush()
        created_ids.append(project.id)
    await db.commit()
    return ImportResult(project_ids=created_ids)
