from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import auth, images, projects

app = FastAPI(title="Wall Projector API")

# Only needed for the Vite dev server origin — in production the browser
# only ever talks to nginx (which proxies /api/ to this service), so no
# cross-origin requests happen and this middleware is inert.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(images.router)


@app.get("/api/health")
async def health():
    return {"ok": True}
