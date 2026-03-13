'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { getTier, TIER_CONFIG, LAYER_CONFIG } from '@aivs/types';
import type { ScanResult } from '@aivs/types';
import { ScoreRing } from './ScoreRing';
import { SUB_SCORE_LABELS } from './constants';

interface ScanResultWithId extends ScanResult {
  id: number;
}

const RESULTS_SECTIONS = [
  { id: 'overview', label: 'Visibility Overview' },
  { id: 'stack', label: 'AI Visibility Stack' },
  { id: 'scores', label: 'Score Breakdown' },
  { id: 'citations', label: 'Distribution by LLM' },
  { id: 'fixes', label: 'Recommended Fixes' },
  { id: 'extraction', label: 'Extraction Preview' },
] as const;

interface ScanResultsProps {
  scanResult: ScanResultWithId;
  activeSection: string;
  onActiveSectionChange: (section: string) => void;
  onReset: () => void;
}

export function ScanResults({ scanResult, activeSection, onActiveSectionChange, onReset }: ScanResultsProps) {
  const tier = getTier(scanResult.score);

  const { foundItems, missingItems } = useMemo(() => {
    const found: string[] = [];
    const missing: string[] = [];
    if (!scanResult.extraction || typeof scanResult.extraction !== 'object') return { foundItems: found, missingItems: missing };

    const ext = scanResult.extraction as Record<string, Record<string, unknown>>;
    if (ext.schema?.types && Array.isArray(ext.schema.types) && ext.schema.types.length > 0)
      found.push(`Schema: ${(ext.schema.types as string[]).join(', ')}`);
    if (ext.crawlAccess?.isHttps) found.push('HTTPS');
    if (ext.crawlAccess?.hasCanonical) found.push('Canonical tag');
    if (ext.crawlAccess?.isIndexable) found.push('Indexable');
    if (ext.feeds?.hasSitemap) found.push('Sitemap');
    if (ext.feeds?.hasRss) found.push('RSS feed');
    if (ext.feeds?.hasLlmsTxt) found.push('llms.txt');
    if (ext.contentRichness?.hasStatistics) found.push('Statistics');
    if (ext.contentRichness?.hasCitations) found.push('Citations');
    if (ext.contentRichness?.hasImages) found.push('Images');
    if (ext.entities?.hasAuthor) found.push('Named author');
    if (ext.structure?.headingHierarchyValid) found.push('Valid headings');

    if (ext.schema?.details && !(ext.schema.details as Record<string, unknown>).speakable)
      missing.push('Speakable markup');
    if (ext.faq && !ext.faq.hasFaqSchema) missing.push('FAQ schema');
    if (ext.contentRichness && !ext.contentRichness.hasStatistics) missing.push('Statistics');
    if (ext.contentRichness && !ext.contentRichness.hasCitations) missing.push('Citations');
    if (ext.summary && !ext.summary.hasDefinitionPattern) missing.push('Front-loaded answers');
    if (ext.feeds && !ext.feeds.hasRss) missing.push('RSS feed');
    if (ext.feeds && !ext.feeds.hasLlmsTxt) missing.push('llms.txt');
    if (ext.authorEeat && !ext.authorEeat.hasAuthorBio) missing.push('Author bio');
    if (ext.authorEeat && !ext.authorEeat.hasAuthorCredentials) missing.push('Author credentials');

    return { foundItems: found, missingItems: missing };
  }, [scanResult]);

  const projectedScore = useMemo(
    () => Math.min(100, scanResult.score + scanResult.fixes.reduce((s, f) => s + f.points, 0)),
    [scanResult],
  );

  const layerEntries = Object.entries(LAYER_CONFIG) as [string, typeof LAYER_CONFIG[string]][];

  return (
    <div>
      {/* Breadcrumb bar */}
      <div className="border-b bg-white px-6 py-3">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={onReset} className="hover:text-blue-600">
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
                    onActiveSectionChange(s.id);
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
                <p className="text-xs font-semibold uppercase text-gray-500 mb-4">Key Metrics</p>
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
                  {TIER_CONFIG.map((t) => {
                    const isActive = scanResult.tier === t.key;
                    return (
                      <div
                        key={t.key}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                          isActive ? 'bg-opacity-10' : ''
                        }`}
                        style={isActive ? { backgroundColor: `${t.color}15` } : undefined}
                      >
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        <span className={`text-sm ${isActive ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                          {t.label}
                        </span>
                        <span className="ml-auto text-xs text-gray-400">{t.min}–{t.max}</span>
                        {isActive && (
                          <span className="text-xs font-bold" style={{ color: t.color }}>&#10003;</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AI Visibility Stack */}
            <div id="section-stack" className="rounded-xl border bg-white p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">AI Visibility Stack</h3>
              {layerEntries.map(([key, layer]) => {
                const score = scanResult.layerScores[key as keyof typeof scanResult.layerScores] ?? 0;
                return (
                  <div key={key} className="mb-4 last:mb-0">
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

            {/* Distribution by LLM + Extraction Preview side by side */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Distribution by LLM */}
              <div id="section-citations" className="rounded-xl border bg-white p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Distribution by LLM</h3>
                {scanResult.citationSimulation?.platforms && (
                  <div className="space-y-3">
                    {scanResult.citationSimulation.platforms.map((platform) => {
                      const barColor = getTier(platform.score).color;
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
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-green-600 mb-2">Found</p>
                    <ul className="space-y-1">
                      {foundItems.map((item, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="text-green-500">&#9679;</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-red-600 mb-2">Missing</p>
                    <ul className="space-y-1">
                      {missingItems.map((item, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="text-red-500">&#9679;</span> {item}
                        </li>
                      ))}
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
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([key, value]) => {
                      const meta = SUB_SCORE_LABELS[key];
                      const barColor = getTier(value as number).color;
                      return (
                        <tr key={key}>
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
                            {value as number}
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
                      const layerColor = LAYER_CONFIG[fix.layer]?.color ?? '#6B7280';
                      return (
                        <tr key={`${fix.factorId}-${i}`}>
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
                  <span className="font-bold text-green-600">{projectedScore}/100</span>
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
                  onClick={onReset}
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
  );
}
