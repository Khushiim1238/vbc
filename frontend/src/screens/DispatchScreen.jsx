import { useState, useEffect } from 'react';
import { ClipboardList, PackageCheck, History } from 'lucide-react';
import { api } from '../api';
import './SalesScreen.css';

export default function DispatchScreen({ device }) {
  const [orders, setOrders] = useState([]);
  const [groupingMode, setGroupingMode] = useState('urgency');
  const [activeTab, setActiveTab] = useState('Pending');
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [bulkVehicleNumber, setBulkVehicleNumber] = useState('');

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  // Clear selections when switching tabs
  useEffect(() => {
    setSelectedOrders(new Set());
    setBulkVehicleNumber('');
  }, [activeTab]);

  const loadOrders = async () => {
    try {
      const data = await api.getOrders();
      const dispatchOrders = data.filter(o => 
        ['Pending', 'Batched', 'Dispatched'].includes(o.status)
      );
      setOrders(dispatchOrders);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus, vehicle = null) => {
    try {
      await api.updateOrderStatus(orderId, { 
        status: newStatus,
        assigned_vehicle: vehicle
      });
      loadOrders();
    } catch (e) {
      alert('Failed to update status');
    }
  };

  const toggleSelection = (orderId) => {
    const next = new Set(selectedOrders);
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    setSelectedOrders(next);
  };

  const handleBulkDispatch = async () => {
    if (!bulkVehicleNumber) {
      alert('Please enter a vehicle number for dispatch.');
      return;
    }
    try {
      const promises = Array.from(selectedOrders).map(orderId => 
        api.updateOrderStatus(orderId, { status: 'Dispatched', assigned_vehicle: bulkVehicleNumber })
      );
      await Promise.all(promises);
      setSelectedOrders(new Set());
      setBulkVehicleNumber('');
      loadOrders();
    } catch (e) {
      alert('Failed to dispatch some orders.');
    }
  };

  // Filter orders by active tab
  const tabOrders = orders.filter(o => o.status === activeTab);

  // Apply grouping/sorting to the filtered orders
  let displayGroups = {};
  if (groupingMode === 'region') {
    tabOrders.forEach(o => {
      const region = o.delivery_area || 'Unknown';
      if (!displayGroups[region]) displayGroups[region] = [];
      displayGroups[region].push(o);
    });
  } else {
    const sorted = [...tabOrders].sort((a, b) => {
      if (groupingMode === 'quantity') {
        return b.qty - a.qty;
      } else {
        return new Date(a.created_at) - new Date(b.created_at);
      }
    });
    displayGroups['All Orders'] = sorted;
  }

  const getStatusBadge = (status) => {
    const colors = {
      'Pending': 'badge-pending',
      'Batched': 'badge-batched',
      'Dispatched': 'badge-dispatched'
    };
    return <span className={`badge ${colors[status] || ''}`}>{status}</span>;
  };

  return (
    <div className="owner-container">
      <h2>Dispatch Dashboard</h2>
      
      {/* Tab Navigation moved to bottom */}

      {/* Bulk Action Bar (Only shows in 'Batched' tab when items are selected) */}
      {activeTab === 'Batched' && selectedOrders.size > 0 && (
        <div className="card" style={{ marginBottom: '1rem', background: '#EFF6FF', borderColor: '#BFDBFE', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <strong style={{ color: '#1E3A8A', whiteSpace: 'nowrap' }}>{selectedOrders.size} order(s) selected</strong>
          <input 
            type="text" 
            placeholder="Enter Vehicle No. (e.g. MH12 AB 1234)" 
            value={bulkVehicleNumber}
            onChange={(e) => setBulkVehicleNumber(e.target.value)}
            style={{ flex: '1 1 200px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: 'var(--text-main)', minWidth: '150px' }}
          />
          <button className="btn-primary" onClick={handleBulkDispatch} style={{ whiteSpace: 'nowrap' }}>
            Dispatch Selected
          </button>
        </div>
      )}

      {/* Grouping Controls */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <strong>View By:</strong>
          <select value={groupingMode} onChange={e => setGroupingMode(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', background: '#FFFFFF', color: 'var(--text-main)', border: '1px solid #CBD5E1' }}>
            <option value="urgency">Urgency (Oldest First)</option>
            <option value="quantity">Quantity (Largest First)</option>
            <option value="region">Region / Area</option>
          </select>
        </div>
      </div>

      {/* Render Groups */}
      {Object.entries(displayGroups).map(([groupName, groupOrders]) => (
        <div key={groupName} className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            {groupName} <span style={{ fontSize: '0.9rem', color: '#9ca3af', fontWeight: 'normal' }}>({groupOrders.length} orders)</span>
          </h3>
          <div className="table-container">
            {groupOrders.length === 0 ? (
              <p className="empty-state" style={{ padding: '2rem' }}>No orders in this stage.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    {activeTab === 'Batched' && <th style={{ width: '40px' }}></th>}
                    <th>Order ID</th>
                    <th>Customer Details</th>
                    <th>Product & Area</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupOrders.map(order => (
                    <tr 
                      key={order.id}
                      style={{ 
                        background: selectedOrders.has(order.id) ? '#EFF6FF' : 'transparent',
                        cursor: activeTab === 'Batched' ? 'pointer' : 'default'
                      }}
                      onClick={() => {
                        if (activeTab === 'Batched') toggleSelection(order.id);
                      }}
                    >
                      {activeTab === 'Batched' && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={selectedOrders.has(order.id)}
                            onChange={() => toggleSelection(order.id)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                          />
                        </td>
                      )}
                      <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>#{order.id}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                      </td>
                      <td>
                        <div>{order.product_code} (Qty: {order.qty})</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Area: {order.delivery_area}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.9rem' }}>{new Date(order.created_at).toLocaleDateString()}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      </td>
                      <td>
                        {getStatusBadge(order.status)}
                        {order.status === 'Dispatched' && (
                          <div style={{ fontSize: '0.8rem', color: '#10B981', marginTop: '0.25rem', fontWeight: 500 }}>
                            via {order.assigned_vehicle}
                          </div>
                        )}
                      </td>
                      <td>
                        {order.status === 'Pending' && (
                          <button 
                            className="btn-primary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(order.id, 'Batched');
                            }}
                          >
                            Mark Batched
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ))}
      
      {Object.keys(displayGroups).length === 0 && (
        <div className="card">
          <p className="empty-state">No orders in this stage.</p>
        </div>
      )}
      
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'Pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('Pending')}
        >
          <ClipboardList size={22} strokeWidth={activeTab === 'Pending' ? 2.5 : 2} />
          <span>Needs Batching</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'Batched' ? 'active' : ''}`}
          onClick={() => setActiveTab('Batched')}
        >
          <PackageCheck size={22} strokeWidth={activeTab === 'Batched' ? 2.5 : 2} />
          <span>Ready to Dispatch</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'Dispatched' ? 'active' : ''}`}
          onClick={() => setActiveTab('Dispatched')}
        >
          <History size={22} strokeWidth={activeTab === 'Dispatched' ? 2.5 : 2} />
          <span>History</span>
        </button>
      </nav>
    </div>
  );
}
