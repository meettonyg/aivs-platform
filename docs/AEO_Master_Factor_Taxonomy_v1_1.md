# AEO Master Factor Taxonomy

**Canonical Reference for Answer Engine Optimization (AEO)**
**Version:** 1.2
**Date:** March 11, 2026

---

## Changelog

**v1.2 (March 11, 2026):**
- Added Priority Tiers: Core 27 and Citation Core definitions with full factor lists
- Added Data Source Classification with per-factor data source mapping table
- Added Scanner Design Principles section (8 engineering guardrails)
- Fixed Citation Core count: labeled "9" in working spreadsheet but actually contains 11 factors; renamed to "Citation Core"
- Synced with Merged Factor Table v2 spreadsheet (Scanner Version, Datasource Category, Core 27, Citation Core columns)

**v1.1-final (March 10, 2026):**
- Added inline source attribution to all precision claims (resolves unsourced-number risk)
- Separated "Operational Diagnostic" type from confidence labels in Category 9 (resolves label system inconsistency)
- Renamed Category 8 to "Platform-Specific Retrieval Behaviors"
- Added disambiguation notes to factors 3.10, 3.18, and 5.9 (the "citation triad")
- Minor wording tightening across 6 factor descriptions

**v1.1 (March 10, 2026):**
- Deduplicated 7 redundant factors (97 → 93 distinct factors)
- Added 5 missing factors: Statistics Addition, Fluency Optimization, Content Behind Interactive Elements, Hallucination Risk / Intra-Page Contradiction Density, Citation Formatting Quality
- Elevated Information Gain from Strongly Inferred to Established
- Added NavBoost / User Satisfaction Signals to Category 8
- Downgraded 3 confidence labels: Content Chunkability, "Best Of" List Mentions, Knowledge Edge Richness
- Merged redundant pairs: Definition + Summary Density, Front-Loaded Answers + Inverted Pyramid, Third-Party Reviews + Review Sentiment, Entity Relationship Mapping + Knowledge Edge Richness
- Added AnswerEngineWP scanner weight mapping with exact `ExtractionScorer.php` weights
- Added product horizon alignment (Tier 1–4 → Horizon 1–3)
- Added category coverage gap analysis for scanner expansion
- Added strategic GTM notes for taxonomy publication

**v1.0 (March 10, 2026):**
- Initial compilation from cross-model synthesis (Claude, Gemini, ChatGPT)

---

## Purpose

This document is the **master reference** for all currently known or strongly inferred factors that influence whether AI systems such as **ChatGPT, Perplexity, Google AI Overviews, Claude, Gemini, and Microsoft Copilot** can:

1. **crawl** a page,
2. **understand** its structure,
3. **extract** useful information,
4. **trust** the source,
5. **associate** the content with entities and knowledge graphs, and
6. **cite, reference, or recommend** the source in generated answers.

---

## Confidence Labels

Every factor is assigned one of four confidence labels to keep the framework defensible:

* **Established** — Well-supported by web standards, platform documentation, repeated observation, or broadly accepted technical practice.
* **Strongly Inferred** — Not always formally documented by platforms, but strongly supported by research, behavior patterns, or repeated industry observation.
* **Indirect / Correlated** — Likely influences AI visibility indirectly through search prominence, authority, trust, or discoverability rather than being a direct retrieval factor.
* **Emerging / Experimental** — New or evolving factors that appear directionally important but are not yet stable, standardized, or universally adopted.

**Additional type tag (Category 9 only):** Factors in Category 9 (Observability) carry both a standard confidence label and a type designation of **Operational Diagnostic**, indicating they are tools for measuring and improving AI visibility rather than signals consumed by external AI systems.

---

## Priority Tiers

In addition to confidence labels, factors are assigned to priority tiers that guide scanner development and optimization sequencing. These tiers are working hypotheses based on cross-model synthesis and field observation — they should be validated against real citation data before being published as authoritative rankings.

### Core 27

The 27 factors with the highest combined impact on AI visibility across crawlability, machine readability, and extractability. These are the factors that matter most for the widest range of sites and should be prioritized in scanner development and client recommendations.

| Layer | Core 27 Factors |
|:---|:---|
| **L1: Access** | 1.1 robots.txt AI Bot Permissions, 1.2 WAF/CDN Bot Blocking, 1.6 SSR/Pre-rendered HTML, 1.7 Page Load Speed/TTFB, 1.10 XML Sitemap, 1.11 Canonical Tags, 1.14 RSS/Atom Feeds, 1.16 llms.txt |
| **L2: Understanding** | 2.1 JSON-LD, 2.2 Organization Schema, 2.3 Person Schema, 2.4 Article Schema, 2.5 FAQPage Schema, 2.10 Speakable Schema, 2.14 sameAs Linking, 2.15 Schema Graph Completeness, 4.1 Entity Density |
| **L3: Extractability** | 3.1 Front-Loaded Answers, 3.2 Concise Answer Blocks, 3.3 Question-Based Headings, 3.4 Heading Hierarchy, 3.5 Definition & Summary Density, 3.6 FAQ/Q&A HTML Structure, 3.10 Statistics Addition, 3.12 Bullet/Numbered Lists, 3.13 HTML Tables, 3.18 Citation Formatting Quality |

### Citation Core

The 11 factors most directly correlated with whether AI systems select a page for citation. These form the minimum viable structure for citation-worthy content. All 11 are a subset of the Core 27.

*Note: This tier was originally labeled "Citation Core 9" in working documents but actually contains 11 factors.*

1. **2.1** JSON-LD Structured Data
2. **3.1** Front-Loaded Direct Answers (Inverted Pyramid)
3. **3.2** Concise Answer Blocks
4. **3.4** Proper Heading Hierarchy
5. **3.5** Definition & Summary Density
6. **3.10** Statistics Addition
7. **3.12** Bullet Lists and Numbered Lists
8. **3.13** HTML Tables for Comparisons
9. **3.18** Citation Formatting Quality
10. **4.1** Entity Density
11. **5.1** Named Author Presence

---

## Data Source Classification

Each factor requires a specific type of data source for measurement. This classification drives scanner architecture decisions and determines which factors can be measured at each product horizon.

