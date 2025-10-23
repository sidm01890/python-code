"""
File uploader routes - converted from Node.js
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.config.database import get_sso_db
from app.middleware.auth import get_current_user
from app.models.main.upload_record import UploadRecord
from app.models.sso.user_details import UserDetails
from pydantic import BaseModel
from typing import List, Optional
import os
import uuid
import logging
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

# Valid upload types
VALID_TYPES = [
    "orders",
    "transactions", 
    "reconciliation",
    "trm",
    "mpr_hdfc_card",
    "mpr_hdfc_upi",
    "pizzahut_orders"
]

# Allowed file extensions
ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv", ".tsv"]

# Maximum file size (400MB)
MAX_FILE_SIZE = 400 * 1024 * 1024


class UploadResponse(BaseModel):
    id: int
    filename: str
    status: str
    message: str


class UploadStatusResponse(BaseModel):
    id: int
    filename: str
    status: str
    message: str
    filetype: str
    filesize: int
    upload_type: str
    created_at: str
    updated_at: str
    processed_data: Optional[str] = None


@router.post("/upload")
async def upload_files(
    type: str = Form(...),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Upload multiple files - converted from Node.js"""
    try:
        if not type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Type is required"
            )
        
        # Validate upload type
        if type not in VALID_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid type. Must be one of: {', '.join(VALID_TYPES)}"
            )
        
        if not files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No files uploaded"
            )
        
        uploaded_files = []
        processing_jobs = []
        
        # Create uploads directory if it doesn't exist
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Process each uploaded file
        for file in files:
            try:
                # Validate file
                if not file.filename:
                    continue
                
                # Check file extension
                file_ext = os.path.splitext(file.filename)[1].lower()
                if file_ext not in ALLOWED_EXTENSIONS:
                    uploaded_files.append({
                        "filename": file.filename,
                        "status": "error",
                        "message": f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
                    })
                    continue
                
                # Check file size
                file_content = await file.read()
                if len(file_content) > MAX_FILE_SIZE:
                    uploaded_files.append({
                        "filename": file.filename,
                        "status": "error",
                        "message": f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
                    })
                    continue
                
                # Generate unique filename
                unique_filename = f"{uuid.uuid4()}_{file.filename}"
                file_path = os.path.join(upload_dir, unique_filename)
                
                # Save file
                with open(file_path, "wb") as f:
                    f.write(file_content)
                
                # Create upload record in database
                upload_record = await UploadRecord.create(db,
                    filename=file.filename,
                    filepath=file_path,
                    filesize=len(file_content),
                    filetype=file_ext,
                    upload_type=type,
                    status="uploaded",
                    message="File uploaded successfully, processing in background"
                )
                
                uploaded_files.append({
                    "id": upload_record.id,
                    "filename": file.filename,
                    "status": "uploaded",
                    "message": "File uploaded successfully, processing in background"
                })
                
                processing_jobs.append(upload_record.id)
                
                # Start background processing
                import asyncio
                from app.workers.tasks import process_upload_file
                
                # Start background task
                asyncio.create_task(process_upload_file(upload_record.id, file_path, type))
                
            except Exception as file_error:
                logger.error(f"Error processing file {file.filename}: {file_error}")
                uploaded_files.append({
                    "filename": file.filename,
                    "status": "error",
                    "message": str(file_error)
                })
        
        return {
            "success": True,
            "message": "Files uploaded successfully",
            "data": {
                "uploadedFiles": uploaded_files,
                "processingJobs": processing_jobs,
                "totalFiles": len(files)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/status/{upload_id}")
async def get_upload_status(
    upload_id: int,
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Get upload status - converted from Node.js"""
    try:
        upload_record = await UploadRecord.get_by_id(db, upload_id)
        
        if not upload_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload record not found"
            )
        
        return {
            "success": True,
            "data": {
                "id": upload_record.id,
                "filename": upload_record.filename,
                "status": upload_record.status,
                "message": upload_record.message,
                "filetype": upload_record.filetype,
                "filesize": upload_record.filesize,
                "upload_type": upload_record.upload_type,
                "created_at": upload_record.created_at.isoformat() if upload_record.created_at else None,
                "updated_at": upload_record.updated_at.isoformat() if upload_record.updated_at else None,
                "processed_data": upload_record.processed_data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get upload status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/uploads")
async def get_all_uploads(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Get all uploads with pagination - converted from Node.js"""
    try:
        uploads, total_count = await UploadRecord.get_all_with_pagination(
            db, page, limit, status, type
        )
        
        # Format response
        upload_list = []
        for upload in uploads:
            upload_list.append({
                "id": upload.id,
                "filename": upload.filename,
                "filepath": upload.filepath,
                "filesize": upload.filesize,
                "filetype": upload.filetype,
                "upload_type": upload.upload_type,
                "status": upload.status,
                "message": upload.message,
                "processed_data": upload.processed_data,
                "created_at": upload.created_at.isoformat() if upload.created_at else None,
                "updated_at": upload.updated_at.isoformat() if upload.updated_at else None
            })
        
        return {
            "success": True,
            "data": {
                "uploads": upload_list,
                "pagination": {
                    "currentPage": page,
                    "totalPages": (total_count + limit - 1) // limit,
                    "totalItems": total_count,
                    "itemsPerPage": limit
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Get all uploads error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete("/uploads/{upload_id}")
async def delete_upload(
    upload_id: int,
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Delete upload - converted from Node.js"""
    try:
        upload_record = await UploadRecord.get_by_id(db, upload_id)
        
        if not upload_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload record not found"
            )
        
        # Delete the physical file
        if os.path.exists(upload_record.filepath):
            try:
                os.unlink(upload_record.filepath)
            except OSError as e:
                logger.warning(f"Could not delete file {upload_record.filepath}: {e}")
        
        # Delete from database
        await UploadRecord.delete(db, upload_id)
        
        return {
            "success": True,
            "message": "Upload deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )