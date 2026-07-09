# Social Graph — Product Design

**Killer workflow:** *Who is the best person I know who can credibly get me to this target?*

This is a knowledge graph for warm intros — not a CRM. The interface should feel like exploring a living network of public relationships, closer to Obsidian’s graph + notes than Salesforce.

---

## MVP scope

Three views only:

| View | Job |
|------|-----|
| **Graph** | See the public relationship network around a target as nodes + typed edges |
| **Person** | Read one node like an Obsidian note: claims, citations, strength, tags, private notes |
| **Path Finder** | Answer the killer question in under 60 seconds with ranked intro paths |

Everything else (deal pipelines, email sync, enrichment dashboards) is out of MVP.

---

## What should look like Obsidian

- **Graph view** — force-directed map, zoom/pan, click-to-focus, dim non-neighbors, filter edge types, collapse weak links
- **Person pages as notes** — markdown-ish layout, `[[wikilinks]]` to related nodes, tags in the gutter, backlinks panel
- **Local-first feel** — dark canvas, quiet chrome, content over chrome
- **Evidence as footnotes** — every edge claim has a source link; hover shows why the edge exists
- **Manual curation** — private notes, strategy tags, “I know this person” strength overrides

## What may look a bit like a CRM (sparingly)

- **Strategy tags** on people: podcast target, sponsor, investor, real estate operator, family office, bridge person, power broker
- **Path ranking scores** — credibility / warmth / strength / recency / usefulness (shown as a compact score, not a pipeline)
- **“My network” seed** — mark who *you* actually know (warmth source of truth)

Keep these as note metadata and path filters — never as kanban boards or contact tables as the home screen.

## What to totally avoid

- Spreadsheet / table-first contact lists
- Pipeline stages, deal boards, activity feeds as primary UX
- Uncited “AI said so” relationships
- Floating badges, stat strips, and dashboard clutter on the first screen
- Generic purple SaaS chrome or glow-heavy “AI network” aesthetics
- Auto-sending outreach or scraping private data

---

## Automatic vs manually curated

### Automatic (ingest + infer)

| Signal | How |
|--------|-----|
| Public co-founder / board / investor links | SEC, company sites, Crunchbase-class sources |
| Shared entities (deals, properties, lawsuits, donations, podcasts) | News, court dockets, FEC, podcast databases |
| Edge type + weak/strong default | Heuristics from source type (co-founder = strong; “mentioned in same article” = weak) |
| Recency | Source date → edge freshness score |
| Candidate shortest paths | Graph search over public + user-marked edges |
| Suggested citations | Attach source URL to each auto edge |

### Manually curated (human judgment)

| Signal | Why |
|--------|-----|
| “I actually know this person” + warmth | Only the user knows real access |
| Private notes / intro context | Not public; strategy-critical |
| Strategy tags | Intent, not fact |
| Edge strength overrides | Public data under/overstates real trust |
| Confirm / reject weak auto edges | Noise control |
| Path usefulness judgment | “This intro is awkward” is human |

**Blunt rule:** Public structure is automatic. Access and strategy are manual. Never pretend a weak public mention is a warm intro.

---

## Node & edge model

**Node types:** person, company, property, deal, article, donation, board seat, podcast, lawsuit, investment, shared entity

**Edge types:** co-founder, investor, family, board member, donor, lawyer, tenant, lender, podcast guest, political ally, partner, competitor, weak public mention

**Every edge must carry:**
- `type`
- `strength` (0–1) → visual thickness
- `recency` (ISO date) → ranking boost
- `evidence[]` → URL + quote/snippet (required)
- optional `userOverride` for private strength/notes

Weak edges render lighter/thinner; strong edges thicker and higher contrast.

---

## Path Finder ranking

Paths from **You → … → Target** ranked by composite score:

```
score = 0.30*warmth + 0.25*strength + 0.20*credibility + 0.15*recency + 0.10*usefulness
```

| Factor | Source |
|--------|--------|
| Warmth | User-marked “I know” on first hop (manual) |
| Strength | Min/avg edge strength along path |
| Credibility | Evidence quality (primary docs > news > weak mention) |
| Recency | Newest edge on path |
| Usefulness | Shorter paths + strategy-tag fit (bridge / power broker) |

Surface the **best first hop** loudly: “Ask Jay Neveloff — strongest credible bridge.”

---

## Example seed path (MVP demo)

```
Nadav → Jay Neveloff → major NYC real estate lawyer → Witkoff / Kushner / Sapir / Dezer → Trump family
```

Demo data is illustrative public-relationship scaffolding for UX — not a claim of verified private access.

---

## Success criteria (60-second test)

1. Enter a target
2. See graph + top intro path without opening a spreadsheet
3. Click any node → note with citations
4. Know who to ask first and why the path is credible
