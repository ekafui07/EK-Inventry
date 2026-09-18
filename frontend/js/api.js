/**
 * API Client Configuration and Fetch Interceptor
 */
const API_BASE_URL = 
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api';

window.API_URL = API_BASE_URL;

// Global Fetch Interceptor to inject Authorization Bearer tokens automatically
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
  
  if (url && !url.includes('/login') && !url.includes('/forgot-password')) {
    const userJson = sessionStorage.getItem('EK_CURRENT_USER');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        if (user && user.token) {
          if (!config) config = {};
          if (!config.headers) config.headers = {};
          
          if (config.headers instanceof Headers) {
             if (!config.headers.has('Authorization')) {
               config.headers.append('Authorization', `Bearer ${user.token}`);
             }
          } else {
             if (!config.headers['Authorization']) {
               config.headers['Authorization'] = `Bearer ${user.token}`;
             }
          }
        }
      } catch(e) {}
    }
  }
  
  const response = await originalFetch(resource, config);
  
  if (response.status === 401) {
    const wasLoggedIn = !!sessionStorage.getItem('EK_CURRENT_USER');
    if (wasLoggedIn && !url.includes('/login') && !url.includes('/forgot-password')) {
      sessionStorage.removeItem('EK_CURRENT_USER');
      location.reload();
    }
  } else if (response.status === 403) {
    if (window.showToast) {
      window.showToast('Permission Denied: You do not have permission for this action.', 'danger');
    }
  }
  
  return response;
};
