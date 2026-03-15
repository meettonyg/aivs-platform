# AI Visibility Scanner — SaaS Product Roadmap

**Version:** 1.0
**Date:** March 12, 2026
**Status:** Strategic Plan — Pre-Development

---

## Executive Summary

Transform the AI Visibility Scanner from a free WordPress plugin (single-URL, 27 factors) into a standalone SaaS platform measuring all 93 AEO factors with site-wide crawling, tiered subscriptions, and full white-label support for agencies.

**Target market:** Digital marketing agencies seeking to offer AI visibility auditing as a premium service.
**Differentiation:** AEO-first methodology (vs. traditional SEO tools like SEMrush, Ahrefs, BrightLocal).
**Timeline:** 12–18 months across 5 phases.

---

## Current State

| Dimension | Today |
|:---|:---|
| Architecture | WordPress plugin + theme (procedural PHP) |
| Factors measured | ~27 of 93 (Core 27 via 8 composite signals) |
| Crawling | Single URL only |
| Auth / billing | None — all scans are free and public |
| White-label | None — hardcoded branding |
| Data storage | WordPress custom post type (`aivs_scan`) with post meta |
| Rate limiting | IP-based, 10 scans/hour via transients |
| Lead capture | Email gate on PDF reports, GoHighLevel CRM integration |

### Current Scanner Signals (scanner-engine.php)

| Signal | Weight | Taxonomy Mapping |
|:---|:---|:---|
| Schema.org types detected | 20% | Category 2 (2.1–2.16) |
| Entity density | 15% | Category 4 (4.1, 4.2) |
| Definition & summary density | 15% | Category 3 (3.5) |
| Heading hierarchy quality | 15% | Category 3 (3.4) |
| FAQ / Q&A block presence | 15% | Categories 2.5 + 3.6 |
| Feed / manifest presence | 10% | Category 1 (1.10, 1.16, 1.17) |
| Speakable markup | 10% | Category 2 (2.10) |

### Category Coverage Gaps

| Category | Current Coverage | Gap |
|:---|:---|:---|
| 1. Crawlability & Access (18) | Strong — robots.txt, WAF, HTTPS, TTFB, canonical, SPA, JS dependency, llms-full.json | Remaining: mobile accessibility, crawl budget, markdown export |
| 2. Structured Data (17) | Strong — all major types detected + accuracy validation | HowTo, Product, Review, LocalBusiness, Event, BreadcrumbList all detected. Missing: feed architecture |
| 3. Content Structure (20) | Strong — front-loaded answers, concise blocks, FAQ, lists, tables, stats, fluff, fact density, self-containment | Remaining: fluency (NLP), structured depth, search intent |
| 4. Entity Signals (10) | Moderate — density + KG + Wikidata | Missing: type quality, disambiguation, cross-page, relationship mapping |
| 5. E-E-A-T & Trust (13) | Strong — 10 factors: author, bio, credentials, author page, experience, expertise, trust pages, citations, original research, freshness | Remaining: factual accuracy (LLM), information gain (LLM), YMYL (Phase 5) |
| 6. Off-Site Authority (11) | Strong — two-tier model (org+person) | 15+ signals: backlinks, KG, Wikidata, YouTube, podcast, books, academic, GitHub, patents, TMDb, social, news/GDELT, iTunes, Amazon, newsletter |
| 7. Semantic Matching (5) | Partial — conversational alignment, topical depth (Phase 4 deep scan) | Remaining: topic clusters, local relevance, intent class |
| 8. Platform-Specific (9) | Integrated — platform visibility estimates in scan results | 6 platforms: Google AIO, ChatGPT, Perplexity, Gemini, Voice, Copilot |
| 9. Observability (8) | Full | Scanner, comparison, scoring, badges, PDF reports all built |

---

## Subscription Tiers

| | Free | Pro | Agency | Enterprise |
|:---|:---|:---|:---|:---|
| **Price** | $0 | $129/mo | $399/mo | Custom ($800–2,000+) |
| **Annual price** | — | $103/mo ($1,236/yr) | $319/mo ($3,828/yr) | Custom |
| **Crawl credits/mo** | 5 single-URL | 5,000 pages | 25,000 pages | 100,000+ pages |
| **Domains** | Ad-hoc only | 10 | 50 | Unlimited |
| **Factors measured** | Core 27 | All on-page (~55) | All (~70+) | All 93 |
| **White-label** | No | Basic (logo, colors, PDF) | Full (custom domain, portal) | Full + custom integrations |
| **API access** | No | Yes | Yes | Yes + webhooks |
| **Team members** | — | 3 | 10 | Unlimited |
| **Client portal** | — | — | Yes | Yes |
| **Scheduled scans** | — | Weekly | Daily | Configurable |
| **Deep scan (LLM)** | — | Add-on | Included | Included |
| **Support** | Community | Email | Priority | Dedicated CSM |

### Credit Economics

- 1 single-URL scan = 1 credit
- 1 page in a site crawl = 1 credit
- Headless-rendered page (SPA) = 3 credits
- Deep scan with LLM analysis = 5 credits per page
- Authority check per domain = 10 credits (cached 30 days, amortized across all pages)

### Add-On Packs

| Add-On | Price | Included In |
|:---|:---|:---|
| Extra 5,000 crawl credits | $49 | All paid tiers |
| Deep scan mode | $29/mo | Agency, Enterprise |
| Citation monitoring | $79/mo | Enterprise |
| AEO certification exam | $499 (annual renewal) | Agency, Enterprise |

---

## Phase 1: Foundation (Months 1–3)

**Goal:** Standalone SaaS with auth, billing, and the current 27-factor scanner ported to a modern web app.

### 1.1 Tech Stack

