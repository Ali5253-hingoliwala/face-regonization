import axios from "axios";

// Backend runs locally alongside the ML pipeline (see project notes:
// the pipeline needs a real webcam, so this backend always runs on
// whatever machine has the camera attached, not a remote server).
const API_BASE_URL = "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach the stored token to every request automatically.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("va_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If a token expires or is invalid, the backend returns 401 --
// clear local auth state so the app doesn't sit in a broken
// half-logged-in state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("va_token");
      localStorage.removeItem("va_role");
      localStorage.removeItem("va_name");
      localStorage.removeItem("va_student_id");
    }
    return Promise.reject(error);
  }
);
