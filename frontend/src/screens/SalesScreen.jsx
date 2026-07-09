import { useState, useEffect } from 'react';
import { api } from '../api';
import { PlusCircle, ListOrdered, Trash2 } from 'lucide-react';
import './SalesScreen.css';

export default function SalesScreen({ device }) {
  const [activeTab, setActiveTab] = useState('new'); // new, list
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  
  // Form State
  const [customer, setCustomer] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [area, setArea] = useState('');
  const [items, setItems] = useState([{ id: Date.now(), productCode: '', qty: '', rate: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  useEffect(() => {
    loadProducts();
    loadOrders();
    const interval = setInterval(loadOrders, 5000); // Poll for real-time updates for now
    return () => clearInterval(interval);
  }, []);

  const loadProducts = async () => {
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadOrders = async () => {
    try {
      const data = await api.getOrders();
      // Filter for this sales person
      const myOrders = data.filter(o => o.sales_person_id === device.id);
      // Sort by newest first
      myOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(myOrders);
    } catch (e) {
      console.error(e);
    }
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        // Auto-fill rate if product changes
        if (field === 'productCode') {
          const prod = products.find(p => p.code === value);
          if (prod) {
            updatedItem.rate = prod.default_rate.toString();
          }
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const addItem = () => {
    setItems([...items, { id: Date.now(), productCode: '', qty: '', rate: '' }]);
  };

  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleEditClick = (order) => {
    setEditingOrder(order);
    setCustomer(order.customer_name);
    setCustomerNumber(order.customer_number || '');
    setArea(order.delivery_area);
    setItems([{
      id: Date.now(),
      productCode: order.product_code,
      qty: order.qty.toString(),
      rate: order.rate.toString()
    }]);
    setActiveTab('new');
  };

  const cancelEdit = () => {
    setEditingOrder(null);
    setCustomer('');
    setCustomerNumber('');
    setArea('');
    setItems([{ id: Date.now(), productCode: '', qty: '', rate: '' }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customer || !customerNumber || !area) {
      alert("Please enter customer name, phone number, and area.");
      return;
    }
    
    const invalidItems = items.filter(item => !item.productCode || !item.qty || !item.rate);
    if (invalidItems.length > 0) {
      alert("Please fill out all product details completely.");
      return;
    }
    
    setSubmitting(true);
    try {
      if (editingOrder) {
        // Edit mode (single item)
        const item = items[0];
        const orderData = {
          customer_name: customer,
          customer_number: customerNumber,
          product_code: item.productCode,
          qty: parseInt(item.qty),
          rate: parseFloat(item.rate),
          delivery_area: area,
          sales_person_id: device.id
        };
        await api.updateOrder(editingOrder.id, orderData);
      } else {
        // Create mode (multiple items)
        const promises = items.map(item => {
          const orderData = {
            customer_name: customer,
            customer_number: customerNumber,
            product_code: item.productCode,
            qty: parseInt(item.qty),
            rate: parseFloat(item.rate),
            delivery_area: area,
            sales_person_id: device.id
          };
          return api.createOrder(orderData);
        });
        await Promise.all(promises);
      }
      
      // Reset form
      cancelEdit();
      setActiveTab('list');
      loadOrders();
    } catch (err) {
      alert("Failed to submit order");
    }
    setSubmitting(false);
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Pending': 'badge-pending',
      'Batched': 'badge-batched',
      'Dispatched': 'badge-dispatched',
      'Payment Pending': 'badge-payment',
      'Paid': 'badge-paid'
    };
    return <span className={`badge ${colors[status] || ''}`}>{status}</span>;
  };

  return (
    <div className="sales-container">
      {/* Tabs removed from top, moved to bottom-nav */}
      {activeTab === 'new' ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>{editingOrder ? 'Edit Order' : 'Create New Order'}</h2>
            {editingOrder && (
              <button type="button" className="btn-logout" onClick={cancelEdit}>
                Cancel Edit
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-row" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label>Customer Name</label>
                <input type="text" value={customer} onChange={e => setCustomer(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Customer Number</label>
                <input type="text" value={customerNumber} onChange={e => setCustomerNumber(e.target.value)} placeholder="Required" required />
              </div>
              <div className="form-group">
                <label>Delivery Area</label>
                <input type="text" value={area} onChange={e => setArea(e.target.value)} required />
              </div>
            </div>
            
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '1.1rem' }}>Order Items</h3>
            
            {items.map((item, index) => (
              <div key={item.id} style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1rem', position: 'relative' }}>
                {items.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeItem(item.id)}
                    style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.5rem' }}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Product</label>
                  <select value={item.productCode} onChange={e => handleItemChange(item.id, 'productCode', e.target.value)} required>
                    <option value="">Select a product...</option>
                    {products.map(p => (
                      <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Quantity</label>
                    <input type="number" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', e.target.value)} min="1" required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Rate (₹)</label>
                    <input type="number" step="0.01" value={item.rate} onChange={e => handleItemChange(item.id, 'rate', e.target.value)} required />
                  </div>
                </div>
              </div>
            ))}
            
            {!editingOrder && (
              <button 
                type="button" 
                onClick={addItem}
                style={{ width: '100%', padding: '0.75rem', background: 'transparent', border: '1px dashed #94A3B8', borderRadius: '6px', color: '#64748B', fontWeight: 500, cursor: 'pointer', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <PlusCircle size={18} /> Add Another Item
              </button>
            )}
            
            <button type="submit" className="btn-primary" disabled={submitting} style={{ marginTop: editingOrder ? '1.5rem' : '0' }}>
              {submitting ? 'Submitting...' : (editingOrder ? 'Save Changes' : 'Submit Complete Order')}
            </button>
          </form>
        </div>
      ) : (
        <div className="table-container">
          {orders.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>No orders yet.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer Details</th>
                  <th>Product & Area</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>#{order.id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{order.customer_number}</div>
                    </td>
                    <td>
                      <div>{order.product_code} (Qty: {order.qty})</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Area: {order.delivery_area}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      ₹{(order.qty * order.rate).toLocaleString()}
                    </td>
                    <td>{getStatusBadge(order.status)}</td>
                    <td>
                      {(order.status === 'Pending' || order.status === 'Batched') && (
                        <button 
                          className="btn-logout" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => handleEditClick(order)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => setActiveTab('new')}
        >
          <PlusCircle size={22} strokeWidth={activeTab === 'new' ? 2.5 : 2} />
          <span>New Order</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          <ListOrdered size={22} strokeWidth={activeTab === 'list' ? 2.5 : 2} />
          <span>My Orders</span>
        </button>
      </nav>
    </div>
  );
}
