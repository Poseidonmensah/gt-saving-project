import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@hooks/useApi';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';
import { Lock, Unlock, X, FileText } from 'lucide-react';

export function AccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data: account, isLoading } = useQuery({ queryKey: ['account', accountId], queryFn: () => apiFetch(`/accounts/${accountId}`) });
  const { data: balance } = useQuery({ queryKey: ['balance', accountId], queryFn: () => apiFetch(`/accounts/${accountId}/balance`), enabled: !!account });

  const freeze = useMutation({ mutationFn: () => apiFetch(`/accounts/${accountId}/freeze`, { method: 'POST', body: JSON.stringify({ reason: window.prompt('Freeze reason:') }) }), onSuccess: () => { toast.success('Account frozen'); qc.invalidateQueries({ queryKey: ['account', accountId] }); } });
  const unfreeze = useMutation({ mutationFn: () => apiFetch(`/accounts/${accountId}/unfreeze`, { method: 'POST' }), onSuccess: () => { toast.success('Account unfrozen'); qc.invalidateQueries({ queryKey: ['account', accountId] }); } });
  const activate = useMutation({ mutationFn: () => apiFetch(`/accounts/${accountId}/activate`, { method: 'POST' }), onSuccess: () => { toast.success('Account activated'); qc.invalidateQueries({ queryKey: ['account', accountId] }); } });

  const fmtGHS = (v: any) => `GHS ${(Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`;
  const canAdmin = ['super_admin','admin','branch_manager','compliance_officer'].includes(user?.role||'');

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;
  if (!account) return <div className="text-center py-20 text-slate-400">Account not found</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="page-header">
        <div><h1 className="page-title font-mono">{account.accountNumber}</h1><p className="page-subtitle capitalize">{account.accountType} · {account.productCode}</p></div>
        <div className="flex gap-2">
          <Link to={`/accounts/${accountId}/statement`} className="btn-secondary"><FileText size={15}/> Statement</Link>
          {canAdmin && account.status === 'pending' && <button onClick={() => activate.mutate()} className="btn-success">Activate</button>}
          {canAdmin && account.status === 'active' && <button onClick={() => freeze.mutate()} className="btn-danger"><Lock size={15}/> Freeze</button>}
          {canAdmin && account.status === 'frozen' && <button onClick={() => unfreeze.mutate()} className="btn-success"><Unlock size={15}/> Unfreeze</button>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Current Balance</p><p className="text-xl font-bold text-slate-900 money mt-1">{fmtGHS(balance?.currentBalance||account.currentBalance)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Available Balance</p><p className="text-xl font-bold text-emerald-600 money mt-1">{fmtGHS(balance?.availableBalance||account.availableBalance)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Hold Amount</p><p className="text-xl font-bold text-amber-600 money mt-1">{fmtGHS(balance?.holdAmount||0)}</p></div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Account Details</h3></div>
        <div className="card-body">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Account Number', account.accountNumber],
              ['Account Type', account.accountType],
              ['Product Code', account.productCode],
              ['Currency', account.currency],
              ['Status', account.status],
              ['Opened Date', account.openedAt ? new Date(account.openedAt).toLocaleDateString('en-GH') : '—'],
              ['Last Transaction', account.lastTransactionAt ? new Date(account.lastTransactionAt).toLocaleString('en-GH') : 'None'],
              ['Mandate Type', account.mandateType],
            ].map(([l,v]) => (
              <div key={l} className="flex justify-between border-b border-slate-50 pb-2">
                <dt className="text-slate-500">{l}</dt>
                <dd className="font-medium text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
