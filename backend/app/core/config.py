import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TFG Backend API"
    API_V1_STR: str = "/api/v1"

    # Firebase
    FIREBASE_PROJECT_ID: str = "epi-devorapp"
    FIREBASE_API_KEY: str = ""
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "firebase-service-account.json"

    # Google Maps & OAuth
    GOOGLE_API_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""

    # PostgreSQL (SQLAlchemy)
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/tfg_db"

    # Microservicio IA (Keras)
    KERAS_API_URL: str = "http://127.0.0.1:8001/predict"

    # Test helpers
    SKIP_EMAIL_VERIFICATION: bool = False

    # JWT
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY", "CAMBIA_ESTO_EN_PRODUCCION_usa_openssl_rand_hex_32"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
