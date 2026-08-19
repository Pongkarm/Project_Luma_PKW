// frontend/js/api.js — Central API Client for Project LUMA
const API_BASE = '/api';

async function apiCall(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('luma_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            if (response.status === 401 && !endpoint.includes('/login')) {
                localStorage.removeItem('luma_token');
                window.location.href = '/login.html';
                return;
            }
            throw new Error(data.message || data.error || `HTTP Error ${response.status}`);
        }

        return data;
    } catch (err) {
        console.error(`[API Error] ${method} ${endpoint}:`, err);
        throw err;
    }
}

// Helper: Polling Task Status
async function pollTaskStatus(taskId, onProgress = null, maxAttempts = 60) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            try {
                const res = await apiCall(`/task/${taskId}`);
                if (onProgress) onProgress(res);

                if (res.status === 'completed') {
                    clearInterval(interval);
                    resolve(res);
                } else if (res.status === 'failed') {
                    clearInterval(interval);
                    reject(new Error(res.error || 'AI generation failed'));
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    reject(new Error('Task timeout (exceeded 3 minutes)'));
                }
            } catch (err) {
                clearInterval(interval);
                reject(err);
            }
        }, 3000);
    });
}
