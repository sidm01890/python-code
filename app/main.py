"""
FastAPI Reconcii Admin Backend Application
Main application entry point
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
import asyncio
from dotenv import load_dotenv
from app.config.database import create_engines, test_connections
from app.workers.tasks import run_scheduled_tasks

# Load environment variables
load_dotenv()

# Import models to ensure they are registered with SQLAlchemy
# This must be done after database configuration is set up
from app.models.sso import (
    UserDetails, Organization, Tool, Module, Group, Permission, 
    AuditLog, Upload, OrganizationTool, GroupModuleMapping, UserModuleMapping,
    # Sheet Data Models (now in SSO for compatibility)
    ZomatoPosVs3poData, Zomato3poVsPosData, Zomato3poVsPosRefundData,
    OrdersNotInPosData, OrdersNotIn3poData,
    # Reconciliation Models (now in SSO for compatibility)
    ZomatoVsPosSummary, ThreepoDashboard, Store, Trm
)
from app.models.main import (
    # Main database models
    Orders, UploadRecord
)

# Import routes
from app.routes import auth, users, organizations, tools, modules, groups, permissions, audit_log, reconciliation, uploader, sheet_data

# Create FastAPI application
app = FastAPI(
    title="Reconcii Admin API",
    description="API documentation for Reconcii Admin Backend",
    version="1.0.0",
    docs_url="/api-docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"message": "Internal server error", "detail": str(exc)}
    )

# Startup event
@app.on_event("startup")
async def startup_event():
    """Application startup tasks"""
    try:
        # Create database engines
        await create_engines()
        
        # Test database connections
        await test_connections()
        
        print("✅ Database connections established successfully")
        print("✅ Application startup completed")
        
    except Exception as e:
        print(f"❌ Application startup failed: {e}")
        raise

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Reconcii Admin API is running"}

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/user", tags=["Users"])
app.include_router(organizations.router, prefix="/api/organization", tags=["Organizations"])
app.include_router(tools.router, prefix="/api/tool", tags=["Tools"])
app.include_router(modules.router, prefix="/api/module", tags=["Modules"])
app.include_router(groups.router, prefix="/api/group", tags=["Groups"])
app.include_router(permissions.router, prefix="/api/permission", tags=["Permissions"])
app.include_router(audit_log.router, prefix="/api/audit_log", tags=["Audit Logs"])
app.include_router(reconciliation.router, prefix="/api/node/reconciliation", tags=["Reconciliation"])
app.include_router(uploader.router, prefix="/api/uploader", tags=["File Upload"])
app.include_router(sheet_data.router, prefix="/api/sheetData", tags=["Sheet Data"])

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8034))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