| Layer | Technology | Rationale |
|:---|:---|:---|
| Frontend | Next.js (App Router) + React + Tailwind | SSR for marketing pages (good for product's own AEO), React dashboard |
| Backend | Next.js API routes + Node.js | Scanner already JS-heavy (scanner.js); DOM parsing via cheerio/jsdom |
| Database | PostgreSQL | Relational schema for users, orgs, scans, projects (replaces wp_posts/wp_postmeta) |
| Cache | Redis | Rate limiting, scan result caching (replaces WP transients) |
| Queue | BullMQ (Redis-backed) | Background job processing for async scans and future crawling |
| Auth | NextAuth.js | Email/password + Google OAuth + magic link |
| Billing | Stripe | Checkout, subscription lifecycle, usage-based billing |
| PDF | Puppeteer or @react-pdf/renderer | Replaces Dompdf |
| Hosting | Vercel (app) + Railway/Render (workers) | Or AWS ECS for more control at scale |

### 1.2 Database Schema (Core Tables)

```
users              — id, email, name, password_hash, created_at
organizations      — id, name, slug, plan_tier, stripe_customer_id,
                     crawl_credits_remaining, crawl_credits_monthly, settings (JSONB)
org_members        — user_id, org_id, role (owner|admin|member|client)
projects           — id, org_id, domain, name, created_at
scans              — id, project_id, url, score, tier, sub_scores (JSONB),
                     extraction (JSONB), fixes (JSONB), citation_sim (JSONB),
                     robots_data (JSONB), page_type, created_at
scan_history       — id, project_id, url, score, sub_scores (JSONB), scanned_at
crawl_jobs         — id, project_id, status, pages_total, pages_completed,
                     started_at, completed_at
api_keys           — id, org_id, key_hash, label, last_used_at, rate_limit
```

### 1.3 Scanner Engine Port

Port all PHP functions from `aivs-scanner/inc/scanner-engine.php` to TypeScript modules:

| PHP Function | TypeScript Module | Complexity |
|:---|:---|:---|
| `aivs_scan_url()` | `lib/scanner/scan.ts` | Medium — orchestrator |
| `aivs_analyze_schema()` | `lib/scanner/analyzers/schema.ts` | Low |
| `aivs_analyze_structure()` | `lib/scanner/analyzers/structure.ts` | Low |
| `aivs_analyze_faq()` | `lib/scanner/analyzers/faq.ts` | Low |
| `aivs_analyze_summaries()` | `lib/scanner/analyzers/summaries.ts` | Low |
| `aivs_analyze_feeds()` | `lib/scanner/analyzers/feeds.ts` | Low |
| `aivs_analyze_entities()` | `lib/scanner/analyzers/entities.ts` | Low |
| `aivs_analyze_crawl_access()` | `lib/scanner/analyzers/crawl-access.ts` | Low |
| `aivs_analyze_content_richness()` | `lib/scanner/analyzers/content-richness.ts` | Low |
| `aivs_generate_fixes()` | `lib/scanner/fixes.ts` | Low |
| `aivs_generate_citation_simulation()` | `lib/scanner/citation-sim.ts` | Low |
| Tier config (AIVS_TIER_CONFIG) | `lib/scanner/tiers.ts` | Trivial |

Scoring weights should be extracted into a configuration object (not hardcoded) so they can evolve as new factors are added.

### 1.4 Dashboard MVP

- **Project list:** Domains with latest score, tier badge, trend sparkline
- **Single scan view:** Score gauge, sub-scores, fixes, extraction preview, citation simulation (port from `template-parts/scanner/results-state.php`)
- **Scan history:** Table of past scans with score trend chart
- **PDF export:** Port `aivs_generate_pdf()` to Node.js
- **Settings:** Organization, billing, team members, API keys

### 1.5 Billing Integration

- Stripe Checkout for subscription signup
- Stripe Webhooks for lifecycle (created, updated, cancelled, payment_failed)
- Monthly crawl credit reset on billing cycle
- Usage tracking dashboard with burn rate projections

### Phase 1 Deliverables

- [ ] Standalone web app at app.aivisibilityscanner.com
- [ ] User registration, login, org creation
- [ ] Single-URL scanning with all current 27 factors
- [ ] Free tier (5 scans/month, no login on homepage)
- [ ] Pro tier ($129/mo) with project management, scan history, API keys
- [ ] Stripe billing integration
- [ ] PDF report generation
- [ ] Public marketing site with free scanner (lead gen)

**Team:** 2 developers | **Timeline:** 10–12 weeks

---

## Phase 2: Factor Expansion + Site Crawling (Months 3–6)

**Goal:** Expand to ~55 factors (all on-page measurable), add site-wide crawling, launch Agency tier.

### 2.1 New Factors — Batch A: High Impact / Low Cost

These require only HTTP fetch + DOM analysis + regex. Implement first.

| Factor | ID | Data Source | Impact | Effort |
|:---|:---|:---|:---|:---|
| WAF/CDN Bot Blocking detection | 1.2 | Simulate fetch as GPTBot UA | HIGH | Medium |
| Hosting/Platform Default Blocking | 1.3 | Simulate fetch with AI bot UAs | HIGH | Medium |
| JS Rendering Dependency | 1.4 | Compare initial HTML vs DOM signals | HIGH | Low |
| Content Behind Interactive Elements | 1.5 | Check hidden content patterns | HIGH | Low |
| HTTPS/SSL | 1.8 | HTTP protocol check | MEDIUM | Trivial |
| Clean URL Structure | 1.12 | Regex on URL | LOW | Trivial |
| Markdown/Clean Export | 1.18 | Check /content.md, alternate formats | LOW | Low |
| HowTo Schema | 2.6 | Scrape JSON-LD | MEDIUM | Trivial |
| Product Schema | 2.7 | Scrape JSON-LD | MEDIUM | Trivial |
| Review/AggregateRating Schema | 2.8 | Scrape JSON-LD | MEDIUM | Trivial |
| LocalBusiness Schema | 2.9 | Scrape JSON-LD | MEDIUM | Trivial |
| BreadcrumbList Schema | 2.11 | Scrape JSON-LD | MEDIUM | Trivial |
| Event Schema | 2.12 | Scrape JSON-LD | LOW | Trivial |
| WebPage/WebSite Schema | 2.13 | Scrape JSON-LD | MEDIUM | Trivial |
| Schema Accuracy (no misleading) | 2.16 | Cross-reference schema vs visible content | HIGH | Medium |
| Named Author Presence | 5.1 | Scrape byline patterns, rel="author" | HIGH | Low |
| Author Bio & Credentials | 5.2 | Scrape + basic NLP | HIGH | Medium |
| Freshness / dateModified | 5.12 | Scrape Article schema dateModified | HIGH | Low |
| Trust Elements on Site | 5.7 | Check /privacy, /terms, /contact pages | MEDIUM | Low |
| Primary-Source Citations | 5.9 | Regex — outbound links to authoritative domains | HIGH | Low |
| Multi-Modal Context (alt text) | 3.20 | Check img alt attributes | MEDIUM | Low |

### 2.2 New Factors — Batch B: Moderate Cost (NLP)

These require NLP analysis but can use deterministic approaches (per Scanner Design Principle 1: "Deterministic over LLM").

| Factor | ID | Method | Impact | Effort |
|:---|:---|:---|:---|:---|
| Front-Loaded Direct Answers | 3.1 | NLP — analyze first 60 words after each heading | HIGH | Medium |
| Concise Answer Blocks | 3.2 | NLP — identify 40-60 word answer units | HIGH | Medium |
| Paragraph Self-Containment | 3.7 | NLP — pronoun/reference analysis | MEDIUM | Medium |
| Low Fluff / Signal-to-Noise | 3.8 | Flesch score + filler word density | MEDIUM | Medium |
| Fact Density | 3.9 | Verifiable claim counting | MEDIUM | Medium |
| TL;DR / Executive Summaries | 3.14 | Class patterns + position analysis | MEDIUM | Low |
| Modular Content Design | 3.15 | Section boundary analysis | MEDIUM | Low |

### 2.3 Site-Wide Crawling Architecture

**Queue system:** BullMQ with Redis. Each crawl job is a parent that spawns child jobs per URL.

**Workers:** Stateless Node.js processes. Start with 2–4, scale horizontally via container orchestration.

**Page discovery strategy:**
1. Parse sitemap.xml first (already detected in `aivs_analyze_feeds()`)
2. Fall back to recursive link following within same domain
3. Respect robots.txt directives (already parsed in `aivs_analyze_robots()`)
4. Prioritize: homepage first → sitemap pages → discovered pages
5. Stop at purchased crawl budget

**Politeness rules:**
- Max 2 concurrent requests per domain
- 1-second delay between requests to same domain
- Respect Crawl-delay in robots.txt
- Rotate User-Agent between standard browser UA and AI bot UAs (for WAF testing)

**Rendering strategy:**
- Default: HTTP fetch via undici (matches current `wp_remote_get()` pattern)
- Optional: Puppeteer headless browser for SPA-detected pages (3x credit cost)
- SPA detection builds on existing `aivs_detect_spa()` function

**Incremental re-scans:**
- Store content hashes per page
- On re-crawl: skip unchanged pages (0.1 credits vs 1.0)
- Full re-crawl option always available
- Delta reports highlight what changed since last crawl

**Site-level scoring:**
- Page scores roll up to domain-level score (weighted avg, homepage 2x weight)
- Aggregate issue surfacing: "12 of 45 pages missing FAQ schema"
- Priority fix list ranked by aggregate impact across all pages

**Budget management:**
- Real-time credit tracking in dashboard with burn rate projection
- Email alerts at 80% and 100% usage
- Hard stop at limit (no overage billing — agencies prefer predictable costs)

### 2.4 Agency Tier Features

- **Client management:** Agencies create sub-organizations per client (visible only to agency)
- **Bulk domain import:** CSV import for domain onboarding
- **Scheduled scans:** Weekly or monthly automated re-scans per project
- **Team roles:** Owner, Admin, Member, Client (read-only)
- **Aggregate reporting:** Cross-client dashboards showing all domains, average scores, trends

### Phase 2 Deliverables

- [ ] ~55 factors measured (up from 27)
- [ ] Site-wide crawling with sitemap discovery and link following
- [ ] Crawl credit tracking and budget management
- [ ] Scheduled automated scans (weekly/monthly)
- [ ] Agency tier ($399/mo) with client management and bulk domains
- [ ] Site-level scoring with page-by-page drill-down
- [ ] Delta reports (what changed between crawls)
- [ ] API v2 with site crawl endpoints

**Team:** 2–3 developers | **Timeline:** 10–12 weeks

---

## Phase 3: White-Label + Authority Signals (Months 6–9)

**Goal:** Full white-label for agencies, external API integrations for off-site factors, platform-specific insights.

### 3.1 White-Label System

#### Basic White-Label (Pro tier — included)

- Custom logo upload (replaces AIVS logo in dashboard and PDFs)
- Brand color selection (primary, secondary, accent)
- Custom PDF report header/footer
- Remove "Powered by AI Visibility Scanner" from client-facing views
- Custom email sender name for report delivery

#### Full White-Label (Agency tier)

- **Custom domains:** CNAME-based. Agency points `scanner.theiragency.com` → our infrastructure
  - Implementation: Caddy or nginx with automatic Let's Encrypt wildcard certs
  - Tenant lookup by hostname in middleware
- **Client portal:** Standalone read-only view where agency clients see their scores, reports, and trends — fully branded as the agency's tool
- **Embeddable scan widget:** JS embed code for agency websites (lead gen tool that feeds into agency's AIVS account)
- **Custom email templates:** Agency controls from-address, subject lines, template content
- **PDF template customization:** Custom cover page background, font selection, agency contact details

#### Technical Approach

- Multi-tenant middleware resolves org from custom domain via DNS lookup table
- White-label config stored in `organizations.settings` JSONB column
- CSS custom properties dynamically load from org config
- PDF generation receives brand config as parameters (extending current `aivs_build_pdf_html()` pattern)

### 3.2 Off-Site Authority Factors (~15 new factors → ~70 total)

Two-tier model: Organization-level (domain/brand) and Person-level (individual) signals scored independently.

| Factor Group | Factors | API Provider | Cost | Status |
|:---|:---|:---|:---|:---|
| Backlink Authority | 6.1 | DataForSEO | $2–5 | ✅ Implemented |
| Brand Mentions / Co-Citations | 6.2 | GDELT DOC 2.0 API | Free | ✅ Implemented |
| Media Coverage | 6.3 | GDELT DOC 2.0 API | Free | ✅ Implemented |
| Reviews & Sentiment | 6.4 | Google Places API + DataForSEO | $3–5 | Planned |
| Directory/NAP Consistency | 6.5 | BrightLocal API or DataForSEO | $5–8 | Planned |
| Knowledge Graph Presence | 4.7 | Google Knowledge Graph API | Free | ✅ Implemented |
| Wikipedia/Wikidata | 4.8 | Wikidata SPARQL | Free | ✅ Implemented |
| Social Profile Consistency | 6.10 | Homepage scrape + meta tags | Free | ✅ Implemented |
| Podcast Guest Appearances | 6.6 | Taddy API (GraphQL) | Free tier | ✅ Implemented |
| Owned Podcast | — | Taddy API (reuse) | Free tier | ✅ Implemented |
| YouTube Channel (brand) | — | YouTube Data API v3 | Free | ✅ Implemented |
| Author Books | — | Open Library + Google Books | Free | ✅ Implemented |
| Academic Citations | 6.8 | Crossref + Semantic Scholar | Free | ✅ Implemented |
| GitHub Profile | — | GitHub REST API | Free | ✅ Implemented |
| Patents | — | USPTO PatentsView API | Free | ✅ Implemented |
| Screen Presence (TV/Film) | — | TMDb API | Free | ✅ Implemented |
| iTunes/Apple Podcasts Ratings | — | iTunes Search API | Free | ✅ Implemented (enrichment) |
| Amazon Book Enrichment | — | Amazon PAAPI v5 | Free (affiliate) | ✅ Implemented (enrichment) |
| Newsletter | — | Manual entry | Free | ✅ Types defined |
| Conference Speaking | — | Manual entry | Free | ✅ Types defined |
| Forum/Community Presence | 6.7 | Reddit API + custom scraping | $1–2 | Planned |
| "Best Of" List Mentions | 6.9 | SERP API (DataForSEO) | $2–3 | Planned |
| Social Sentiment | 6.11 | Social listening API | $5–10 | Planned |

**Cost optimization strategy:**
- Authority factors run once per domain (not per page), cached for 30 days
- Per-domain authority cost: ~$0.10–0.25
- Amortized across all page scans for that domain
- Only available on Pro+ tiers

### 3.3 Platform-Specific Visibility Estimates (Category 8)

| Platform | Approach | Key Signals | Factor |
|:---|:---|:---|:---|
| Google AI Overviews | Score based on organic ranking (DataForSEO SERP) + schema completeness + entity density | 76% top-10 overlap, +73% schema boost | 8.1 |
| ChatGPT | Score based on Bing ranking + content structure + authority | 8% Google overlap, favors encyclopedic content | 8.2 |
| Perplexity | Score based on recency (dateModified <90 days) + citation density + research depth | 28% Google overlap, strongest recency weight | 8.3 |
| Microsoft Copilot | Bing ranking + Microsoft ecosystem signals + enterprise verification | LinkedIn/GitHub bias | 8.4 |
| Gemini | Google Knowledge Graph + E-E-A-T + structured data | Google ecosystem alignment | 8.5 |
| Voice Assistants | Speakable schema + concise direct answers + spoken-language friendliness | Short definitive answers | 8.6 |

**Important framing:** These are structural readiness scores, not live predictions. Per Scanner Design Principle 7: "Confidence labels are mandatory." Present as: "Your structural readiness for [platform] citation is X/100."

**Dashboard view:** Platform comparison matrix — side-by-side showing estimated visibility per AI platform with specific recommendations for each.

### Phase 3 Deliverables

- [ ] Basic white-label (Pro): logo, colors, branded PDFs, custom sender name
- [ ] Full white-label (Agency): custom domains, client portal, embeddable widget, email templates
- [ ] Off-site authority scoring (~70 factors total)
- [ ] Platform-specific visibility estimates (6 platforms)
- [ ] Platform comparison matrix in dashboard
- [ ] Enterprise tier launch with custom pricing
- [ ] Authority data caching layer (30-day TTL per domain)

**Team:** 3 developers | **Timeline:** 10–12 weeks

---

## Phase 4: Advanced Intelligence + Scale (Months 9–14)

**Goal:** LLM-powered analysis, citation monitoring, advanced NLP factors, enterprise features.

### 4.1 LLM-Powered Factors (~12 new factors → ~85 total)

These require LLM or advanced NLP analysis. Offered as "Deep Scan" mode (5 credits per page).

| Factor | ID | Method | Est. Cost/Page |
|:---|:---|:---|:---|
| Hallucination Risk / Contradiction Detection | 3.19 | LLM — compare schema claims vs body text | ~$0.01 |
| Factual Accuracy Spot-Check | 5.8 | LLM — cross-reference claims against known facts | ~$0.02 |
| Information Gain Scoring | 5.11 | LLM — compare content novelty vs SERP consensus | ~$0.03 |
| Conversational Language Alignment | 7.1 | NLP — semantic similarity to query patterns | ~$0.005 |
| Topical Depth & Coverage | 7.2 | NLP — topic modeling, coverage breadth | ~$0.005 |
| Topic Cluster Completeness | 7.3 | Crawl + graph analysis — internal link graph | Compute |
| Intent Class Alignment | 7.5 | NLP/LLM — classify page intent vs target queries | ~$0.01 |
| Fluency Optimization | 3.11 | NLP — Flesch + coherence scoring | ~$0.002 |
| Structured Depth | 3.16 | DOM analysis — depth/structure ratio | Compute |
| Search Intent Alignment | 3.17 | DataForSEO SERP API + comparison | ~$0.005 |
| Entity Type Quality | 4.2 | NLP API — spaCy or Google NLP entity typing | ~$0.005 |
| Entity Disambiguation | 4.3 | NLP + Knowledge Graph lookup | ~$0.01 |

**LLM cost strategy:**
- Use Claude Haiku 4.5 or GPT-4o-mini for per-page analysis (~$0.01–0.03/page)
- Deep scan is optional, charged at 5 credits/page (vs 1 for standard)
- Standard scans remain cheap and deterministic
- Deep scan results cached alongside standard scan data

### 4.2 Citation Monitoring (Category 9 completion)

Move beyond structural estimation to actual monitoring:

**AI Crawler Log Analysis (9.1, 9.2, 9.8):**
- Users upload or connect server access logs
- AIVS identifies GPTBot, ClaudeBot, PerplexityBot visits
- Reports: frequency, pages visited, trends, new bots detected
- Dashboard: crawler heatmap showing which pages AI systems visit most

**Citation Simulation Per Platform (9.7):**
- Use platform-specific models from Phase 3 to simulate citation likelihood
- Per-query testing: "Would this page be cited for query X on platform Y?"
- Requires query input from user (or auto-suggest based on content analysis)

**Historical Score Tracking (9.6):**
- Full time-series in `scan_history` table
- Trend charts per factor, per layer, per domain
- "Score changed" alerts when scores drop below threshold

### 4.3 Enterprise Features

| Feature | Description |
|:---|:---|
| SSO/SAML | Corporate identity providers (Okta, Azure AD, Google Workspace) |
| Webhook notifications | Scan complete, score changed, credit threshold reached |
| Zapier/Make connector | Automated workflows — e.g., scan complete → Slack notification → update Airtable |
| Bulk API | Up to 1,000 URLs per API call |
| Dedicated infrastructure | Isolated compute for large enterprise customers |
| SLA | 99.9% uptime guarantee |
| Custom integrations | One-off integrations built by our team for Enterprise customers |

### 4.4 Infrastructure Scaling

| Component | Approach |
|:---|:---|
| Workers | Kubernetes or AWS ECS auto-scaling based on BullMQ queue depth |
| Reports | CloudFront or Cloudflare R2 for PDF/SVG caching |
| Database | PostgreSQL read replicas for dashboard queries |
| Rate limiting | Token bucket per API key via Redis (replaces simple IP-based) |
| Monitoring | Datadog or Grafana — scan latency, queue depth, error rates, API cost tracking |

### Phase 4 Deliverables

- [ ] ~85 of 93 factors measured
- [ ] Deep scan mode with LLM analysis
- [ ] Citation monitoring dashboard
- [ ] Server log analysis tool for AI crawler identification
- [ ] Historical score tracking with trend charts and alerts
- [ ] Enterprise SSO, webhooks, Zapier/Make integration
- [ ] Bulk API (1,000 URLs per call)
- [ ] Auto-scaling infrastructure

**Team:** 3–4 developers | **Timeline:** 16–20 weeks

---

## Phase 5: Market Leadership (Months 14–18)

**Goal:** Complete all 93 factors, AEO certification program, marketplace integrations, category dominance.

### 5.1 Remaining Experimental Factors (8 factors → all 93 complete)

| Factor | ID | Notes | Effort |
|:---|:---|:---|:---|
| IndexNow Support | 1.15 | Check for IndexNow implementation | Low |
| Machine-Readable Feed Architecture | 2.17 | Evaluate overall feed ecosystem maturity | Medium |
| Cross-Page Entity Consistency | 4.5 | Requires multi-page crawl data from Phase 2 | Medium |
| Entity Relationship Mapping | 4.6 | Graph database analysis of schema relationships | High |
| YMYL Sensitivity | 5.13 | Topic classification + appropriate trust escalation | Medium |
| Platform-Specific Citation Style Preferences | 8.9 | Ongoing research, per-platform source type preferences | Medium |
| Platform-Specific Freshness Weighting | 8.8 | Calibrate per-platform recency models | Medium |
| NavBoost / User Satisfaction | 8.7 | GSC integration for CTR data | Medium |

### 5.2 AEO Certification Program

Based on the taxonomy's GTM notes (see `AEO_Master_Factor_Taxonomy_v1_1.md`, section "Future AEO Certification Curriculum"):

- **Online course:** Teach all 93 factors across 9 modules (one per category)
- **Assessment exam:** Timed, proctored, with practical scenario questions
- **Certified practitioner badge:** Digital badge + listing in public directory
- **Prerequisite:** Active Agency or Enterprise subscription
- **Revenue:** $499 per certification, annual renewal
- **Distribution:** Certified practitioners become evangelists and referral sources

### 5.3 Marketplace & Integrations

| Integration | Description | Priority |
|:---|:---|:---|
| WordPress connector plugin | Lightweight plugin that sends data from WP sites → SaaS dashboard | HIGH |
| Shopify app | Scanner integration for ecommerce AEO | MEDIUM |
| Google Search Console | Pull CTR/impression data for correlation with AEO scores | HIGH |
| HubSpot integration | Sync AEO scores into CRM for agency sales workflows | MEDIUM |
| Slack/Teams notifications | Score alerts, weekly digests, crawl complete notifications | HIGH |
| Looker Studio connector | Agencies include AEO data in client reporting dashboards | MEDIUM |

### Phase 5 Deliverables

- [ ] All 93 factors measured
- [ ] AEO certification program launched
- [ ] WordPress connector plugin published
- [ ] Google Search Console integration
- [ ] Slack/Teams notification integration
- [ ] Shopify app
- [ ] HubSpot integration
- [ ] Public certification directory

**Team:** 3–4 developers + 1 content/curriculum developer | **Timeline:** 16–20 weeks

---

## Complete Factor Implementation Schedule

### Phase 1 — Ported from Current Scanner (27 factors)

| ID | Factor | Data Source |
|:---|:---|:---|
| 1.1 | robots.txt AI Bot Permissions | Scrape/HTTP |
| 1.6 | SSR / Pre-rendered HTML | Scrape |
| 1.7 | Page Load Speed / TTFB | API |
| 1.10 | XML Sitemap Presence | Scrape |
| 1.11 | Canonical Tags | Scrape |
| 1.14 | RSS/Atom Feeds | Scrape |
| 1.16 | llms.txt Presence | Scrape/HTTP |
| 1.17 | llms-full.json | Scrape/HTTP |
| 2.1 | JSON-LD Structured Data | Scrape |
| 2.2 | Organization Schema | Scrape |
| 2.3 | Person Schema | Scrape |
| 2.4 | Article/BlogPosting Schema | Scrape |
| 2.5 | FAQPage Schema | Scrape |
| 2.10 | Speakable Schema | Scrape |
| 2.14 | sameAs Linking | Scrape |
| 2.15 | Schema Graph Completeness | Graph Analysis |
| 3.1 | Front-Loaded Direct Answers | NLP Analysis |
| 3.2 | Concise Answer Blocks | NLP Analysis |
| 3.3 | Question-Based Headings | Scrape |
| 3.4 | Proper Heading Hierarchy | Scrape |
| 3.5 | Definition & Summary Density | NLP Analysis |
| 3.6 | FAQ/Q&A HTML Structure | Scrape |
| 3.10 | Statistics Addition | Regex/Scrape |
| 3.12 | Bullet/Numbered Lists | Scrape |
| 3.13 | HTML Tables | Scrape |
| 3.18 | Citation Formatting Quality | Regex/Scrape |
| 4.1 | Entity Density | NLP API |

### Phase 2 — On-Page Expansion (28 new → 55 total)

| ID | Factor | Data Source | Impact | Effort |
|:---|:---|:---|:---|:---|
| 1.2 | WAF/CDN Bot Blocking | Simulation | HIGH | Medium |
| 1.3 | Hosting/Platform Blocking | Simulation | HIGH | Medium |
| 1.4 | JS Rendering Dependency | Scrape/Render | HIGH | Low |
| 1.5 | Content Behind Interactive Elements | Scrape/Simulation | HIGH | Low |
| 1.8 | HTTPS/SSL | Network API | MEDIUM | Trivial |
| 1.12 | Clean URL Structure | Regex | LOW | Trivial |
| 1.18 | Markdown/Clean Export | Scrape/HTTP | LOW | Low |
| 2.6 | HowTo Schema | Scrape | MEDIUM | Trivial |
| 2.7 | Product Schema | Scrape | MEDIUM | Trivial |
| 2.8 | Review/AggregateRating Schema | Scrape | MEDIUM | Trivial |
| 2.9 | LocalBusiness Schema | Scrape | MEDIUM | Trivial |
| 2.11 | BreadcrumbList Schema | Scrape | MEDIUM | Trivial |
| 2.12 | Event Schema | Scrape | LOW | Trivial |
| 2.13 | WebPage/WebSite Schema | Scrape | MEDIUM | Trivial |
| 2.16 | Schema Accuracy | Scrape + NLP | HIGH | Medium |
| 3.7 | Paragraph Self-Containment | NLP Analysis | MEDIUM | Medium |
| 3.8 | Low Fluff / Signal-to-Noise | NLP Analysis | MEDIUM | Medium |
| 3.9 | Fact Density | NLP Analysis | MEDIUM | Medium |
| 3.14 | TL;DR / Executive Summaries | NLP Analysis | MEDIUM | Low |
| 3.15 | Modular Content Design | DOM Analysis | MEDIUM | Low |
| 3.20 | Multi-Modal Context (alt text) | Scrape | MEDIUM | Low |
| 5.1 | Named Author Presence | Scrape | HIGH | Low |
| 5.2 | Author Bio & Credentials | Scrape + NLP | HIGH | Medium |
| 5.7 | Trust Elements on Site | Scrape | MEDIUM | Low |
| 5.9 | Primary-Source Citations | Regex | HIGH | Low |
| 5.12 | Freshness / dateModified | Scrape | HIGH | Low |
| 9.3 | Extraction Previewing | Simulation | MEDIUM | Low |
| 9.4 | Competitor Structure Comparison | Multi-URL Scrape | MEDIUM | Low |

### Phase 3 — Authority & Platform Signals (15 new → 70 total)

| ID | Factor | Data Source | Impact | Effort |
|:---|:---|:---|:---|:---|
| 4.4 | Entity Consistency Across Sources | SEO API | HIGH | Medium |
| 4.7 | Knowledge Graph Presence | API (Google KG) | HIGH | Low |
| 4.8 | Wikipedia/Wikidata Presence | API (Wikidata) | MEDIUM | Low |
| 4.9 | LinkedIn/Crunchbase Validation | API | MEDIUM | Low |
| 4.10 | Brand Entity Signals | Brand Tracking API | MEDIUM | Medium |
| 5.3 | Dedicated Author Pages | Crawler | MEDIUM | Medium |
| 5.4 | First-Hand Experience Signals | NLP Analysis | MEDIUM | Medium |
| 5.5 | Demonstrable Expertise | NLP Analysis | MEDIUM | Medium |
| 5.6 | External Validation of Authority | Backlink API | MEDIUM | Low |
| 5.10 | Original Research / Proprietary Data | NLP Analysis | HIGH | Medium |
| 6.1 | Backlink Authority | SEO API | HIGH | Low |
| 6.2 | Co-Citations / Brand Mentions | Brand Tracking API | HIGH | Medium |
| 6.3 | Media Coverage | News API | MEDIUM | Medium |
| 6.4 | Reviews & Sentiment | Review API | HIGH | Medium |
| 6.5 | Directory/NAP Consistency | Local SEO API | HIGH (local) | Medium |
| 8.1–8.6 | Platform-Specific Readiness | SERP API + Models | HIGH | High |

### Phase 4 — LLM & Advanced NLP (15 new → 85 total)

| ID | Factor | Data Source | Impact | Effort |
|:---|:---|:---|:---|:---|
| 3.11 | Fluency Optimization | NLP Analysis | MEDIUM | Low |
| 3.16 | Structured Depth | DOM Analysis | MEDIUM | Low |
| 3.17 | Search Intent Alignment | SEO API | MEDIUM | Medium |
| 3.19 | Hallucination Risk / Contradiction | LLM Analysis | HIGH | Medium |
| 4.2 | Entity Type Quality | NLP API | MEDIUM | Low |
| 4.3 | Entity Disambiguation | NLP + KG API | MEDIUM | Medium |
| 5.8 | Factual Accuracy | LLM Analysis | HIGH | Medium |
| 5.11 | Information Gain | Vector DB + LLM | HIGH | High |
| 6.6 | Podcast/Interview Mentions | Taddy API (GraphQL) | LOW | Medium |
| 6.7 | Forum/Community Presence | Community API | MEDIUM | Medium |
| 6.8 | Academic Citations | Academic API | MEDIUM | Low |
| 6.9 | "Best Of" List Mentions | SERP API | LOW | Low |
| 6.10 | Social Profile Consistency | Social API | MEDIUM | Low |
| 6.11 | Social Sentiment | Social Listening | LOW | Medium |
| 7.1 | Conversational Language Alignment | NLP Analysis | MEDIUM | Medium |
| 7.2 | Topical Depth & Coverage | Content API / NLP | MEDIUM | Medium |
| 7.5 | Intent Class Alignment | SEO API + NLP | MEDIUM | Medium |
| 9.1 | AI Crawler Log Visibility | Server Logs | HIGH | Medium |
| 9.2 | Repeated AI Crawler Visits | Server Logs | MEDIUM | Low |
| 9.5 | AI Visibility Scoring | Composite | — (meta) | Low |
| 9.6 | Historical Score Tracking | Database | HIGH | Low |
| 9.7 | Citation Simulation | RAG Simulation | HIGH | High |
| 9.8 | Directional AI Crawler Analytics | Server Logs | MEDIUM | Low |

### Phase 5 — Experimental & Remaining (8 new → all 93)

| ID | Factor | Data Source | Impact | Effort |
|:---|:---|:---|:---|:---|
| 1.9 | Mobile Accessibility | API | LOW | Low |
| 1.13 | Crawl Budget Efficiency | Server Logs | MEDIUM | Medium |
| 1.15 | IndexNow Support | API | LOW | Low |
| 2.17 | Machine-Readable Feed Architecture | Scrape | LOW | Medium |
| 4.5 | Cross-Page Entity Consistency | Internal Crawler | MEDIUM | Medium |
| 4.6 | Entity Relationship Mapping | Graph Database | MEDIUM | High |
| 5.13 | YMYL Sensitivity | NLP API | MEDIUM | Medium |
| 7.3 | Topic Cluster Completeness | Crawler/Graph | HIGH | High |
| 7.4 | Local Relevance Signals | NLP/Schema | MEDIUM | Low |
| 8.7 | NavBoost / User Satisfaction | Analytics API | HIGH | Medium |
| 8.8 | Platform Freshness Weighting | Analytical Model | MEDIUM | Medium |
| 8.9 | Platform Citation Style Preferences | Analytical Model | LOW | Medium |

---

## Unit Economics & Revenue Model

### Cost Per Scan (at scale)

| Cost Component | Per Page | Per Domain Authority Check | Notes |
|:---|:---|:---|:---|
| Compute (worker + app) | $0.001 | — | HTTP fetch + DOM parsing |
| Database (amortized) | $0.0005 | — | PostgreSQL + Redis |
| External APIs (authority) | — | $0.10–0.25 | Cached 30 days, amortized |
| LLM analysis (deep scan) | $0.01–0.03 | — | Only for deep scan mode |
| PDF generation | $0.002 | — | Per report |
| Bandwidth/CDN | $0.001 | — | Per scan result served |

### Margin Analysis

| Tier | Monthly Revenue | Est. COGS | Gross Margin | Notes |
|:---|:---|:---|:---|:---|
| Free | $0 | ~$0.50 | N/A | Lead gen — 5 scans |
| Pro (5K credits) | $129 | $15–25 | 80–88% | On-page factors only, authority cached |
| Agency (25K credits) | $399 | $60–100 | 75–85% | Includes authority data, white-label infra |
| Enterprise (100K+) | ~$1,200 | $200–350 | 70–83% | Full stack, dedicated resources |

### Upsell Paths

```
Free Scan → (3rd scan) → Pro upsell
     ↓
Pro ($129) → (5th domain or team invite) → Agency upsell
     ↓
Agency ($399) → (30+ domains or credit overage) → Enterprise upsell
     ↓
Enterprise (custom) → (certification + integrations) → Lock-in
```

### Revenue Targets (12-month projection)

| Metric | Month 3 | Month 6 | Month 9 | Month 12 |
|:---|:---|:---|:---|:---|
| Free users | 500 | 2,000 | 5,000 | 10,000 |
| Pro subscribers | 20 | 80 | 200 | 400 |
| Agency subscribers | 0 | 15 | 50 | 100 |
| Enterprise | 0 | 0 | 3 | 8 |
| MRR | $2,580 | $16,305 | $47,600 | $101,200 |
| ARR (run rate) | $31K | $196K | $571K | $1.21M |

---

## Competitive Differentiation

### AIVS vs. Traditional SEO Tools

| Dimension | SEMrush / Ahrefs | BrightLocal | AIVS |
|:---|:---|:---|:---|
| **Core focus** | SEO rankings, backlinks, keywords | Local SEO, reputation, listings | AEO — AI citation probability |
| **What they measure** | Organic rankings, domain authority, keyword gaps | Local pack rankings, review sentiment, NAP consistency | AI visibility score, extractability, entity trust, platform-specific citation readiness |
| **AI-specific features** | Limited — some AI overview tracking added recently | None | Native — 93-factor AEO taxonomy, citation simulation, platform comparison matrix |
| **Scoring model** | Domain Authority, keyword difficulty | Star rating, listing accuracy | AI Visibility Score (0–100) across 3-layer stack |
| **Target insight** | "How do you rank in search?" | "How do you rank locally?" | "Will AI systems cite your content?" |
| **Agency value prop** | "Help clients rank higher" | "Help clients get found locally" | "Help clients get quoted by AI" |

### Unique AIVS Advantages

1. **93-factor AEO taxonomy** — No competitor has published or operationalized a comprehensive AI visibility factor model. This is proprietary IP.

2. **AI Visibility Stack (3-layer model)** — Access → Understanding → Extractability as a dependency chain. Communicates priority clearly. No competitor has this framework.

3. **Platform-specific insights** — "Your page scores 78 for Google AI Overviews but only 45 for ChatGPT." No tool offers differentiated per-platform visibility estimates.

4. **Citation simulation** — Structural estimate of whether AI systems would cite a page. Unique to market.

5. **Entity & Knowledge Graph focus** — Measures entity density, disambiguation, cross-source consistency, relationship mapping. SEO tools measure backlinks and keywords; AIVS measures whether AI can identify and trust your entities.

6. **Fix-first orientation** — Prioritized, actionable recommendations with projected score impact. "Fix these 3 things to gain 18 points." Competitors show data; AIVS tells you what to do.

7. **Published methodology** — Open taxonomy builds trust and category authority. Certification program creates distribution channel.

---

## Risk Register

| Risk | Phase | Impact | Mitigation |
|:---|:---|:---|:---|
| Scanner port accuracy | 1 | Scoring drift between PHP and TS | Side-by-side test suite with 100+ URLs |
| Stripe billing failures | 1 | Revenue loss, poor UX | Webhook retry logic, grace periods, dunning emails |
| External API downtime | 3 | Missing authority data | 30-day cache, fallback scoring without authority layer |
| LLM cost overruns | 4 | Margin erosion on deep scans | Hard credit limits, cost monitoring, model cost benchmarking |
| Custom domain SSL | 3 | Certificate provisioning failures | Caddy auto-TLS with fallback to platform domain |
| Crawl politeness violations | 2 | Getting blocked by target sites | Strict robots.txt respect, configurable delays, rotating UAs |
| Scanner determinism | 4 | Non-reproducible scores from LLM factors | Clearly label LLM-scored factors as estimates; cache results |
| Market timing | All | Competitor launches similar product | Speed to market; moat = taxonomy IP + agency relationships |
| Crawl scale (1→100K pages) | 2–4 | Infrastructure cost, queue backpressure | Auto-scaling workers, graceful degradation, priority queues |

---

## Dependency Map

```
Phase 1: Foundation
├── Auth + multi-tenancy ──→ All subsequent phases
├── Scanner port ──→ Phase 2 factor expansion
├── Stripe billing ──→ Phase 2 Agency tier
└── BullMQ queue ──→ Phase 2 crawling

Phase 2: Factor Expansion + Crawling
├── Site crawling ──→ Phase 3 authority (needs domain-level data)
├── ~55 factors ──→ Phase 3 platform estimates (needs on-page signals)
├── Client management ──→ Phase 3 white-label client portal
└── Scheduled scans ──→ Phase 4 historical tracking

Phase 3: White-Label + Authority
├── External APIs ──→ Phase 4 advanced intelligence (shared infra)
├── White-label system ──→ Phase 5 marketplace (branding in integrations)
└── Platform estimates ──→ Phase 4 citation monitoring

Phase 4: Advanced Intelligence
├── LLM analysis ──→ Phase 5 remaining NLP factors
├── Citation monitoring ──→ Phase 5 certification curriculum
└── Enterprise features ──→ Phase 5 marketplace integrations

Phase 5: Market Leadership
├── All 93 factors ──→ Certification program (teaches all factors)
├── Marketplace ──→ Growth engine
└── Certification ──→ Distribution channel + lock-in
```

---

## Key Reference Files

| File | Purpose |
|:---|:---|
| `docs/AEO_Master_Factor_Taxonomy_v1_1.md` | Complete 93-factor taxonomy — source of truth |
| `docs/AEO_Merged_Factor_Table_v2 (1).xlsx` | Factor-to-tier mapping spreadsheet |
| `aivs-scanner/inc/scanner-engine.php` | Current scanner logic (1,723 lines) — port reference |
| `aivs-scanner/inc/rest-api.php` | Current API contract — endpoint patterns to replicate |
| `aivs-scanner/inc/score-tiers.php` | Tier config (thresholds, labels, colors) |
| `aivs-scanner/inc/pdf-generator.php` | PDF report generation pattern |
| `aivs-scanner/inc/admin-bulk-scanner.php` | Bulk scanning pattern (up to 50 URLs) |
| `aivisibilityscanner/template-parts/scanner/results-state.php` | Results UI template — UX reference |
| `aivisibilityscanner/docs/AnswerEngineWP_LandingPage_Copy.md` | Pricing and positioning reference |

---

## Repository & Project Structure

**Approach:** New monorepo (`aivs-platform`), separate from the existing `AnswerEngine` WordPress repo.

The current `AnswerEngine` repo remains as-is — the free WordPress scanner continues as a lead-gen funnel. The SaaS is a fundamentally different architecture and mixing them creates confusion around deploys, dependencies, and CI/CD.

### Monorepo Layout (Turborepo)

```
aivs-platform/
├── apps/
│   ├── web/                          # Next.js app (dashboard + marketing site + API routes)
│   │   ├── app/                      # Next.js App Router
│   │   │   ├── (marketing)/          # Public pages (homepage, pricing, methodology)
│   │   │   ├── (auth)/               # Login, register, forgot password
│   │   │   ├── dashboard/            # Authenticated dashboard
│   │   │   │   ├── projects/         # Domain/project management
│   │   │   │   ├── scans/            # Scan results and history
│   │   │   │   ├── reports/          # PDF reports, comparisons
│   │   │   │   ├── settings/         # Org settings, billing, team, API keys
│   │   │   │   └── white-label/      # White-label configuration (Agency+)
│   │   │   └── api/                  # Next.js API routes
│   │   │       ├── scan/             # Single-URL scan endpoint
│   │   │       ├── crawl/            # Site crawl initiation
│   │   │       ├── webhooks/         # Stripe webhooks
│   │   │       └── v1/               # Public API (Pro+ tiers)
│   │   ├── components/               # App-specific React components
│   │   ├── lib/                      # App-specific utilities
│   │   └── public/                   # Static assets
│   │
│   ├── worker/                       # BullMQ scan/crawl workers (Node.js)
│   │   ├── src/
│   │   │   ├── jobs/                 # Job handlers (scan, crawl, authority, deep-scan)
│   │   │   ├── queues/               # Queue definitions and config
│   │   │   └── index.ts              # Worker entry point
│   │   ├── Dockerfile                # Container build for Railway/ECS
│   │   └── package.json
│   │
│   └── docs/                         # Public methodology/taxonomy site (optional, Phase 5)
│
├── packages/
│   ├── scanner-engine/               # Core scanning logic (ported from PHP)
│   │   ├── src/
│   │   │   ├── analyzers/            # One file per analyzer (schema, structure, faq, etc.)
│   │   │   ├── scan.ts               # Orchestrator — runs all analyzers, computes score
│   │   │   ├── fixes.ts              # Fix generation engine
│   │   │   ├── citation-sim.ts       # Citation simulation
│   │   │   └── tiers.ts              # Tier config (thresholds, labels, colors)
│   │   ├── tests/                    # Test suite (validate parity with PHP scanner)
│   │   └── package.json
│   │
│   ├── db/                           # Database layer
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Full database schema
│   │   │   └── migrations/           # Migration history
│   │   ├── src/
│   │   │   └── client.ts             # Prisma client singleton
│   │   └── package.json
│   │
│   ├── ui/                           # Shared React components (design system)
│   │   ├── src/
│   │   │   ├── score-gauge/          # Circular score gauge
│   │   │   ├── tier-badge/           # Tier badge component
│   │   │   ├── layer-chart/          # AI Visibility Stack visualization
│   │   │   └── ...
│   │   └── package.json
│   │
│   └── types/                        # Shared TypeScript types
│       ├── src/
│       │   ├── scan.ts               # Scan result types
│       │   ├── project.ts            # Project/domain types
│       │   ├── subscription.ts       # Billing/tier types
│       │   └── api.ts                # API request/response types
│       └── package.json
│
├── infra/                            # Infrastructure as Code
│   ├── terraform/                    # Or Pulumi — DB provisioning, DNS, CDN
│   └── docker-compose.yml            # Local dev environment
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Lint, typecheck, test on PR
│   │   ├── deploy-web.yml            # Deploy web app to Vercel
│   │   └── deploy-worker.yml         # Deploy worker to Railway
│   └── CODEOWNERS
│
├── turbo.json                        # Turborepo pipeline config
├── package.json                      # Root workspace config
├── .env.example                      # Environment variable template
├── .gitignore
└── README.md
```

### Why This Structure

- **`scanner-engine` as a package:** Isolated, testable, used by both `web` (API routes) and `worker` (crawl jobs). Can be validated against the PHP version during port.
- **`db` as a package:** Single Prisma schema shared across all apps. Migrations managed centrally.
- **`ui` as a package:** Score gauge, tier badges, and chart components reused across dashboard, reports, and embeddable widget.
- **Turborepo:** Parallel builds, shared caching, dependency-aware task orchestration. Scales well from 2 devs to a larger team.

---

## Hosting & Infrastructure

### Service Map

| Component | Service | Tier | Est. Cost (Launch) | Notes |
|:---|:---|:---|:---|:---|
| Web app (Next.js) | **Vercel** | Pro ($20/mo) | $20/mo | Best Next.js DX, edge functions, preview deploys, automatic SSL |
| Workers (BullMQ) | **Railway** | Usage-based | $20–50/mo | Simple container deploys, auto-scaling, no k8s complexity |
| Database (Postgres) | **Supabase** | Free → Pro ($25/mo) | $0–25/mo | Managed Postgres, generous free tier, row-level security |
| Cache / Queue (Redis) | **Upstash** | Pay-per-use | $0–10/mo | Serverless Redis, native BullMQ support |
| File storage (PDFs, badges) | **Cloudflare R2** | Pay-per-use | $0–5/mo | Zero egress fees — PDFs and badges served frequently |
| White-label custom domains | **Cloudflare for SaaS** | Enterprise ($0.10/hostname) | $0 initially | Automatic SSL for agency custom domains via API |
| Email (transactional) | **Resend** | Free → Pro | $0–20/mo | Report delivery, scan notifications, team invites |
| Monitoring | **Betterstack** | Free → Pro | $0–25/mo | Logs + uptime monitoring combined |
| Error tracking | **Sentry** | Free tier | $0 | Exception tracking across web + workers |

### Why This Stack

1. **Speed to market** — Vercel + Railway + Supabase lets 2 devs ship Phase 1 in 10–12 weeks without DevOps overhead
2. **Low launch cost** — ~$70–150/mo total infra until paying customers arrive
3. **White-label solved** — Cloudflare for SaaS handles automatic SSL provisioning for agency custom domains via API (the hardest infra problem in Phase 3)
4. **Migrate later** — All services can be migrated to AWS/GCP when infra costs exceed ~$500/mo and fine-grained control is needed

### Infrastructure Cost Scaling

| Stage | Timeline | Users | Monthly Infra Cost | Trigger to Scale |
|:---|:---|:---|:---|:---|
| Launch | Months 1–3 | <100 | ~$70/mo | — |
| Growth | Months 3–6 | 100–500 | ~$200–400/mo | Supabase Pro, Railway scaling |
| Scale | Months 6–12 | 500–2,000 | ~$500–1,500/mo | DB read replicas, worker auto-scaling |
| Enterprise | Month 12+ | 2,000+ | ~$2,000–5,000/mo | Consider migrating workers to AWS ECS |

### Local Development

```bash
# Docker Compose provides Postgres + Redis locally
docker compose up -d

# Turborepo runs all apps in parallel
pnpm dev
```

---

**End of Document**
