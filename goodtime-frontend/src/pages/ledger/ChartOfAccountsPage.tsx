import { useQuery } from '@tanstack/react-query';
import { ledgerApi } from '@api/index';

export function ChartOfAccountsPage() {
  const { data,isLoading } = useQuery({ queryKey:['chart-of-accounts'], queryFn: ledgerApi.chartOfAccounts });
  const rows = (data as any)||[];
  const classes = [...new Set(rows.map((r:any)=>r.account_class))];

  return (
    <div className="space-y-5">
      <div className="page-header"><div><h1 className="page-title">Chart of Accounts</h1><p className="page-subtitle">Full general ledger account structure</p></div></div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Account Name</th><th>Class</th><th>Group</th><th>Normal Balance</th><th>Status</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : classes.flatMap(cls => [
              <tr key={`h-${cls}`} className="bg-slate-100"><td colSpan={6} className="font-bold text-slate-700 py-2 uppercase text-xs tracking-wider px-4">{cls as string}</td></tr>,
              ...rows.filter((r:any)=>r.account_class===cls).map((r:any)=>(
                <tr key={r.account_code}>
                  <td className="font-mono font-semibold text-blue-700">{r.account_code}</td>
                  <td className="font-medium">{r.account_name}</td>
                  <td><span className="badge-gray text-xs">{r.account_class}</span></td>
                  <td className="text-slate-500 text-xs">{r.account_group||'—'}</td>
                  <td className="text-center"><span className={`badge text-xs ${r.normal_balance==='debit'?'badge-blue':'badge-green'}`}>{r.normal_balance}</span></td>
                  <td><span className={`badge text-xs ${r.is_active?'badge-green':'badge-gray'}`}>{r.is_active?'Active':'Inactive'}</span></td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
