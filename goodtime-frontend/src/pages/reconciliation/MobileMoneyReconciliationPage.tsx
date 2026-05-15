import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { reconApi } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import { Upload, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function MobileMoneyReconciliationPage() {
  const { user } = useAuthStore();
  const [sessionId, setSessionId] = useState('');
  const [result, setResult] = useState<any>(null);

  const startSession = useMutation({
    mutationFn: () => reconApi.startSession({ type: 'mobile_money', branchId: user?.branchId || '' }),
    onSuccess: (d: any) => { setSessionId(d.sessionId); toast.success('Session started'); },
    onError: (e: any) => toast.error(e.message),
  });

  const runGL = useMutation({
    mutationFn: () => reconApi.reconcileGL(sessionId),
    onSuccess: (d: any) => setResult(d),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="page-header"><div><h1 className="page-title">Mobile Money Reconciliation</h1><p className="page-subtitle">Reconcile MTN MoMo & Vodafone Cash transactions</p></div></div>

      {!sessionId ? (
        <div className="card p-6 text-center space-y-4">
          <Upload size={40} className="mx-auto text-slate-300"/>
          <p className="text-slate-600">Start a mobile money reconciliation session.</p>
          <button onClick={() => startSession.mutate()} disabled={startSession.isPending} className="btn-primary px-8">
            {startSession.isPending ? 'Starting…' : 'Start MM Reconciliation'}
          </button>
        </div>
      ) : result ? (
        <div className={`card p-6 text-center ${result.balanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          {result.balanced ? <CheckCircle size={48} className="text-emerald-600 mx-auto mb-4"/> : <XCircle size={48} className="text-red-600 mx-auto mb-4"/>}
          <h2 className="text-xl font-bold mb-4">{result.balanced ? 'GL Balanced' : 'GL Imbalance Detected'}</h2>
          <div className="space-y-2 text-sm mb-4">
            {[['Total Debits', `GHS ${(Number(result.debits)/100).toFixed(2)}`], ['Total Credits', `GHS ${(Number(result.credits)/100).toFixed(2)}`]].map(([l,v]) => (
              <div key={l} className="flex justify-between"><span className="text-slate-600">{l}</span><strong>{v}</strong></div>
            ))}
          </div>
          <button onClick={() => { setResult(null); setSessionId(''); }} className="btn-secondary mt-4">New Session</button>
        </div>
      ) : (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Run GL Balance Check</h3></div>
          <div className="card-body space-y-4">
            <p className="text-sm text-slate-500">Session: <code className="font-mono">{sessionId.slice(0,8)}…</code></p>
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">This will verify that total debits equal total credits for all mobile money transactions today.</div>
            <button onClick={() => runGL.mutate()} disabled={runGL.isPending} className="btn-primary w-full py-3">
              {runGL.isPending ? 'Running…' : 'Run GL Balance Check'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
