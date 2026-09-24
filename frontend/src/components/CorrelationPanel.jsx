import { ArrowRightLeft, MapPin, Clock3 } from 'lucide-react';

export default function CorrelationPanel({ links = [], events = [] }) {
  const byId = Object.fromEntries(events.map((event) => [event.id, event]));
  return (
    <section className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
        <ArrowRightLeft className="h-4 w-4" />
        <span>Observed correlations</span>
      </div>
      {links.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">No cross-feed relationship detected in the current window.</p>
      ) : links.map((link) => {
        const first = byId[link.events[0]];
        const second = byId[link.events[1]];
        return (
          <div key={link.events.join('-')} className="rounded-lg border border-purple-200 bg-white/70 p-3 dark:border-purple-900/50 dark:bg-pulsePanel/70">
            <div className="font-bold text-slate-800 dark:text-slate-100">{first?.type} <span className="text-purple-500">↔</span> {second?.type}</div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{link.distance_km} km</span>
              <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{link.time_minutes} min</span>
              <strong>Score: {link.correlation_score}</strong>
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{link.reasons.join(' · ')}</div>
            <div className="mt-2 text-xs font-semibold text-purple-700 dark:text-purple-300">{link.disclaimer}</div>
          </div>
        );
      })}
    </section>
  );
}
