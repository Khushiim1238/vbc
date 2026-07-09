import { useState } from 'react';
import { api } from '../api';
import './LoginScreen.css'; // We will create this

export default function LoginScreen({ onLogin }) {
  const [role, setRole] = useState('Sales');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (role === 'Owner' && pin !== '8081') {
      setError('Invalid PIN for Owner access');
      return;
    }

    try {
      // Generate a persistent UUID for this device if it doesn't exist
      let deviceId = localStorage.getItem('vardhman_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('vardhman_device_id', deviceId);
      }

      const deviceData = {
        id: deviceId,
        role,
        name: name.trim()
      };

      // Register with backend
      const response = await api.registerDevice(deviceData);
      onLogin(response);
    } catch (err) {
      setError('Failed to connect to server');
      console.error(err);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Welcome to Vardhman Prefab</h2>
        <p>Set up your device</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Your Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="Sales">Sales Person</option>
              <option value="Dispatch">Dispatch Person</option>
              <option value="Accounts">Accounts Person</option>
              <option value="Owner">Owner</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Your Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Rahul"
            />
          </div>

          {role === 'Owner' && (
            <div className="form-group">
              <label>Owner PIN</label>
              <input 
                type="password" 
                value={pin} 
                onChange={(e) => setPin(e.target.value)} 
                placeholder="****"
              />
            </div>
          )}
          
          <button type="submit" className="btn-primary">Set Up Device</button>
        </form>
      </div>
    </div>
  );
}
