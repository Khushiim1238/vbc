from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(String, primary_key=True, index=True) # UUID generated on client
    role = Column(String, index=True) # Sales, Dispatch, Accounts, Owner
    name = Column(String)
    
    orders = relationship("Order", back_populates="sales_person")

class Product(Base):
    __tablename__ = "products"
    
    code = Column(String, primary_key=True, index=True) # e.g. VCB 101
    name = Column(String)
    default_rate = Column(Float)
    
class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, index=True)
    customer_number = Column(String, nullable=True)
    product_code = Column(String, ForeignKey("products.code"))
    qty = Column(Integer)
    rate = Column(Float)
    delivery_area = Column(String)
    status = Column(String, default="Pending") # Pending, Batched, Dispatched, Payment Pending, Paid
    modified_post_dispatch = Column(Integer, default=0) # Boolean flag 0/1
    
    sales_person_id = Column(String, ForeignKey("devices.id"))
    assigned_vehicle = Column(String, nullable=True) # e.g. 20T Truck
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    sales_person = relationship("Device", back_populates="orders")
    product = relationship("Product")
