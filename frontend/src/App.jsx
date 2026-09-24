import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LiveMap from './components/LiveMap';
import TimelineView from './components/TimelineView'; // <-- Import the Timeline

export default function App() {
  const [selectedZone, setSelectedZone] = useState("Zone 3 — Industrial");
  const [connectionStatus, setConnectionStatus] = useState("CONNECTING");
  const [simSeconds, setSimSeconds] = useState(0);
  const [data, setData] = useState({
    pulse_score: 100,
    summary: "Initializing district correlation stream...",
    events: [],
    timeline: [] // <-- Add timeline to initial state
  });

  useEffect(() => {
    const eventSource = new EventSource("http://localhost:8000/api/stream");

    eventSource.onopen = () => setConnectionStatus("LIVE");

    eventSource.onmessage = (event) => {
      setData(JSON.parse(event.data));
      setSimSeconds((prev) => prev + 5);
    };

    eventSource.onerror = () => setConnectionStatus("STALE / DEGRADED");

    return () => eventSource.close();
  }, []);

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
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${data.pulse_score >= 80 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                {data.pulse_score >= 80 ? "OPTIMAL" : "ATTENTION"}
              </span>
            </div>
            <div className="my-6 text-center">
              <span className="text-5xl font-black text-slate-900 dark:text-white">{data.pulse_score}</span>
              <span className="text-sm font-semibold text-slate-400"> / 100</span>
            </div>
            <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">Composite stability metric; not an official city measurement.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:col-span-3 sm:grid-cols-3">
            {data.events.map((ev, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-pulseBorder dark:bg-pulsePanel">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{ev.type} STREAM</span>
                <div className="mt-2 text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                  <span>{ev.value.toFixed(1)}</span>
                  {ev.is_anomaly && <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-1 rounded">ANOMALY</span>}
                </div>
                <p className="mt-1 text-xs text-slate-400">{ev.source}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`rounded-xl border p-4 transition-colors ${data.pulse_score < 100 ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10' : 'border-blue-100 bg-blue-50/50 dark:border-pulseBorder dark:bg-pulsePanel'}`}>
          <div className={`flex items-center space-x-2 text-xs font-bold uppercase tracking-wider ${data.pulse_score < 100 ? 'text-amber-700 dark:text-amber-500' : 'text-blue-700 dark:text-blue-400'}`}>
            <span>Situational Intelligence Summary</span>
          </div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
            {data.summary}
          </p>
        </section>

        {/* Lower Canvas Layout: 2/3 Map, 1/3 Timeline */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 h-[450px]">
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-colors dark:border-pulseBorder dark:bg-pulsePanel relative z-0 h-full">
            <LiveMap events={data.events} />
          </div>
          <div className="lg:col-span-1 h-full">
            <TimelineView timeline={data.timeline} />
          </div>
        </section>

      </main>
    </div>
  );
}