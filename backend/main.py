from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Vardhman Prefab API")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def seed_database():
    db = next(get_db())
    # Seed Products if empty
    if db.query(models.Product).count() == 0:
        products = [
            models.Product(code="VCB 101", name="Cover Block 20mm", default_rate=1.5),
            models.Product(code="VCB 102", name="Cover Block 25mm", default_rate=1.8),
            models.Product(code="VCB 103", name="Cover Block 30mm", default_rate=2.0),
            models.Product(code="VCB 104", name="Cover Block 40mm", default_rate=2.5),
            models.Product(code="VCB 105", name="Cover Block 50mm", default_rate=3.0),
            models.Product(code="VCB 106", name="Cover Block 75mm", default_rate=4.5),
            models.Product(code="VCB 107", name="Cover Block 100mm", default_rate=6.0),
        ]
        db.add_all(products)
        db.commit()

# --- Devices ---
@app.post("/devices", response_model=schemas.Device)
def register_device(device: schemas.DeviceCreate, db: Session = Depends(get_db)):
    db_device = db.query(models.Device).filter(models.Device.id == device.id).first()
    if db_device:
        # Update existing
        db_device.role = device.role
        db_device.name = device.name
        db.commit()
        db.refresh(db_device)
        return db_device
        
    db_device = models.Device(**device.dict())
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device

@app.get("/devices", response_model=List[schemas.Device])
def get_devices(db: Session = Depends(get_db)):
    return db.query(models.Device).all()

@app.delete("/devices/{device_id}")
def reset_device(device_id: str, db: Session = Depends(get_db)):
    # Simple unregister for Owner screen
    db_device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if db_device:
        db.delete(db_device)
        db.commit()
    return {"status": "ok"}

# --- Products ---
@app.get("/products", response_model=List[schemas.Product])
def get_products(db: Session = Depends(get_db)):
    return db.query(models.Product).all()

# --- Orders ---
@app.post("/orders", response_model=schemas.Order)
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    db_order = models.Order(**order.dict())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

@app.get("/orders", response_model=List[schemas.Order])
def get_orders(db: Session = Depends(get_db)):
    return db.query(models.Order).all()

@app.put("/orders/{order_id}", response_model=schemas.Order)
def update_order(order_id: int, order_update: schemas.OrderUpdate, db: Session = Depends(get_db)):
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # Only allow edits if Pending or Batched (prevent editing dispatched orders unless owner, which we'll handle in frontend)
    if db_order.status not in ["Pending", "Batched"]:
        raise HTTPException(status_code=400, detail="Cannot edit an order that has been dispatched")
        
    for key, value in order_update.dict(exclude_unset=True).items():
        setattr(db_order, key, value)
        
    db.commit()
    db.refresh(db_order)
    return db_order

@app.patch("/orders/{order_id}/status", response_model=schemas.Order)
def update_order_status(order_id: int, status_update: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    valid_statuses = ["Pending", "Batched", "Dispatched", "Payment Pending", "Paid"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    db_order.status = status_update.status
    if status_update.assigned_vehicle:
        db_order.assigned_vehicle = status_update.assigned_vehicle
        
    db.commit()
    db.refresh(db_order)
    return db_order
