import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5001/api",
  headers: { "Content-Type": "application/json" },
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("app-token");
  if (token) {
    config.headers["x-app-token"] = token;
  }
  return config;
});

// On 401, clear token and reload to show login screen
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("app-token");
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
