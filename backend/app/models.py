from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from .database import Base


class Bin(Base):
    __tablename__ = "bins"

    id = Column(Integer, primary_key=True, index=True)
    location = Column(String, unique=True, index=True)
    latitude = Column(String, nullable=True)
    longitude = Column(String, nullable=True)

    # Relationship with reports
    reports = relationship("Report", back_populates="bin", cascade="all, delete-orphan")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    bin_id = Column(Integer, ForeignKey("bins.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    cleared_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship with Bin
    bin = relationship("Bin", back_populates="reports")
