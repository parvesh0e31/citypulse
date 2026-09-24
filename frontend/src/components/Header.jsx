import { Activity, Sun, Moon, MapPin, Radio, Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function Header({
  selectedZone,
  onZoneChange,
  connectionStatus = "LIVE",
  elapsedSeconds = 0,
}) {
  const { theme, toggleTheme } = useTheme();

  const zones = [
    "Zone 1 — Downtown",
    "Zone 2 — Residential",
    "Zone 3 — Industrial",
    "Zone 4 — University",
    "Zone 5 — Market",
    "Zone 6 — Highway Corridor",
  ];

  const isLive = connectionStatus === "LIVE" || connectionStatus === "Live";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur transition-colors duration-300 dark:border-pulseBorder dark:bg-pulsePanel/90">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        
        {/* Brand & Live Indicator */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 ring-1 ring-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:ring-blue-400/30">
            <Activity className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                CITY<span className="text-blue-600 dark:text-blue-400">PULSE</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${
                  isLive
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
                    : "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30"
                }`}
              >
                <Radio className={`h-3 w-3 ${isLive ? "animate-spin" : ""}`} />
                {connectionStatus}
              </span>
            </div>
            <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
              Live Civic Health & Heterogeneous Data Correlation
            </p>
          </div>
        </div>

        {/* Controls: Sector Selector, Simulation Clock, Theme Switcher */}
        <div className="flex items-center space-x-3">
          
          {/* District / Zone Selector */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-pulseBorder dark:bg-pulseDark">
            <MapPin className="mr-1.5 h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <select
              value={selectedZone}
              onChange={(e) => onZoneChange(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 outline-none transition-colors dark:text-slate-200 cursor-pointer"
            >
              {zones.map((zone) => (
                <option key={zone} value={zone} className="bg-white text-slate-900 dark:bg-pulsePanel dark:text-slate-100">
                  {zone}
                </option>
              ))}
            </select>
          </div>

          {/* Simulation Clock Display */}
          <div className="hidden items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono font-medium text-slate-700 md:flex dark:border-pulseBorder dark:bg-pulseDark dark:text-slate-300">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>+{elapsedSeconds}s</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            type="button"
            aria-label="Toggle Theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:bg-slate-100 dark:border-pulseBorder dark:bg-pulseDark dark:text-slate-300 dark:hover:bg-slate-800/80"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-600 transition-transform duration-200 hover:-rotate-12" />
            )}
          </button>

        </div>
      </div>
    </header>
  );
}