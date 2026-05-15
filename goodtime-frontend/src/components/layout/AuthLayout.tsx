import { Outlet } from 'react-router-dom';
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4 shadow-lg">
            <span className="text-2xl font-bold text-white">GT</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Good Time S&L</h1>
          <p className="text-slate-400 text-sm mt-1">Savings & Loans Management System</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8"><Outlet /></div>
        <p className="text-center text-slate-500 text-xs mt-6">© {new Date().getFullYear()} Good Time Saving & Loans Ltd · Ghana</p>
      </div>
    </div>
  );
}
