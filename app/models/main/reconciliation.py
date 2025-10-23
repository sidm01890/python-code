"""
Reconciliation models for Main database
"""

from sqlalchemy import Column, String, Date, Numeric, DateTime, Index, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from datetime import datetime
from typing import List
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()


class ZomatoVsPosSummary(Base):
    """Zomato vs POS Summary model"""
    __tablename__ = "zomato_vs_pos_summary"
    
    id = Column(String(255), primary_key=True)
    pos_order_id = Column(String(255), nullable=True)
    zomato_order_id = Column(String(255), nullable=True)
    order_date = Column(Date, nullable=True)
    store_name = Column(String(255), nullable=True)
    
    # Net Amount fields
    pos_net_amount = Column(Numeric(15, 2), nullable=True)
    zomato_net_amount = Column(Numeric(15, 2), nullable=True)
    pos_vs_zomato_net_amount_delta = Column(Numeric(15, 2), nullable=True)
    
    # Reconciliation fields
    reconciled_status = Column(String(255), nullable=True)
    reconciled_amount = Column(Numeric(15, 2), nullable=True)
    unreconciled_amount = Column(Numeric(15, 2), nullable=True)
    
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    
    @classmethod
    async def create(cls, db: AsyncSession, **kwargs):
        """Create a new record"""
        try:
            record = cls(**kwargs)
            db.add(record)
            await db.commit()
            await db.refresh(record)
            return record
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating zomato_vs_pos_summary: {e}")
            raise
    
    @classmethod
    async def get_all(cls, db: AsyncSession, limit: int = 100):
        """Get all records"""
        try:
            query = select(cls).limit(limit)
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error getting all zomato_vs_pos_summary: {e}")
            return []
    
    @classmethod
    async def get_count(cls, db: AsyncSession):
        """Get count of records"""
        try:
            from sqlalchemy import func
            result = await db.execute(select(func.count()).select_from(cls))
            return result.scalar() or 0
        except Exception as e:
            logger.error(f"Error getting count: {e}")
            return 0
    
    @classmethod
    async def get_receivable_data(cls, db: AsyncSession, limit: int = 1000):
        """Get receivable data"""
        try:
            query = select(cls).where(cls.reconciled_status == "receivable").limit(limit)
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error getting receivable data: {e}")
            return []

    def to_dict(self):
        """Convert record to dictionary"""
        return {
            "id": self.id,
            "pos_order_id": self.pos_order_id,
            "zomato_order_id": self.zomato_order_id,
            "order_date": self.order_date.isoformat() if self.order_date else None,
            "store_name": self.store_name,
            "pos_net_amount": float(self.pos_net_amount) if self.pos_net_amount else None,
            "zomato_net_amount": float(self.zomato_net_amount) if self.zomato_net_amount else None,
            "reconciled_status": self.reconciled_status,
            "reconciled_amount": float(self.reconciled_amount) if self.reconciled_amount else None,
            "unreconciled_amount": float(self.unreconciled_amount) if self.unreconciled_amount else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class ThreepoDashboard(Base):
    """3PO Dashboard model"""
    __tablename__ = "threepo_dashboard"
    
    id = Column(String(255), primary_key=True)
    bank = Column(String(255), nullable=True)
    business_date = Column(Date, nullable=True)
    store_code = Column(String(255), nullable=True)
    store_name = Column(String(255), nullable=True)
    city = Column(String(255), nullable=True)
    zone = Column(String(255), nullable=True)
    total_orders = Column(Numeric(15, 2), nullable=True)
    total_amount = Column(Numeric(15, 2), nullable=True)
    net_amount = Column(Numeric(15, 2), nullable=True)
    commission = Column(Numeric(15, 2), nullable=True)
    pg_charges = Column(Numeric(15, 2), nullable=True)
    tds_amount = Column(Numeric(15, 2), nullable=True)
    final_amount = Column(Numeric(15, 2), nullable=True)
    
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    
    @classmethod
    async def create(cls, db: AsyncSession, **kwargs):
        """Create a new record"""
        try:
            record = cls(**kwargs)
            db.add(record)
            await db.commit()
            await db.refresh(record)
            return record
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating threepo_dashboard: {e}")
            raise
    
    @classmethod
    async def get_all(cls, db: AsyncSession, limit: int = 100):
        """Get all records"""
        try:
            query = select(cls).limit(limit)
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error getting all threepo_dashboard: {e}")
            return []
    
    @classmethod
    async def get_count(cls, db: AsyncSession):
        """Get count of records"""
        try:
            from sqlalchemy import func
            result = await db.execute(select(func.count()).select_from(cls))
            return result.scalar() or 0
        except Exception as e:
            logger.error(f"Error getting count: {e}")
            return 0
    
    @classmethod
    async def get_by_date_range(cls, db: AsyncSession, start_date: str, end_date: str, store_codes: list = None):
        """Get records by date range and store codes"""
        try:
            query = select(cls).where(cls.business_date >= start_date).where(cls.business_date <= end_date)
            if store_codes:
                query = query.where(cls.store_code.in_(store_codes))
            query = query.order_by(cls.business_date.asc())
            
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error getting threepo_dashboard by date range: {e}")
            return []

    def to_dict(self):
        """Convert record to dictionary"""
        return {
            "id": self.id,
            "bank": self.bank,
            "business_date": self.business_date.isoformat() if self.business_date else None,
            "store_code": self.store_code,
            "store_name": self.store_name,
            "city": self.city,
            "zone": self.zone,
            "total_orders": float(self.total_orders) if self.total_orders else None,
            "total_amount": float(self.total_amount) if self.total_amount else None,
            "net_amount": float(self.net_amount) if self.net_amount else None,
            "commission": float(self.commission) if self.commission else None,
            "pg_charges": float(self.pg_charges) if self.pg_charges else None,
            "tds_amount": float(self.tds_amount) if self.tds_amount else None,
            "final_amount": float(self.final_amount) if self.final_amount else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class Store(Base):
    """Store model"""
    __tablename__ = "store"
    
    id = Column(String(255), primary_key=True)
    store_code = Column(String(255), nullable=True)
    store_name = Column(String(255), nullable=True)
    city = Column(String(255), nullable=True)
    zone = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    contact_number = Column(String(255), nullable=True)
    store_type = Column(String(255), nullable=True)
    eotf_status = Column(String(255), nullable=True)
    created_date = Column(String(255), nullable=True)
    updated_date = Column(String(255), nullable=True)
    
    @classmethod
    async def create(cls, db: AsyncSession, **kwargs):
        """Create a new record"""
        try:
            record = cls(**kwargs)
            db.add(record)
            await db.commit()
            await db.refresh(record)
            return record
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating store: {e}")
            raise
    
    @classmethod
    async def get_all(cls, db: AsyncSession, limit: int = 100):
        """Get all stores"""
        try:
            query = select(cls).limit(limit)
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error getting all stores: {e}")
            return []
    
    @classmethod
    async def get_cities(cls, db: AsyncSession):
        """Get unique cities from stores"""
        try:
            from sqlalchemy import func, distinct
            query = select(distinct(cls.city), cls.zone).where(cls.city.isnot(None))
            result = await db.execute(query)
            cities = []
            for row in result:
                cities.append({
                    "id": row.city,
                    "name": row.city,
                    "state": row.zone,
                    "country": "India"
                })
            return cities
        except Exception as e:
            logger.error(f"Error getting cities: {e}")
            return []
    
    @classmethod
    async def get_by_city_ids(cls, db: AsyncSession, city_ids: List[str]):
        """Get stores by city IDs"""
        try:
            query = select(cls).where(cls.city.in_(city_ids))
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error getting stores by city IDs: {e}")
            return []

    def to_dict(self):
        """Convert store to dictionary"""
        return {
            "id": self.id,
            "store_code": self.store_code,
            "store_name": self.store_name,
            "city": self.city,
            "zone": self.zone,
            "address": self.address,
            "contact_number": self.contact_number,
            "store_type": self.store_type,
            "eotf_status": self.eotf_status,
            "created_date": self.created_date,
            "updated_date": self.updated_date
        }


class Trm(Base):
    """TRM (Transaction Reconciliation Management) model"""
    __tablename__ = "trm"
    
    uid = Column(String(255), primary_key=True, unique=True)
    zone = Column(String(128), nullable=True)
    store_name = Column(String(128), nullable=True)
    city = Column(String(128), nullable=True)
    pos = Column(String(128), nullable=True)
    hardware_model = Column(String(128), nullable=True)
    hardware_id = Column(String(128), nullable=True)
    acquirer = Column(String(128), nullable=True)
    tid = Column(String(128), nullable=True)
    mid = Column(String(128), nullable=True)
    batch_no = Column(String(128), nullable=True)
    transaction_date = Column(Date, nullable=True)
    transaction_time = Column(String(128), nullable=True)
    card_number = Column(String(128), nullable=True)
    transaction_type = Column(String(128), nullable=True)
    amount = Column(Numeric(15, 2), nullable=True)
    currency = Column(String(128), nullable=True)
    auth_code = Column(String(128), nullable=True)
    rrn = Column(String(128), nullable=True)
    status = Column(String(128), nullable=True)
    
    @classmethod
    async def create(cls, db: AsyncSession, **kwargs):
        """Create a new TRM record"""
        try:
            record = cls(**kwargs)
            db.add(record)
            await db.commit()
            await db.refresh(record)
            return record
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating TRM record: {e}")
            raise
    
    @classmethod
    async def get_all(cls, db: AsyncSession, limit: int = 100):
        """Get all TRM records"""
        try:
            query = select(cls).limit(limit)
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error getting all TRM records: {e}")
            return []
    
    @classmethod
    async def get_by_date_range(cls, db: AsyncSession, start_date: str, end_date: str):
        """Get TRM records by date range"""
        try:
            query = (
                select(cls)
                .where(cls.transaction_date >= start_date)
                .where(cls.transaction_date <= end_date)
                .order_by(cls.transaction_date.desc())
            )
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error getting TRM by date range: {e}")
            return []

    def to_dict(self):
        """Convert TRM to dictionary"""
        return {
            "uid": self.uid,
            "zone": self.zone,
            "store_name": self.store_name,
            "city": self.city,
            "pos": self.pos,
            "transaction_date": self.transaction_date.isoformat() if self.transaction_date else None,
            "transaction_time": self.transaction_time,
            "amount": float(self.amount) if self.amount else None,
            "currency": self.currency,
            "status": self.status
        }
