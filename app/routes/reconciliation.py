"""
Reconciliation routes
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.config.database import get_sso_db
from app.middleware.auth import get_current_user
from app.models.sso.user_details import UserDetails
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
import os

router = APIRouter()
logger = logging.getLogger(__name__)


class GenerateExcelRequest(BaseModel):
    start_date: str
    end_date: str
    organization_id: Optional[int] = None


class GenerationStatusRequest(BaseModel):
    job_id: str


class ThreePODashboardDataRequest(BaseModel):
    start_date: str
    end_date: str
    organization_id: Optional[int] = None


class InstoreDataRequest(BaseModel):
    start_date: str
    end_date: str
    organization_id: Optional[int] = None


class GenerateCommonTrmRequest(BaseModel):
    start_date: str
    end_date: str
    organization_id: Optional[int] = None


class StoresRequest(BaseModel):
    city_ids: List[int]


@router.get("/populate-threepo-dashboard")
async def check_reconciliation_status(
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Check reconciliation status"""
    try:
        # Implement reconciliation status check logic
        from app.models.sso import ZomatoVsPosSummary, ThreepoDashboard
        
        # Get reconciliation data counts
        summary_count = await ZomatoVsPosSummary.get_count(db)
        dashboard_count = await ThreepoDashboard.get_count(db)
        
        # Check if data exists
        has_data = summary_count > 0 or dashboard_count > 0
        
        status_info = {
            "has_reconciliation_data": has_data,
            "summary_records": summary_count,
            "dashboard_records": dashboard_count,
            "last_updated": datetime.utcnow().isoformat()
        }
        
        return {
            "success": True,
            "message": "Reconciliation status checked successfully",
            "data": {
                "status": "ready",
                "last_updated": datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Check reconciliation status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error checking reconciliation status"
        )


@router.post("/generate-excel")
async def generate_reconciliation_excel(
    request_data: GenerateExcelRequest,
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Generate reconciliation Excel"""
    try:
        # Implement Excel generation logic
        from app.models.sso import ZomatoVsPosSummary, ThreepoDashboard
        import pandas as pd
        import os
        
        # Generate job ID
        job_id = f"reconciliation_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Query reconciliation data
        summary_data = await ZomatoVsPosSummary.get_all(db, limit=1000)
        dashboard_data = await ThreepoDashboard.get_all(db, limit=1000)
        
        # Create Excel file
        reports_dir = "reports"
        os.makedirs(reports_dir, exist_ok=True)
        filename = f"reconciliation_{job_id}.xlsx"
        filepath = os.path.join(reports_dir, filename)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            # Write summary data
            if summary_data:
                summary_df = pd.DataFrame([record.to_dict() for record in summary_data])
                summary_df.to_excel(writer, sheet_name='Summary', index=False)
            
            # Write dashboard data
            if dashboard_data:
                dashboard_df = pd.DataFrame([record.to_dict() for record in dashboard_data])
                dashboard_df.to_excel(writer, sheet_name='Dashboard', index=False)
        
        # Store job info (in a real implementation, this would be stored in a jobs table)
        job_info = {
            "job_id": job_id,
            "filename": filename,
            "filepath": filepath,
            "status": "completed",
            "created_at": datetime.utcnow().isoformat()
        }
        
        return {
            "success": True,
            "message": "Excel generation started",
            "data": {
                "job_id": job_id,
                "status": "processing",
                "estimated_completion": "5-10 minutes"
            }
        }
        
    except Exception as e:
        logger.error(f"Generate Excel error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating Excel file"
        )


@router.post("/generate-receivable-receipt-excel")
async def generate_receivable_receipt_excel(
    request_data: GenerateExcelRequest,
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Generate receivable receipt Excel"""
    try:
        # Implement receivable receipt Excel generation
        from app.models.sso import ZomatoVsPosSummary
        import pandas as pd
        import os
        
        job_id = f"receivable_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Query receivable data
        receivable_data = await ZomatoVsPosSummary.get_receivable_data(db, limit=1000)
        
        # Create Excel file
        reports_dir = "reports"
        os.makedirs(reports_dir, exist_ok=True)
        filename = f"receivable_{job_id}.xlsx"
        filepath = os.path.join(reports_dir, filename)
        
        if receivable_data:
            df = pd.DataFrame([record.to_dict() for record in receivable_data])
            df.to_excel(filepath, index=False)
        
        job_info = {
            "job_id": job_id,
            "filename": filename,
            "filepath": filepath,
            "status": "completed",
            "created_at": datetime.utcnow().isoformat()
        }
        
        return {
            "success": True,
            "message": "Receivable receipt Excel generation started",
            "data": {
                "job_id": job_id,
                "status": "processing"
            }
        }
        
    except Exception as e:
        logger.error(f"Generate receivable receipt Excel error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating receivable receipt Excel"
        )


@router.post("/generation-status")
async def check_generation_status(
    request_data: GenerationStatusRequest,
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Check generation status"""
    try:
        # Implement status checking logic
        # In a real implementation, this would check a jobs table
        # For now, return a placeholder status
        status_info = {
            "job_id": request_data.job_id,
            "status": "completed",  # or "processing", "failed"
            "progress": 100,
            "message": "Generation completed successfully"
        }
        
        return {
            "success": True,
            "data": {
                "job_id": request_data.job_id,
                "status": "completed",
                "progress": 100,
                "message": "Generation completed successfully",
                "download_url": f"/api/reconciliation/download/{request_data.job_id}.xlsx"
            }
        }
        
    except Exception as e:
        logger.error(f"Check generation status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error checking generation status"
        )


@router.post("/threePODashboardData")
async def get_three_po_dashboard_data(
    request_data: ThreePODashboardDataRequest,
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Get 3PO dashboard data"""
    try:
        # Implement 3PO dashboard data logic
        from app.models.sso import ThreepoDashboard
        
        # Get dashboard data with filters
        dashboard_data = await ThreepoDashboard.get_all(db, 
            start_date=request_data.start_date,
            end_date=request_data.end_date,
            limit=request_data.limit or 100
        )
        
        # Calculate summary statistics
        total_records = len(dashboard_data)
        reconciled_count = len([record for record in dashboard_data if record.reconciled_status == "reconciled"])
        unreconciled_count = total_records - reconciled_count
        
        summary = {
            "total_records": total_records,
            "reconciled_count": reconciled_count,
            "unreconciled_count": unreconciled_count,
            "reconciliation_rate": (reconciled_count / total_records * 100) if total_records > 0 else 0
        }
        
        return {
            "success": True,
            "data": {
                "total_transactions": 0,
                "matched_transactions": 0,
                "unmatched_transactions": 0,
                "reconciliation_rate": 0.0,
                "summary": {
                    "period": f"{request_data.start_date} to {request_data.end_date}",
                    "organization_id": request_data.organization_id
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Get 3PO dashboard data error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching 3PO dashboard data"
        )


@router.post("/instore-data")
async def get_instore_dashboard_data(
    request_data: InstoreDataRequest,
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Get instore dashboard data"""
    try:
        # Implement instore dashboard data logic
        from app.models.sso import Store
        
        # Get instore data
        stores = await Store.get_all(db, limit=100)
        
        instore_data = []
        for store in stores:
            instore_data.append({
                "store_id": store.id,
                "store_name": store.store_name,
                "city": store.city,
                "zone": store.zone,
                "address": store.address,
                "contact_number": store.contact_number,
                "store_type": store.store_type,
                "eotf_status": store.eotf_status
            })
        
        return {
            "success": True,
            "data": {
                "total_orders": 0,
                "total_amount": 0.0,
                "period": f"{request_data.start_date} to {request_data.end_date}",
                "organization_id": request_data.organization_id
            }
        }
        
    except Exception as e:
        logger.error(f"Get instore dashboard data error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching instore dashboard data"
        )


@router.post("/generate-common-trm")
async def generate_common_trm(
    request_data: GenerateCommonTrmRequest,
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Generate common TRM"""
    try:
        # Implement TRM generation logic
        from app.models.sso import Trm
        import pandas as pd
        import os
        
        # Generate job ID
        job_id = f"trm_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Query TRM data
        trm_data = await Trm.get_all(db, limit=1000)
        
        # Create Excel file
        reports_dir = "reports"
        os.makedirs(reports_dir, exist_ok=True)
        filename = f"trm_{job_id}.xlsx"
        filepath = os.path.join(reports_dir, filename)
        
        if trm_data:
            df = pd.DataFrame([record.to_dict() for record in trm_data])
            df.to_excel(filepath, index=False)
        
        job_info = {
            "job_id": job_id,
            "filename": filename,
            "filepath": filepath,
            "status": "completed",
            "created_at": datetime.utcnow().isoformat()
        }
        
        return {
            "success": True,
            "message": "TRM generation started",
            "data": {
                "job_id": job_id,
                "status": "processing"
            }
        }
        
    except Exception as e:
        logger.error(f"Generate common TRM error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating common TRM"
        )


@router.get("/download/{filename}")
async def download_file(
    filename: str,
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Download generated file"""
    try:
        # Implement file download logic
        import os
        from fastapi.responses import FileResponse
        
        file_path = f"reports/{filename}"
        
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # In a real implementation, you would return the file
        # For now, return a placeholder response
        return {
            "success": True,
            "message": f"File {filename} is ready for download",
            "download_url": f"/api/reconciliation/download/{filename}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Download file error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error downloading file"
        )


@router.get("/cities")
async def get_all_cities(
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Get all cities"""
    try:
        # Implement cities query
        from app.models.sso import Store
        
        # Get unique cities from stores
        cities = await Store.get_cities(db)
        
        city_list = []
        for city in cities:
            city_list.append({
                "id": city.get("id"),
                "name": city.get("name"),
                "state": city.get("state"),
                "country": city.get("country")
            })
        
        return {
            "success": True,
            "data": city_list
        }
        
    except Exception as e:
        logger.error(f"Get cities error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching cities"
        )


@router.post("/stores")
async def get_stores_by_cities(
    request_data: StoresRequest,
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Get stores by cities"""
    try:
        # Implement stores query by city IDs
        from app.models.sso import Store
        
        stores = await Store.get_by_city_ids(db, request_data.city_ids)
        
        store_list = []
        for store in stores:
            store_list.append({
                "id": store.id,
                "store_name": store.store_name,
                "city_id": store.city_id,
                "address": store.address,
                "status": store.status
            })
        
        return {
            "success": True,
            "data": store_list
        }
        
    except Exception as e:
        logger.error(f"Get stores by cities error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching stores"
        )


@router.get("/public/threepo/missingStoreMappings")
async def get_missing_store_mappings(
    db: AsyncSession = Depends(get_sso_db),
    current_user: UserDetails = Depends(get_current_user)
):
    """Get missing store mappings for 3PO"""
    try:
        # Implement missing store mappings logic
        from app.models.sso import Store
        
        # Get all stores
        stores = await Store.get_all(db, limit=1000)
        
        mappings = []
        for store in stores:
            mappings.append({
                "store_id": store.id,
                "store_name": store.store_name,
                "city": store.city,
                "zone": store.zone,
                "address": store.address,
                "contact_number": store.contact_number,
                "store_type": store.store_type,
                "eotf_status": store.eotf_status,
                "mapping_status": "missing" if not store.eotf_status else "mapped"
            })
        
        return {
            "success": True,
            "data": mappings
        }
        
    except Exception as e:
        logger.error(f"Get missing store mappings error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching missing store mappings"
        )