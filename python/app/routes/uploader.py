"""
File uploader routes
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.config.database import get_sso_db, get_main_db
from app.middleware.auth import get_current_user
from app.models.main.upload_record import UploadRecord
from app.models.sso.user_details import UserDetails
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import uuid
import logging
from datetime import datetime
import httpx
import asyncio

router = APIRouter()
logger = logging.getLogger(__name__)

# FeynmanFlow API configuration - configurable via environment variable
FEYNMANFLOW_API_BASE_URL = os.getenv("FEYNMANFLOW_API_URL", "http://0.0.0.0:8000")
FEYNMANFLOW_UPLOAD_ENDPOINT = "/upload/vector-match-excel"
DEFAULT_CHUNK_SIZE = 1000

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
    request: Request,
    background_tasks: BackgroundTasks,
    type: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    datasource: Optional[str] = Query(None),
    client: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """
    Upload multiple files
    
    If datasource query parameter is provided, proxies request to FeynmanFlow-finance-0.1 API.
    Otherwise, uses the original Node.js upload logic with type parameter.
    
    For datasource uploads: Accepts files, returns 200 immediately, processes in background.
    """
    try:
        # Check if datasource is provided in query parameters (for FeynmanFlow API proxy)
        if datasource:
            logger.info(f"Proxying upload request to FeynmanFlow API with datasource: {datasource}, client: {client}")
            return await proxy_to_feynmanflow_api_async(request, files, datasource, client, background_tasks)
        
        # Otherwise, use the original upload logic
        if not type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either 'type' (form data) or 'datasource' (query parameter) is required"
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


async def proxy_to_feynmanflow_api_async(
    request: Request,
    files: List[UploadFile],
    datasource: str,
    client: Optional[str],
    background_tasks: BackgroundTasks
):
    """
    Proxy upload request to FeynmanFlow-finance-0.1 API
    Accepts files, returns 200 immediately, processes in background to prevent frontend timeout
    """
    try:
        # Validate datasource
        if not datasource or datasource.strip() == "":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="datasource query parameter is required and cannot be empty"
            )
        
        # Check if files are uploaded
        if not files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No files uploaded"
            )
        
        # Validate and prepare files for background processing
        files_to_process = []
        
        for file in files:
            try:
                # Validate file
                if not file.filename:
                    continue
                
                # Check file extension
                file_ext = os.path.splitext(file.filename)[1].lower()
                if file_ext not in ALLOWED_EXTENSIONS:
                    logger.warning(f"Invalid file type for {file.filename}: {file_ext}. Skipping.")
                    continue
                
                # Read file content (we need to read it now before returning response)
                file_content = await file.read()
                
                # Check file size
                if len(file_content) > MAX_FILE_SIZE:
                    logger.warning(f"File {file.filename} too large: {len(file_content)} bytes. Skipping.")
                    continue
                
                # Store file data for background processing
                files_to_process.append({
                    "filename": file.filename,
                    "content": file_content,
                    "content_type": file.content_type or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                })
                
            except Exception as file_error:
                logger.error(f"Error preparing file {file.filename}: {str(file_error)}")
                continue
        
        if not files_to_process:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid files to process"
            )
        
        # Add background task to process files
        background_tasks.add_task(
            process_files_with_feynmanflow_api,
            files_to_process,
            datasource.strip(),
            client.strip() if client else None
        )
        
        # Return immediately with success response
        datasource_upper = datasource.strip().upper()
        logger.info(f"Accepted {len(files_to_process)} file(s) for datasource {datasource_upper}. Processing in background.")
        
        return {
            "status": 200,
            "message": f"{datasource_upper} data file uploaded",
            "data": None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in proxy_to_feynmanflow_api_async: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error accepting upload request: {str(e)}"
        )


async def process_files_with_feynmanflow_api(
    files_to_process: List[Dict[str, Any]],
    datasource: str,
    client: Optional[str] = None
):
    """
    Background task to process files with FeynmanFlow API
    This runs asynchronously after the API response is sent to frontend
    """
    try:
        logger.info(f"Starting background processing for {len(files_to_process)} file(s) with datasource: {datasource}")
        
        # Build FeynmanFlow API URL with query parameters
        feynmanflow_url = f"{FEYNMANFLOW_API_BASE_URL}{FEYNMANFLOW_UPLOAD_ENDPOINT}"
        query_params = {
            "datasource": datasource.strip(),
            "chunk_size": str(DEFAULT_CHUNK_SIZE)
        }
        # Add client parameter if provided
        if client:
            query_params["client"] = client.strip()
        
        async with httpx.AsyncClient(timeout=600.0) as http_client:  # 10 minutes timeout
            for file_data in files_to_process:
                try:
                    filename = file_data["filename"]
                    file_content = file_data["content"]
                    content_type = file_data["content_type"]
                    
                    logger.info(f"Processing file {filename} with FeynmanFlow API: {feynmanflow_url}")
                    logger.info(f"Query params: {query_params}, File size: {len(file_content)} bytes")
                    
                    # Create multipart form data for the proxy request using the file content
                    from io import BytesIO
                    file_stream = BytesIO(file_content)
                    files_data = {
                        "file": (filename, file_stream, content_type)
                    }
                    
                    # Make request to FeynmanFlow API
                    response = await http_client.post(
                        feynmanflow_url,
                        params=query_params,
                        files=files_data
                    )
                    
                    # Handle response
                    if response.status_code == 200:
                        response_data = response.json()
                        logger.info(f"Successfully processed file {filename} with FeynmanFlow API")
                        logger.debug(f"Response for {filename}: {response_data}")
                    else:
                        error_detail = response.text
                        try:
                            error_detail = response.json()
                        except:
                            pass
                        logger.error(f"FeynmanFlow API returned error for {filename}: Status {response.status_code}, Error: {error_detail}")
                
                except httpx.TimeoutException:
                    logger.error(f"Timeout while processing file {file_data['filename']} with FeynmanFlow API")
                except Exception as file_error:
                    logger.error(f"Error processing file {file_data['filename']}: {str(file_error)}", exc_info=True)
        
        logger.info(f"Background processing completed for {len(files_to_process)} file(s) with datasource: {datasource}")
    
    except Exception as e:
        logger.error(f"Error in background processing with FeynmanFlow API: {str(e)}", exc_info=True)


@router.get("/status/{upload_id}")
async def get_upload_status(
    upload_id: int,
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Get upload status"""
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
    """Get all uploads with pagination"""
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
    """Delete upload"""
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


