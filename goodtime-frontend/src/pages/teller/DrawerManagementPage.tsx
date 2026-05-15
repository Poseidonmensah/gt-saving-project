import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { txnApi } from '@api/index';
import { Wallet, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export function DrawerManagementPage() {
  const qc = useQueryClient();
  const [openAmt, setOpenAmt] = useState('');
  const [closeAmt, setCloseAmt] = useState('');
  const { data: summary, isLoading } = useQuery({ queryKey: ['drawer-summary'], queryFn: txnApi.drawerSummary, refetchInterval: 30000 });

  const open  = useMutation({ mutationFn: () => txnApi.openDrawer(Math.round(parseFloat(openAmt) * 100)), onSuccess: () => { toast.success('Drawer opened'); qc.invalidateQueries({ queryKey: ['drawer-summary'] }); setOpenAmt(''); }});
  const close = useMutation({ mutationFn: () => txnApi.closeDrawer(Math.round(parseFloat(closeAmt) * 100)), onSuccess: (d: any) => { toast[d.balanced ? 'success' : 'error'](d.balanced ? 'Drawer balanced and closed' : `Variance: GHS ${(d.variance/100).toFixed(2)}`); qc.invalidateQueries({ queryKey: ['drawer-summary'] }); setCloseAmt(''); }});

  const fmt = (v: any) => `GHS ${(Number(v||0)/100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header"><div><h1 className="page-title">Drawer Management</h1><p className="page-subtitle">Open, manage and close your teller cash drawer</p></div></div>

      {/* Current drawer status */}
      {summary ? (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold flex items-center gap-2"><Wallet size={16}/> Today's Drawer</h3>
            <span className={`badge ${summary.status === 'open' ? 'badge-green' : 'badge-gray'}`}>{summary.status}</span>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[['Opening Balance', fmt(summary.opening_balance)], ['Current Balance', fmt(summary.closing_balance ?? summary.opening_balance)], ['Total Deposits', fmt(summary.total_deposits)], ['Total Withdrawals', fmt(summary.total_withdrawals)], ['Fees Collected', fmt(summary.total_fees)], ['Transactions', summary.transaction_count || 0]].map(([l,v]) => (
                <div key={l} className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">{l}</p><p className="font-bold text-slate-900">{v}</p></div>
              ))}
            </div>
            {summary.status === 'open' && (
              <div className="border-t pt-4">
                <label className="label">Physical Cash Count (GHS)</label>
                <div className="flex gap-3">
                  <input type="number" step="0.01" value={closeAmt} onChange={e => setCloseAmt(e.target.value)} className="input flex-1 font-mono" placeholder="Enter counted amount"/>
                  <button onClick={() => close.mutate()} disabled={!closeAmt || close.isPending} className="btn-primary px-6">{close.isPending ? 'Closing...' : 'Close Drawer'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : !isLoading && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Open Drawer</h3></div>
          <div className="card-body">
            <p className="text-slate-500 text-sm mb-4">No drawer open today. Enter your opening cash balance to begin.</p>
            <label className="label">Opening Balance (GHS)</label>
            <div className="flex gap-3">
              <input type="number" step="0.01" value={openAmt} onChange={e => setOpenAmt(e.target.value)} className="input flex-1 font-mono" placeholder="0.00"/>
              <button onClick={() => open.mutate()} disabled={!openAmt || open.isPending} className="btn-success px-6">{open.isPending ? 'Opening...' : 'Open Drawer'}</button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>}
    </div>
  );
}
