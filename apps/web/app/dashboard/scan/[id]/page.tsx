import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { getTier } from '@aivs/scanner-engine';
import { notFound, redirect } from 'next/navigation';

interface SubScoresData {
  schema?: number;
  entity?: number;
  speakable?: number;
  structure?: number;
  faq?: number;
  summary?: number;
  feed?: number;
  crawlAccess?: number;
  contentRichness?: number;
}

interface LayerScoresData {
  access?: number;
  understanding?: number;
  extractability?: number;
}

interface FixData {
  description?: string;
  points?: number;
  layer?: string;
  factorId?: string;
  priority?: number;
}

const SUB_SCORE_LABELS: Record<string, string> = {
  schema: 'Structured Data',
  entity: 'Entity Signals',
  speakable: 'Speakable Markup',
  structure: 'Content Structure',
  faq: 'FAQ / Q&A',
  summary: 'Summaries & Definitions',
  feed: 'Feeds & Discovery',
  crawlAccess: 'Crawl Access',
  contentRichness: 'Content Richness',
};

export default async function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');

  const { id } = await params;

  // The id could be a project ID — show project's scans
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scans: { orderBy: { createdAt: 'desc' }, take: 20 },
      organization: { include: { members: true } },
    },
  });

  if (!project) notFound();

  const userId = (session.user as { id?: string }).id;
  if (!project.organization.members.some((m) => m.userId === userId)) {
    notFound();
  }

  const latestScan = project.scans[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <p className="text-gray-500">{project.domain}</p>
      </div>

      {latestScan ? (
        <>
          {/* Score overview */}
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border bg-white p-6 text-center">
              <p className="text-sm text-gray-500">Overall Score</p>
              <p className="mt-2 text-5xl font-extrabold" style={{ color: getTier(latestScan.score).color }}>
                {latestScan.score}
              </p>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: getTier(latestScan.score).color }}
              >
                {getTier(latestScan.score).label}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                {getTier(latestScan.score).message}
              </p>
            </div>

            {/* Layer scores */}
            <div className="rounded-lg border bg-white p-6">
              <p className="mb-4 text-sm font-semibold text-gray-700">AI Visibility Stack</p>
              {(['access', 'understanding', 'extractability'] as const).map((layer) => {
                const layerScores = (latestScan.layerScores ?? {}) as LayerScoresData;
                const score = layerScores[layer] ?? 0;
                const colors = { access: '#3B82F6', understanding: '#8B5CF6', extractability: '#EC4899' };
                const labels = { access: 'L1: Access', understanding: 'L2: Understanding', extractability: 'L3: Extractability' };
                return (
                  <div key={layer} className="mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">{labels[layer]}</span>
                      <span className="font-semibold" style={{ color: colors[layer] }}>{score}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${score}%`, backgroundColor: colors[layer] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Meta */}
            <div className="rounded-lg border bg-white p-6">
              <p className="mb-4 text-sm font-semibold text-gray-700">Scan Details</p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">URL</dt>
                  <dd className="truncate font-mono text-gray-900" style={{ maxWidth: 200 }}>{latestScan.url}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Page Type</dt>
                  <dd className="text-gray-900">{latestScan.pageType ?? 'Unknown'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Scanned</dt>
                  <dd className="text-gray-900">{latestScan.createdAt.toLocaleDateString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Hash</dt>
                  <dd className="font-mono text-gray-500">{latestScan.hash}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Sub-scores */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Sub-Scores</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries((latestScan.subScores ?? {}) as SubScoresData).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{SUB_SCORE_LABELS[key] ?? key}</span>
                    <span className="font-semibold text-gray-900">{value ?? 0}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${value ?? 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fixes */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Recommended Fixes</h2>
            {Array.isArray(latestScan.fixes) && (latestScan.fixes as FixData[]).length > 0 ? (
              <div className="space-y-3">
                {(latestScan.fixes as FixData[]).map((fix, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                      {(fix.priority ?? i + 1)}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{fix.description}</p>
                      <div className="mt-1 flex gap-2 text-xs text-gray-500">
                        <span className="rounded bg-green-100 px-1.5 text-green-700">+{fix.points} pts</span>
                        <span>{fix.layer}</span>
                        <span>Factor {fix.factorId}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No fixes recommended — great job!</p>
            )}
          </div>

          {/* Scan history */}
          {project.scans.length > 1 && (
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Scan History</h2>
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">URL</th>
                    <th className="pb-2">Score</th>
                    <th className="pb-2">Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {project.scans.map((scan) => (
                    <tr key={scan.id}>
                      <td className="py-2 text-gray-500">{scan.createdAt.toLocaleDateString()}</td>
                      <td className="py-2 truncate font-mono text-gray-600" style={{ maxWidth: 300 }}>{scan.url}</td>
                      <td className="py-2 font-semibold">{scan.score}</td>
                      <td className="py-2">{scan.tier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          No scans yet. Run your first scan from the API or use the scan form.
        </div>
      )}
    </div>
  );
}
