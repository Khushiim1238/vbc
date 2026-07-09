from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Devices
class DeviceBase(BaseModel):
    role: str
    name: str

class DeviceCreate(DeviceBase):
    id: str

class Device(DeviceBase):
    id: str
    
    class Config:
        from_attributes = True

# Products
class ProductBase(BaseModel):
    code: str
    name: str
    default_rate: float

class Product(ProductBase):
    class Config:
        from_attributes = True

# Orders
class OrderBase(BaseModel):
    customer_name: str
    customer_number: Optional[str] = None
    product_code: str
    qty: int
    rate: float
    delivery_area: str
    sales_person_id: str

class OrderCreate(OrderBase):
    customer_number: str
    
class OrderUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_number: Optional[str] = None
    product_code: Optional[str] = None
    qty: Optional[int] = None
    rate: Optional[float] = None
    delivery_area: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    status: str
    assigned_vehicle: Optional[str] = None

class Order(OrderBase):
    id: int
    status: str
    assigned_vehicle: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    product: Optional[Product] = None
    sales_person: Optional[Device] = None
    
    class Config:
        from_attributes = True