| Data Source Type | Description | Scanner Feasibility |
|:---|:---|:---|
| **Scrape / HTTP** | Directly fetchable from page HTML or HTTP response | v1–v2 (cheap, fast) |
| **Regex / Local** | Pattern matching on fetched content | v1–v2 (cheap, fast) |
| **DOM Analysis** | Structural analysis of HTML document tree | v2 (moderate) |
| **NLP Analysis** | Natural language processing on page text | v2 (moderate, deterministic preferred) |
| **NLP API** | External NLP service (e.g., Google NLP, spaCy) | v2 (API cost per scan) |
| **Graph Analysis** | Schema/entity relationship graph construction | v2–v3 (moderate) |
| **LLM Analysis** | Large language model evaluation | v2–v3 (higher cost, non-deterministic) |
| **SEO API** | External SEO data (Ahrefs, DataForSEO, etc.) | v3 (API cost) |
| **API** | External service API (Google KG, Wikidata, etc.) | v3 (API cost) |
| **Server Logs** | Host-level access log analysis | Observability tooling |
| **Brand Tracking API** | Brand monitoring services | Enterprise/Agency |

### Per-Factor Data Source Mapping

| Factor | Data Source | Factor | Data Source |
|:---|:---|:---|:---|
| 1.1 | Scrape / HTTP | 4.1 | NLP API |
| 1.2 | Simulation / Scrape | 4.2 | NLP API |
| 1.3 | Simulation / Scrape | 4.3 | NLP API |
| 1.4 | Scrape / Render | 4.4 | SEO API |
| 1.5 | Scrape / Simulation | 4.5 | Internal Crawler |
| 1.6 | Scrape | 4.6 | Graph Database |
| 1.7 | API | 4.7 | API |
| 1.8 | Network API | 4.8 | API |
| 1.9 | API | 4.9 | API |
| 1.10 | Scrape | 4.10 | Brand Tracking API |
| 1.11 | Scrape | 5.1 | Scrape |
| 1.12 | Regex / Local | 5.2 | Scrape + NLP |
| 1.13 | Server Logs | 5.3 | Crawler |
| 1.14 | Scrape | 5.4 | NLP Analysis |
| 1.15 | API | 5.5 | NLP Analysis |
| 1.16 | Scrape / HTTP | 5.6 | Backlink API |
| 1.17 | Scrape / HTTP | 5.7 | Scrape |
| 1.18 | Scrape / HTTP | 5.8 | LLM Analysis |
| 2.1 | Scrape | 5.9 | Scrape |
| 2.2 | Scrape | 5.10 | NLP Analysis |
| 2.3 | Scrape | 5.11 | Vector Database |
| 2.4 | Scrape | 5.12 | Scrape |
| 2.5 | Scrape | 5.13 | NLP API |
| 2.6 | Scrape | 6.1 | SEO API |
| 2.7 | Scrape | 6.2 | Brand Tracking API |
| 2.8 | Scrape | 6.3 | News API |
| 2.9 | Scrape | 6.4 | Review API |
| 2.10 | Scrape | 6.5 | Local SEO API |
| 2.11 | Scrape | 6.6 | Audio Search API |
| 2.12 | Scrape | 6.7 | Community API |
| 2.13 | Scrape | 6.8 | Academic API |
| 2.14 | Scrape | 6.9 | SERP API |
| 2.15 | Graph Analysis | 6.10 | Social API |
| 2.16 | Scrape + NLP | 6.11 | Social Listening API |
| 2.17 | Scrape | 7.1 | NLP Analysis |
| 3.1 | NLP Analysis | 7.2 | Content API |
| 3.2 | NLP Analysis | 7.3 | Crawler / Graph |
| 3.3 | Scrape | 7.4 | NLP / Schema |
| 3.4 | Scrape | 7.5 | SEO API |
| 3.5 | NLP Analysis | 8.1–8.5 | AEO / SERP API |
| 3.6 | Scrape | 8.6 | Scrape |
| 3.7 | NLP Analysis | 8.7 | Analytics API |
| 3.8 | NLP Analysis | 8.8–8.9 | Analytical Model |
| 3.9 | NLP Analysis | 9.1–9.2, 9.8 | Server Logs |
| 3.10 | Regex / Scrape | 9.3 | Simulation |
| 3.11 | NLP Analysis | 9.4 | Multi-URL Scrape |
| 3.12 | Scrape | 9.5 | Composite Metrics |
| 3.13 | Scrape | 9.6 | Database |
| 3.14 | NLP Analysis | 9.7 | RAG Simulation |
| 3.15 | DOM Analysis | | |
| 3.16 | DOM Analysis | | |
| 3.17 | SEO API | | |
| 3.18 | Regex / Scrape | | |
| 3.19 | LLM Analysis | | |
| 3.20 | Scrape | | |

---

## Scanner Design Principles

These engineering guardrails govern how taxonomy factors are translated into scanner signals. They apply to all scanner versions (v1–v3) and should be referenced during development.

1. **Deterministic over LLM** — Prefer Flesch scores, regex patterns, DOM parsing, and structural heuristics over LLM-based subjective judgments. LLMs are acceptable for contradiction detection and answer-block identification.

2. **Cheap + Fast + Explainable** — Scanner signals should be inexpensive to compute, fast to return, and explainable to the user. "Your page has 3 definition sentences" is better than "Our AI rated your expertise at 72%."

3. **Fix from the bottom up** — The AI Visibility Stack dependency chain means Access must be fixed before Understanding, Understanding before Extractability. Scanner results should communicate this priority.

4. **Page-level first, site-level second** — v1 measures single-page signals. v2 introduces site-wide crawl signals. v3 adds external authority. Don't jump ahead.

5. **No hypothetical APIs** — Only plan around APIs that are publicly available and stable. Use Ahrefs, DataForSEO, Google NLP, Crossref, Taddy, GDELT as realistic options.

6. **Scanner vs. Authority Graph** — On-page structural signals belong in the scanner. Off-site reputation signals belong in an authority graph product (v3/enterprise). Don't mix them.

7. **Confidence labels are mandatory** — Every factor must carry Established / Strongly Inferred / Indirect / Emerging. This keeps the framework defensible and prevents overclaiming.

8. **Validate before publishing** — The Core 27 and Citation Core lists are working hypotheses, not validated rankings. Test against real citation data before publishing as authoritative.

---

## The Three Pillars of AEO

All known AEO factors collapse into three primary pillars:

### 1. Extractability
Can an AI system cleanly identify, isolate, and reuse the answer?

### 2. Authority
Does the system trust the source enough to cite or reference it?

### 3. Machine Readability
Is the content structured in ways that AI systems, crawlers, and retrieval pipelines can parse efficiently?

A fourth operational layer is increasingly important:

### 4. Observability
Can site owners monitor, diagnose, and improve AI visibility over time?

