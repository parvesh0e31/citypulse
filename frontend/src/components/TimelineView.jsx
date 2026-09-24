import { History, AlertTriangle, Info, ShieldAlert } from 'lucide-react';

export default function TimelineView({ timeline = [] }) {
  const getIcon = (type) => {
    if (type === 'critical') return <ShieldAlert className="h-4 w-4 text-red-500" />;
    if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <Info className="h-4 w-4 text-emerald-500" />;
  };

  const getLineColor = (type) => {
    if (type === 'critical') return 'bg-red-500/50';
    if (type === 'warning') return 'bg-amber-500/50';
    return 'bg-emerald-500/50';
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-pulseBorder dark:bg-pulsePanel">
      <div className="mb-4 flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <History className="h-4 w-4" />
        <span>Live Event Timeline</span>
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
          {timeline.map((item, idx) => (
            <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white bg-slate-50 shadow dark:border-pulsePanel dark:bg-pulseDark md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                {getIcon(item.type)}
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] rounded-lg border border-slate-100 bg-slate-50 p-3 shadow-sm dark:border-pulseBorder dark:bg-pulseDark/50">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{item.time}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${getLineColor(item.type)}`}></span>
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">{item.desc}</div>
              </div>
            </div>
          ))}
          {timeline.length === 0 && (
            <div className="text-center text-xs text-slate-400 pt-10">Waiting for incoming telemetry...</div>
          )}
        </div>
      </div>
    </div>
  );
}