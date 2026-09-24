import { CheckCircle2, CircleAlert, CloudOff, Radio } from 'lucide-react';

const statusStyles = {
  LIVE: 'text-emerald-600 dark:text-emerald-400',
  SIMULATED: 'text-blue-600 dark:text-blue-400',
  STALE: 'text-amber-600 dark:text-amber-400',
  OFFLINE: 'text-red-600 dark:text-red-400',
};

function StatusIcon({ status }) {
  if (status === 'OFFLINE') return <CloudOff className="h-4 w-4" />;
  if (status === 'STALE') return <CircleAlert className="h-4 w-4" />;
  if (status === 'SIMULATED') return <Radio className="h-4 w-4" />;
  return <CheckCircle2 className="h-4 w-4" />;
}

export default function FeedHealth({ feeds = {} }) {
  const values = Object.entries(feeds);
  const degraded = values.some(([, feed]) => ['STALE', 'OFFLINE'].includes(feed.status));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-pulseBorder dark:bg-pulsePanel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Data sources</h2>
        {degraded && <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Some feeds are unavailable</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {values.map(([name, feed]) => (
          <div key={name} className="rounded-lg bg-slate-50 p-3 dark:bg-pulseDark/60">
            <div className={`flex items-center gap-2 text-sm font-bold ${statusStyles[feed.status] || statusStyles.STALE}`}>
              <StatusIcon status={feed.status} />
              <span>{feed.status}</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{feed.type}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{name}</div>
            {feed.age_seconds !== null && <div className="mt-2 text-[11px] text-slate-400">Updated {feed.age_seconds}s ago</div>}
          </div>
        ))}
      </div>
      {degraded && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Some data sources are unavailable, but CityPulse is still operating with the other available feeds.</p>}
    </section>
  );
}
