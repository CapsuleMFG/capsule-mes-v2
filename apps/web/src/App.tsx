import { trpc } from './trpc';

export function App() {
  const health = trpc.health.useQuery();
  const hello = trpc.hello.useQuery({ name: 'Capsule' });

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/[0.02] p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold">Capsule MES v2</h1>
        <p className="text-gray-600 mt-1">Phase 0 skeleton — typed monorepo.</p>
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-400">API health</dt>
            <dd>{health.isLoading ? '…' : health.data?.ok ? 'ok' : 'down'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">tRPC hello</dt>
            <dd>{hello.data?.message ?? '…'}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