@router.post("/analyze-columns")
async def analyze_columns(
    file: UploadFile = File(...),
    datasource: str = Query(..., description="Data source identifier"),
    current_user: UserDetails = Depends(get_current_user)
):
    """
    Analyze Excel file columns and return mappings to system-understood columns.
    Proxies to FeynmanFlow API for vector-based column matching.
    """
    try:
        logger.info(f"[ANALYZE-COLUMNS] Analyzing columns for file: {file.filename}, datasource: {datasource}")
        
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Check file extension
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Read file content
        file_content = await file.read()
        
        # For analyze-columns, we only need headers, so allow larger files
        # Set a higher limit for analysis (1GB) since we only read headers
        ANALYSIS_MAX_FILE_SIZE = 1024 * 1024 * 1024  # 1GB for analysis
        
        if len(file_content) > ANALYSIS_MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large for analysis. Maximum size: {ANALYSIS_MAX_FILE_SIZE / (1024*1024*1024)}GB"
            )
        
        # Proxy to FeynmanFlow API
        analyze_url = f"{FEYNMANFLOW_API_BASE_URL}/analyze-columns"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Create FormData for multipart upload
            from io import BytesIO
            file_stream = BytesIO(file_content)
            files_data = {
                "file": (file.filename, file_stream, file.content_type or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            }
            params = {"datasource": datasource, "save_mappings": "false"}
            
            response = await client.post(analyze_url, files=files_data, params=params)
            
            if response.status_code != 200:
                logger.error(f"[ANALYZE-COLUMNS] FeynmanFlow API error: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error analyzing columns: {response.text}"
                )
            
            result = response.json()
            
            logger.info(f"[ANALYZE-COLUMNS] Successfully analyzed columns")
            return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ANALYZE-COLUMNS] Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing columns: {str(e)}"
        )


