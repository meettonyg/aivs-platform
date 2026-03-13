'use client';

import Link from 'next/link';
import { useState, useRef, FormEvent } from 'react';

/* ── Tier helpers (mirrored from scanner-engine to avoid server-only import) ── */

const TIER_CONFIG = [
  { key: 'authority', label: 'AI Authority', color: '#22C55E', bgLight: 'bg-green-50', textColor: 'text-green-600', min: 90, max: 100, message: 'Healthy across all layers of the AI Visibility Stack.' },
  { key: 'extractable', label: 'AI Extractable', color: '#3B82F6', bgLight: 'bg-blue-50', textColor: 'text-blue-600', min: 70, max: 89, message: 'Strong foundation but needs Layer 3 refinement.' },
  { key: 'readable', label: 'AI Readable', color: '#EAB308', bgLight: 'bg-yellow-50', textColor: 'text-yellow-600', min: 40, max: 69, message: "AI can read it but won't cite it." },
  { key: 'invisible', label: 'Invisible to AI', color: '#EF4444', bgLight: 'bg-red-50', textColor: 'text-red-600', min: 0, max: 39, message: 'AI systems cannot reliably access or understand this content.' },
] as const;

function getTier(score: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return TIER_CONFIG.find((t) => clamped >= t.min && clamped <= t.max) ?? TIER_CONFIG[TIER_CONFIG.length - 1];
}

/* ── Sub-score labels ── */

const SUB_SCORE_LABELS: Record<string, { label: string; layer: string }> = {
  crawlAccess: { label: 'Crawl Access', layer: 'Layer 1' },
  botBlocking: { label: 'Bot Blocking', layer: 'Layer 1' },
  feed: { label: 'Feed & Discovery', layer: 'Layer 1' },
  schema: { label: 'Schema Completeness', layer: 'Layer 2' },
  schemaAccuracy: { label: 'Schema Accuracy', layer: 'Layer 2' },
  entity: { label: 'Entity Density', layer: 'Layer 2' },
  structure: { label: 'Content Structure', layer: 'Layer 2' },
  contentRichness: { label: 'Content Richness', layer: 'Layer 2' },
  faq: { label: 'FAQ & Answer Coverage', layer: 'Layer 3' },
  summary: { label: 'Summary Presence', layer: 'Layer 3' },
  speakable: { label: 'Speakable Markup', layer: 'Layer 3' },
  contentQuality: { label: 'Content Quality', layer: 'Layer 3' },
  authorEeat: { label: 'Author E-E-A-T', layer: 'Layer 3' },
};

/* ── Types ── */

interface ScanResult {
  url: string;
  score: number;
  tier: string;
  subScores: Record<string, number>;
  layerScores: { access: number; understanding: number; extractability: number };
  extraction: Record<string, unknown>;
  fixes: { description: string; points: number; layer: string; factorId: string; priority: number }[];
  citationSimulation: {
    overall: number;
    platforms: { name: string; score: number; confidence: string; reasoning: string }[];
    strengths: string[];
    weaknesses: string[];
  };
  robotsData: Record<string, unknown>;
  pageType: string;
  hash: string;
  id: number;
}

/* ── Score ring SVG component ── */

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const tier = getTier(score);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tier.color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-3xl font-extrabold text-gray-900">{score}</span>
        <span className="text-sm text-gray-400">/100</span>
        <p className="text-xs font-medium" style={{ color: tier.color }}>{tier.label}</p>
      </div>
    </div>
  );
}

/* ── Results nav items ── */

const RESULTS_SECTIONS = [
  { id: 'overview', label: 'Visibility Overview' },
  { id: 'stack', label: 'AI Visibility Stack' },
  { id: 'scores', label: 'Score Breakdown' },
  { id: 'citations', label: 'Distribution by LLM' },
  { id: 'fixes', label: 'Recommended Fixes' },
  { id: 'extraction', label: 'Extraction Preview' },
] as const;

/* ── Main page ── */

