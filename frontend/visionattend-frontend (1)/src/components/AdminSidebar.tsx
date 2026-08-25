import { Activity, BarChart3, CalendarDays, CalendarClock, FileText, LayoutDashboard, LogOut, UserRound, Users, MoreHorizontal, Sun, Moon, X, ChevronDown } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import NotificationCenter from "./NotificationCenter";

const links = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Live Session", to: "/admin/live-session", icon: Activity },
  { label: "Attendance", to: "/admin/attendance", icon: BarChart3 },
  { label: "Students", to: "/admin/students", icon: Users },
  { label: "Calendar", to: "/admin/calendar", icon: CalendarDays },
  { label: "Schedule", to: "/admin/schedule", icon: CalendarClock },
  { label: "Leave", to: "/admin/leave", icon: FileText },
  { label: "Profile", to: "/profile", icon: UserRound },
];

const pageTitles: Record<string, string> = { "/admin": "Dashboard", "/admin/live-session": "Live Session", "/admin/attendance": "Attendance", "/admin/students": "Students", "/admin/calendar": "Calendar", "/admin/schedule": "Schedule", "/admin/leave": "Leave Management", "/profile": "Profile" };

export default function AdminSidebar() {
  const { name, logout, theme, toggleTheme } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const title = useMemo(() => pageTitles[location.pathname] ?? "Admin Portal", [location.pathname]);

  useEffect(() => {
    document.documentElement.classList.add("portal-active");
    document.documentElement.style.setProperty("--portal-sidebar-offset", open ? "16rem" : "0px");
    return () => { document.documentElement.classList.remove("portal-active"); document.documentElement.style.removeProperty("--portal-sidebar-offset"); };
  }, [open]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) { if (!(event.target as HTMLElement)?.closest?.("[data-profile-menu]")) setProfileOpen(false); }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function requestLogout() { setProfileOpen(false); setConfirmLogout(true); }

  return <>
    <header className="fixed inset-x-0 top-0 z-[60] border-b border-line bg-bg/90 backdrop-blur-xl transition-[left] duration-300" style={{ left: open ? "16rem" : "0" }}>
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button onClick={() => setOpen(v => !v)} aria-label={open ? "Close navigation" : "Open navigation"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-panel text-ink-muted shadow-sm transition hover:-translate-y-0.5 hover:bg-panel-hover hover:text-ink">{open ? <X size={18} /> : <MoreHorizontal size={20} />}</button>
        <div className="min-w-0"><p className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-accent sm:block">VisionAttend · Admin Portal</p><h1 className="truncate font-display text-lg font-semibold sm:text-xl">{title}</h1></div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] text-ink-muted md:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" />AI Attendance System</div>
          <NotificationCenter />
          <button onClick={toggleTheme} aria-label="Toggle theme" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-panel text-ink-muted transition hover:bg-panel-hover hover:text-ink">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="relative hidden sm:block" data-profile-menu>
            <button type="button" onClick={() => setProfileOpen(v => !v)} aria-expanded={profileOpen} aria-haspopup="menu" className="flex h-10 items-center gap-2 rounded-xl border border-line bg-panel px-2.5 text-sm text-ink-muted transition hover:bg-panel-hover"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-xs font-semibold text-accent">{(name || "A").slice(0, 1).toUpperCase()}</span><span className="max-w-24 truncate">{name || "Admin"}</span><ChevronDown size={14} className={`transition-transform ${profileOpen ? "rotate-180" : ""}`} /></button>
            {profileOpen && <div className="absolute right-0 top-[calc(100%+8px)] w-48 overflow-hidden rounded-xl border border-line bg-panel p-1.5 shadow-xl" role="menu"><NavLink to="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-muted hover:bg-panel-hover hover:text-ink" role="menuitem"><UserRound size={16}/>Profile</NavLink><button type="button" onClick={requestLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-muted hover:bg-red-50 hover:text-red-600" role="menuitem"><LogOut size={16}/>Logout</button></div>}
          </div>
        </div>
      </div>
    </header>
    <div className="h-16" aria-hidden="true" />
    {open && <button aria-label="Close sidebar overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#d59a42]/30 bg-gradient-to-b from-[#fffdf9] via-[#f8ead5] to-[#e6bd7d] shadow-2xl transition-transform duration-300 ease-out dark:border-[#dca24d]/40 dark:from-[#061522] dark:via-[#0d2940] dark:to-[#17537a] ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="border-b border-[#d59a42]/30 px-5 pb-5 pt-20 dark:border-[#dca24d]/30"><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#b87318] dark:text-[#f0b44f]">VisionAttend · AI Attendance</p><p className="mt-4 text-sm font-medium text-[#9a641d] dark:text-[#f4c56b]">Welcome back</p><p className="mt-0.5 font-display text-xl font-semibold text-[#8b5712] dark:text-[#ffd27a]">{name || "Administrator"}</p><p className="mt-1 text-xs text-[#a66d20] dark:text-[#e9b75c]">Administrator</p></div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">{links.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end={to === "/admin"} onClick={() => setOpen(false)} className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${isActive ? "bg-[#d98225] text-white shadow-lg shadow-[#d98225]/25" : "text-[#9a641d] hover:translate-x-1 hover:bg-[#d98225]/15 hover:text-[#7c4b0d] dark:text-[#f2b95d] dark:hover:bg-[#e5a03f]/15 dark:hover:text-[#ffd98c]"}`}><Icon size={18} className="transition-transform group-hover:scale-110"/><span>{label}</span></NavLink>)}</nav>
      <div className="border-t border-[#d59a42]/30 p-4 dark:border-[#dca24d]/30"><button onClick={toggleTheme} className="mb-2 flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-[#9a641d] transition hover:bg-[#d98225]/15 hover:text-[#7c4b0d] dark:text-[#f2b95d] dark:hover:bg-[#e5a03f]/15 dark:hover:text-[#ffd98c]"><span className="flex items-center gap-3">{theme === "dark" ? <Moon size={18}/> : <Sun size={18}/>} {theme === "dark" ? "Dark mode" : "Light mode"}</span><span className="text-xs">Switch</span></button><button onClick={() => setConfirmLogout(true)} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-[#9a641d] transition hover:bg-red-500/15 hover:text-red-600 dark:text-[#f2b95d] dark:hover:bg-red-500/15 dark:hover:text-red-300"><LogOut size={18}/>Logout</button></div>
    </aside>
    {confirmLogout && <ConfirmDialog title="Confirm Sign Out" text="Are you sure you want to sign out of your account?" onCancel={() => setConfirmLogout(false)} onConfirm={logout}/>} 
  </>;
}
function ConfirmDialog({ title, text, onCancel, onConfirm }: { title: string; text: string; onCancel: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm" onMouseDown={onCancel}><div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl" onMouseDown={e => e.stopPropagation()}><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><LogOut size={22}/></div><h2 className="mt-4 text-center text-lg font-semibold">{title}</h2><p className="mt-2 text-center text-sm text-ink-muted">{text}</p><div className="mt-6 flex justify-end gap-2"><button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-ink-muted hover:bg-panel-hover">Cancel</button><button onClick={onConfirm} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">Sign Out</button></div></div></div>; }
