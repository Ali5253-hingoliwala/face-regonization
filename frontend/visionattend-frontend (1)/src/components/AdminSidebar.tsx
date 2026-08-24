import { Activity, BarChart3, CalendarDays, CalendarClock, LayoutDashboard, LogOut, UserRound, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Live Session", to: "/admin/live-session", icon: Activity },
  { label: "Attendance", to: "/admin/attendance", icon: BarChart3 },
  { label: "Students", to: "/admin/students", icon: Users },
  { label: "Calendar", to: "/admin/calendar", icon: CalendarDays },
  { label: "Schedule", to: "/admin/schedule", icon: CalendarClock },
  { label: "Profile", to: "/profile", icon: UserRound },
];

export default function AdminSidebar({ open = true, onClose }: { open?: boolean; onClose?: () => void }) {
  const { name, logout } = useAuth();
  return <><aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-panel transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
    <div className="border-b border-line px-6 py-5"><div className="font-display text-xl font-semibold">VisionAttend</div><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-accent">AI Attendance</p></div>
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">{links.map(({label,to,icon:Icon})=><NavLink key={to} to={to} end={to==="/admin"} onClick={onClose} className={({isActive})=>`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${isActive?"bg-accent text-white shadow-sm":"text-ink-muted hover:bg-panel-hover hover:text-ink"}`}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
    <div className="border-t border-line p-4"><div className="mb-3 rounded-xl bg-panel-hover px-4 py-3"><p className="text-sm font-medium">{name || "Administrator"}</p><p className="mt-1 text-xs text-ink-muted">Administrator</p></div><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-ink-muted transition hover:bg-red-50 hover:text-red-600"><LogOut size={18}/>Logout</button></div>
  </aside>{open&&onClose&&<button aria-label="Close sidebar" onClick={onClose} className="fixed inset-0 z-40 bg-black/20 lg:hidden"/>}</>;
}
