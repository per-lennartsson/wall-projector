import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    # Extension points for a later OAuth/magic-link phase — nullable so a
    # password-only user today never needs these, and a future OAuth-only
    # user can exist without a password_hash.
    auth_provider: Mapped[str] = mapped_column(String, default="password", server_default="password")
    provider_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    projects: Mapped[list["Project"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)

    wall_width: Mapped[float] = mapped_column(Numeric, default=300)
    wall_height: Mapped[float] = mapped_column(Numeric, default=200)
    wall_unit: Mapped[str] = mapped_column(String, default="cm")

    ruler_length: Mapped[float] = mapped_column(Numeric, default=100)
    ruler_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    ruler_color: Mapped[str] = mapped_column(String, default="#ffcc00")

    bg_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    bg_color: Mapped[str] = mapped_column(String, default="#2a2a2a")
    bg_project_too: Mapped[bool] = mapped_column(Boolean, default=False)

    default_image_width: Mapped[float] = mapped_column(Numeric, default=30)
    default_frame_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    default_frame_color: Mapped[str] = mapped_column(String, default="black")
    default_frame_width: Mapped[float] = mapped_column(Numeric, default=3)

    grid_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    grid_size: Mapped[float] = mapped_column(Numeric, default=20)
    grid_project_too: Mapped[bool] = mapped_column(Boolean, default=False)

    nail_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    nail_color: Mapped[str] = mapped_column(String, default="#ff3b3b")
    nail_size: Mapped[float] = mapped_column(Numeric, default=10)

    keystone_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    keystone_vertical: Mapped[float] = mapped_column(Numeric, default=0)
    keystone_horizontal: Mapped[float] = mapped_column(Numeric, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="projects")
    images: Mapped[list["ProjectImage"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="ProjectImage.sort_order"
    )


class ProjectImage(Base):
    __tablename__ = "images"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    # The frontend's ImageState.id is a small per-project integer counter
    # (used for React keys/selection, not a UUID) — stored here verbatim so
    # the API can round-trip the exact same JSON shape the local-mode
    # localStorage path already produces, with no frontend changes needed.
    local_id: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String, default="")
    src: Mapped[str] = mapped_column(Text, nullable=False)
    # sha256(src), computed at write time (see routers/projects.py) — lets the
    # image-library endpoint dedupe the same photo reused across a user's
    # projects without hashing the (potentially multi-MB) src on every read.
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    x_pct: Mapped[float] = mapped_column(Numeric, default=0)
    y_pct: Mapped[float] = mapped_column(Numeric, default=0)
    w_pct: Mapped[float] = mapped_column(Numeric, default=10)
    h_pct: Mapped[float] = mapped_column(Numeric, default=10)
    rotation: Mapped[float] = mapped_column(Numeric, default=0)
    natural_w: Mapped[float] = mapped_column(Numeric, default=0)
    natural_h: Mapped[float] = mapped_column(Numeric, default=0)

    frame_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    frame_color: Mapped[str] = mapped_column(String, default="black")
    frame_width: Mapped[float] = mapped_column(Numeric, default=3)

    aspect_locked: Mapped[bool] = mapped_column(Boolean, default=True)
    crop: Mapped[bool] = mapped_column(Boolean, default=False)
    snap_to_grid: Mapped[bool] = mapped_column(Boolean, default=False)

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    project: Mapped["Project"] = relationship(back_populates="images")
    nails: Mapped[list["ImageNail"]] = relationship(
        back_populates="image", cascade="all, delete-orphan", order_by="ImageNail.sort_order"
    )


class ImageNail(Base):
    __tablename__ = "nails"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("images.id", ondelete="CASCADE"), index=True)
    x_cm: Mapped[float] = mapped_column(Numeric, default=0)
    y_cm: Mapped[float] = mapped_column(Numeric, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    image: Mapped["ProjectImage"] = relationship(back_populates="nails")
