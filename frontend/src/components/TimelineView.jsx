import { History, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';

const filters = [['5', 'Last 5 min'], ['15', 'Last 15 min'], ['30', 'Last 30 min'], ['120', 'All available']];

export default function TimelineView({ timeline = [] }) {
  const [filter, setFilter] = useState('30');
  const visible = useMemo(() => {
    if (filter === '120') return timeline;
    const reference = timeline.reduce((latest, item) => Math.max(latest, new Date(item.timestamp || 0).getTime()), 0);
    const cutoff = reference - Number(filter) * 60 * 1000;
    return timeline.filter((item) => new Date(item.timestamp || item.time).getTime() >= cutoff);
  }, [filter, timeline]);
  const getIcon = (item) => item.is_anomaly ? <ShieldAlert className="h-4 w-4 text-red-500" /> : item.event_type === 'WEATHER' ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <Info className="h-4 w-4 text-emerald-500" />;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-pulseBorder dark:bg-pulsePanel">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"><History className="h-4 w-4" />History</div>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded border border-slate-200 bg-transparent px-2 py-1 text-[11px] dark:border-pulseBorder">
          {filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {visible.map((item) => (
          <div key={item.event_id || item.id} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-pulseBorder dark:bg-pulseDark/50">
            <div className="mt-0.5">{getIcon(item)}</div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.event_type || item.type} {item.is_anomaly ? 'anomaly' : 'normal'}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{item.value} {item.unit || ''} · {item.source}</div>
              <div className="mt-1 text-[10px] text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
        {visible.length === 0 && <div className="pt-10 text-center text-xs text-slate-400">No events in this time window.</div>}
      </div>
    </div>
  );
}
