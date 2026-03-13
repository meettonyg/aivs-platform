'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, FormEvent } from 'react';
import type { ScanResult } from '@aivs/types';
import { ScanResults } from '@/components/scan/ScanResults';

interface ScanResultWithId extends ScanResult {
  id: number;
}

export default function HomePage() {
  const [scanResult, setScanResult] = useState<ScanResultWithId | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scanResult) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scanResult]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = formData.get('url') as string;
    if (!url) return;

    setIsScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? 'Scan failed. Please try again.');
        return;
      }
      setScanResult(json.data);
      setActiveSection('overview');
    } catch {
      setError('Network error. Please check the URL and try again.');
    } finally {
      setIsScanning(false);
    }
  }

  function handleReset() {
    setScanResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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

      {/* Scan Results */}
      {scanResult && (
        <div ref={resultsRef}>
          <ScanResults
            scanResult={scanResult}
            activeSection={activeSection}
            onActiveSectionChange={setActiveSection}
            onReset={handleReset}
          />
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
