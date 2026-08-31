import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import CookieConsent from "./components/CookieConsent";
import SignupConsentGate from "./components/SignupConsentGate";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import LegalPage from "./pages/LegalPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminLiveSessionPage from "./pages/AdminLiveSessionPage";
import AdminAttendancePage from "./pages/AdminAttendancePage";
import AdminStudentsPage from "./pages/AdminStudentsPage";
import AdminCalendarPage from "./pages/AdminCalendarPage";
import AdminSchedulePage from "./pages/AdminSchedulePage";
import AdminLeavePage from "./pages/AdminLeavePage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import StudentAttendancePage from "./pages/StudentAttendancePage";
import StudentCalendarPage from "./pages/StudentCalendarPage";
import StudentLeavePage from "./pages/StudentLeavePage";
import ProfilePage from "./pages/ProfilePage";
import SecurityPage from "./pages/SecurityPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return <AuthProvider><BrowserRouter><CookieConsent/><Routes>
    <Route path="/" element={<LandingPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/signup" element={<><SignupConsentGate/><SignupPage /></>} /><Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="/terms" element={<LegalPage kind="terms" />} /><Route path="/privacy" element={<LegalPage kind="privacy" />} /><Route path="/cookies" element={<LegalPage kind="cookies" />} />
    <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboardPage /></ProtectedRoute>} /><Route path="/admin/live-session" element={<ProtectedRoute requiredRole="admin"><AdminLiveSessionPage /></ProtectedRoute>} /><Route path="/admin/attendance" element={<ProtectedRoute requiredRole="admin"><AdminAttendancePage /></ProtectedRoute>} /><Route path="/admin/students" element={<ProtectedRoute requiredRole="admin"><AdminStudentsPage /></ProtectedRoute>} /><Route path="/admin/calendar" element={<ProtectedRoute requiredRole="admin"><AdminCalendarPage /></ProtectedRoute>} /><Route path="/admin/schedule" element={<ProtectedRoute requiredRole="admin"><AdminSchedulePage /></ProtectedRoute>} /><Route path="/admin/leave" element={<ProtectedRoute requiredRole="admin"><AdminLeavePage /></ProtectedRoute>} /><Route path="/admin/security" element={<ProtectedRoute requiredRole="admin"><SecurityPage /></ProtectedRoute>} />
    <Route path="/student" element={<ProtectedRoute requiredRole="student"><StudentDashboardPage /></ProtectedRoute>} /><Route path="/student/attendance" element={<ProtectedRoute requiredRole="student"><StudentAttendancePage /></ProtectedRoute>} /><Route path="/student/calendar" element={<ProtectedRoute requiredRole="student"><StudentCalendarPage /></ProtectedRoute>} /><Route path="/student/leave" element={<ProtectedRoute requiredRole="student"><StudentLeavePage /></ProtectedRoute>} /><Route path="/student/security" element={<ProtectedRoute requiredRole="student"><SecurityPage /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} /><Route path="*" element={<NotFoundPage />} />
  </Routes></BrowserRouter></AuthProvider>;
}