The practical AEO equation:

> **Crawlability + Machine Readability + Extractability + Entity Trust + Authority Signals = Citation Probability**

---

# Category 1: Technical Crawlability & Access

These factors determine whether AI systems can physically reach, fetch, and process the content at all. If they can't access it, nothing else matters.

## 1.1 robots.txt AI Bot Permissions

**Confidence:** Established
Explicit allow/deny rules for AI crawlers: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, GoogleOther, Bytespider. If blocked, the content may never enter the retrieval pipeline. Many sites inadvertently block AI crawlers through blanket disallow rules or default CMS configurations.

## 1.2 WAF / CDN / Firewall Bot Blocking

**Confidence:** Established
Cloudflare, Sucuri, ModSecurity, host-level firewalls, and rate-limiting layers can silently block AI bots even when robots.txt allows them. Cloudflare updated its default configuration to block AI bots in late 2025 [LLMrefs GEO Guide, 2026; industry reporting]. This is one of the most common invisible causes of low AI visibility.

## 1.3 Hosting Provider / Platform Default Blocking

**Confidence:** Established
Distinct from WAF blocking. Many shared hosting platforms, managed WordPress hosts, and cloud firewalls block new or unrecognized user-agents by default as a security measure. Site owners may need to proactively whitelist AI bot IP ranges at the host level, not just in robots.txt. This is invisible to most site owners and is a top-priority diagnostic check.

## 1.4 JavaScript Rendering Dependency

**Confidence:** Established
Most AI crawlers do not execute client-side JavaScript. GPTBot, ClaudeBot, and PerplexityBot only see raw HTML from the initial server response. Content loaded via client-side JS (React SPAs, dynamic tabs, accordions, interactive pricing tables) is invisible to AI bots. Server-side rendering (SSR) or static HTML fallback is required.

## 1.5 Content Behind Interactive Elements

**Confidence:** Established
Content hidden behind tabs, accordions, sliders, dropdown menus, "read more" toggles, and other interactive UI elements that require clicks to reveal is invisible to AI crawlers. This is distinct from general JS rendering — even server-rendered pages often hide content behind interactive elements. All critical content must be present in the initial HTML response without user interaction.

## 1.6 Server-Side Rendering / Pre-rendered HTML

**Confidence:** Established
Content present in the initial HTML response is significantly more reliable for AI extraction than content dependent on client-side rendering or hydration.

## 1.7 Page Load Speed / TTFB

**Confidence:** Strongly Inferred
Fast server response improves crawl efficiency and reduces fetch friction. Slow HTML delivery may reduce crawl depth, revisit frequency, or prioritization.

## 1.8 HTTPS / SSL Security

**Confidence:** Established
Secure delivery is a baseline trust and accessibility signal. Non-HTTPS pages are less likely to be favored by modern search or AI retrieval systems.

## 1.9 Mobile Accessibility / Mobile-First Availability

**Confidence:** Indirect / Correlated
Content hidden or degraded on mobile may indirectly reduce AI visibility through search indexing behavior and reduced crawl equivalence.

## 1.10 XML Sitemap Presence & Accuracy

**Confidence:** Established
A valid sitemap with accurate `lastmod` values improves discovery and crawl efficiency, especially for large sites or frequently updated content. Helps both search engines and AI crawlers identify recently updated content.

## 1.11 Canonical Tags

**Confidence:** Established
Canonicalization reduces duplicate-content ambiguity and helps AI systems resolve the preferred version of a page.

## 1.12 Clean URL Structure

**Confidence:** Strongly Inferred
Descriptive, semantic URLs improve topic clarity, user trust when displayed in citation lists, and retrieval context.

## 1.13 Crawl Budget Efficiency

**Confidence:** Strongly Inferred
Especially on large sites, crawl efficiency affects how often important pages are discovered and revisited by AI crawlers.

## 1.14 RSS / Atom Feed Availability

**Confidence:** Emerging / Experimental
Structured feed outputs may serve as supplementary discovery and freshness channels for AI systems.

## 1.15 IndexNow Support

**Confidence:** Emerging / Experimental
Can accelerate indexing in ecosystems that consume Bing-driven discovery signals. Since ChatGPT uses Bing's index for real-time retrieval, IndexNow may accelerate how quickly updated content reaches AI systems.

## 1.16 llms.txt Presence

**Confidence:** Emerging / Experimental
An emerging machine-readable manifest (proposed by Jeremy Howard, 2024) for AI agents that points crawlers to the highest-value content, skipping ads, navigation, and noise. Early practitioner reports suggest improved attribution and citation rates, though controlled data is limited.

## 1.17 llms-full.json or Equivalent Knowledge Feed

**Confidence:** Emerging / Experimental
Structured JSON feeds designed for RAG-style ingestion or machine-readable summarization pipelines. An emerging standard with growing adoption.

## 1.18 Markdown / Clean Export Versions

**Confidence:** Emerging / Experimental
Pages or documents available in stripped-down, low-noise, LLM-friendly formats may improve AI readability and downstream ingestion.

---

# Category 2: Structured Data & Machine Readability

These factors determine how clearly a page communicates its meaning to machines.

## 2.1 JSON-LD Structured Data

**Confidence:** Established
Preferred structured-data format for machine parsing. Cleaner separation from HTML than Microdata or RDFa. All major AI platforms and Google recommend JSON-LD.

## 2.2 Organization Schema

**Confidence:** Established
Defines the site's primary organizational entity: name, logo, URL, social profiles, contact details, founding data. Essential for Knowledge Graph recognition and entity resolution.

## 2.3 Person Schema

**Confidence:** Established
Links content to named people with machine-readable author attribution, credentials, affiliations, and identity references. Content with proper Person schema receives significantly more AI citations than anonymous content — one analysis found ~40% higher citation rates for attributed content [Qwairy E-E-A-T Study, 2026; Princeton GEO, 2023].

## 2.4 Article / BlogPosting Schema

**Confidence:** Established
Defines article boundaries, authorship, dates, images, publisher, and summary data. The `dateModified` field is particularly important — AI systems prefer recently updated content.

## 2.5 FAQPage Schema

**Confidence:** Established
One of the most powerful AEO schema types. Exposes clear question-answer pairs for direct extraction. Despite Google restricting FAQ rich results in 2023, AI search platforms have embraced FAQ schema as a primary extraction source.

## 2.6 HowTo Schema

**Confidence:** Established
Improves extractability for instructional and step-based content.

## 2.7 Product Schema

