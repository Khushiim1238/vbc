import { useState, useEffect } from 'react';
import { api } from '../api';
import './SalesScreen.css';

export default function AccountsScreen({ device }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      const data = await api.getOrders();
      const accountsOrders = data.filter(o => 
        ['Dispatched', 'Payment Pending', 'Paid'].includes(o.status)
      );
      accountsOrders.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      setOrders(accountsOrders);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.updateOrderStatus(orderId, { status: newStatus });
      loadOrders();
    } catch (e) {
      alert('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Dispatched': 'badge-dispatched',
      'Payment Pending': 'badge-payment',
      'Paid': 'badge-paid'
    };
    return <span className={`badge ${colors[status] || ''}`}>{status}</span>;
  };

  return (
    <div className="owner-container">
      <h2>Accounts Dashboard</h2>
      <div className="card">
        <h3>Pending & Completed Payments</h3>
        <div className="table-container" style={{ marginTop: '1rem' }}>
          {orders.length === 0 ? (
            <p className="empty-state" style={{ padding: '2rem' }}>No orders for accounts.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Product Details</th>
                  <th>Amount Due</th>
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
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Vehicle: {order.assigned_vehicle || 'N/A'}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      ₹{(order.qty * order.rate).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                    <td>
                      {getStatusBadge(order.status)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {(order.status === 'Dispatched' || order.status === 'Payment Pending') && (
                          <>
                            <button 
                              className="btn-primary" 
                              style={{ background: '#10b981', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                              onClick={() => handleUpdateStatus(order.id, 'Paid')}
                            >
                              Mark Paid
                            </button>
                            {order.status === 'Dispatched' && (
                              <button 
                                className="btn-logout" 
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                onClick={() => handleUpdateStatus(order.id, 'Payment Pending')}
                              >
                                Mark Pending
                              </button>
                            )}
                          </>
                        )}
                        {order.status === 'Paid' && (
                          <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>✓ Received</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
