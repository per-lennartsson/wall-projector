from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://wallprojector:wallprojector@postgres:5432/wallprojector"
    # No default: a guessable secret lets anyone forge an access token for any
    # user id. Must be set via the JWT_SECRET env var (see .env.example) —
    # startup fails otherwise, which is intentional.
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    cors_origins: list[str] = ["http://localhost:5173"]
    # Browsers silently drop a Set-Cookie with Secure over a plain-http origin
    # (no TLS termination in front). Defaults True for real deployments behind
    # HTTPS; docker-compose.web.yml (no TLS, port 8081) overrides to False.
    cookie_secure: bool = True


settings = Settings()
