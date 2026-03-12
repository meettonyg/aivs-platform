/**
 * YMYL (Your Money, Your Life) sensitivity detector (Factor 5.13).
 *
 * Classifies pages as YMYL and escalates trust requirements accordingly.
 * YMYL topics require stronger E-E-A-T signals.
 */

import type { CheerioAPI } from 'cheerio';

export interface YmylResult {
  score: number;
  isYmyl: boolean;
  ymylCategory: string | null;
  confidence: 'high' | 'medium' | 'low';
  trustEscalation: TrustEscalation | null;
}

export interface TrustEscalation {
  required: string[];
  present: string[];
  missing: string[];
  escalationScore: number;
}

const YMYL_CATEGORIES: Record<string, { keywords: RegExp; trustSignals: string[] }> = {
  'health-medical': {
    keywords: /\b(health|medical|disease|symptom|treatment|diagnosis|medication|drug|prescription|hospital|doctor|surgery|cancer|diabetes|heart|blood pressure|mental health|therapy|dosage|side effect)\b/gi,
    trustSignals: ['namedAuthor', 'authorCredentials', 'medicalDisclaimer', 'dateModified', 'primarySources'],
  },
  'financial': {
    keywords: /\b(invest|stock|loan|mortgage|credit|debt|tax|insurance|retirement|401k|ira|banking|financial|money|income|salary|budget|cryptocurrency|trading)\b/gi,
    trustSignals: ['namedAuthor', 'authorCredentials', 'financialDisclaimer', 'dateModified', 'primarySources'],
  },
  'legal': {
    keywords: /\b(law|legal|attorney|lawyer|court|lawsuit|regulation|compliance|rights|liability|contract|patent|copyright|trademark)\b/gi,
    trustSignals: ['namedAuthor', 'authorCredentials', 'legalDisclaimer', 'dateModified'],
  },
  'safety': {
    keywords: /\b(safety|emergency|danger|hazard|toxic|poison|fire|flood|earthquake|evacuation|first aid|CPR|rescue)\b/gi,
    trustSignals: ['namedAuthor', 'primarySources', 'dateModified'],
  },
  'news-current-events': {
    keywords: /\b(breaking news|election|government|policy|legislation|vote|political|democracy|conflict|war)\b/gi,
    trustSignals: ['namedAuthor', 'dateModified', 'primarySources', 'corrections'],
  },
};

export function analyzeYmylSensitivity(
  $: CheerioAPI,
  url: string,
): YmylResult {
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const totalWords = bodyText.split(/\s+/).length;

  // Detect YMYL category
  let topCategory: string | null = null;
  let topDensity = 0;

  for (const [category, config] of Object.entries(YMYL_CATEGORIES)) {
    const matches = bodyText.match(config.keywords);
    const density = matches ? matches.length / totalWords : 0;

    if (density > topDensity && density > 0.005) {
      topCategory = category;
      topDensity = density;
    }
  }

  const isYmyl = topCategory !== null && topDensity > 0.01;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (topDensity > 0.03) confidence = 'high';
  else if (topDensity > 0.015) confidence = 'medium';

  // If not YMYL, full score (no escalation needed)
  if (!isYmyl || !topCategory) {
    return {
      score: 100,
      isYmyl: false,
      ymylCategory: null,
      confidence: 'low',
      trustEscalation: null,
    };
  }

  // Check trust signals for YMYL content
  const requiredSignals = YMYL_CATEGORIES[topCategory].trustSignals;
  const presentSignals: string[] = [];
  const missingSignals: string[] = [];

  for (const signal of requiredSignals) {
    if (checkTrustSignal($, signal, url)) {
      presentSignals.push(signal);
    } else {
      missingSignals.push(signal);
    }
  }

  const escalationScore = requiredSignals.length > 0
    ? Math.round((presentSignals.length / requiredSignals.length) * 100)
    : 100;

  // Score: higher for YMYL pages that have proper trust signals
  const score = escalationScore;

  return {
    score,
    isYmyl,
    ymylCategory: topCategory,
    confidence,
    trustEscalation: {
      required: requiredSignals,
      present: presentSignals,
      missing: missingSignals,
      escalationScore,
    },
  };
}

function checkTrustSignal($: CheerioAPI, signal: string, url: string): boolean {
  switch (signal) {
    case 'namedAuthor': {
      return (
        $('[rel="author"], .author-name, .byline, [itemprop="author"]').length > 0 ||
        $('script[type="application/ld+json"]').text().includes('"author"')
      );
    }
    case 'authorCredentials': {
      const authorSection = $('[class*="author"]').text();
      return /\b(ph\.?d|m\.?d|m\.?s|certified|licensed|professor|doctor|dr\.)\b/i.test(authorSection);
    }
    case 'medicalDisclaimer': {
      const text = $('body').text().toLowerCase();
      return text.includes('medical disclaimer') ||
        text.includes('not medical advice') ||
        text.includes('consult your doctor') ||
        text.includes('consult a healthcare');
    }
    case 'financialDisclaimer': {
      const text = $('body').text().toLowerCase();
      return text.includes('financial disclaimer') ||
        text.includes('not financial advice') ||
        text.includes('consult a financial advisor');
    }
    case 'legalDisclaimer': {
      const text = $('body').text().toLowerCase();
      return text.includes('legal disclaimer') ||
        text.includes('not legal advice') ||
        text.includes('consult an attorney');
    }
    case 'dateModified': {
      return (
        $('meta[property="article:modified_time"]').length > 0 ||
        $('time[datetime]').length > 0 ||
        $('script[type="application/ld+json"]').text().includes('"dateModified"')
      );
    }
    case 'primarySources': {
      const links = $('a[href]').toArray();
      const hostname = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
      const externalCount = links.filter((el) => {
        const href = $(el).attr('href') ?? '';
        try {
          const linkHost = new URL(href, url).hostname;
          return linkHost !== hostname && linkHost.length > 0;
        } catch { return false; }
      }).length;
      return externalCount >= 3;
    }
    case 'corrections': {
      const text = $('body').text().toLowerCase();
      return text.includes('correction') || text.includes('update:') || text.includes('editor\'s note');
    }
    default:
      return false;
  }
}
