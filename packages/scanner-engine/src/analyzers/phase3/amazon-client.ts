/**
 * Amazon Product Advertising API (PAAPI) v5 client.
 *
 * Enriches confirmed books with sales data:
 *   - Best Sellers Rank (salesRank)
 *   - Customer review count and average rating
 *   - ASIN
 *
 * Requires Amazon Associates account (free, no per-call cost).
 * Env: AMAZON_ASSOCIATE_TAG, AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY
 */

const PAAPI_HOST = 'webservices.amazon.com';
const PAAPI_REGION = 'us-east-1';
const PAAPI_SERVICE = 'ProductAdvertisingAPI';

export function isAmazonConfigured(): boolean {
  return !!(
    process.env.AMAZON_ASSOCIATE_TAG &&
    process.env.AMAZON_ACCESS_KEY &&
    process.env.AMAZON_SECRET_KEY
  );
}

export interface AmazonBookEnrichment {
  asin: string;
  title: string;
  salesRank: number | null;
  reviewCount: number | null;
  starRating: number | null; // 0-5
  price: string | null;
  imageUrl: string | null;
  detailPageUrl: string;
}

/**
 * Search Amazon for a book by ISBN.
 */
export async function searchByIsbn(isbn: string): Promise<AmazonBookEnrichment | null> {
  if (!isAmazonConfigured() || !isbn) return null;

  try {
    const payload = buildSearchPayload({
      Keywords: isbn,
      SearchIndex: 'Books',
      ItemCount: 1,
    });

    const result = await callPaapi('SearchItems', payload);
    if (!result?.SearchResult?.Items?.length) return null;

    return mapItem(result.SearchResult.Items[0]);
  } catch {
    return null;
  }
}

/**
 * Search Amazon for a book by title and author.
 */
export async function searchByTitleAuthor(
  title: string,
  author: string,
): Promise<AmazonBookEnrichment | null> {
  if (!isAmazonConfigured()) return null;

  try {
    const payload = buildSearchPayload({
      Keywords: `${title} ${author}`,
      SearchIndex: 'Books',
      ItemCount: 3,
    });

    const result = await callPaapi('SearchItems', payload);
    const items = result?.SearchResult?.Items ?? [];

    // Find best match by title similarity
    const titleLower = title.toLowerCase();
    const match = items.find((item: PaapiItem) =>
      item.ItemInfo?.Title?.DisplayValue?.toLowerCase().includes(titleLower),
    ) ?? items[0];

    return match ? mapItem(match) : null;
  } catch {
    return null;
  }
}

/**
 * Enrich confirmed books with Amazon sales data.
 * Returns a map of candidateId → enrichment data.
 */
export async function enrichBooksWithAmazon(
  books: { id: string; title: string; isbn: string | null; authors: string[] }[],
): Promise<Map<string, AmazonBookEnrichment>> {
  const results = new Map<string, AmazonBookEnrichment>();

  if (!isAmazonConfigured()) return results;

  // Amazon PAAPI has rate limits — process sequentially with small batches
  for (const book of books) {
    let enrichment: AmazonBookEnrichment | null = null;

    // Try ISBN first (most accurate)
    if (book.isbn) {
      enrichment = await searchByIsbn(book.isbn);
    }

    // Fallback to title+author search
    if (!enrichment && book.title && book.authors.length > 0) {
      enrichment = await searchByTitleAuthor(book.title, book.authors[0]);
    }

    if (enrichment) {
      results.set(book.id, enrichment);
    }
  }

  return results;
}

/**
 * Compute bonus authority points from Amazon data (0-20).
 * Used by author-books scorer.
 */
