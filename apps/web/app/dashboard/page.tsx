import { auth } from '@/lib/auth';
import { prisma } from '@aivs/db';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;

  const membership = userId
    ? await prisma.orgMember.findFirst({
        where: { userId },
        include: {
          organization: {
            include: {
              projects: {
                include: {
                  scans: { orderBy: { createdAt: 'desc' }, take: 1 },
                },
                orderBy: { updatedAt: 'desc' },
                take: 5,
              },
            },
          },
        },
      })
    : null;

  const org = membership?.organization;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-500">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ''}.
        </p>
      </div>

      {/* Stats */}
      {org && (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Plan"
            value={org.planTier.charAt(0).toUpperCase() + org.planTier.slice(1)}
          />
          <StatCard
            label="Credits Remaining"
            value={`${org.crawlCreditsRemaining} / ${org.crawlCreditsMonthly}`}
          />
          <StatCard label="Projects" value={String(org.projects.length)} />
          <StatCard
            label="Total Scans"
            value={String(org.projects.reduce((acc, p) => acc + p.scans.length, 0))}
          />
        </div>
      )}

      {/* Recent projects */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Projects</h2>
          <Link
            href="/dashboard/projects"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View all
          </Link>
        </div>

        {org?.projects.length ? (
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Latest Score</th>
                  <th className="px-4 py-3">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {org.projects.map((project) => {
                  const latestScan = project.scans[0];
                  return (
                    <tr key={project.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{project.name}</td>
                      <td className="px-4 py-3 text-gray-600">{project.domain}</td>
                      <td className="px-4 py-3">
                        {latestScan ? (
                          <span className="font-semibold">{latestScan.score}/100</span>
                        ) : (
                          <span className="text-gray-400">No scans</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {latestScan?.tier ?? <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-8 text-center">
            <p className="text-gray-500">No projects yet.</p>
            <Link
              href="/dashboard/projects"
              className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Create your first project
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
