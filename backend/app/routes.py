from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from .database import get_db
from . import models, schemas

router = APIRouter()

# ----------------- Bins -----------------

@router.post("/bins", response_model=schemas.BinRead)
def create_bin(bin_in: schemas.BinCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(models.Bin)
        .filter(models.Bin.location == bin_in.location)
        .first()
    )
    if existing:
        # Optionally update coordinates if provided and missing
        updated = False
        if bin_in.latitude is not None and existing.latitude is None:
            existing.latitude = bin_in.latitude
            updated = True
        if bin_in.longitude is not None and existing.longitude is None:
            existing.longitude = bin_in.longitude
            updated = True
        if updated:
            db.add(existing)
            db.commit()
            db.refresh(existing)
        return existing
    bin_obj = models.Bin(
        location=bin_in.location,
        latitude=bin_in.latitude,
        longitude=bin_in.longitude
    )
    db.add(bin_obj)
    db.commit()
    db.refresh(bin_obj)
    return bin_obj


@router.get("/bins", response_model=List[schemas.BinRead])
def list_bins(db: Session = Depends(get_db)):
    return db.query(models.Bin).order_by(models.Bin.id.desc()).all()


@router.get("/bins/{bin_id}", response_model=schemas.BinWithReports)
def get_bin(bin_id: int, db: Session = Depends(get_db)):
    bin_obj = db.query(models.Bin).filter(models.Bin.id == bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")
    return bin_obj


# ----------------- Reports -----------------

@router.post("/reports", response_model=schemas.ReportRead)
def create_report(
    report_in: schemas.ReportCreate,
    db: Session = Depends(get_db)
):
    bin_obj = (
        db.query(models.Bin)
        .filter(models.Bin.id == report_in.bin_id)
        .first()
    )
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")
    report = models.Report(
        bin_id=report_in.bin_id,
        status=report_in.status
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Simple Notification (console log for now)
    print(
        f"NOTIFY: Bin {bin_obj.id} at '{bin_obj.location}' reported as "
        f"{report.status} [lat={bin_obj.latitude}, lng={bin_obj.longitude}]"
    )
    return report


@router.get("/reports", response_model=List[schemas.ReportRead])
def list_reports(db: Session = Depends(get_db)):
    return (
        db.query(models.Report)
        .order_by(models.Report.created_at.desc())
        .all()
    )


@router.put("/reports/{report_id}/clear", response_model=schemas.ReportRead)
def clear_report(report_id: int, db: Session = Depends(get_db)):
    """Mark a report as cleared and set cleared_at timestamp."""
    db_report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not db_report:
        raise HTTPException(status_code=404, detail="Report not found")

    db_report.status = "done"
    db_report.cleared_at = datetime.utcnow()
    db.commit()
    db.refresh(db_report)
    return db_report
