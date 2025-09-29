from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ✅ New column
    cleared_at = Column(DateTime(timezone=True), nullable=True)

    # Example relationship if you have users
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="reports")
