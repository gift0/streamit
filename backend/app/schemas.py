from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class BinBase(BaseModel):
    location: str = Field(..., example="5th Avenue Main St")
    latitude: Optional[float] = Field(None, example=6.5244)
    longitude: Optional[float] = Field(None, example=3.3792)