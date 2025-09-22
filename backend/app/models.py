from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, Float
from sqlalchemy.orm import relationship
from .database import Base

class Bin(Base):
    __tablename__ = "bins"

    id = Column(Integer, primary_key=True, index=True)
    location = Column(String, nullable=False, index=True)
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)

    reports = relationship("Report", back_populates="bin", cascade="all, delete-orphan")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    bin_id = Column(Integer, ForeignKey("bins.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, default="full", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    bin = relationship("Bin", back_populates="reports")