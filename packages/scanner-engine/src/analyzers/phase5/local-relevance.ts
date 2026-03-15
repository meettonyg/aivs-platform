/**
 * Local relevance analyzer — Factor 7.4 in the AEO taxonomy.
 *
 * Detects location-specific signals: LocalBusiness schema, geo-targeted content,
 * NAP (Name, Address, Phone) consistency, regional specificity.
 * Lightweight / deterministic — runs in Phase 5.
 */

import type { CheerioAPI } from 'cheerio';

export interface LocalRelevanceResult {
  score: number;
  isLocalContent: boolean;
  hasLocalBusinessSchema: boolean;
  hasGeoMeta: boolean;
  hasNapData: boolean;
  detectedLocations: string[];
  localSignals: string[];
}

const GEO_META_SELECTORS = [
  'meta[name="geo.region"]',
  'meta[name="geo.placename"]',
  'meta[name="geo.position"]',
  'meta[name="ICBM"]',
  'meta[property="place:location:latitude"]',
  'meta[property="business:contact_data:street_address"]',
];

const LOCAL_SCHEMA_TYPES = new Set([
  'LocalBusiness', 'Restaurant', 'Store', 'MedicalBusiness',
  'LegalService', 'FinancialService', 'RealEstateAgent',
  'Dentist', 'Physician', 'Attorney', 'AutoRepair',
  'BeautySalon', 'BarberShop', 'DayCare', 'Electrician',
  'Plumber', 'LocksmithService', 'MovingCompany',
  'HousePainter', 'RoofingContractor', 'HealthClub',
]);

const LOCATION_PATTERNS = [
  // US states (abbreviated)
  /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/,
  // UK postcodes
  /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i,
  // Phone numbers (US)
  /\(\d{3}\)\s*\d{3}[-.]?\d{4}/,
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
  // "in [City]", "near [City]" patterns
  /\b(?:in|near|serving|located in)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/,
];

export function analyzeLocalRelevance($: CheerioAPI): LocalRelevanceResult {
  const localSignals: string[] = [];
  const detectedLocations: string[] = [];

  // Check LocalBusiness schema variants
  let hasLocalBusinessSchema = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text().trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const record = item as Record<string, unknown>;
        checkSchemaForLocal(record, localSignals, detectedLocations);
        if (typeof record['@type'] === 'string' && LOCAL_SCHEMA_TYPES.has(record['@type'])) {
          hasLocalBusinessSchema = true;
        }
        if (Array.isArray(record['@graph'])) {
          for (const g of record['@graph'] as Record<string, unknown>[]) {
            checkSchemaForLocal(g, localSignals, detectedLocations);
            if (typeof g['@type'] === 'string' && LOCAL_SCHEMA_TYPES.has(g['@type'])) {
              hasLocalBusinessSchema = true;
            }
          }
        }
      }
    } catch { /* skip */ }
  });

  if (hasLocalBusinessSchema) localSignals.push('LocalBusiness schema');

  // Check geo meta tags
  let hasGeoMeta = false;
  for (const selector of GEO_META_SELECTORS) {
    if ($(selector).length > 0) {
      hasGeoMeta = true;
      localSignals.push('geo meta tags');
      break;
    }
  }

  // Check hCard / adr microformat
  if ($('.vcard, .h-card, .adr, .h-adr, [itemtype*="PostalAddress"]').length > 0) {
    localSignals.push('address microformat');
  }

  // NAP detection (Name, Address, Phone)
  const bodyText = $('body').text();
  const hasPhone = /\(\d{3}\)\s*\d{3}[-.]?\d{4}|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(bodyText);
  const hasAddress = $('[itemprop="address"], [itemtype*="PostalAddress"], address').length > 0
    || /\b\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\b/.test(bodyText);
  const hasNapData = hasPhone && hasAddress;
  if (hasNapData) localSignals.push('NAP data');

  // Detect location patterns in content
  for (const pattern of LOCATION_PATTERNS) {
    const match = bodyText.match(pattern);
    if (match && detectedLocations.length < 10) {
      detectedLocations.push(match[0].trim());
    }
  }

  // Google Maps embed
  if ($('iframe[src*="google.com/maps"], iframe[src*="maps.google"]').length > 0) {
    localSignals.push('Google Maps embed');
  }

  // Service area / geo-targeted headings
  const headingText = $('h1, h2, h3').text().toLowerCase();
  if (/\b(near me|in\s+\w+|serving\s+\w+|locations?|directions?|hours)\b/.test(headingText)) {
    localSignals.push('location-oriented headings');
  }

  const isLocalContent = localSignals.length >= 2;

  // Scoring
  let score = 0;
  if (hasLocalBusinessSchema) score += 25;
  if (hasGeoMeta) score += 15;
  if (hasNapData) score += 20;
  if (detectedLocations.length > 0) score += 10;
  if (localSignals.includes('Google Maps embed')) score += 10;
  if (localSignals.includes('address microformat')) score += 10;
  if (localSignals.includes('location-oriented headings')) score += 10;

  return {
    score: Math.min(100, score),
    isLocalContent,
    hasLocalBusinessSchema,
    hasGeoMeta,
    hasNapData,
    detectedLocations: [...new Set(detectedLocations)].slice(0, 10),
    localSignals: [...new Set(localSignals)],
  };
}

function checkSchemaForLocal(
  obj: Record<string, unknown>,
  signals: string[],
  locations: string[],
): void {
  if (obj['address'] && typeof obj['address'] === 'object') {
    const addr = obj['address'] as Record<string, unknown>;
    if (addr['addressLocality']) {
      locations.push(String(addr['addressLocality']));
      signals.push('schema address');
    }
    if (addr['addressRegion']) {
      locations.push(String(addr['addressRegion']));
    }
  }
  if (obj['areaServed']) {
    signals.push('areaServed in schema');
    if (typeof obj['areaServed'] === 'string') {
      locations.push(obj['areaServed']);
    }
  }
  if (obj['geo'] && typeof obj['geo'] === 'object') {
    signals.push('geo coordinates in schema');
  }
}
