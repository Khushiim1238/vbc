import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';
import SalesScreen from './screens/SalesScreen';
import DispatchScreen from './screens/DispatchScreen';
import AccountsScreen from './screens/AccountsScreen';
import OwnerScreen from './screens/OwnerScreen';
import { LayoutDashboard, ShoppingCart, Truck, Wallet, LogOut, Package } from 'lucide-react';
import './App.css';

function App() {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for identity
    const savedDevice = localStorage.getItem('vardhman_device');
    if (savedDevice) {
      setDevice(JSON.parse(savedDevice));
    }
    setLoading(false);
  }, []);

  const handleLogin = (deviceData) => {
    localStorage.setItem('vardhman_device', JSON.stringify(deviceData));
    setDevice(deviceData);
  };

  const handleLogout = () => {
    localStorage.removeItem('vardhman_device');
    setDevice(null);
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading workspace...</div>;

  const renderSidebarIcon = (role) => {
    switch (role) {
      case 'Sales': return <ShoppingCart size={20} />;
      case 'Dispatch': return <Truck size={20} />;
      case 'Accounts': return <Wallet size={20} />;
      case 'Owner': return <LayoutDashboard size={20} />;
      default: return <Package size={20} />;
    }
  };

  return (
    <BrowserRouter>
      <div className="app-container">
        {device ? (
          <>
            <header className="app-header">
              <h1>
                <Package size={24} style={{ color: 'var(--primary-color)' }} />
                Vardhman
              </h1>
              <div className="user-info">
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                  {device.name}
                </span>
                <button onClick={handleLogout} className="btn-logout" title="Logout">
                  <LogOut size={16} />
                </button>
              </div>
            </header>
            <main className="app-content">
              <Routes>
                {device.role === 'Sales' && <Route path="/*" element={<SalesScreen device={device} />} />}
                {device.role === 'Dispatch' && <Route path="/*" element={<DispatchScreen device={device} />} />}
                {device.role === 'Accounts' && <Route path="/*" element={<AccountsScreen device={device} />} />}
                {device.role === 'Owner' && <Route path="/*" element={<OwnerScreen device={device} />} />}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </>
        ) : (
          <LoginScreen onLogin={handleLogin} />
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;
