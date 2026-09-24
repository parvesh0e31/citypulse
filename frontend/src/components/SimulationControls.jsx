const stages = [
  ['normal', 'Stage 1 - Normal'],
  ['weather', 'Stage 2 - Weather'],
  ['disruption', 'Stage 3 - Disruption'],
  ['multi', 'Stage 4 - Multi-feed event'],
];

export default function SimulationControls({ stage, onStageChange }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-pulseBorder dark:bg-pulsePanel">
      <div className="mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Simulation</h2>
        <p className="mt-1 text-xs text-slate-400">Choose a predictable scenario for the demonstration.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {stages.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onStageChange(value)}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${stage === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-pulseDark dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