**Confidence:** Established
Critical for ecommerce, shopping, and recommendation queries. AI systems use structured product data for product recommendations and comparison queries.

## 2.8 Review / AggregateRating Schema

**Confidence:** Strongly Inferred
Adds trust and recommendation context. The combination of Product + Review schema is particularly powerful for transactional queries. Aggregate review sentiment influences AI recommendation behavior.

## 2.9 LocalBusiness Schema

**Confidence:** Established
Important for local search, local recommendations, and geographic entity resolution.

## 2.10 Speakable Schema

**Confidence:** Emerging / Experimental
Google's schema extension for voice assistants and AI extraction. A direct signal for sections intended to be spoken or extracted.

## 2.11 BreadcrumbList Schema

**Confidence:** Established
Helps machines understand site hierarchy and page context.

## 2.12 Event Schema

**Confidence:** Established
Important for event-based queries and time-sensitive answer generation.

## 2.13 WebPage / WebSite Schema

**Confidence:** Established
Defines page type, site identity, and sometimes site-level search capabilities (SearchAction).

## 2.14 sameAs Linking

**Confidence:** Established
Connects site entities to external identity references: Wikipedia, Wikidata, LinkedIn, Crunchbase, social profiles. Critical for cross-platform entity validation.

## 2.15 Schema Graph Completeness & Nesting

**Confidence:** Strongly Inferred
AI systems benefit more from an interconnected entity graph than isolated schema fragments. Properly linked relationships (Organization → Person → Article → FAQ) improve machine understanding.

## 2.16 Schema Accuracy / No Misleading Markup

**Confidence:** Established
Schema must match visible page content. Misleading or phantom schema reduces trust. AI systems cross-reference schema claims against page content.

## 2.17 Machine-Readable Feed Architecture

**Confidence:** Emerging / Experimental
Structured JSON feeds, manifests, content maps, and RAG-ready exports may become major future AEO surfaces.

---

# Category 3: Content Structure & Extractability

These factors determine how easily AI systems can isolate useful answer units from a page.

## 3.1 Front-Loaded Direct Answers (Inverted Pyramid)

**Confidence:** Established
AI systems often extract the first 40–60 words of a section for citations. Position direct answers to primary questions at the beginning of content, before providing context or elaboration. Answer-first, then explain.

## 3.2 Concise Answer Blocks

**Confidence:** Strongly Inferred
Structured 40–60 word summaries are especially useful for extraction, synthesis, and citations. The reusable pattern: question → concise answer → supporting facts → optional schema.

## 3.3 Question-Based Headings

**Confidence:** Strongly Inferred
H2/H3 headings phrased as natural questions map well to conversational query behavior and directly match how users prompt AI systems.

## 3.4 Proper Heading Hierarchy

**Confidence:** Established
Logical H1 → H2 → H3 nesting improves document parsing and section understanding. Skipped levels degrade extraction accuracy.

## 3.5 Definition & Summary Density

**Confidence:** Strongly Inferred
Concise definitional statements ("X is...") and opening section summaries increase extractability. Research on extractive summarization consistently shows that definitional sentences are preferentially selected by AI systems.

## 3.6 FAQ / Q&A HTML Structure

**Confidence:** Strongly Inferred
Using semantic Q&A HTML structures (`<dl>`/`<dt>`/`<dd>`, `<details>`/`<summary>`) in addition to FAQPage schema strengthens extraction signals through multiple channels.

## 3.7 Paragraph Self-Containment

**Confidence:** Strongly Inferred
Each paragraph should make sense when extracted on its own. Avoid pronouns that reference earlier content ("this," "these," "that approach") without restating the referent. Include mini-definitions for technical terms inline.

## 3.8 Low Fluff / High Signal-to-Noise Ratio

**Confidence:** Strongly Inferred
Verbose, repetitive, or vague content is less extractable than concise, information-dense writing. AI systems penalize over-optimization and fluff similarly to how search engines do.

## 3.9 Fact Density

**Confidence:** Strongly Inferred
High concentration of verifiable facts, data points, and concrete statements increases citation suitability. Pages with more extractable facts provide more useful material for AI synthesis.

## 3.10 Statistics Addition

**Confidence:** Established
*Source: Princeton GEO research (2023).* Adding relevant, specific statistics to content achieved a 30–40% relative improvement in AI visibility metrics. Quantitative data makes content more citable because AI systems can verify and reference precise numbers. One of the single highest-impact GEO strategies measured in controlled research.

*Disambiguation: This factor measures whether content includes quantitative evidence (numbers, percentages, data points). It is distinct from 3.18 (how outbound citations are formatted) and 5.9 (whether you cite authoritative sources at all). All three are complementary — a page can add statistics (3.10), cite the source of those statistics (5.9), and format that citation clearly (3.18).*

## 3.11 Fluency Optimization

**Confidence:** Strongly Inferred
*Source: Princeton GEO research.* Writing quality, readability, and natural language flow. The combination of fluency optimization with statistics addition outperformed any single GEO strategy by more than 5.5% in controlled testing. Well-written content that's easy to extract and quote gets cited more.

## 3.12 Bullet Lists and Numbered Lists

**Confidence:** Strongly Inferred
Lists improve parseability and extraction for steps, ranked items, and grouped concepts.

## 3.13 HTML Tables for Comparisons

**Confidence:** Strongly Inferred
Well-structured tables are valuable for comparison, specification, and feature-difference queries. AI systems can directly reference tabular data.

## 3.14 TL;DR / Executive Summaries

**Confidence:** Strongly Inferred
Short high-level summaries before deep content help AI identify core answers quickly.

## 3.15 Modular Content Design

**Confidence:** Strongly Inferred
Pages organized into self-contained conceptual modules are easier for AI to reassemble across queries. Clear section boundaries improve chunk quality in RAG pipelines.

## 3.16 Structured Depth

**Confidence:** Strongly Inferred
Comprehensive content performs best when deep coverage is paired with strong structural organization. Depth without structure is counterproductive.

## 3.17 Search Intent Alignment

**Confidence:** Strongly Inferred
Pages should align with the likely intent class: informational, commercial, transactional, navigational, or local. Misaligned intent reduces citation probability.

## 3.18 Citation Formatting Quality

**Confidence:** Strongly Inferred
How you format outbound citations within your content matters. Standard linking formats (clear anchor text to primary sources, parenthetical citations, superscript references) help AI systems verify claims faster and increase the factual confidence score of the page.

