'use client';

import { useEffect, useState } from 'react';
import { StatCard } from './_components/stat-card';
import { AdminLineChart, AdminPieChart } from './_components/admin-chart';

interface Stats {
  totalUsers: number;
  totalOrgs: number;
  totalScans: number;
  activeSubscriptions: number;
  mrr: number;
  signupsByDay: { date: string; count: number }[];
  scansByDay: { date: string; count: number }[];
  planBreakdown: { name: string; count: number }[];
  topDomains: { url: string; count: number }[];
  systemHealth: { queueDepth: number; failedJobs: number };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setStats(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="flex h-64 items-center justify-center text-red-500">Failed to load stats</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Users" value={stats.totalUsers.toLocaleString()} />
        <StatCard title="Organizations" value={stats.totalOrgs.toLocaleString()} />
        <StatCard title="Total Scans" value={stats.totalScans.toLocaleString()} />
        <StatCard title="Active Subscriptions" value={stats.activeSubscriptions.toLocaleString()} />
        <StatCard title="MRR" value={`$${stats.mrr.toLocaleString()}`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">New Signups (Last 30 Days)</h3>
          <AdminLineChart data={stats.signupsByDay} dataKey="count" xKey="date" color="#3B82F6" label="Signups" />
        </div>
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Scans Per Day (Last 30 Days)</h3>
          <AdminLineChart data={stats.scansByDay} dataKey="count" xKey="date" color="#8B5CF6" label="Scans" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Plan breakdown */}
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Organizations by Plan</h3>
          <AdminPieChart data={stats.planBreakdown} dataKey="count" nameKey="name" height={250} />
        </div>

        {/* System health */}
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">System Health</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
              <span className="text-sm text-gray-600">Queue Depth (Pending + Running)</span>
              <span className="text-lg font-semibold">{stats.systemHealth.queueDepth}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
              <span className="text-sm text-gray-600">Failed Jobs</span>
              <span className={`text-lg font-semibold ${stats.systemHealth.failedJobs > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.systemHealth.failedJobs}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top domains */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Top 10 Most-Scanned Domains</h3>
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Scan Count</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {stats.topDomains.map((d, i) => (
              <tr key={d.url} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{d.url}</td>
                <td className="px-4 py-3">{d.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
