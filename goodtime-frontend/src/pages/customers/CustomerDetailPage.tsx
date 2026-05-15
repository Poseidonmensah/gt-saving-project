import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@hooks/useApi';
import { User, CreditCard, FileText, Shield, Phone, Mail, MapPin, Briefcase, AlertTriangle } from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const m: Record<string,string> = { active:'badge-green', prospect:'badge-blue', frozen:'badge-red', restricted:'badge-orange', dormant:'badge-yellow', closed:'badge-gray' };
  return <span className={m[status]||'badge-gray'}>{status}</span>;
}
function KycBadge({ status }: { status: string }) {
  const m: Record<string,string> = { approved:'badge-green', pending:'badge-yellow', rejected:'badge-red', in_review:'badge-blue' };
  return <span className={m[status]||'badge-gray'}>{status.replace('_',' ')}</span>;
}

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const { data: customer, isLoading } = useQuery({ queryKey: ['customer', customerId], queryFn: () => apiFetch(`/customers/${customerId}`) });
  const { data: accounts } = useQuery({ queryKey: ['customer-accounts', customerId], queryFn: () => apiFetch(`/customers/${customerId}/accounts`), enabled: !!customer });

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;
  if (!customer) return <div className="text-center py-20 text-slate-400">Customer not found</div>;

  const fmtGHS = (v: any) => `GHS ${(Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{customer.fullName}</h1>
            {customer.pepFlag && <span className="badge-red"><AlertTriangle size={11}/> PEP</span>}
            {customer.sanctionsFlag && <span className="badge-red"><AlertTriangle size={11}/> Sanctions</span>}
          </div>
          <p className="page-subtitle font-mono">{customer.customerNumber}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/customers/${customerId}/kyc`} className="btn-secondary">KYC Review</Link>
          <Link to={`/accounts`} className="btn-primary">Open Account</Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3 text-center"><p className="text-xs text-slate-500">Status</p><div className="mt-1"><StatusBadge status={customer.status}/></div></div>
        <div className="card p-3 text-center"><p className="text-xs text-slate-500">KYC</p><div className="mt-1"><KycBadge status={customer.kycStatus}/></div></div>
        <div className="card p-3 text-center"><p className="text-xs text-slate-500">KYC Tier</p><p className="font-semibold text-slate-800 mt-1">{customer.kycTier?.replace('_',' ').toUpperCase()}</p></div>
        <div className="card p-3 text-center"><p className="text-xs text-slate-500">Risk Rating</p><p className={`font-semibold mt-1 ${customer.riskRating==='high'?'text-red-600':customer.riskRating==='medium'?'text-amber-600':'text-emerald-600'}`}>{customer.riskRating?.toUpperCase()}</p></div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold flex items-center gap-2"><User size={16}/> Personal Information</h3></div>
          <div className="card-body">
            <dl className="space-y-2 text-sm">
              {[
                ['Date of Birth', customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString('en-GH') : '—'],
                ['Gender', customer.gender || '—'],
                ['Nationality', customer.nationality || '—'],
                ['ID Type', customer.idType?.replace(/_/g,' ') || '—'],
                ['ID Number', customer.idNumber || '—'],
                ['Occupation', customer.occupation || '—'],
                ['Employer', customer.employerName || '—'],
                ['Source of Funds', customer.sourceOfFunds || '—'],
                ['Customer Since', new Date(customer.createdAt).toLocaleDateString('en-GH')],
              ].map(([l,v]) => (
                <div key={l} className="flex justify-between border-b border-slate-50 pb-1">
                  <dt className="text-slate-500">{l}</dt>
                  <dd className="font-medium text-slate-800 text-right max-w-48 truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="font-semibold flex items-center gap-2"><Phone size={16}/> Contact Details</h3></div>
          <div className="card-body space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Phone size={16} className="text-slate-400"/>
              <div><p className="text-xs text-slate-500">Primary Phone</p><p className="font-medium">{customer.phoneNumber}</p></div>
            </div>
            {customer.altPhone && <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Phone size={16} className="text-slate-400"/>
              <div><p className="text-xs text-slate-500">Alternative Phone</p><p className="font-medium">{customer.altPhone}</p></div>
            </div>}
            {customer.email && <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Mail size={16} className="text-slate-400"/>
              <div><p className="text-xs text-slate-500">Email</p><p className="font-medium">{customer.email}</p></div>
            </div>}
            {customer.address && <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <MapPin size={16} className="text-slate-400"/>
              <div><p className="text-xs text-slate-500">Address</p><p className="font-medium">{customer.address}</p></div>
            </div>}
          </div>
        </div>
      </div>

      {/* Accounts */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold flex items-center gap-2"><CreditCard size={16}/> Accounts</h3>
          <span className="badge-blue">{(accounts||[]).length} accounts</span>
        </div>
        <div className="table-container border-0">
          <table className="data-table">
            <thead><tr><th>Account No.</th><th>Type</th><th>Balance (GHS)</th><th>Available</th><th>Status</th><th>Opened</th></tr></thead>
            <tbody>
              {(accounts||[]).length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-slate-400">No accounts found</td></tr>
              ) : (accounts||[]).map((a: any) => (
                <tr key={a.account_number}>
                  <td><Link to={`/accounts/${a.account_id}`} className="font-mono text-blue-600 hover:underline">{a.account_number}</Link></td>
                  <td><span className="badge-blue">{a.account_type}</span></td>
                  <td className="money">{fmtGHS(a.current_balance)}</td>
                  <td className="money">{fmtGHS(a.available_balance)}</td>
                  <td><span className={a.status==='active'?'badge-green':'badge-gray'}>{a.status}</span></td>
                  <td className="text-xs text-slate-500">{a.opened_at ? new Date(a.opened_at).toLocaleDateString('en-GH') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
