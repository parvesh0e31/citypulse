import { useState, useEffect } from 'react';
import Header from './components/Header';
import LiveMap from './components/LiveMap';
import TimelineView from './components/TimelineView';
import FeedHealth from './components/FeedHealth';
import CorrelationPanel from './components/CorrelationPanel';
import SimulationControls from './components/SimulationControls';

export default function App() {
  const [selectedZone, setSelectedZone] = useState("Zone 3 — Industrial");
  const [connectionStatus, setConnectionStatus] = useState("CONNECTING");
  const [simSeconds, setSimSeconds] = useState(0);
  const [data, setData] = useState({
    pulse_score: 100,
    summary: "Initializing district correlation stream...",
    events: [],
    timeline: [],
    links: [],
    feeds: {},
    stage: 'normal',
    pulse_status: 'HEALTHY'
  });

  useEffect(() => {
    const eventSource = new EventSource("http://localhost:8000/api/stream");

    eventSource.onopen = () => setConnectionStatus("LIVE");

    eventSource.addEventListener("civic_state", (event) => {
      setData(JSON.parse(event.data));
      setSimSeconds((prev) => prev + 5);
    });

    eventSource.onerror = () => setConnectionStatus("STALE / DEGRADED");

    return () => eventSource.close();
  }, []);

  const changeStage = async (stage) => {
    await fetch(`http://localhost:8000/api/stage/${stage}`, { method: 'POST' });
    setData((current) => ({ ...current, stage }));
  };

  const statusColor = {
    HEALTHY: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    WATCH: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    WARNING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    CRITICAL: 'bg-red-500/10 text-red-600 dark:text-red-400',
  }[data.pulse_status] || 'bg-slate-500/10 text-slate-600';

  return (
    <div className="min-h-screen bg-pulseLight text-slate-900 transition-colors duration-300 dark:bg-pulseDark dark:text-slate-100 flex flex-col font-sans">
      
      <Header
        selectedZone={selectedZone}
        onZoneChange={setSelectedZone}
        connectionStatus={connectionStatus}
        elapsedSeconds={simSeconds}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 space-y-5">
        
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-pulseBorder dark:bg-pulsePanel">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Civic Pulse</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusColor}`}>
                {data.pulse_status}
              </span>
            </div>
            <div className="my-6 text-center">
              <span className="text-5xl font-black text-slate-900 dark:text-white">{data.pulse_score}</span>
              <span className="text-sm font-semibold text-slate-400"> / 100</span>
            </div>
            <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">Transparent demo score based on anomaly severity, affected feeds, and observed correlations.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:col-span-3 sm:grid-cols-3">
            {data.events.map((ev, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-pulseBorder dark:bg-pulsePanel">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{ev.type} STREAM</span>
                <div className="mt-2 text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                  <span>{ev.value.toFixed(1)} <small className="text-xs font-medium text-slate-400">{ev.unit}</small></span>
                  {ev.is_anomaly && <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-1 rounded">ANOMALY</span>}
                </div>
                <p className="mt-1 text-xs text-slate-400">{ev.source} · {ev.zone} · severity {ev.severity}/10</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`rounded-xl border p-4 transition-colors ${data.links.length ? 'border-purple-200 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/20' : 'border-blue-100 bg-blue-50/50 dark:border-pulseBorder dark:bg-pulsePanel'}`}>
          <div className={`flex items-center space-x-2 text-xs font-bold uppercase tracking-wider ${data.pulse_score < 100 ? 'text-amber-700 dark:text-amber-500' : 'text-blue-700 dark:text-blue-400'}`}>
            <span>Situational Intelligence Summary</span>
          </div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
            {data.summary}
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-colors dark:border-pulseBorder dark:bg-pulsePanel relative z-0 h-full">
            <LiveMap events={data.events} links={data.links} />
          </div>
          <div className="lg:col-span-1 h-[450px]">
            <TimelineView timeline={data.timeline} />
          </div>
        </section>

        <CorrelationPanel links={data.links} events={data.events} />
        <FeedHealth feeds={data.feeds} />
        <SimulationControls stage={data.stage} onStageChange={changeStage} />

      </main>
    </div>
  );
}