export function computeAmazonBookBonus(enrichment: AmazonBookEnrichment): number {
  let bonus = 0;

  // Has reviews
  if (enrichment.reviewCount && enrichment.reviewCount > 0) bonus += 3;
  if (enrichment.reviewCount && enrichment.reviewCount >= 50) bonus += 3;
  if (enrichment.reviewCount && enrichment.reviewCount >= 500) bonus += 4;

  // High rating
  if (enrichment.starRating && enrichment.starRating >= 4.0) bonus += 3;

  // Good sales rank (lower is better)
  if (enrichment.salesRank && enrichment.salesRank <= 100000) bonus += 4;
  if (enrichment.salesRank && enrichment.salesRank <= 10000) bonus += 3;

  return Math.min(20, bonus);
}

// ── PAAPI v5 signing ──────────────────────────────────────────────────

interface PaapiItem {
  ASIN: string;
  DetailPageURL: string;
  ItemInfo?: {
    Title?: { DisplayValue: string };
    ByLineInfo?: { Contributors?: { Name: string; Role: string }[] };
  };
  BrowseNodeInfo?: {
    WebsiteSalesRank?: { SalesRank: number };
  };
  CustomerReviews?: {
    Count?: number;
    StarRating?: { Value: number };
  };
  Images?: {
    Primary?: { Large?: { URL: string } };
  };
  Offers?: {
    Listings?: { Price?: { DisplayAmount: string } }[];
  };
}

function mapItem(item: PaapiItem): AmazonBookEnrichment {
  return {
    asin: item.ASIN,
    title: item.ItemInfo?.Title?.DisplayValue ?? '',
    salesRank: item.BrowseNodeInfo?.WebsiteSalesRank?.SalesRank ?? null,
    reviewCount: item.CustomerReviews?.Count ?? null,
    starRating: item.CustomerReviews?.StarRating?.Value ?? null,
    price: item.Offers?.Listings?.[0]?.Price?.DisplayAmount ?? null,
    imageUrl: item.Images?.Primary?.Large?.URL ?? null,
    detailPageUrl: item.DetailPageURL,
  };
}

function buildSearchPayload(params: Record<string, string | number>): Record<string, unknown> {
  return {
    PartnerTag: process.env.AMAZON_ASSOCIATE_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    Resources: [
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'BrowseNodeInfo.WebsiteSalesRank',
      'CustomerReviews.Count',
      'CustomerReviews.StarRating',
      'Images.Primary.Large',
      'Offers.Listings.Price',
    ],
    ...params,
  };
}

async function callPaapi(operation: string, payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  // PAAPI v5 requires AWS Signature V4 signing.
  // Use a lightweight signing approach.
  const accessKey = process.env.AMAZON_ACCESS_KEY!;
  const secretKey = process.env.AMAZON_SECRET_KEY!;

  const target = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`;
  const body = JSON.stringify(payload);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, 'Z');
  const dateStamp = amzDate.slice(0, 8);

  // Compute AWS Signature V4
  const { createHmac, createHash } = await import('node:crypto');

  const hash = (data: string) => createHash('sha256').update(data).digest('hex');
  const hmac = (key: Buffer | string, data: string) =>
    createHmac('sha256', key).update(data).digest();

  const contentHash = hash(body);
  const canonicalHeaders = [
    `content-encoding:amz-1.0`,
    `content-type:application/json; charset=utf-8`,
    `host:${PAAPI_HOST}`,
    `x-amz-date:${amzDate}`,
    `x-amz-target:${target}`,
  ].join('\n') + '\n';

  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = [
    'POST',
    '/paapi5/searchitems',
    '',
    canonicalHeaders,
    signedHeaders,
    contentHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${PAAPI_REGION}/${PAAPI_SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hash(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, PAAPI_REGION);
  const kService = hmac(kRegion, PAAPI_SERVICE);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${PAAPI_HOST}/paapi5/searchitems`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Encoding': 'amz-1.0',
      'X-Amz-Date': amzDate,
      'X-Amz-Target': target,
      'Authorization': authorization,
      'User-Agent': 'AIVS-Scanner/1.0',
    },
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;
  return res.json() as Promise<Record<string, unknown>>;
}
