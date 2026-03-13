import { NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';
import { toCsv } from '@/lib/admin-utils';

export async function GET() {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const scans = await prisma.scan.findMany({
    select: {
      id: true,
      url: true,
      score: true,
      tier: true,
      factorVersion: true,
      createdAt: true,
      project: {
        select: {
          name: true,
          domain: true,
          organization: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000, // Limit for performance
  });

  const rows = scans.map((s) => ({
    id: s.id,
    url: s.url,
    score: s.score,
    tier: s.tier,
    factorVersion: s.factorVersion,
    project: s.project?.name ?? '',
    domain: s.project?.domain ?? '',
    organization: s.project?.organization?.name ?? '',
    createdAt: s.createdAt.toISOString(),
  }));

  const csv = toCsv(rows, [
    { key: 'id', label: 'ID' },
    { key: 'url', label: 'URL' },
    { key: 'score', label: 'Score' },
    { key: 'tier', label: 'Tier' },
    { key: 'factorVersion', label: 'Factor Version' },
    { key: 'project', label: 'Project' },
    { key: 'domain', label: 'Domain' },
    { key: 'organization', label: 'Organization' },
    { key: 'createdAt', label: 'Created At' },
  ]);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="scans-export.csv"',
    },
  });
}
