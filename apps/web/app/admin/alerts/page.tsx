'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminTable, type Column } from '../_components/admin-table';

interface AlertRow {
  id: string;
  organizationId: string;
  projectId: string | null;
  type: string;
  severity: string;
  title: string;
  message: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  failureCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  organization: { id: string; name: string };
}

function AlertsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<'alerts' | 'webhooks'>('alerts');

  // Alerts state
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [alertsPagination, setAlertsPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [webhooksPagination, setWebhooksPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/alerts?${searchParams.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setAlerts(res.data);
          setAlertsPagination(res.pagination);
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const fetchWebhooks = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/webhooks?${searchParams.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setWebhooks(res.data);
          setWebhooksPagination(res.pagination);
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    if (tab === 'alerts') fetchAlerts();
    else fetchWebhooks();
  }, [tab, fetchAlerts, fetchWebhooks]);

  const retryWebhook = async (webhookId: string) => {
    await fetch(`/api/admin/webhooks/${webhookId}/retry`, { method: 'POST' });
    fetchWebhooks();
  };

  const alertColumns: Column<AlertRow>[] = [
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      render: (row) => {
        const colors: Record<string, string> = {
          critical: 'bg-red-100 text-red-700',
          warning: 'bg-amber-100 text-amber-700',
          info: 'bg-blue-100 text-blue-700',
        };
        return <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[row.severity] ?? 'bg-gray-100'}`}>{row.severity}</span>;
      },
    },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'title', label: 'Title' },
    {
      key: 'readAt',
      label: 'Status',
      render: (row) => (
        <span className={`rounded px-2 py-0.5 text-xs ${row.readAt ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
          {row.readAt ? 'Read' : 'Unread'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];

  const webhookColumns: Column<WebhookRow>[] = [
    { key: 'url', label: 'URL', render: (row) => <span className="max-w-xs truncate block">{row.url}</span> },
    { key: 'organization', label: 'Organization', render: (row) => row.organization.name },
    { key: 'events', label: 'Events', render: (row) => row.events.join(', ') },
    {
      key: 'active',
      label: 'Status',
      render: (row) => (
        <span className={`rounded px-2 py-0.5 text-xs ${row.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {row.active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'failureCount',
      label: 'Failures',
      render: (row) => (
        <span className={row.failureCount > 0 ? 'font-semibold text-red-600' : ''}>{row.failureCount}</span>
      ),
    },
    {
      key: 'lastTriggeredAt',
      label: 'Last Triggered',
      render: (row) => (row.lastTriggeredAt ? new Date(row.lastTriggeredAt).toLocaleString() : 'Never'),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Alerts & Webhooks</h1>

      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setTab('alerts')}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${tab === 'alerts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Alerts
          </button>
          <button
            onClick={() => setTab('webhooks')}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${tab === 'webhooks' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Webhooks
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>
      ) : tab === 'alerts' ? (
        <AdminTable
          columns={alertColumns}
          data={alerts}
          pagination={alertsPagination}
          searchPlaceholder="Search alerts..."
        />
      ) : (
        <AdminTable
          columns={webhookColumns}
          data={webhooks}
          pagination={webhooksPagination}
          searchPlaceholder="Search by webhook URL..."
          actions={(row) => {
            const webhook = row as unknown as WebhookRow;
            if (webhook.failureCount > 0 || !webhook.active) {
              return (
                <button
                  onClick={() => retryWebhook(webhook.id)}
                  className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                >
                  Reset & Retry
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

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>}>
      <AlertsContent />
    </Suspense>
  );
}
