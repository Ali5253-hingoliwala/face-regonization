import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-bg/80 backdrop-blur-md border-b border-line shadow-sm"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="shrink-0">
          <Logo size={26} />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-ink-muted hover:text-ink transition-colors relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-accent transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm text-ink-muted hover:text-ink transition-colors px-4 py-2"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="text-sm bg-accent text-white font-medium px-4 py-2 rounded-md shadow-sm shadow-accent/20 hover:bg-accent-dim hover:shadow-md transition-all"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-ink"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          mobileOpen ? "max-h-64 border-b border-line" : "max-h-0"
        }`}
      >
        <div className="px-6 py-4 flex flex-col gap-4 bg-bg">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-sm text-ink-muted hover:text-ink transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-2">
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="text-sm text-center border border-line rounded-md px-4 py-2 text-ink hover:bg-panel-hover transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              onClick={() => setMobileOpen(false)}
              className="text-sm text-center bg-accent text-white font-medium px-4 py-2 rounded-md hover:bg-accent-dim transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}