*Disambiguation: This factor measures citation presentation — whether links are clearly labeled, anchored to descriptive text, and formatted for machine parsing. It is distinct from 5.9 (whether you cite authoritative sources) and 3.10 (whether you include quantitative data).*

## 3.19 Hallucination Risk / Intra-Page Contradiction Density

**Confidence:** Strongly Inferred
If a page contradicts itself (schema says the price is $50 but body text says $60; H1 says "2025 Guide" but footer says © 2023; structured data conflicts with visible content), the AI model's confidence score drops. Contradictions increase hallucination risk, causing the LLM to discard the source in favor of a more consistent one. Internal consistency within the page is a major extractability factor.

## 3.20 Multi-Modal Context Integration

**Confidence:** Emerging / Experimental
Images, charts, transcripts, captions, and alt-text may increasingly influence multimodal retrieval and citation as AI systems evolve. Most AI crawlers currently cannot parse images directly, but descriptive alt text and surrounding context serve as proxy signals.

---

# Category 4: Entity & Knowledge Graph Signals

AI systems increasingly reason about entities rather than keywords. Entity clarity determines whether AI can confidently associate your content with the right concepts.

## 4.1 Entity Density

**Confidence:** Strongly Inferred
A higher density of clear, machine-identifiable entities improves knowledge extraction. Pages with 15+ connected entities show 4.8× higher selection probability for AI Overviews (Wellows study, 2025).

## 4.2 Entity Type Quality

**Confidence:** Strongly Inferred
ORG, PERSON, PRODUCT, and GPE entities carry more extraction value than DATE, CARDINAL, ORDINAL, or EVENT entities. The AnswerEngineWP scanner uses an explicit entity type whitelist for this reason.

## 4.3 Entity Disambiguation

**Confidence:** Strongly Inferred
Clear context helps AI distinguish between similarly named entities ("Apple" the company vs. the fruit). Schema, consistent naming, and contextual signals all contribute.

## 4.4 Entity Consistency Across Sources

**Confidence:** Strongly Inferred
When brand descriptions, category positioning, and key facts are consistent across your website, LinkedIn, Crunchbase, review platforms, and industry directories, AI systems categorize and reference your brand with greater confidence. Conflicting signals reduce citation probability.

## 4.5 Cross-Page Entity Consistency

**Confidence:** Strongly Inferred
Consistent use of names, schema, roles, and relationships across pages on your own site improves site-level knowledge coherence.

## 4.6 Entity Relationship Mapping

**Confidence:** Strongly Inferred
Explicit edges such as Person → founded → Company, Company → offers → Product, Person → authorOf → Article help AI systems build richer knowledge graphs. More verified relationships around an entity means higher retrieval confidence.

## 4.7 Knowledge Graph Presence

**Confidence:** Indirect / Correlated
Recognition in Google's Knowledge Graph significantly improves AI citation positioning. Knowledge Graph recognition comes from consistent structured data, Wikipedia/Wikidata presence, and authoritative third-party mentions.

## 4.8 Wikipedia / Wikidata Presence

**Confidence:** Indirect / Correlated
Wikipedia presence correlates with early citation positioning (average position 3.28 in one analysis). Even without a full Wikipedia article, Wikidata entries contribute to entity resolution.

## 4.9 LinkedIn / Crunchbase / External Profile Validation

**Confidence:** Strongly Inferred
Professional profiles and data aggregators strengthen entity verification and sameAs linking.

## 4.10 Brand Entity Signals

**Confidence:** Indirect / Correlated
Branded search demand, persistent mentions, and entity recognition across the web contribute to trust and recall. These are the "evidence file" AI builds to verify your brand.

---

# Category 5: E-E-A-T, Trust & Content Authority

These signals influence whether AI systems trust a page enough to use it as a source. 96% of AI Overview citations come from sources with strong E-E-A-T signals (Wellows study, 2025).

## 5.1 Named Author Presence

**Confidence:** Established
Anonymous content carries weaker trust signals than attributed content. Named authorship is a baseline requirement for citation-worthy content.

## 5.2 Author Bio & Credentials

**Confidence:** Strongly Inferred
Visible expertise context — degrees, certifications, job roles, domain qualifications — improves source credibility. Particularly important for trust-sensitive topics. Content from credentialed authors receives meaningfully more AI citations than anonymous content [Princeton GEO, 2023; Qwairy, 2026].

## 5.3 Dedicated Author Pages with Person Schema

**Confidence:** Strongly Inferred
Persistent identity pages with Person schema strengthen author verification, cross-page trust, and machine-readable identity resolution.

## 5.4 First-Hand Experience Signals

**Confidence:** Strongly Inferred
Authentic examples, lived experience, firsthand usage, and real-world details differentiate content from generic synthesis. AI systems increasingly use the "Experience" component of E-E-A-T to identify primary vs. derivative sources.

## 5.5 Demonstrable Expertise

**Confidence:** Strongly Inferred
Content that reflects domain understanding, precision, and technical competence is more likely to be trusted and cited.

## 5.6 External Validation of Authority

**Confidence:** Indirect / Correlated
Awards, media mentions, speaking engagements, and professional recognition reinforce source quality and authoritativeness.

## 5.7 Trust Elements on Site

**Confidence:** Strongly Inferred
Contact pages, editorial policies, privacy pages, terms of service, and transparency cues strengthen trustworthiness. In some contexts, their absence may function as a disqualifying signal rather than merely a negative weight.

## 5.8 Factual Accuracy

**Confidence:** Established
Incorrect, exaggerated, or contradictory claims reduce citation trust. AI systems evaluate factual confidence by comparing statements across multiple sources.

## 5.9 Primary-Source Citations Within Content

**Confidence:** Strongly Inferred
*Source: Princeton GEO research (2023) found "Cite Sources" achieved 30–40% improvement in AI visibility — one of the single highest-impact strategies tested.* Outbound citations to authoritative sources increase factual confidence and trust. This factor is high-leverage and frequently underweighted in AEO strategies.

*Disambiguation: This factor measures whether you reference authoritative external sources at all. It is distinct from 3.10 (whether you include quantitative data) and 3.18 (how clearly those citations are formatted). Together, these three form the "citation triad" — include evidence (3.10), cite your sources (5.9), format those citations cleanly (3.18).*

## 5.10 Original Research / Proprietary Data

**Confidence:** Strongly Inferred
Unique data, surveys, original statistics, and proprietary research create information gain and make the page more citation-worthy. Multiple analyses suggest content with original data shows meaningfully higher AI citability vs. generic content [Princeton GEO, 2023; ZipTie E-E-A-T Study, 2026].

