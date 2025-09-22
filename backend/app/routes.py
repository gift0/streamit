from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas

router = APIRouter()

# Bins
@router.post("/bins", response_model=schemas.BinRead)
def create_bin(bin_in: schemas.BinCreate, db: Session = Depends(get_db)):
	existing = db.query(models.Bin).filter(models.Bin.location == bin_in.location).first()
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
	bin_obj = models.Bin(location=bin_in.location, latitude=bin_in.latitude, longitude=bin_in.longitude)
	db.add(bin_obj)
	db.commit()
	db.refresh(bin_obj)
	return bin_obj