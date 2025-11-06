"""
Application settings and configuration
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os
from urllib.parse import quote_plus


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    app_name: str = "Reconcii Admin API"
    debug: bool = False
    environment: str = "development"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8034
    
    # JWT Configuration
    jwt_secret: str = "your-default-jwt-secret-key-for-development"
    jwt_algorithm: str = "HS256"
    jwt_expires_in: str = "24h"
    
    # Encryption
    secret_key: str = "your-secret-key"
    iv: str = "your-iv-key"
    
    # Database - SSO (Authentication)
    sso_db_host: str = "localhost"
    sso_db_user: str = "root"
    sso_db_password: str = "NewStrongPassword123!"
    sso_db_name: str = "devyani_sso"
    sso_db_port: int = 3306
    
    # Database - Main (Application Data)
    main_db_host: str = "localhost"
    main_db_user: str = "root"
    main_db_password: str = "NewStrongPassword123!"
    main_db_name: str = "devyani"
    main_db_port: int = 3306
    
    # Production Database (AWS RDS)
    production_sso_db_host: str = "coreco-mysql.cpzxmgfkrh6g.ap-south-1.rds.amazonaws.com"
    production_sso_db_user: str = "admin"
    production_sso_db_password: str = "One4the$#"
    production_sso_db_name: str = "devyani_sso"
    
    production_main_db_host: str = "coreco-mysql.cpzxmgfkrh6g.ap-south-1.rds.amazonaws.com"
    production_main_db_user: str = "admin"
    production_main_db_password: str = "One4the$#"
    production_main_db_name: str = "devyani"
    
    # Database Pool Settings
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_timeout: int = 30
    db_pool_recycle: int = 3600
    
    # Organization & Tool IDs
    organization_id: int = 1
    tool_id: int = 1
    
    # Email Configuration
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    
    # Redis Configuration (for background tasks)
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    
    # Task Executor Configuration (for parallel processing)
    task_executor_workers: int = 10  # Number of worker threads for background tasks
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Create settings instance
settings = Settings()

# Database URLs
def get_database_urls():
    """Get database URLs based on environment"""
    if settings.environment == "production":
        sso_user = quote_plus(settings.production_sso_db_user)
        sso_pass = quote_plus(settings.production_sso_db_password)
        main_user = quote_plus(settings.production_main_db_user)
        main_pass = quote_plus(settings.production_main_db_password)
        sso_url = (
            f"mysql+aiomysql://{sso_user}:{sso_pass}"
            f"@{settings.production_sso_db_host}:{settings.sso_db_port}/{settings.production_sso_db_name}"
        )
        main_url = (
            f"mysql+aiomysql://{main_user}:{main_pass}"
            f"@{settings.production_main_db_host}:{settings.main_db_port}/{settings.production_main_db_name}"
        )
    else:
        sso_user = quote_plus(settings.sso_db_user)
        sso_pass = quote_plus(settings.sso_db_password)
        main_user = quote_plus(settings.main_db_user)
        main_pass = quote_plus(settings.main_db_password)
        sso_url = (
            f"mysql+aiomysql://{sso_user}:{sso_pass}"
            f"@{settings.sso_db_host}:{settings.sso_db_port}/{settings.sso_db_name}"
        )
        main_url = (
            f"mysql+aiomysql://{main_user}:{main_pass}"
            f"@{settings.main_db_host}:{settings.main_db_port}/{settings.main_db_name}"
        )
    
    return sso_url, main_url
