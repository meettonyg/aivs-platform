'use client';

import { useRouter } from 'next/navigation';

export function ImpersonationBanner({ email }: { email: string }) {
  const router = useRouter();

  const stopImpersonating = async () => {
    await fetch('/api/admin/impersonate', { method: 'DELETE' });
    router.push('/admin/users');
    router.refresh();
  };

  return (
    <div className="flex items-center justify-between bg-amber-500 px-6 py-2 text-sm font-medium text-white">
      <span>Viewing as <strong>{email}</strong> (impersonation mode)</span>
      <button
        onClick={stopImpersonating}
        className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold hover:bg-amber-700"
      >
        Stop Impersonating
      </button>
    </div>
  );
}
