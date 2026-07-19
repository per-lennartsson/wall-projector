from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from ..database import get_db
from ..deps import get_current_user
from ..models import RefreshToken, User
from ..schemas import LoginRequest, SignupRequest, TokenResponse, UserOut
from ..security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api/auth",
        max_age=60 * 60 * 24 * 30,
    )


async def _issue_tokens(db: AsyncSession, user: User, response: Response) -> TokenResponse:
    raw_refresh = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=refresh_token_expiry(),
        )
    )
    await db.commit()
    _set_refresh_cookie(response, raw_refresh)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/signup", response_model=TokenResponse)
async def signup(body: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    # bcrypt hashing is ~100ms of CPU; run off the event loop so one signup
    # doesn't stall every other request being served by this worker.
    password_hash = await run_in_threadpool(hash_password, body.password)
    user = User(email=body.email, password_hash=password_hash)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await _issue_tokens(db, user, response)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    # Always verify against *some* hash (a fixed dummy one when there's no
    # matching account) so this takes the same ~100ms either way — otherwise
    # the "no such user" path returns near-instantly and the timing gap
    # itself reveals which emails are registered. Also run off the event
    # loop since bcrypt verification blocks the whole process otherwise.
    hash_to_check = user.password_hash if user and user.password_hash else DUMMY_PASSWORD_HASH
    password_ok = await run_in_threadpool(verify_password, body.password, hash_to_check)
    if user is None or not user.password_hash or not password_ok:
        raise invalid
    return await _issue_tokens(db, user, response)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
):
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if not refresh_token:
        raise unauthorized
    token_hash = hash_refresh_token(refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()
    if stored is None:
        raise unauthorized
    if stored.revoked_at is not None:
        # This token was already rotated away — replaying it means either a
        # client bug or a stolen token being used after the legitimate
        # client already refreshed. Can't tell which, so treat it as theft:
        # kill every refresh token for this user, forcing a fresh login.
        now = datetime.now(timezone.utc)
        active = await db.execute(
            select(RefreshToken).where(RefreshToken.user_id == stored.user_id, RefreshToken.revoked_at.is_(None))
        )
        for token in active.scalars().all():
            token.revoked_at = now
        await db.commit()
        raise unauthorized
    if stored.expires_at < datetime.now(timezone.utc):
        raise unauthorized
    stored.revoked_at = datetime.now(timezone.utc)
    user = await db.get(User, stored.user_id)
    if user is None:
        raise unauthorized
    return await _issue_tokens(db, user, response)


@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
):
    if refresh_token:
        token_hash = hash_refresh_token(refresh_token)
        result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        stored = result.scalar_one_or_none()
        if stored is not None and stored.revoked_at is None:
            stored.revoked_at = datetime.now(timezone.utc)
            await db.commit()
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/auth")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, email=user.email)
