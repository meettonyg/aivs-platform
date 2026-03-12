import { auth } from '@/lib/auth';
import { prisma } from '@aivs/db';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect('/auth/login');

  const membership = await prisma.orgMember.findFirst({
    where: { userId },
    include: {
      organization: {
        include: {
          members: { include: { user: { select: { id: true, name: true, email: true } } } },
          apiKeys: { select: { id: true, label: true, lastUsedAt: true, createdAt: true } },
        },
      },
    },
  });

  const org = membership?.organization;
  if (!org) redirect('/dashboard');

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Organization */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Organization</h2>
        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Name</dt>
            <dd className="font-medium text-gray-900">{org.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Slug</dt>
            <dd className="font-mono text-gray-600">{org.slug}</dd>
          </div>
        </dl>
      </section>

      {/* Billing */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Billing</h2>
        <dl className="grid gap-4 md:grid-cols-3">
          <div>
            <dt className="text-sm text-gray-500">Current Plan</dt>
            <dd className="text-lg font-bold text-gray-900">
              {org.planTier.charAt(0).toUpperCase() + org.planTier.slice(1)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Crawl Credits</dt>
            <dd className="text-lg font-bold text-gray-900">
              {org.crawlCreditsRemaining} / {org.crawlCreditsMonthly}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Period Ends</dt>
            <dd className="text-gray-900">
              {org.currentPeriodEnd
                ? new Date(org.currentPeriodEnd).toLocaleDateString()
                : 'N/A'}
            </dd>
          </div>
        </dl>

        {org.planTier === 'free' && (
          <div className="mt-4 flex gap-3">
            <UpgradeButton plan="pro" label="Upgrade to Pro — $129/mo" />
            <UpgradeButton plan="agency" label="Upgrade to Agency — $399/mo" />
          </div>
        )}
      </section>

      {/* Team */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Team Members</h2>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {org.members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 text-gray-900">{m.user.name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{m.user.email}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {m.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* API Keys */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">API Keys</h2>
        {org.apiKeys.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Label</th>
                  <th className="px-4 py-2">Created</th>
                  <th className="px-4 py-2">Last Used</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {org.apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td className="px-4 py-2 text-gray-900">{key.label}</td>
                    <td className="px-4 py-2 text-gray-500">{key.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {key.lastUsedAt ? key.lastUsedAt.toLocaleDateString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No API keys yet. API access is available on Pro and above plans.
          </p>
        )}
      </section>
    </div>
  );
}

function UpgradeButton({ plan, label }: { plan: string; label: string }) {
  return (
    <form
      action={async () => {
        'use server';
        // Client-side redirect handled via JS
      }}
    >
      <button
        type="button"
        onClick={() => {
          fetch('/api/billing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.success && d.data.url) window.location.href = d.data.url;
            });
        }}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {label}
      </button>
    </form>
  );
}
