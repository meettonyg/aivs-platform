'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminTable, type Column } from '../_components/admin-table';
import { AdminBarChart } from '../_components/admin-chart';
import { StatCard } from '../_components/stat-card';

interface ScanRow {
  id: string;
  url: string;
  score: number;
  tier: string;
  factorVersion: number;
  createdAt: string;
  project: { id: string; name: string; domain: string; organization: { id: string; name: string } } | null;
}

interface Analytics {
  totalScans: number;
  scoreDistribution: { range: string; count: number }[];
  tierAverages: { tier: string; avgScore: number; count: number; minScore: number; maxScore: number }[];
}

function ScansContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<'list' | 'analytics'>(
    (searchParams.get('view') as 'list' | 'analytics') || 'list',
  );
  const [data, setData] = useState<ScanRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    if (view === 'analytics') {
      fetch('/api/admin/scans?view=analytics')
        .then((r) => r.json())
        .then((res) => { if (res.success) setAnalytics(res.data); })
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/admin/scans?${searchParams.toString()}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            setData(res.data);
            setPagination(res.pagination);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [searchParams, view]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: Column<ScanRow>[] = [
    { key: 'url', label: 'URL', sortable: true, render: (row) => <span className="max-w-xs truncate block">{row.url}</span> },
    {
      key: 'score',
      label: 'Score',
      sortable: true,
      render: (row) => (
        <span className={`font-semibold ${row.score >= 70 ? 'text-green-600' : row.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
          {row.score}
        </span>
      ),
    },
    {
      key: 'tier',
      label: 'Tier',
      sortable: true,
      render: (row) => <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{row.tier}</span>,
    },
    {
      key: 'project',
      label: 'Organization',
      render: (row) => row.project?.organization?.name ?? '—',
    },
    {
      key: 'project',
      label: 'Project',
      render: (row) => row.project?.name ?? '—',
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
        <h1 className="text-2xl font-bold text-gray-900">Scans</h1>
        <div className="flex gap-3">
          <div className="flex rounded-lg border bg-white">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 text-sm ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-700'} rounded-l-lg`}
            >
              List
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`px-4 py-2 text-sm ${view === 'analytics' ? 'bg-gray-900 text-white' : 'text-gray-700'} rounded-r-lg`}
            >
              Analytics
            </button>
          </div>
          <a
            href="/api/admin/scans/export"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Export CSV
          </a>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>
      ) : view === 'analytics' && analytics ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total Scans" value={analytics.totalScans.toLocaleString()} />
            {analytics.tierAverages.slice(0, 2).map((t) => (
              <StatCard key={t.tier} title={`Avg Score (${t.tier})`} value={t.avgScore} subtitle={`${t.count} scans`} />
            ))}
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Score Distribution</h3>
            <AdminBarChart data={analytics.scoreDistribution} dataKey="count" xKey="range" color="#8B5CF6" />
          </div>

          <div className="rounded-lg border bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Average Scores by Tier</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <tr><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Avg Score</th><th className="px-4 py-3">Min</th><th className="px-4 py-3">Max</th><th className="px-4 py-3">Count</th></tr>
                </thead>
                <tbody className="divide-y">
                  {analytics.tierAverages.map((t) => (
                    <tr key={t.tier} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{t.tier}</td>
                      <td className="px-4 py-3">{t.avgScore}</td>
                      <td className="px-4 py-3">{t.minScore}</td>
                      <td className="px-4 py-3">{t.maxScore}</td>
                      <td className="px-4 py-3">{t.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <AdminTable
          columns={columns}
          data={data}
          pagination={pagination}
          searchPlaceholder="Search by URL..."
        />
      )}
    </div>
  );
}

export default function ScansPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>}>
      <ScansContent />
    </Suspense>
  );
}