export default function HomePage() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const resultsRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = formData.get('url') as string;
    if (!url) return;

    setIsScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const res = await fetch(`/api/scan?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? 'Scan failed. Please try again.');
        return;
      }
      setScanResult(json.data);
      setActiveSection('overview');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      setError('Network error. Please check the URL and try again.');
    } finally {
      setIsScanning(false);
    }
  }

  const tier = scanResult ? getTier(scanResult.score) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-blue-600">AI Visibility Scanner</span>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Log in
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-white border-b">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900">
            Is your content visible to AI?
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Measure your AI Engine Optimization (AEO) score across 27 factors.
            Discover how ChatGPT, Google AI Overviews, Perplexity, and other AI systems
            see your content — and what to fix.
          </p>

          {/* Free scanner */}
          <form onSubmit={handleSubmit} className="mx-auto mt-10 flex max-w-xl gap-3">
            <input
              type="url"
              name="url"
              placeholder="Enter a URL to scan..."
              required
              disabled={isScanning}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isScanning}
              className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isScanning ? 'Scanning...' : 'Scan Free'}
            </button>
          </form>
          <p className="mt-3 text-sm text-gray-500">No account required. 5 free scans per month.</p>

          {error && (
            <div className="mx-auto mt-6 max-w-xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {isScanning && (
            <div className="mt-12 flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="text-gray-500">Analyzing your page across 27 AI visibility factors...</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Scan Results (Semrush-style layout) ── */}
      {scanResult && tier && (
        <div ref={resultsRef}>
          {/* Breadcrumb bar */}
          <div className="border-b bg-white px-6 py-3">
            <div className="mx-auto max-w-7xl">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <button onClick={() => { setScanResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-blue-600">
                  Home
                </button>
                <span>&rsaquo;</span>
                <span className="text-gray-900 font-medium">Visibility Overview</span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-gray-900">
                Visibility Overview: <span className="font-normal text-gray-600">{scanResult.url}</span>
              </h2>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span className="rounded bg-gray-100 px-2 py-0.5">{scanResult.pageType}</span>
                <span>Scan ID: {scanResult.hash}</span>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-6 py-6">
            <div className="flex gap-6">
              {/* Left sidebar nav */}
              <aside className="hidden lg:block w-52 flex-shrink-0">
                <nav className="sticky top-6 space-y-0.5">
                  {RESULTS_SECTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveSection(s.id);
                        document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`block w-full rounded-md px-3 py-2 text-left text-sm transition ${
                        activeSection === s.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </nav>

                {/* What's Next sidebar card */}
                <div className="mt-6 rounded-xl border bg-white p-4">
                  <h3 className="text-sm font-bold text-gray-900">What&apos;s Next?</h3>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-700">Track your progress</p>
                      <p className="text-xs text-gray-500">Create a free account to monitor changes over time.</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700">Audit your full site</p>
                      <p className="text-xs text-gray-500">Scan all your pages to find site-wide issues.</p>
                    </div>
                    <Link
                      href="/auth/register"
                      className="block rounded-lg bg-blue-600 py-2 text-center text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Get Started Free
                    </Link>
                  </div>
                </div>
              </aside>

              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-6">
                {/* Overview row */}
                <div id="section-overview" className="grid gap-6 md:grid-cols-3">
                  {/* Score card */}
                  <div className="rounded-xl border bg-white p-6">
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-4">AI Visibility</p>
                    <div className="flex flex-col items-center">
                      <ScoreRing score={scanResult.score} />
                      <p className="mt-3 text-xs text-gray-500 text-center">{tier.message}</p>
                    </div>
                  </div>

                  {/* Key metrics card */}
                  <div className="rounded-xl border bg-white p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Key Metrics</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-extrabold text-gray-900">{scanResult.layerScores.access}</p>
                        <p className="text-xs text-gray-500">Access Score</p>
                      </div>
                      <div>
                        <p className="text-2xl font-extrabold text-gray-900">{scanResult.layerScores.understanding}</p>
                        <p className="text-xs text-gray-500">Understanding</p>
                      </div>
                      <div>
                        <p className="text-2xl font-extrabold text-gray-900">{scanResult.layerScores.extractability}</p>
                        <p className="text-xs text-gray-500">Extractability</p>
                      </div>
                      <div>
                        <p className="text-2xl font-extrabold text-gray-900">{scanResult.citationSimulation?.overall ?? '—'}</p>
                        <p className="text-xs text-gray-500">Citation Score</p>
                      </div>
                    </div>
                  </div>

                  {/* Tier breakdown card */}
                  <div className="rounded-xl border bg-white p-6">
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-4">Tier Classification</p>
                    <div className="space-y-2">
                      {TIER_CONFIG.map((t) => (
                        <div
                          key={t.key}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                            scanResult.tier === t.key ? t.bgLight : ''
                          }`}
                        >
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                          <span className={`text-sm ${scanResult.tier === t.key ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                            {t.label}
                          </span>
                          <span className="ml-auto text-xs text-gray-400">{t.min}–{t.max}</span>
                          {scanResult.tier === t.key && (
                            <span className="text-xs font-bold" style={{ color: t.color }}>&#10003;</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Visibility Stack */}
                <div id="section-stack" className="rounded-xl border bg-white p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">AI Visibility Stack</h3>
                  {([
                    { key: 'access' as const, num: 1, label: 'Access', color: '#3B82F6', bg: 'bg-blue-50' },
                    { key: 'understanding' as const, num: 2, label: 'Understanding', color: '#8B5CF6', bg: 'bg-purple-50' },
                    { key: 'extractability' as const, num: 3, label: 'Extractability', color: '#EC4899', bg: 'bg-pink-50' },
                  ]).map((layer) => {
                    const score = scanResult.layerScores[layer.key] ?? 0;
                    return (
                      <div key={layer.key} className="mb-4 last:mb-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: layer.color }}>
                              {layer.num}
                            </span>
                            <span className="text-sm font-medium text-gray-700">{layer.label}</span>
                          </div>
                          <span className="text-sm font-bold" style={{ color: layer.color }}>{score}/100</span>
                        </div>
                        <div className="h-3 rounded-full bg-gray-100">
                          <div
                            className="h-3 rounded-full transition-all duration-700"
                            style={{ width: `${score}%`, backgroundColor: layer.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Distribution by LLM + Score Breakdown side by side */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Distribution by LLM */}
                  <div id="section-citations" className="rounded-xl border bg-white p-6">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Distribution by LLM</h3>
                    {scanResult.citationSimulation?.platforms && (
                      <div className="space-y-3">
                        {scanResult.citationSimulation.platforms.map((platform) => {
                          const barColor = platform.score >= 70 ? '#3B82F6' : platform.score >= 40 ? '#EAB308' : '#EF4444';
                          return (
                            <div key={platform.name}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-gray-700">{platform.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400">{platform.confidence}</span>
                                  <span className="text-sm font-bold" style={{ color: barColor }}>{platform.score}</span>
                                </div>
                              </div>
                              <div className="h-2 rounded-full bg-gray-100">
                                <div
                                  className="h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${platform.score}%`, backgroundColor: barColor }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Strengths / Weaknesses */}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {scanResult.citationSimulation?.strengths?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase text-green-600 mb-1">Strengths</p>
                          {scanResult.citationSimulation.strengths.map((s, i) => (
                            <p key={i} className="text-xs text-gray-600 mb-0.5">+ {s}</p>
                          ))}
                        </div>
                      )}
                      {scanResult.citationSimulation?.weaknesses?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase text-red-600 mb-1">Weaknesses</p>
                          {scanResult.citationSimulation.weaknesses.map((w, i) => (
                            <p key={i} className="text-xs text-gray-600 mb-0.5">- {w}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Extraction summary card */}
                  <div id="section-extraction" className="rounded-xl border bg-white p-6">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Extraction Preview</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Found */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-green-600 mb-2">Found</p>
                        <ul className="space-y-1">
                          {scanResult.extraction && typeof scanResult.extraction === 'object' && (() => {
                            const items: string[] = [];
                            const ext = scanResult.extraction as Record<string, Record<string, unknown>>;
                            if (ext.schema?.types && Array.isArray(ext.schema.types) && ext.schema.types.length > 0)
                              items.push(`Schema: ${(ext.schema.types as string[]).join(', ')}`);
                            if (ext.crawlAccess?.isHttps) items.push('HTTPS');
                            if (ext.crawlAccess?.hasCanonical) items.push('Canonical tag');
                            if (ext.crawlAccess?.isIndexable) items.push('Indexable');
                            if (ext.feeds?.hasSitemap) items.push('Sitemap');
                            if (ext.feeds?.hasRss) items.push('RSS feed');
                            if (ext.feeds?.hasLlmsTxt) items.push('llms.txt');
                            if (ext.contentRichness?.hasStatistics) items.push('Statistics');
                            if (ext.contentRichness?.hasCitations) items.push('Citations');
                            if (ext.contentRichness?.hasImages) items.push('Images');
                            if (ext.entities?.hasAuthor) items.push('Named author');
                            if (ext.structure?.headingHierarchyValid) items.push('Valid headings');
                            return items.map((item, i) => (
                              <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                                <span className="text-green-500">&#9679;</span> {item}
                              </li>
                            ));
                          })()}
                        </ul>
                      </div>
                      {/* Missing */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-red-600 mb-2">Missing</p>
                        <ul className="space-y-1">
                          {scanResult.extraction && typeof scanResult.extraction === 'object' && (() => {
                            const items: string[] = [];
                            const ext = scanResult.extraction as Record<string, Record<string, unknown>>;
                            if (ext.schema?.details && !(ext.schema.details as Record<string, unknown>).speakable)
                              items.push('Speakable markup');
                            if (ext.faq && !ext.faq.hasFaqSchema) items.push('FAQ schema');
                            if (ext.contentRichness && !ext.contentRichness.hasStatistics) items.push('Statistics');
                            if (ext.contentRichness && !ext.contentRichness.hasCitations) items.push('Citations');
                            if (ext.summary && !ext.summary.hasDefinitionPattern) items.push('Front-loaded answers');
                            if (ext.feeds && !ext.feeds.hasRss) items.push('RSS feed');
                            if (ext.feeds && !ext.feeds.hasLlmsTxt) items.push('llms.txt');
                            if (ext.authorEeat && !ext.authorEeat.hasAuthorBio) items.push('Author bio');
                            if (ext.authorEeat && !ext.authorEeat.hasAuthorCredentials) items.push('Author credentials');
                            return items.map((item, i) => (
                              <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                                <span className="text-red-500">&#9679;</span> {item}
                              </li>
                            ));
                          })()}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown table */}
                <div id="section-scores" className="rounded-xl border bg-white p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Score Breakdown</h3>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase text-gray-500">
                        <th className="pb-3 pr-4">Factor</th>
                        <th className="pb-3 pr-4">Layer</th>
                        <th className="pb-3 pr-4 w-1/3">Score</th>
                        <th className="pb-3 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Object.entries(scanResult.subScores)
                        .filter(([key]) => SUB_SCORE_LABELS[key])
                        .sort(([, a], [, b]) => b - a)
                        .map(([key, value]) => {
                          const meta = SUB_SCORE_LABELS[key];
                          const barColor = value >= 70 ? '#22C55E' : value >= 40 ? '#EAB308' : '#EF4444';
                          return (
                            <tr key={key} className="group">
                              <td className="py-3 pr-4 text-sm text-gray-700">{meta.label}</td>
                              <td className="py-3 pr-4">
                                <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                                  {meta.layer}
                                </span>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="h-2 rounded-full bg-gray-100">
                                  <div
                                    className="h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${value}%`, backgroundColor: barColor }}
                                  />
                                </div>
                              </td>
                              <td className="py-3 text-right text-sm font-bold" style={{ color: barColor }}>
                                {value}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Recommended Fixes */}
                {scanResult.fixes.length > 0 && (
                  <div id="section-fixes" className="rounded-xl border bg-white p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-900">Recommended Fixes</h3>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        {scanResult.fixes.length} fixes &middot; +{scanResult.fixes.reduce((s, f) => s + f.points, 0)} pts potential
                      </span>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-left text-[11px] font-semibold uppercase text-gray-500">
                          <th className="pb-3 w-8">#</th>
                          <th className="pb-3 pr-4">Fix</th>
                          <th className="pb-3 pr-4">Layer</th>
                          <th className="pb-3 pr-4">Factor</th>
                          <th className="pb-3 text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {scanResult.fixes.map((fix, i) => {
                          const layerColor = fix.layer === 'access' ? '#3B82F6' : fix.layer === 'understanding' ? '#8B5CF6' : '#EC4899';
                          return (
                            <tr key={i}>
                              <td className="py-3 text-xs font-bold text-gray-400">{fix.priority ?? i + 1}</td>
                              <td className="py-3 pr-4 text-sm text-gray-700">{fix.description}</td>
                              <td className="py-3 pr-4">
                                <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: layerColor }}>
                                  {fix.layer}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-xs font-mono text-gray-500">{fix.factorId}</td>
                              <td className="py-3 text-right text-sm font-bold text-green-600">+{fix.points}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="mt-4 rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-600">
                      Projected score after fixes:{' '}
                      <span className="font-bold text-green-600">
                        {Math.min(100, scanResult.score + scanResult.fixes.reduce((s, f) => s + f.points, 0))}/100
                      </span>
                    </div>
                  </div>
                )}

                {/* CTA banner */}
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-8 text-center">
                  <p className="text-lg font-bold text-gray-900">You just scanned 1 page</p>
                  <p className="mt-2 text-sm text-gray-600">
                    Your site has dozens (or hundreds) of pages. Each one needs its own schema, structure, and AI-ready signals.
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-4">
                    <Link
                      href="/auth/register"
                      className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Audit your entire site &rarr;
                    </Link>
                    <button
                      onClick={() => { setScanResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Scan another URL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tiers preview — only show when no results */}
      {!scanResult && !isScanning && (
        <>
          <section className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="mb-8 text-center text-3xl font-bold text-gray-900">AI Visibility Tiers</h2>
            <div className="grid gap-6 md:grid-cols-4">
              {[
                { label: 'AI Authority', range: '90-100', color: 'bg-green-500', desc: 'Healthy across all layers.' },
                { label: 'AI Extractable', range: '70-89', color: 'bg-blue-500', desc: 'Strong but needs Layer 3 work.' },
                { label: 'AI Readable', range: '40-69', color: 'bg-yellow-500', desc: "AI can read it but won't cite it." },
                { label: 'Invisible to AI', range: '0-39', color: 'bg-red-500', desc: 'AI cannot reliably access this.' },
              ].map((t) => (
                <div key={t.label} className="rounded-lg border bg-white p-6 text-center">
                  <div className={`mx-auto mb-3 h-3 w-3 rounded-full ${t.color}`} />
                  <h3 className="font-semibold text-gray-900">{t.label}</h3>
                  <p className="text-sm text-gray-500">{t.range}</p>
                  <p className="mt-2 text-sm text-gray-600">{t.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Pricing */}
          <section className="bg-white py-16">
            <div className="mx-auto max-w-5xl px-6">
              <h2 className="mb-8 text-center text-3xl font-bold text-gray-900">Pricing</h2>
              <div className="grid gap-6 md:grid-cols-3">
                {[
                  { name: 'Free', price: '$0', credits: '5 scans/mo', features: ['Single-URL scans', 'Core 27 factors', 'PDF reports'] },
                  { name: 'Pro', price: '$129/mo', credits: '5,000 pages/mo', features: ['All on-page factors', '10 domains', 'API access', 'Scan history', 'White-label basics'] },
                  { name: 'Agency', price: '$399/mo', credits: '25,000 pages/mo', features: ['All factors (70+)', '50 domains', 'Full white-label', 'Client portal', 'Scheduled scans'] },
                ].map((plan) => (
                  <div key={plan.name} className="rounded-lg border p-6">
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    <p className="mt-1 text-3xl font-extrabold text-gray-900">{plan.price}</p>
                    <p className="mt-1 text-sm text-gray-500">{plan.credits}</p>
                    <ul className="mt-4 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="text-green-500">&#10003;</span> {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/auth/register"
                      className="mt-6 block rounded-lg bg-blue-600 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Get Started
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="border-t bg-white py-8 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} AI Visibility Scanner. All rights reserved.
      </footer>
    </div>
  );
}
