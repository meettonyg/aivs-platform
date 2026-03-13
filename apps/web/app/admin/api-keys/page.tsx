'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminTable, type Column } from '../_components/admin-table';

interface ApiKeyRow {
  id: string;
  label: string;
  rateLimit: number;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string };
}

function ApiKeysContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ApiKeyRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/api-keys?${searchParams.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          setPagination(res.pagination);
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const revokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;
    await fetch(`/api/admin/api-keys/${keyId}`, { method: 'DELETE' });
    fetchKeys();
  };

  const columns: Column<ApiKeyRow>[] = [
    { key: 'label', label: 'Label', sortable: true },
    { key: 'organization', label: 'Organization', render: (row) => row.organization.name },
    { key: 'scopes', label: 'Scopes', render: (row) => row.scopes.join(', ') },
    { key: 'rateLimit', label: 'Rate Limit', sortable: true, render: (row) => `${row.rateLimit}/min` },
    {
      key: 'lastUsedAt',
      label: 'Last Used',
      sortable: true,
      render: (row) => (row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : 'Never'),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>
      ) : (
        <AdminTable
          columns={columns}
          data={data}
          pagination={pagination}
          searchPlaceholder="Search by label..."
          actions={(row) => {
            const key = row as unknown as ApiKeyRow;
            return (
              <button
                onClick={() => revokeKey(key.id)}
                className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
              >
                Revoke
              </button>
            );
          }}
        />
      )}
    </div>
  );
}

export default function ApiKeysPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>}>
      <ApiKeysContent />
    </Suspense>
  );
}