@router.get("/datasource")
async def get_datasource(
    db: AsyncSession = Depends(get_main_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """
    Get datasource configuration from database
    Queries data_source table and groups data by category, tender, and type.
    
    Flow:
    1. Query data_source table from main database
    2. Group by category -> tender -> type
    3. Return structured response matching production API
    
    Table: data_source
    Columns: id, name (dataSource), category, tender, type
    """
    try:
        logger.info("[DATASOURCE] Controller hit: GET /api/uploader/datasource")
        
        # Query data_source table
        # Table structure: id, name (dataSource), category, tender, type
        query = text("""
            SELECT 
                category,
                tender,
                type,
                name as dataSource
            FROM data_source
            WHERE category IS NOT NULL
            AND tender IS NOT NULL
            AND type IS NOT NULL
            AND name IS NOT NULL
            ORDER BY category, tender, name
        """)
        
        logger.info(f"[DATASOURCE] SQL Query: {query}")
        
        result = await db.execute(query)
        rows = result.fetchall()
        
        logger.info(f"[DATASOURCE] Found {len(rows)} records from data_source table")
        
        # Group by category -> tender -> type
        # Structure: category_map[category][tender][dataSource] = type
        category_map: Dict[str, Dict[str, Dict[str, str]]] = {}
        
        for row in rows:
            category = row[0]
            tender = row[1]
            type_value = row[2]
            data_source = row[3]
            
            # Initialize category if not exists
            if category not in category_map:
                category_map[category] = {}
            
            # Initialize tender if not exists
            if tender not in category_map[category]:
                category_map[category][tender] = {}
            
            # Add dataSource -> type mapping
            category_map[category][tender][data_source] = type_value
        
        # Convert to response format
        result_data = []
        category_order = ["3PO", "Banking", "POS", "Config", "Cash_PickUp"]
        
        for category in category_order:
            if category in category_map and category_map[category]:
                tenders = []
                for tender, data_source_map in sorted(category_map[category].items()):
                    # Convert data_source_map to types list
                    types_list = [
                        {
                            "type": type_value,
                            "dataSource": data_source
                        }
                        for data_source, type_value in sorted(data_source_map.items())
                    ]
                    
                    tenders.append({
                        "tender": tender,
                        "types": types_list
                    })
                
                if tenders:
                    result_data.append({
                        "category": category,
                        "tenders": tenders
                    })
        
        # Add any remaining categories not in the order list
        for category, tenders_dict in category_map.items():
            if category not in category_order:
                tenders = []
                for tender, data_source_map in sorted(tenders_dict.items()):
                    types_list = [
                        {
                            "type": type_value,
                            "dataSource": data_source
                        }
                        for data_source, type_value in sorted(data_source_map.items())
                    ]
                    
                    tenders.append({
                        "tender": tender,
                        "types": types_list
                    })
                
                if tenders:
                    result_data.append({
                        "category": category,
                        "tenders": tenders
                    })
        
        response = {
            "status": 200,
            "message": "DataSources",
            "data": result_data
        }
        
        logger.info(f"[DATASOURCE] Query executed successfully")
        logger.info(f"[DATASOURCE] Response: {len(result_data)} categories, total records: {len(rows)}")
        
        return response
        
    except Exception as e:
        logger.error(f"[DATASOURCE] Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching datasource: {str(e)}"
        )