## 5.11 Information Gain

**Confidence:** Established
*Elevated from Strongly Inferred in v1.1 based on RAG architecture principles and Google patent analysis.* Content that provides new verifiable facts, unique perspectives, or novel analysis beyond consensus has a mathematically higher chance of being selected for AI synthesis. In RAG systems, content that merely restates what the top 10 results already say is redundant — the retrieval system gains nothing by including it. Information gain is the primary differentiator between content that gets cited and content that gets skipped.

## 5.12 Freshness / dateModified Signal

**Confidence:** Established
Explicit freshness metadata via `dateModified` in Article schema is a practical trust and recency indicator. Visible "Updated on" dates reinforce freshness. Perplexity shows particularly strong recency weight — pages published within 90 days appear to receive substantially more citations [Agenxus GEO Guide, 2025; industry observation].

## 5.13 YMYL Sensitivity

**Confidence:** Strongly Inferred
Health, finance, legal, and safety topics require much stronger trust and expertise signals. AI systems apply heightened scrutiny. Credentials are nearly essential for citation consideration in these categories.

---

# Category 6: Off-Site Authority & Reputation Signals

AI systems do not evaluate sources only from the page itself. External reputation matters significantly.

## 6.1 Backlink Authority

**Confidence:** Indirect / Correlated
Backlinks remain a top-3 ranking factor. Pages with 3.8× more backlinks than positions 2–10 take the #1 spot. Since AI Overviews pull predominantly from top-ranking pages (76% overlap with top 10 for Google AI Overviews), traditional link authority feeds AI visibility indirectly.

**Data Source:** DataForSEO API (org-level signal). ✅ Implemented.

## 6.2 Co-Citations and Unlinked Brand Mentions

**Confidence:** Strongly Inferred
Frequent mention by other credible sources contributes to authority without requiring a hyperlink. AI platforms track unlinked brand mentions and build authority profiles.

**Data Source:** GDELT DOC 2.0 API — free, unlimited (org-level signal). ✅ Implemented.

## 6.3 Media Mentions & Press Coverage

**Confidence:** Strongly Inferred
Recognized coverage strengthens brand legitimacy and entity recognition. Each media mention enriches the entity's Knowledge Graph presence.

**Data Source:** GDELT DOC 2.0 API — article search with sentiment analysis, major outlet detection (org-level signal). ✅ Implemented.

## 6.4 Third-Party Reviews & Review Sentiment

**Confidence:** Strongly Inferred
Reviews on platforms like Google Business Profile, G2, Capterra, Trustpilot, or Yelp influence trust and recommendations. Both the volume and semantic polarity of reviews affect recommendation confidence.

## 6.5 Directory / NAP Consistency

**Confidence:** Established
Essential for local identity resolution and local recommendation reliability. Consistent Name, Address, Phone across all listing platforms.

## 6.6 Podcast Appearances, Interviews & Expert Quotes

**Confidence:** Strongly Inferred
Appearances on podcasts, interviews in trade publications, and being quoted as an expert create authority edges and third-party validation that AI systems can trace.

**Data Sources:**
- Guest appearances: Taddy API GraphQL — episode search with ShowAuthority-compatible identifiers (person-level signal). ✅ Implemented.
- Owned podcasts: Taddy API — domain ownership filtering (org-level signal). ✅ Implemented.
- iTunes/Apple Podcasts ratings: iTunes Search API — enrichment for rating data (free). ✅ Implemented.

## 6.7 Forum / Community Presence

**Confidence:** Indirect / Correlated
Reddit is one of the top 5 most-cited domains across AI Overviews. Active, helpful presence in relevant communities can directly result in AI citations.

## 6.8 Academic / Research Citations

**Confidence:** Strongly Inferred
High-value signal in technical, scientific, and research-oriented sectors. Perplexity particularly favors academic and research sources.

**Data Sources:** Semantic Scholar Author API + Crossref Works API — both free, no key (person-level signal with attribution). ✅ Implemented.

## 6.9 "Best Of" / Comparison List Mentions

**Confidence:** Indirect / Correlated
Third-party inclusion in listicles and comparison pages reinforces category-level authority. This is a variant of co-citation rather than a distinct signal.

## 6.10 Social Profile Consistency

**Confidence:** Strongly Inferred
Consistent brand identity across LinkedIn, Twitter/X, Facebook, and industry-specific platforms helps entity validation and cross-reference confidence.

**Data Source:** Homepage social link discovery + public profile meta tag scraping — free (both org and person-level signals). ✅ Implemented.

## 6.11 Social Sentiment

**Confidence:** Indirect / Correlated
LinkedIn, Instagram, and Facebook are in the top 20 domains cited by all major LLMs. Social sentiment likely matters in some contexts, but confidence is lower than for reviews or media mentions.

### Additional Authority Signals (Beyond Original Taxonomy)

The following signals extend the taxonomy with additional authority indicators:

| Signal | Level | Data Source | Status |
|:---|:---|:---|:---|
| YouTube Channel | Org | YouTube Data API v3 (free) | ✅ Implemented |
| Author Books | Person | Open Library + Google Books (free) | ✅ Implemented |
| Amazon Book Enrichment | Person | Amazon PAAPI v5 (affiliate) | ✅ Implemented |
| GitHub Profile | Person | GitHub REST API (free) | ✅ Implemented |
| Patents | Person | USPTO PatentsView API (free) | ✅ Implemented |
| Screen Presence (TV/Film) | Person | TMDb API (free) | ✅ Implemented |
| Knowledge Graph | Org | Google KG API (free) | ✅ Implemented |
| Wikidata | Org | Wikidata SPARQL (free) | ✅ Implemented |
| Newsletter | Org | Manual entry | ✅ Types defined |
| Conference Speaking | Person | Manual entry | ✅ Types defined |

---

# Category 7: Semantic Matching & Topic Architecture

These factors determine whether your content semantically aligns with the queries AI systems are trying to answer.

## 7.1 Conversational Language Alignment

**Confidence:** Strongly Inferred
Write in the natural language people use when asking questions about your topic. Content that semantically resembles the phrasing of user queries is more likely to be retrieved by vector-based retrieval systems. The implementation: write naturally for your audience, not in keyword-stuffed or jargon-heavy phrasing.

## 7.2 Topical Depth & Comprehensive Coverage

**Confidence:** Strongly Inferred
Deep coverage improves confidence that the page is a good source for related follow-up questions. AI systems prefer sources that can answer multiple related questions from a single page.

