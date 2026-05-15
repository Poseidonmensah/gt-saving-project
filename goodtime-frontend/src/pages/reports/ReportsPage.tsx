import { useState } from 'react';
import { reportsApi } from '@api/index';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';

const REPORTS = [
  { id:'trial_balance',        label:'Trial Balance',               category:'Financial',   icon:'📊' },
  { id:'loan_portfolio',       label:'Loan Portfolio',              category:'Loans',       icon:'🏦' },
  { id:'arrears_aging',        label:'Arrears Aging',               category:'Loans',       icon:'⚠️' },
  { id:'disbursement',         label:'Loan Disbursements',          category:'Loans',       icon:'💸' },
  { id:'teller_collections',   label:'Teller Collections',          category:'Operations',  icon:'🏧' },
  { id:'cash_position',        label:'Cash Position',               category:'Financial',   icon:'💰' },
  { id:'high_value_transactions', label:'High Value Transactions',  category:'Compliance',  icon:'🔍' },
  { id:'kyc_status',           label:'KYC Status Summary',          category:'Compliance',  icon:'🛡️' },
];

export function ReportsPage() {
  const [selected, setSelected] = useState('');
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [to,   setTo]   = useState(new Date().toISOString().split('T')[0]);
  const [fmt,  setFmt]  = useState<'excel'|'pdf'|'csv'>('excel');
  const [loading, setLoading] = useState(false);

  const download = async () => {
    if (!selected) { toast.error('Select a report'); return; }
    setLoading(true);
    try {
      const res = await reportsApi.generate(selected, { fromDate: from, toDate: to }, fmt);
      const blob = new Blob([res.data], { type: res.headers['content-type'] });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `${selected}_${from}_to_${to}.${fmt==='excel'?'xlsx':fmt}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (e: any) { toast.error(e.message || 'Failed to generate report'); }
    finally { setLoading(false); }
  };

  const categories = [...new Set(REPORTS.map(r => r.category))];

  return (
    <div className="space-y-6">
      <div className="page-header"><div><h1 className="page-title">Reports & Analytics</h1><p className="page-subtitle">Generate financial, operational and compliance reports</p></div></div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 card">
          <div className="card-header"><h3 className="font-semibold">Select Report</h3></div>
          <div className="card-body space-y-5">
            {categories.map(cat => (
              <div key={cat}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{cat}</p>
                <div className="grid grid-cols-2 gap-2">
                  {REPORTS.filter(r => r.category === cat).map(r => (
                    <button key={r.id} onClick={() => setSelected(r.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${selected===r.id?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'}`}>
                      <span className="text-xl">{r.icon}</span>
                      <span className="text-sm font-medium">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><h3 className="font-semibold">Parameters</h3></div>
            <div className="card-body space-y-4">
              <div className="form-group"><label className="label">From Date</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="input"/></div>
              <div className="form-group"><label className="label">To Date</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="input"/></div>
              <div className="form-group">
                <label className="label">Format</label>
                <select value={fmt} onChange={e=>setFmt(e.target.value as any)} className="input">
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="csv">CSV (.csv)</option>
                </select>
              </div>
              <button onClick={download} disabled={loading||!selected} className="btn-primary w-full py-3">
                {loading ? 'Generating…' : <><Download size={16}/> Generate Report</>}
              </button>
            </div>
          </div>
          <div className="card bg-blue-50 border-blue-200 p-4 text-xs text-blue-700 space-y-1">
            <p className="font-medium">Note</p>
            <p>All exports are logged in the audit trail. Reports reflect posted transactions only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
