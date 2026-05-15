import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export function useApiQuery<T>(key: unknown[], fn: () => Promise<T>, opts?: any) {
  return useQuery<T>({ queryKey: key, queryFn: fn, ...opts });
}

export function useApiMutation<T>(fn: (data: any) => Promise<T>, opts?: { successMsg?: string; onSuccess?: (data: T) => void; invalidateKeys?: unknown[][] }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      if (opts?.successMsg) toast.success(opts.successMsg);
      opts?.invalidateKeys?.forEach(k => qc.invalidateQueries({ queryKey: k }));
      opts?.onSuccess?.(data);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'An error occurred'),
  });
}

export function getToken(): string {
  return JSON.parse(sessionStorage.getItem('gtsl-auth') || '{}')?.state?.accessToken || '';
}

export function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

export async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`/api/v1${path}`, { ...opts, headers: { ...authHeaders(), ...opts?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data.data ?? data;
}