## 7.3 Topic Cluster Completeness & Internal Link Coherence

**Confidence:** Strongly Inferred
A site that covers a subject comprehensively across connected, linked pages demonstrates stronger topical authority than orphaned content. Hub-and-spoke architecture with intentional parent-child relationships improves topic clarity and crawl flow.

## 7.4 Local Relevance Signals

**Confidence:** Strongly Inferred
Location-specific context matters for local answer generation. LocalBusiness schema, geo-targeted content, and regional specificity all contribute.

## 7.5 Intent Class Alignment

**Confidence:** Strongly Inferred
Product and service recommendation queries need different structural signals than purely informational content. Matching the structural format to the query intent class (informational, commercial, transactional, navigational, local) increases citation probability.

---

# Category 8: Platform-Specific Retrieval Behaviors

Different AI systems do not behave identically. Understanding platform-specific retrieval behaviors enables targeted optimization.

## 8.1 Google AI Overviews

**Confidence:** Strongly Inferred
- 76% overlap with Google's organic top 10 results (strongest overlap of any AI platform)
- Heavily relies on Knowledge Graph alignment and entity recognition
- Schema completeness shows +73% selection boost
- Semantic completeness (ability to answer without external references) has r=0.87 correlation with selection
- E-E-A-T verification became 27% stricter in 2025 vs. 2024
- Traditional domain authority (DA) has declined in importance (r=0.18 correlation, down from 0.23)

## 8.2 ChatGPT

**Confidence:** Strongly Inferred
- Only 8% overlap with Google's top 10 (lowest among major platforms)
- Favors encyclopedia-style, well-structured content with clear authority signals
- Uses Bing's index for real-time retrieval (IndexNow helps)
- Values comprehensive explanations with conversational structure
- Higher tolerance for newer domains if content demonstrates expertise

## 8.3 Perplexity

**Confidence:** Strongly Inferred
- 28% overlap with Google's top 10 (strongest proximity to traditional rankings among AI-only platforms)
- Strongest recency weight — pages published within 90 days appear to receive substantially more citations [Agenxus GEO Guide, 2025]
- Favors research-heavy, B2B SaaS, academic content
- Values citation density and verifiable evidence
- Conversational tone preferred over academic formality
- Highest conversion rates among AI platforms for SaaS products

## 8.4 Microsoft Copilot

**Confidence:** Strongly Inferred
- Biased toward Microsoft ecosystem content (LinkedIn, GitHub, Microsoft Docs)
- Enterprise-verified sources receive preferential treatment
- Moderate schema leverage — focuses more on text quality and citation density

## 8.5 Gemini / Google Knowledge Graph Alignment

**Confidence:** Strongly Inferred
- Leverages Google's full Knowledge Graph and ranking systems
- Strong alignment with Google's E-E-A-T framework
- Structured data implementation heavily weighted

## 8.6 Voice Assistant Preferences

**Confidence:** Strongly Inferred
Voice systems prefer concise, directly answerable, spoken-language-friendly content. Short, definitive answers to direct questions perform best. Speakable schema markup is the key technical signal.

## 8.7 NavBoost / User Satisfaction Signals (Google-Specific)

**Confidence:** Strongly Inferred
For Google AI Overviews specifically, the AI relies on traditional Google Search interaction data. If human users quickly bounce from your site in traditional search, Google's AI system is unlikely to cite you in an AI Overview. User satisfaction signals from click data act as a preliminary filter for AI source selection. This means traditional UX and engagement optimization directly feeds Google AI visibility.

## 8.8 Platform-Specific Freshness Weighting

**Confidence:** Strongly Inferred
Freshness matters across all systems, but the degree varies significantly. Perplexity weights recency most aggressively. Google AI Overviews favor freshness for evolving topics. ChatGPT shows moderate freshness sensitivity.

## 8.9 Platform-Specific Citation Style Preferences

**Confidence:** Emerging / Experimental
Different systems appear to favor different source types: editorial, research, product, forum, or encyclopedic. Optimization strategies may need platform-specific tuning as these preferences become better understood.

---

# Category 9: Observability, Diagnostics & Optimization Feedback Loops

These are operational AEO factors — essential for monitoring and improving AI visibility over time. Each factor carries both a standard confidence label and a type designation of **Operational Diagnostic**, indicating these are measurement and optimization tools rather than signals consumed by external AI systems.

## 9.1 AI Crawler Log Visibility

**Confidence:** Established | **Type:** Operational Diagnostic
Seeing visits from GPTBot, ClaudeBot, PerplexityBot, and others helps diagnose discoverability. Treat as "directional coverage" rather than absolute measurement due to user-agent spoofing and masked crawling.

## 9.2 Repeated AI Crawler Visits

**Confidence:** Indirect / Correlated | **Type:** Operational Diagnostic
Recurring visits may indicate continued retrieval interest, though causality should be treated cautiously.

## 9.3 Extraction Previewing

**Confidence:** Established | **Type:** Operational Diagnostic
Simulating what an AI system can extract from a page helps identify weak answer surfaces and structural gaps.

## 9.4 Competitor Structure Comparison

**Confidence:** Established | **Type:** Operational Diagnostic
Comparing schema, answer blocks, summaries, feeds, and extractable content against competitors reveals structural gaps and prioritization opportunities.

## 9.5 AI Visibility Scoring

**Confidence:** Established | **Type:** Operational Diagnostic
A weighted structural score prioritizes fixes and communicates progress, even though it is not itself used by external AI systems.

## 9.6 Historical Score Tracking

**Confidence:** Established | **Type:** Operational Diagnostic
Tracking progress over time turns AEO from a static audit into an optimization discipline. After 6+ months, historical data becomes a client retention moat.

## 9.7 Citation Simulation

**Confidence:** Strongly Inferred | **Type:** Operational Diagnostic
A structural estimate of citation likelihood helps communicate stakes. Must always be framed as structural analysis, not deterministic prediction. Load-bearing disclaimer: "Based on structural signals, not AI ranking models."

## 9.8 Directional AI Crawler Analytics

**Confidence:** Established | **Type:** Operational Diagnostic
Useful for monitoring patterns, but must be framed as directional rather than absolute because of user-agent spoofing and masked crawling.

---

# AnswerEngineWP Scanner Alignment

## Current v1 Scanner Signals (ExtractionScorer.php)

The scanner measures 7 direct structural factors with the following exact weights:

