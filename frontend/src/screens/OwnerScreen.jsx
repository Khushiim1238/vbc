import { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { LayoutDashboard, PieChart as PieChartIcon } from 'lucide-react';

export default function OwnerScreen() {
  const [orders, setOrders] = useState([]);
  const [devices, setDevices] = useState([]);
  const [activeTab, setActiveTab] = useState('data'); // 'data' or 'charts'

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const ordersData = await api.getOrders();
      ordersData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(ordersData);
      
      const devicesData = await api.getDevices();
      setDevices(devicesData);
    } catch (e) {
      console.error(e);
    }
  };

  const getDeviceName = (deviceId) => {
    const d = devices.find(x => x.id === deviceId);
    return d ? d.name : deviceId || 'Unknown';
  };

  const kpis = useMemo(() => {
    let totalRevenue = 0;
    let totalQty = 0;
    let pendingRevenue = 0;

    orders.forEach(o => {
      const rev = o.qty * o.rate;
      totalRevenue += rev;
      totalQty += o.qty;
      if (['Pending', 'Batched'].includes(o.status)) {
        pendingRevenue += rev;
      }
    });

    return { totalRevenue, totalOrders: orders.length, totalQty, pendingRevenue };
  }, [orders]);

  const revenueByDay = useMemo(() => {
    const daily = {};
    orders.forEach(o => {
      const d = new Date(o.created_at);
      const dateStr = d.toLocaleDateString();
      if (!daily[dateStr]) daily[dateStr] = { revenue: 0, orders: 0, qty: 0 };
      daily[dateStr].revenue += (o.qty * o.rate);
      daily[dateStr].orders += 1;
      daily[dateStr].qty += o.qty;
    });
    
    return Object.entries(daily)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [orders]);

  const salesTeamAnalysis = useMemo(() => {
    const reps = {};
    orders.forEach(o => {
      const id = o.sales_person_id || 'Unknown';
      const name = getDeviceName(id);
      
      if (!reps[name]) reps[name] = { revenue: 0, orders: 0, qty: 0 };
      reps[name].revenue += (o.qty * o.rate);
      reps[name].orders += 1;
      reps[name].qty += o.qty;
    });
    return Object.entries(reps)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders, devices]);

  const statusDistribution = useMemo(() => {
    const counts = {};
    orders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#6366F1', '#8B5CF6'];

  const getStatusBadge = (status) => {
    return <span className="badge">{status}</span>;
  };

  const formatINR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  return (
    <div className="owner-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Executive Dashboard</h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Live Feed</div>
      </div>

      {activeTab === 'data' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ marginBottom: 0 }}>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Revenue</p>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>{formatINR(kpis.totalRevenue)}</h3>
            </div>
            <div className="card" style={{ marginBottom: 0 }}>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Revenue</p>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{formatINR(kpis.pendingRevenue)}</h3>
            </div>
            <div className="card" style={{ marginBottom: 0 }}>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Orders</p>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>{kpis.totalOrders}</h3>
            </div>
            <div className="card" style={{ marginBottom: 0 }}>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items Sold</p>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>{kpis.totalQty.toLocaleString()} units</h3>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
            <div className="card" style={{ marginBottom: 0, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Sales Team Performance</h3>
              </div>
              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                {salesTeamAnalysis.length === 0 ? (
                  <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No sales data.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Representative</th>
                        <th>Orders</th>
                        <th>Items</th>
                        <th>Revenue Generated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesTeamAnalysis.map(rep => (
                        <tr key={rep.name}>
                          <td style={{ fontWeight: 600 }}>{rep.name}</td>
                          <td>{rep.orders}</td>
                          <td>{rep.qty}</td>
                          <td style={{ fontWeight: 600 }}>{formatINR(rep.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 0, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Day-Wise Summary</h3>
              </div>
              <div className="table-container" style={{ border: 'none', borderRadius: 0, maxHeight: '400px', overflowY: 'auto' }}>
                {revenueByDay.length === 0 ? (
                  <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No daily data.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Orders</th>
                        <th>Items</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueByDay.slice().reverse().map(day => (
                        <tr key={day.date}>
                          <td style={{ fontWeight: 500 }}>{day.date}</td>
                          <td>{day.orders}</td>
                          <td>{day.qty}</td>
                          <td style={{ fontWeight: 600 }}>{formatINR(day.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Recent Activity Pulse</h3>
            </div>
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              {orders.length === 0 ? (
                <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No activity yet.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 10).map(order => (
                      <tr key={order.id}>
                        <td style={{ color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td style={{ fontWeight: 600 }}>{order.customer_name}</td>
                        <td>{order.product_code} (Qty: {order.qty})</td>
                        <td style={{ fontWeight: 600 }}>{formatINR(order.qty * order.rate)}</td>
                        <td>{getStatusBadge(order.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'charts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>Revenue Trends</h3>
            <div style={{ height: 350, width: '100%' }}>
              {revenueByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                    <Tooltip 
                      formatter={(value) => formatINR(value)}
                      contentStyle={{ borderRadius: '4px', border: '1px solid var(--border-color)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                      cursor={{ fill: '#F5F5F5' }}
                    />
                    <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data</div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>Order Pipeline</h3>
            <div style={{ height: 350, width: '100%' }}>
              {statusDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '4px', border: '1px solid var(--border-color)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.85rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data</div>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          <LayoutDashboard size={22} strokeWidth={activeTab === 'data' ? 2.5 : 2} />
          <span>Dashboard</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          <PieChartIcon size={22} strokeWidth={activeTab === 'charts' ? 2.5 : 2} />
          <span>Analytics</span>
        </button>
      </nav>

    </div>
  );
}
