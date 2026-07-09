const API_BASE_URL = "https://vbc-backend-6qoj.onrender.com";

export const api = {
    // Devices
    registerDevice: async (deviceData) => {
        const res = await fetch(`${API_BASE_URL}/devices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deviceData),
        });
        return res.json();
    },
    getDevices: async () => {
        const res = await fetch(`${API_BASE_URL}/devices`);
        return res.json();
    },
    
    // Products
    getProducts: async () => {
        const res = await fetch(`${API_BASE_URL}/products`);
        return res.json();
    },
    
    // Orders
    createOrder: async (orderData) => {
        const res = await fetch(`${API_BASE_URL}/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderData),
        });
        return res.json();
    },
    getOrders: async () => {
        const res = await fetch(`${API_BASE_URL}/orders`);
        return res.json();
    },
    updateOrder: async (orderId, orderUpdate) => {
        const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderUpdate),
        });
        return res.json();
    },
    updateOrderStatus: async (orderId, statusData) => {
        const res = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(statusData),
        });
        return res.json();
    }
};
