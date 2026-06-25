import { useState } from 'react';
import { trpc } from './trpc';

const STATUS_BADGE: Record<string, string> = {
  in_process: 'bg-amber-50 text-amber-700',
  done: 'bg-blue-50 text-blue-700',
  shipped: 'bg-emerald-50 text-emerald-700',
  scrapped: 'bg-red-50 text-red-700',
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm ring-1 ring-black/[0.02] p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </section>
  );
}

export function App() {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const productLines = trpc.productLines.list.useQuery();
  const routes = trpc.routes.list.useQuery();
  const jobs = trpc.jobs.list.useQuery();
  const job = trpc.jobs.get.useQuery({ id: selectedJobId ?? 0 }, { enabled: selectedJobId != null });

  const refresh = () => {
    utils.jobs.list.invalidate();
    if (selectedJobId != null) utils.jobs.get.invalidate({ id: selectedJobId });
  };

  const createJob = trpc.jobs.create.useMutation({
    onSuccess: (res) => {
      utils.jobs.list.invalidate();
      setSelectedJobId(res.job.id);
    },
  });
  const advance = trpc.units.advance.useMutation({ onSuccess: refresh });
  const ship = trpc.shipments.ship.useMutation({ onSuccess: refresh });

  // New-job form state
  const [lineId, setLineId] = useState<number | ''>('');
  const linesRoutes = (routes.data ?? []).filter((r) => r.productLineId === lineId);
  const [routeId, setRouteId] = useState<number | ''>('');
  const [customer, setCustomer] = useState('');
  const [qty, setQty] = useState(3);

  const doneUnitIds = (job.data?.units ?? []).filter((u) => u.status === 'done').map((u) => u.id);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold">Capsule MES v2</h1>
          <p className="text-sm text-gray-500">Phase 1 — jobs → units → stations → shipping</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* New job */}
        <Card title="New job">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-gray-400 text-xs">Product line</span>
                <select
                  className="mt-1 w-full bg-white ring-1 ring-gray-200 rounded-[10px] text-sm px-3 py-2 focus:ring-2 focus:ring-gray-900"
                  value={lineId}
                  onChange={(e) => { setLineId(Number(e.target.value) || ''); setRouteId(''); }}
                >
                  <option value="">Select…</option>
                  {(productLines.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-gray-400 text-xs">Route</span>
                <select
                  className="mt-1 w-full bg-white ring-1 ring-gray-200 rounded-[10px] text-sm px-3 py-2 focus:ring-2 focus:ring-gray-900"
                  value={routeId}
                  onChange={(e) => setRouteId(Number(e.target.value) || '')}
                  disabled={lineId === ''}
                >
                  <option value="">Select…</option>
                  {linesRoutes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.steps.length} steps)</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-gray-400 text-xs">Customer</span>
                <input
                  className="mt-1 w-full bg-white ring-1 ring-gray-200 rounded-[10px] text-sm px-3 py-2 focus:ring-2 focus:ring-gray-900"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-400 text-xs">Quantity</span>
                <input
                  type="number" min={1} max={1000}
                  className="mt-1 w-full bg-white ring-1 ring-gray-200 rounded-[10px] text-sm px-3 py-2 focus:ring-2 focus:ring-gray-900"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            </div>
            <button
              className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-[10px] active:scale-[0.98] transition-all disabled:opacity-40"
              disabled={lineId === '' || routeId === '' || createJob.isPending}
              onClick={() =>
                createJob.mutate({
                  productLineId: Number(lineId),
                  routeId: Number(routeId),
                  customer: customer || undefined,
                  quantity: qty,
                })
              }
            >
              {createJob.isPending ? 'Creating…' : 'Create job + units'}
            </button>
          </div>
        </Card>

        {/* Jobs list */}
        <Card title="Jobs">
          <div className="divide-y divide-gray-50">
            {(jobs.data ?? []).length === 0 && <p className="text-sm text-gray-400">No jobs yet.</p>}
            {(jobs.data ?? []).map((j) => (
              <button
                key={j.id}
                onClick={() => setSelectedJobId(j.id)}
                className={`w-full text-left py-2.5 px-2 rounded-lg flex items-center justify-between hover:bg-gray-50 ${selectedJobId === j.id ? 'bg-gray-50' : ''}`}
              >
                <span className="text-sm font-medium">{j.jobNumber}</span>
                <span className="text-xs text-gray-500">{j.customer ?? '—'}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Selected job detail */}
        <section className="lg:col-span-2">
          <Card title={job.data ? `Units — ${job.data.job.jobNumber}` : 'Units'}>
            {!selectedJobId && <p className="text-sm text-gray-400">Select a job to see its units.</p>}
            {selectedJobId && job.data && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">
                    {job.data.units.length} unit(s){job.data.job.customer ? ` · ${job.data.job.customer}` : ''}
                  </p>
                  <button
                    className="bg-white ring-1 ring-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-[10px] active:scale-[0.98] transition-all disabled:opacity-40"
                    disabled={doneUnitIds.length === 0 || ship.isPending}
                    onClick={() => ship.mutate({ unitIds: doneUnitIds, carrier: 'UPS' })}
                  >
                    Ship done units ({doneUnitIds.length})
                  </button>
                </div>
                <div className="overflow-hidden rounded-xl ring-1 ring-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-400 text-xs">
                      <tr>
                        <th className="text-left font-medium px-4 py-2">Serial</th>
                        <th className="text-left font-medium px-4 py-2">Current station</th>
                        <th className="text-left font-medium px-4 py-2">Status</th>
                        <th className="text-right font-medium px-4 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.data.units.map((u) => (
                        <tr key={u.id} className="border-t border-gray-50">
                          <td className="px-4 py-2.5 text-gray-600">{u.serial}</td>
                          <td className="px-4 py-2.5 text-gray-600">{u.currentStationName ?? <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-2.5"><Badge status={u.status} /></td>
                          <td className="px-4 py-2.5 text-right">
                            {u.status === 'in_process' && (
                              <button
                                className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg active:scale-[0.98] transition-all"
                                onClick={() => advance.mutate({ unitId: u.id })}
                              >
                                Advance →
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}
