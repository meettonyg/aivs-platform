import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import type { WhiteLabelConfig } from '@aivs/types';

/**
 * GET /api/white-label/embed?orgId=xxx — Get embeddable widget JS
 *
 * Returns a self-contained JavaScript snippet that agencies can embed
 * on their websites for lead generation.
 */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return new NextResponse('// Missing orgId parameter', {
      status: 400,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, settings: true, planTier: true },
  });

  if (!org || (org.planTier !== 'agency' && org.planTier !== 'enterprise')) {
    return new NextResponse('// Widget not available for this plan', {
      status: 403,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  const settings = (org.settings ?? {}) as unknown as WhiteLabelConfig;
  const widget = settings.embedWidget;
  const branding = settings.branding;

  // Check origin
  const origin = request.headers.get('origin') ?? '';
  if (widget?.allowedOrigins && widget.allowedOrigins.length > 0) {
    const normalizedOrigin = origin.toLowerCase();
    let originHost = '';
    if (normalizedOrigin) {
      try {
        originHost = new URL(normalizedOrigin).hostname;
      } catch {
        originHost = '';
      }
    }

    const allowed = widget.allowedOrigins.some((o: string) => {
      if (o === '*') return true;

      const normalizedAllowed = String(o).toLowerCase().trim();
      if (!normalizedAllowed) return false;

      // Exact origin match supports full origin entries (scheme + host + optional port)
      if (normalizedOrigin === normalizedAllowed) return true;

      // Domain/subdomain match supports entries like "example.com"
      if (originHost === normalizedAllowed || originHost.endsWith(`.${normalizedAllowed}`)) {
        return true;
      }

      return false;
    });
    if (!allowed) {
      return new NextResponse('// Origin not allowed', {
        status: 403,
        headers: { 'Content-Type': 'application/javascript' },
      });
    }
  }

  const primaryColor = branding?.primaryColor ?? '#2563eb';
  const theme = widget?.theme ?? 'light';
  const displayMode = widget?.displayMode ?? 'score-and-tier';
  const ctaText = widget?.ctaText ?? 'Get Your AI Visibility Score';
  const apiBase = process.env.NEXTAUTH_URL ?? 'https://app.aivs.app';

  const js = `
(function() {
  'use strict';
  var container = document.getElementById('aivs-scanner-widget');
  if (!container) return;

  var style = document.createElement('style');
  style.textContent = \`
    .aivs-widget { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; }
    .aivs-widget input { width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box; }
    .aivs-widget input:focus { outline: none; border-color: ${primaryColor}; }
    .aivs-widget button { width: 100%; padding: 12px; margin-top: 8px; background: ${primaryColor}; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .aivs-widget button:hover { opacity: 0.9; }
    .aivs-widget button:disabled { opacity: 0.5; cursor: not-allowed; }
    .aivs-widget .aivs-result { text-align: center; padding: 24px; margin-top: 16px; border-radius: 12px; background: ${theme === 'dark' ? '#1f2937' : '#f9fafb'}; }
    .aivs-widget .aivs-score { font-size: 48px; font-weight: 800; color: ${primaryColor}; }
    .aivs-widget .aivs-tier { font-size: 14px; font-weight: 600; text-transform: uppercase; margin-top: 4px; }
    .aivs-widget .aivs-error { color: #dc2626; margin-top: 8px; font-size: 14px; }
  \`;
  document.head.appendChild(style);

  container.innerHTML = \`
    <div class="aivs-widget">
      <form id="aivs-form">
        <input type="url" id="aivs-url" placeholder="Enter your website URL" required />
        <button type="submit">${ctaText}</button>
      </form>
      <div id="aivs-output"></div>
    </div>
  \`;

  document.getElementById('aivs-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var url = document.getElementById('aivs-url').value;
    var btn = this.querySelector('button');
    var output = document.getElementById('aivs-output');
    btn.disabled = true;
    btn.textContent = 'Scanning...';
    output.innerHTML = '';

    fetch('${apiBase}/api/scan?url=' + encodeURIComponent(url))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.success) throw new Error(data.error?.message || 'Scan failed');
        var d = data.data;
        var tierColors = { authority: '#16a34a', extractable: '#2563eb', readable: '#d97706', invisible: '#dc2626' };
        var html = '<div class="aivs-result">';
        html += '<div class="aivs-score">' + d.score + '</div>';
        ${displayMode !== 'score-only' ? `html += '<div class="aivs-tier" style="color:' + (tierColors[d.tier] || '#6b7280') + '">' + d.tier + '</div>';` : ''}
        html += '</div>';
        output.innerHTML = html;
      })
      .catch(function(err) {
        output.innerHTML = '<div class="aivs-error">' + err.message + '</div>';
      })
      .finally(function() {
        btn.disabled = false;
        btn.textContent = '${ctaText}';
      });
  });
})();
`.trim();

  return new NextResponse(js, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': origin || '*',
    },
  });
}
