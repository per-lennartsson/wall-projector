from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user
from ..models import Project, ProjectImage, User
from ..schemas import LibraryImageOut

router = APIRouter(prefix="/api/images", tags=["images"])

# Own prefix (not nested under /api/projects) so there's no route-ordering
# ambiguity with GET /api/projects/{project_id}.
#
# No object storage/thumbnailing pipeline exists (images are base64 `src` in
# the DB — see CLAUDE.md), so this endpoint returns full-resolution images
# same as everywhere else in the app. SCAN_LIMIT/RESULT_LIMIT bound both the
# DB work and the response size in lieu of real pagination or thumbnails.
SCAN_LIMIT = 1000
RESULT_LIMIT = 48


@router.get("", response_model=list[LibraryImageOut])
async def list_image_library(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProjectImage)
        .join(Project)
        .where(Project.user_id == user.id)
        .order_by(ProjectImage.updated_at.desc())
        .limit(SCAN_LIMIT)
    )
    # Dedupe by content_hash, keeping the most recent occurrence (rows are
    # already ordered newest-first, so "first seen" == "most recent").
    seen: dict[str, ProjectImage] = {}
    for im in result.scalars():
        if im.content_hash in seen:
            continue
        seen[im.content_hash] = im
        if len(seen) >= RESULT_LIMIT:
            break
    return [
        LibraryImageOut(id=im.content_hash, src=im.src, name=im.name, naturalW=float(im.natural_w), naturalH=float(im.natural_h))
        for im in seen.values()
    ]
