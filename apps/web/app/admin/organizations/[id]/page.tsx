'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StatCard } from '../../_components/stat-card';

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  crawlCreditsMonthly: number;
  crawlCreditsRemaining: number;
  currentPeriodEnd: string | null;
  parentOrgId: string | null;
  createdAt: string;
  members: { id: string; role: string; user: { id: string; email: string; name: string | null; role: string } }[];
  projects: { id: string; name: string; domain: string; siteScore: number | null; siteTier: string | null; createdAt: string; _count: { scans: number; crawlJobs: number } }[];
  apiKeys: { id: string; label: string; rateLimit: number; scopes: string[]; lastUsedAt: string | null; createdAt: string }[];
  webhooks: { id: string; url: string; events: string[]; active: boolean; failureCount: number; lastTriggeredAt: string | null }[];
  _count: { members: number; projects: number };
}

type Tab = 'overview' | 'members' | 'projects' | 'apikeys' | 'webhooks';

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ planTier: '', crawlCreditsRemaining: 0, crawlCreditsMonthly: 0 });

  useEffect(() => {
    fetch(`/api/admin/organizations/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setOrg(res.data);
          setForm({
            planTier: res.data.planTier,
            crawlCreditsRemaining: res.data.crawlCreditsRemaining,
            crawlCreditsMonthly: res.data.crawlCreditsMonthly,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const saveChanges = async () => {
    const res = await fetch(`/api/admin/organizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setEditing(false);
      const updated = await res.json();
      if (updated.success && org) {
        setOrg({ ...org, ...updated.data });
      }
    }
  };

  const deleteOrg = async () => {
    if (!confirm('Are you sure you want to delete this organization? This cannot be undone.')) return;
    const res = await fetch(`/api/admin/organizations/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/organizations');
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>;
  if (!org) return <div className="flex h-64 items-center justify-center text-red-500">Organization not found</div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'members', label: `Members (${org.members.length})` },
    { key: 'projects', label: `Projects (${org.projects.length})` },
    { key: 'apikeys', label: `API Keys (${org.apiKeys.length})` },
    { key: 'webhooks', label: `Webhooks (${org.webhooks.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push('/admin/organizations')} className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Organizations
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
          <p className="text-sm text-gray-500">{org.slug}</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={saveChanges} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">Save</button>
              <button onClick={() => setEditing(false)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">Edit</button>
              <button onClick={deleteOrg} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Delete</button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard title="Plan Tier" value={editing ? '' : org.planTier} />
        <StatCard title="Members" value={org._count.members} />
        <StatCard title="Projects" value={org._count.projects} />
        <StatCard title="Credits" value={`${org.crawlCreditsRemaining}/${org.crawlCreditsMonthly}`} />
      </div>

      {/* Edit form */}
      {editing && (
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Edit Organization</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500">Plan Tier</label>
              <select value={form.planTier} onChange={(e) => setForm({ ...form, planTier: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                <option value="free">free</option>
                <option value="pro">pro</option>
                <option value="agency">agency</option>
                <option value="enterprise">enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Credits Remaining</label>
              <input type="number" value={form.crawlCreditsRemaining} onChange={(e) => setForm({ ...form, crawlCreditsRemaining: parseInt(e.target.value) || 0 })} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Credits Monthly</label>
              <input type="number" value={form.crawlCreditsMonthly} onChange={(e) => setForm({ ...form, crawlCreditsMonthly: parseInt(e.target.value) || 0 })} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-1 py-3 text-sm font-medium ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="rounded-lg border bg-white p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-gray-500">Stripe Customer</dt><dd className="font-medium">{org.stripeCustomerId || '—'}</dd></div>
            <div><dt className="text-gray-500">Stripe Subscription</dt><dd className="font-medium">{org.stripeSubscriptionId || '—'}</dd></div>
            <div><dt className="text-gray-500">Period End</dt><dd className="font-medium">{org.currentPeriodEnd ? new Date(org.currentPeriodEnd).toLocaleDateString() : '—'}</dd></div>
            <div><dt className="text-gray-500">Parent Org (Agency)</dt><dd className="font-medium">{org.parentOrgId || '—'}</dd></div>
            <div><dt className="text-gray-500">Created</dt><dd className="font-medium">{new Date(org.createdAt).toLocaleString()}</dd></div>
          </dl>
        </div>
      )}

      {tab === 'members' && (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Org Role</th><th className="px-4 py-3">Platform Role</th></tr>
            </thead>
            <tbody className="divide-y">
              {org.members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{m.user.name || '—'}</td>
                  <td className="px-4 py-3">{m.user.email}</td>
                  <td className="px-4 py-3"><span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{m.role}</span></td>
                  <td className="px-4 py-3"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{m.user.role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'projects' && (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Scans</th><th className="px-4 py-3">Crawls</th></tr>
            </thead>
            <tbody className="divide-y">
              {org.projects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.domain}</td>
                  <td className="px-4 py-3">{p.siteScore ?? '—'}</td>
                  <td className="px-4 py-3">{p.siteTier ?? '—'}</td>
                  <td className="px-4 py-3">{p._count.scans}</td>
                  <td className="px-4 py-3">{p._count.crawlJobs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'apikeys' && (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-3">Label</th><th className="px-4 py-3">Scopes</th><th className="px-4 py-3">Rate Limit</th><th className="px-4 py-3">Last Used</th></tr>
            </thead>
            <tbody className="divide-y">
              {org.apiKeys.map((k) => (
                <tr key={k.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{k.label}</td>
                  <td className="px-4 py-3">{k.scopes.join(', ')}</td>
                  <td className="px-4 py-3">{k.rateLimit}/min</td>
                  <td className="px-4 py-3">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'webhooks' && (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-3">URL</th><th className="px-4 py-3">Events</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Failures</th></tr>
            </thead>
            <tbody className="divide-y">
              {org.webhooks.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{w.url}</td>
                  <td className="px-4 py-3">{w.events.join(', ')}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${w.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {w.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{w.failureCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
