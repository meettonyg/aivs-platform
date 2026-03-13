'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminTable, type Column } from '../_components/admin-table';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  stripeSubscriptionId: string | null;
  crawlCreditsMonthly: number;
  crawlCreditsRemaining: number;
  parentOrgId: string | null;
  createdAt: string;
  _count: { members: number; projects: number };
}

function OrganizationsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<OrgRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  const fetchOrgs = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/organizations?${searchParams.toString()}`)
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
    fetchOrgs();
  }, [fetchOrgs]);

  const columns: Column<OrgRow>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'slug', label: 'Slug', sortable: true },
    {
      key: 'planTier',
      label: 'Plan',
      sortable: true,
      render: (row) => (
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
          row.planTier === 'enterprise' ? 'bg-purple-100 text-purple-700' :
          row.planTier === 'agency' ? 'bg-blue-100 text-blue-700' :
          row.planTier === 'pro' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {row.planTier}
        </span>
      ),
    },
    { key: '_count', label: 'Members', render: (row) => row._count.members },
    { key: '_count', label: 'Projects', render: (row) => row._count.projects },
    {
      key: 'crawlCreditsRemaining',
      label: 'Credits',
      render: (row) => `${row.crawlCreditsRemaining}/${row.crawlCreditsMonthly}`,
    },
    {
      key: 'stripeSubscriptionId',
      label: 'Stripe',
      render: (row) => (
        <span className={`rounded px-2 py-0.5 text-xs ${row.stripeSubscriptionId ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {row.stripeSubscriptionId ? 'Active' : 'None'}
        </span>
      ),
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <a
          href="/api/admin/organizations/export"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Export CSV
        </a>
      </div>

      {/* Plan filter */}
      <div className="flex gap-3">
        {['', 'free', 'pro', 'agency', 'enterprise'].map((p) => {
          const current = searchParams.get('plan') ?? '';
          return (
            <button
              key={p}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                if (p) params.set('plan', p);
                else params.delete('plan');
                params.set('page', '1');
                router.push(`/admin/organizations?${params.toString()}`);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                current === p ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {p || 'All Plans'}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Loading organizations...</div>
      ) : (
        <AdminTable
          columns={columns}
          data={data}
          pagination={pagination}
          searchPlaceholder="Search by name or slug..."
          onRowClick={(row) => router.push(`/admin/organizations/${(row as unknown as OrgRow).id}`)}
        />
      )}
    </div>
  );
}

export default function OrganizationsPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>}>
      <OrganizationsContent />
    </Suspense>
  );
}
