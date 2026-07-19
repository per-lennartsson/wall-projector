import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

FrameColor = Literal["light-wood", "dark-wood", "black", "white"]
WallUnit = Literal["cm", "m", "in", "px"]


# ---------- auth ----------
class SignupRequest(BaseModel):
    email: EmailStr
    # bcrypt silently truncates at 72 bytes — capping input length avoids a
    # false sense of security from a longer password that's actually
    # ignored past that point.
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: uuid.UUID
    email: str


# ---------- project state (matches the frontend's WallProjectState/ImageState shape) ----------
class Nail(BaseModel):
    xCm: float
    yCm: float


class Frame(BaseModel):
    enabled: bool
    color: FrameColor
    width: float


class ImageState(BaseModel):
    id: int
    # Images are stored as base64 data URLs (no object storage — see
    # CLAUDE.md), so this field is the actual photo bytes; capping it
    # (~11MB decoded) and the list lengths below stops a single project from
    # growing unboundedly and exhausting the database.
    src: str = Field(max_length=15_000_000)
    name: str = Field(max_length=500)
    xPct: float
    yPct: float
    wPct: float
    hPct: float
    rotation: float
    naturalW: float
    naturalH: float
    aspectLocked: bool
    crop: bool
    snapToGrid: bool
    frame: Frame
    nails: list[Nail] = Field(max_length=20)


class Wall(BaseModel):
    width: float
    height: float
    unit: WallUnit


class Ruler(BaseModel):
    length: float
    visible: bool
    color: str


class Background(BaseModel):
    enabled: bool
    color: str
    projectToo: bool


class Defaults(BaseModel):
    imageWidth: float
    frameEnabled: bool
    frameColor: FrameColor
    frameWidth: float


class Grid(BaseModel):
    enabled: bool
    size: float
    projectToo: bool


class NailGlobal(BaseModel):
    enabled: bool
    color: str
    size: float


class Keystone(BaseModel):
    enabled: bool
    vertical: float
    horizontal: float


class ProjectState(BaseModel):
    wall: Wall
    images: list[ImageState] = Field(max_length=200)
    ruler: Ruler
    background: Background
    defaults: Defaults
    grid: Grid
    nail: NailGlobal
    keystone: Keystone


class ProjectSummary(BaseModel):
    id: uuid.UUID
    name: str
    updated_at: datetime


class ProjectCreate(BaseModel):
    name: str


class ProjectRename(BaseModel):
    name: str


class WorkspaceBundleEntry(BaseModel):
    name: str
    state: ProjectState


class WorkspaceBundle(BaseModel):
    type: Literal["wall-projector-workspaces"]
    workspaces: list[WorkspaceBundleEntry]


class ImportResult(BaseModel):
    project_ids: list[uuid.UUID]


class LibraryImageOut(BaseModel):
    id: str  # content_hash
    src: str
    name: str
    naturalW: float
    naturalH: float
