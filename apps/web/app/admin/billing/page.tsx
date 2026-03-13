'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '../_components/stat-card';
import { AdminPieChart } from '../_components/admin-chart';

interface BillingData {
  mrr: number;
  arr: number;
  churnRate: number;
  conversionRate: number;
  paidOrgs: number;
  totalOrgs: number;
  planBreakdown: { name: string; count: number; revenue: number }[];
  expiringOrgs: { id: string; name: string; slug: string; planTier: string; currentPeriodEnd: string }[];
  creditUsage: { totalMonthly: number; remaining: number; used: number };
}

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/billing')
      .then((r) => r.json())
      .then((res) => { if (res.success) setData(res.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>;
  if (!data) return <div className="flex h-64 items-center justify-center text-red-500">Failed to load billing data</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Billing & Revenue</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="MRR" value={`$${data.mrr.toLocaleString()}`} />
        <StatCard title="ARR" value={`$${data.arr.toLocaleString()}`} />
        <StatCard title="Free Tier Rate" value={`${data.churnRate}%`} subtitle={`${data.totalOrgs - data.paidOrgs} of ${data.totalOrgs} orgs`} />
        <StatCard title="Conversion Rate" value={`${data.conversionRate}%`} subtitle={`${data.paidOrgs} paid orgs`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Plan breakdown pie chart */}
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Subscriptions by Plan</h3>
          <AdminPieChart data={data.planBreakdown} dataKey="count" nameKey="name" height={280} />
        </div>

        {/* Revenue by plan */}
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Revenue by Plan</h3>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Orgs</th><th className="px-4 py-3">MRR</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.planBreakdown.map((p) => (
                <tr key={p.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium capitalize">{p.name}</td>
                  <td className="px-4 py-3">{p.count}</td>
                  <td className="px-4 py-3">${p.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit usage */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Credit Usage</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-500">Total Monthly</p>
            <p className="text-2xl font-bold">{data.creditUsage.totalMonthly.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-500">Used</p>
            <p className="text-2xl font-bold">{data.creditUsage.used.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-500">Remaining</p>
            <p className="text-2xl font-bold">{data.creditUsage.remaining.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Expiring subscriptions */}
      {data.expiringOrgs.length > 0 && (
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Expiring Subscriptions (Next 7 Days)</h3>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Expires</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.expiringOrgs.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{o.name}</td>
                  <td className="px-4 py-3 capitalize">{o.planTier}</td>
                  <td className="px-4 py-3">{new Date(o.currentPeriodEnd).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