| Signal | Weight | Taxonomy Mapping |
|:---|:---|:---|
| **Schema.org types detected** | 20% | Category 2 (2.1–2.16) |
| **Heading hierarchy quality** | 15% | Category 3 (3.4) |
| **FAQ / Q&A block presence** | 15% | Categories 2.5 + 3.6 |
| **Definition & summary density** | 15% | Category 3 (3.5) |
| **Entity density** | 15% | Category 4 (4.1, 4.2) |
| **Feed / manifest presence** | 10% | Category 1 (1.10, 1.16, 1.17) |
| **Speakable markup** | 10% | Category 2 (2.10) |

**Total: 100%**

Each signal produces a 0–100 sub-score. The overall AI Visibility Score is the weighted average.

## Category Coverage Gap Analysis

| Category | v1 Coverage | Gap |
|:---|:---|:---|
| 1. Crawlability & Access | Partial (feeds/sitemap only) | No robots.txt check, no WAF detection, no JS dependency check |
| 2. Structured Data | Strong | Schema types detected + speakable markup |
| 3. Content Structure | Moderate | Headings, definitions, FAQ. Missing: answer-first analysis, statistics detection, list/table readiness |
| 4. Entity Signals | Moderate | Entity density measured. Missing: cross-page consistency, relationship mapping |
| 5. E-E-A-T & Trust | None | No author detection, no freshness check, no credential signals |
| 6. Off-Site Authority | None | Out of scope for page-fetch scanner (requires external APIs) |
| 7. Semantic Matching | None | Would require query-level analysis beyond current architecture |
| 8. Platform-Specific Retrieval | None | Would require per-platform testing infrastructure |
| 9. Observability | Full (this IS the scanner) | Scanner, comparison, score tracking, badges, PDF reports all built |

## v2 Expansion Priorities (Horizon 1.5–2)

These are measurable from a page fetch without external APIs:

1. robots.txt AI-bot permission checks (1.1)
2. JavaScript dependency / SSR detection (1.4, 1.5)
3. Author attribution + Person schema checks (2.3, 5.1–5.3)
4. Freshness / dateModified detection (5.12)
5. Canonical + sitemap validation (1.10, 1.11)
6. Internal link structure analysis (7.3)
7. Answer-first formatting analysis (3.1)
8. List / table extraction readiness (3.12, 3.13)
9. Cross-page entity consistency (4.5)
10. Intra-page contradiction detection (3.19)

## v3 Expansion Priorities (Horizon 2–3)

These require external data sources or API integrations:

1. External entity validation (4.7, 4.8, 4.9)
2. Review / reputation aggregation (6.4)
3. Information gain scoring (5.11)
4. Original research / statistics detection (3.10, 5.10)
5. Off-site mention tracking (6.2, 6.3)
6. Platform-specific visibility overlays (8.1–8.9)
7. Authority graph expansion (6.1)

## Product Horizon Alignment

| Taxonomy Tier | Product Horizon | Focus |
|:---|:---|:---|
| Tier 1: Directly Measurable Structural | Horizon 1 (v1.0 scanner) | Schema, headings, FAQ, summaries, entities, feeds, speakable |
| Tier 2: Entity, Trust & Authority | Horizon 2 (10k–100k installs) | Author schema, freshness, entity graph, knowledge feeds, headless APIs |
| Tier 3: Off-Site Reputation | Horizon 3 (100k+ installs) / Agency Services | Backlinks, media mentions, reviews, directory consistency, citation tracking |
| Tier 4: Emerging & Platform-Specific | Continuous R&D | llms.txt evolution, RAG feeds, multimodal retrieval, platform-specific weighting |

---

# Key Research Citations

| Study | Key Finding | Relevant Factors |
|:---|:---|:---|
| **Princeton GEO Paper (2023)** | "Cite Sources," "Statistics Addition," and "Quotation Addition" achieved 30–40% improvement in AI visibility. Fluency + Statistics combination outperformed any single strategy by 5.5%+. | 3.10, 3.11, 5.9 |
| **Wellows AI Overview Study (2025)** | 96% of AI Overview citations from sources with strong E-E-A-T. Pages with 15+ connected entities show 4.8× higher selection probability. Structured data shows +73% selection rate. DA declined to r=0.18 correlation. | 4.1, 5.1–5.13, 2.1–2.16 |
| **Ahrefs / Linehan-Guan Study (15k prompts)** | Overall AI citation overlap with Google top 10: only 12%. ChatGPT: 8%. Perplexity: 28%. AI Overviews: 76%. | 8.1–8.5 |
| **BrightEdge State of Answer Engines (2026)** | Top 10 optimized brands: 18% of relevant answers. Non-optimized: 3%. Citation links see 22% CTR. | All categories |
| **Gartner Forecast (reaffirmed 2026)** | 25% decline in traditional search volume by 2026. By 2028, 60% of AI-generated answers will be terminal. | Market context |

---

# Strategic GTM Notes for Taxonomy Publication

This taxonomy has three strategic uses beyond internal reference:

## 1. Publish as "The AEO Taxonomy"
Create a documentation hub at `answerenginewp.com/taxonomy` or `answerenginewp.com/methodology/factors`. Open-source the knowledge to sell the implementation. This is the content play that establishes category authority.

## 2. Scanner Cross-Reference
On scanner results pages, link failed checks to the corresponding taxonomy factor. Example: "Failed: No FAQ Schema detected. See Factor 2.5 in the AEO Taxonomy to understand why this matters." This turns the taxonomy into a diagnostic reference that keeps users inside the ecosystem.

## 3. Future AEO Certification Curriculum
The taxonomy defines the curriculum. Agencies learn the factors, pass an assessment, and use AnswerEngineWP Pro/Agency to implement. The certification creates a distribution channel and validates the framework as an industry standard.

---

# Summary

AEO is not simply "SEO for AI."

Traditional SEO optimized documents for ranking.
AEO optimizes knowledge for extraction, trust, and citation.

> **AI systems do not just find pages. They select structured, trusted, extractable knowledge objects.**

This document is the canonical master taxonomy. Update when new research, platform documentation, or field data justifies revisions.

---

# Versioning Plan

* **v1.2** — ~~Add scanner mapping matrix~~ Done: Added Priority Tiers (Core 27, Citation Core), Data Source Classification, Design Principles, per-factor data source mapping
* **v1.3** — Add platform-by-platform weighting estimates based on field observation
* **v1.4** — Add scanner code module mapping (which PHP functions measure which factors)
* **v2.0** — Convert taxonomy into full scoring framework with measurement methods, implementation guidance, and agency training materials

---

**End of Document**
