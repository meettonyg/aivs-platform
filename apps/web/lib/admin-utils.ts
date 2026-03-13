import { NextRequest } from 'next/server';

/** Parse common pagination/sort/search params from request URL */
export function parsePaginationParams(req: NextRequest) {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const search = url.searchParams.get('search') ?? '';
  const sort = url.searchParams.get('sort') ?? '';
  const order = (url.searchParams.get('order') ?? 'asc') as 'asc' | 'desc';
  const skip = (page - 1) * limit;
  return { page, limit, search, sort, order, skip };
}

/** Build pagination response metadata */
export function paginationMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/** Convert array of objects to CSV string */
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const val = row[c.key];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(','),
    )
    .join('\n');
  return `${header}\n${body}`;
}

/** Build Prisma orderBy from sort/order params */
export function buildOrderBy(sort: string, order: 'asc' | 'desc', allowedFields: string[]) {
  if (sort && allowedFields.includes(sort)) {
    return { [sort]: order };
  }
  return { createdAt: 'desc' as const };
}
