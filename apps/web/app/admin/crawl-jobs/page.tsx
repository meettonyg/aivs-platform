'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminTable, type Column } from '../_components/admin-table';
import { StatCard } from '../_components/stat-card';

interface CrawlJobRow {
  id: string;
  status: string;
  pagesTotal: number;
  pagesCompleted: number;
  pagesSkipped: number;
  creditsUsed: number;
  isIncremental: boolean;
  siteScore: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  project: { id: string; name: string; domain: string; organization: { id: string; name: string } };
}

interface QueueStats {
  pending: number;
  running: number;
  failed: number;
  completed: number;
}

function CrawlJobsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<CrawlJobRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [queueStats, setQueueStats] = useState<QueueStats>({ pending: 0, running: 0, failed: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(() => {
    fetch(`/api/admin/crawl-jobs?${searchParams.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          setPagination(res.pagination);
          setQueueStats(res.queueStats);
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    fetchJobs();
    // Auto-poll every 5 seconds
    intervalRef.current = setInterval(fetchJobs, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchJobs]);

  const cancelJob = async (jobId: string) => {
    await fetch(`/api/admin/crawl-jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    fetchJobs();
  };

  const statusFilter = searchParams.get('status') ?? '';

  const columns: Column<CrawlJobRow>[] = [
    {
      key: 'project',
      label: 'Project',
      render: (row) => (
        <div>
          <div className="font-medium">{row.project.name}</div>
          <div className="text-xs text-gray-500">{row.project.domain}</div>
        </div>
      ),
    },
    {
      key: 'project',
      label: 'Organization',
      render: (row) => row.project.organization.name,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const colors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-700',
          running: 'bg-blue-100 text-blue-700',
          completed: 'bg-green-100 text-green-700',
          failed: 'bg-red-100 text-red-700',
        };
        return <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[row.status] ?? 'bg-gray-100'}`}>{row.status}</span>;
      },
    },
    {
      key: 'pagesCompleted',
      label: 'Pages',
      render: (row) => `${row.pagesCompleted}/${row.pagesTotal}${row.pagesSkipped ? ` (${row.pagesSkipped} skipped)` : ''}`,
    },
    { key: 'creditsUsed', label: 'Credits', sortable: true },
    {
      key: 'startedAt',
      label: 'Duration',
      render: (row) => {
        if (!row.startedAt) return '—';
        const start = new Date(row.startedAt).getTime();
        const end = row.completedAt ? new Date(row.completedAt).getTime() : Date.now();
        const secs = Math.round((end - start) / 1000);
        if (secs < 60) return `${secs}s`;
        return `${Math.floor(secs / 60)}m ${secs % 60}s`;
      },
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Crawl Jobs</h1>
        <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">Auto-refreshing every 5s</span>
      </div>

      {/* Queue stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard title="Pending" value={queueStats.pending} />
        <StatCard title="Running" value={queueStats.running} />
        <StatCard title="Completed" value={queueStats.completed} />
        <StatCard title="Failed" value={queueStats.failed} />
      </div>

      {/* Status filter */}
      <div className="flex gap-3">
        {['', 'pending', 'running', 'completed', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              if (s) params.set('status', s);
              else params.delete('status');
              params.set('page', '1');
              router.push(`/admin/crawl-jobs?${params.toString()}`);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              statusFilter === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>
      ) : (
        <AdminTable
          columns={columns}
          data={data}
          pagination={pagination}
          actions={(row) => {
            const job = row as unknown as CrawlJobRow;
            if (job.status === 'pending' || job.status === 'running') {
              return (
                <button
                  onClick={() => cancelJob(job.id)}
                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                >
                  Cancel
                </button>
              );
            }
            return null;
          }}
        />
      )}
    </div>
  );
}

export default function CrawlJobsPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>}>
      <CrawlJobsContent />
    </Suspense>
  );
}
