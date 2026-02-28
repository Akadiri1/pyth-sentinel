# SENTINEL-1 · Autonomous Risk Warden

> **Built for the [Pyth Playground Community Hackathon](https://www.pyth.network/)**
> Live dashboard powered by **Pyth Pro** real-time price feeds & **Pyth Entropy** randomized execution.

![Stack](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript_5.8-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_6-646CFF?logo=vite&logoColor=white)
![Pyth](https://img.shields.io/badge/Pyth_Network-AB87FF)

---

## What is Sentinel-1?

Sentinel-1 is an **autonomous AI risk warden** — a real-time portfolio monitoring dashboard that:

- **Streams live price data** from 8 Pyth Hermes feeds (BTC, ETH, SOL, PYTH, LINK, AVAX, USDT, DOGE) via REST polling every 1.5 seconds
- **Computes risk metrics in real-time** — volatility from sparkline variance, correlation from cross-asset co-movement, liquidation proximity from position health factors
- **Simulates stress scenarios** using Pyth Entropy concepts — flash crashes, correlated sell-offs, volatility spikes, and black swan events with live dollar-impact calculations
- **Provides emergency actions** — Manual Shelter (instant close-all), Entropy-Randomized Exits (MEV-safe randomized timing), and Guardian Shield (scripted liquidation defense)
- **Generates context-aware reasoning logs** — 95% of agent messages reference live Pyth prices, EMA signals, confidence intervals, and feed latency
- **Answers natural language queries** about positions, risk, hedging, and individual assets using live feed data

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SENTINEL-1 DASHBOARD                 │
├─────────────┬──────────────┬──────────────┬─────────────┤
│  Price      │  Reasoning   │  Risk Gauge  │  Agent      │
│  Ticker     │  Console     │  + Actions   │  Chat       │
│  (8 feeds)  │  (AI logs)   │  (SVG gauge) │  (NL query) │
├─────────────┴──────────────┴──────────────┴─────────────┤
│  Publisher Radar — Oracle Meta-Analysis (Full Width)     │
│  Publisher Table · Confidence Sensitivity · Stake Caps   │
├────────────────────────┬────────────────────────────────┤
│  Positions Panel       │  Entropy Stress Tests           │
│  (4 leveraged)         │  (4 live scenarios)             │
└────────────────────────┴────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐    ┌──────────────────────┐
│  usePriceFeeds  │    │  useLivePositions    │
│  (Hermes REST)  │    │  useLiveRiskMetrics  │
│                 │    │  useLiveEntropy      │
│  1.5s polling   │    │  useAgentLogs        │
│  10-fail retry  │    │  useAgentState       │
│  mock fallback  │    │  usePublisherRadar   │
└────────┬────────┘    └──────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Pyth Hermes REST API                   │
│  hermes.pyth.network/v2/updates/price   │
│  8 mainnet feed IDs · parsed=true       │
└─────────────────────────────────────────┘
```

---

## Features Built

### 1. Live Pyth Price Feeds
- **8 real Pyth mainnet feed IDs** polling via `hermes.pyth.network/v2/updates/price/latest`
- **Resilient poller** with AbortController timeouts (8s), 10-consecutive-failure tolerance before mock fallback
- **Sparkline history** (24 data points per feed) accumulated in-memory
- **Connection indicator** in header: PYTH LIVE (green) / PYTH MOCK (yellow) / connecting (cyan) / error (red)
- Price cards with Recharts sparkline charts, confidence intervals, 24h change, and category badges

### 2. Live Risk Assessment
- **Volatility Index** — computed from sparkline price variance across all feeds
- **Correlation Risk** — detected from cross-asset directional co-movement
- **Liquidation Proximity** — derived from minimum health factor across positions
- **Overall Score** — weighted composite (35% volatility + 35% correlation + 30% liquidation)
- **SVG semi-circular gauge** with animated fill (Framer Motion) and color-coded risk levels

### 3. Active Positions (Live P&L)
- 4 leveraged positions: SOL/USD long 3x, ETH/USD long 2x, BTC/USD short 2x, LINK/USD long 2x
- **SOL/USD entry at $172.30** ("legacy top-of-cycle") — creates a critical health factor scenario with current SOL ~$80
- P&L, percentage change, and health factor update reactively from live Pyth prices
- Health factor color-coding: green (>3.0), yellow (>1.5), red (<1.5)
- SHELTERED badge + spinner when positions are withdrawn

### 4. Emergency Controls
| Action | Behavior |
|--------|----------|
| **Manual Shelter** | Closes all positions instantly, logs total P&L, re-enters at current prices after 8 seconds |
| **Entropy-Randomized Exit** | Closes ~75% of positions in shuffled order with randomized timing (1.2–3.2s per tranche), then re-enters all at fresh prices. MEV-safe simulation. |
| **Guardian Shield** | Appears only when health factor < 1.0 (critical). Fires a scripted 4-step defense sequence into the Reasoning Console, then stabilizes the underwater position by re-entering at current market price. |

### 5. Critical Liquidation Alert System
- When any position's health factor drops below 1.0:
  - **Entire dashboard border pulses** with animated dark red glow (`danger-pulse`)
  - **Agent Override Box** appears: "[CRITICAL] Liquidation imminent at $XX.XX..."
  - **Giant "ACTIVATE GUARDIAN SHIELD" button** with intense `guardian-glow` animation
- Guardian Shield fires the scripted log sequence:
  1. `[ALERT]` — Health factor + liquidation distance (immediate)
  2. `[ACTION]` — Locking collateral, triggering entropy exit (1s delay)
  3. `[SYSTEM]` — Pyth Pro price verification with confidence band (2s delay)
  4. `[SUCCESS]` — Liquidation averted, new health factor, position stabilized (4s delay)
- After shield fires, position re-enters at current price → health factor resets → danger pulse disappears

### 6. Entropy Stress Tests (Live Computed)
- **4 scenarios** recomputed every 5 seconds from real position data:
  - Flash crash of largest position (-12%)
  - Correlated sell-off across all positions (-8%)
  - Volatility spike on weakest position (-18%)
  - Black swan cascading liquidations (-25%)
- Dollar impact calculated from `size × price × crash% × leverage`
- Recommended actions change based on severity
- Statuses cycle through pending → running → complete

### 7. AI Reasoning Console
- **14 log message templates** referencing live data:
  - Feed health monitoring with latency
  - EMA cross detection (bullish divergence / bearish convergence)
  - Microstructure analysis (confidence tightening → institutional accumulation)
  - Volatility spike / flash crash protocol detection
  - Strategy execution evaluation
  - Cross-asset sentiment scans (RISK-ON / RISK-OFF)
  - Portfolio rebalance checks
  - Pyth Entropy seed requests with MEV protection
  - Short squeeze / institutional flow detection
  - Guardian monitoring scans
- **95% of messages use live Pyth data** (prices, confidence, EMA, change%)
- CRT scanline overlay with scrolling animation
- `SENTINEL_V1.0_READY` blinking indicator in footer
- Log entries color-coded by type: `[SYSTEM]` cyan, `[ALERT]` yellow/red with glow, `[ACTION]` lavender, `[ANALYSIS]` purple, `[SUCCESS]` green

### 8. Agent Chat (Natural Language)
- **5 dynamic response generators** using live feeds + positions:
  - **Asset analysis** — price, confidence, 24h range, liquidity depth, feed latency, EMA signal, position details
  - **Hedge analysis** — long/short exposure breakdown, 5% drop stress test per position, VaR₉₅ estimate
  - **Risk report** — Markdown table with portfolio value, P&L, health factors, volatility, sentiment
  - **Portfolio summary** — per-position listing with all metrics
  - **Default overview** — feed count, bullish/bearish ratio, top mover
- Intent matching detects asset tickers/names or keywords (hedge, risk, portfolio, position)
- Quick-suggestion chips: "Analyze SOL", "Risk report", "Hedge rates"

### 9. Visual Design System (Pyth Aesthetic)
- **Colors**: Deep black (`#0B0B0F`), Pyth Purple (`#AB87FF`), Lavender (`#E6DAFE`), Green (`#00FFA3`), Red (`#FF4162`), Yellow (`#FFD166`), Cyan (`#00D4FF`)
- **Glassmorphism cards** with backdrop blur and purple glow on hover
- **Fonts**: JetBrains Mono (terminal/data), Inter (UI headings)
- **Animations**: Framer Motion entry animations, price pulse, scanline scroll, sentinel blink, danger pulse, guardian glow
- **Custom CSS**: Grid background pattern, gradient text, typing cursor, button hover glow borders

### 10. Publisher Radar — Oracle Meta-Analysis
Analyzes the "sources of the source" — Pyth's 120+ first-party institutional publishers.

- **Publisher Deviation Tracking**: Models 12 real Pyth publishers (Jane Street, Binance, Jump Trading, Wintermute, Cumberland, Galaxy Digital, OKX, Virtu Financial, DRW, Alameda Research, Raydium, CoinShares). Each publisher's reported price is derived from the live aggregate ± confidence-weighted deviation. Publishers exceeding 20σ are flagged as **SUSPICIOUS**.
- **Confidence Interval Sensitivity**: Tracks the `±conf` field over time with a live sparkline chart. Alerts when confidence widens >30% between ticks — an early warning of extreme volatility that typically precedes crashes by 2–5 seconds.
- **Publisher Stake Caps**: Visualizes each publisher's staked PYTH tokens vs their cap with animated bar charts. Shows total staked, total cap, and overall utilization percentage — revealing the economic security backing each feed.
- **Latency Leaderboard**: Computes per-publisher latency from `publish_time` deltas. Institutional publishers (Jane Street ~8–23ms) consistently beat DeFi publishers (Raydium ~50–130ms). Fastest publisher of the session is highlighted.
- **Three-Tab Interface**: Switch between Publishers (deviation table with expandable rows), Confidence (interval chart + alerts), and Stakes (bar visualization + utilization metrics).
- **Per-Feed Selection**: Dropdown to analyze any of the 8 feeds. Each feed shows its own publisher breakdown.
- **Status Classification**: `healthy` / `lagging` / `deviating` / `suspicious` / `offline` with color-coded badges and animated pulse for suspicious entries.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 + TypeScript 5.8 |
| **Build** | Vite 6 |
| **Styling** | Tailwind CSS v4 (using `@theme` directive) |
| **Animation** | Framer Motion |
| **Charts** | Recharts (sparkline AreaCharts) |
| **Icons** | Lucide React (~20 icons) |
| **Data** | Pyth Hermes REST API (live) + mock fallback |
| **Fonts** | Google Fonts (JetBrains Mono, Inter) |

---

## Project Structure

```
sentinel-1/
├── public/
│   └── sentinel.svg              # Favicon
├── src/
│   ├── main.tsx                   # React entry point
│   ├── App.tsx                    # Root layout + hook orchestration
│   ├── types.ts                   # TypeScript interfaces
│   ├── hooks.ts                   # All custom hooks (680 lines)
│   ├── index.css                  # Tailwind theme + custom CSS (246 lines)
│   ├── components/
│   │   ├── Header.tsx             # Top bar with status indicators
│   │   ├── PriceTicker.tsx        # 8-feed price card grid with sparklines
│   │   ├── ReasoningConsole.tsx   # Terminal-style AI reasoning log
│   │   ├── RiskGauge.tsx          # SVG semi-circular risk gauge
│   │   ├── ActionButtons.tsx      # Emergency controls + Guardian Shield
│   │   ├── PositionsPanel.tsx     # Active positions with P&L
│   │   ├── EntropyPanel.tsx       # Stress test scenarios
│   │   ├── AgentChat.tsx          # NL query chat interface
│   │   └── PublisherRadar.tsx     # Oracle meta-analysis (deviation, confidence, stakes)
│   └── services/
│       ├── pythHermesService.ts   # Live Pyth Hermes REST integration
│       ├── publisherRadarService.ts # Publisher simulation + confidence tracking
│       └── mockPythService.ts     # Mock data fallback service
├── index.html                     # Entry HTML with Google Fonts
├── vite.config.ts                 # Vite + React + Tailwind plugins
├── tsconfig.json                  # TypeScript project references
├── tsconfig.app.json              # App TypeScript config
├── package.json                   # Dependencies & scripts
└── README.md                      # This file
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type-check
npx tsc --noEmit

# Build for production
npm run build
```

The dashboard connects to Pyth Hermes automatically. If the API is unreachable, it falls back to mock data after ~15 seconds (10 retries).

---

## Pyth Integration Details

### Pyth Pro (Real-Time Price Feeds)
- **Endpoint**: `https://hermes.pyth.network/v2/updates/price/latest`
- **8 Mainnet Feed IDs**:
  | Asset | Feed ID |
  |-------|---------|
  | BTC/USD | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
  | ETH/USD | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
  | SOL/USD | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` |
  | PYTH/USD | `0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff` |
  | LINK/USD | `0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2` |
  | AVAX/USD | `0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1571f7cbe3882` |
  | USDT/USD | `0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b` |
  | DOGE/USD | `0xc96458d393fe9deb7a7d63a0ac41e2898a67a7750dbd166673279e06c868df0a` |
- **Polling interval**: 1.5 seconds
- **Parsed data**: price, confidence, EMA price, publish time — all converted from Pyth's integer+exponent format

### Pyth Entropy (Randomized Execution)
- Used conceptually for MEV-safe exit strategies
- Entropy-Randomized Exit shuffles position order and adds random timing jitter (1.2–3.2s per tranche)
- Stress test scenarios simulate entropy-based risk modeling
- Guardian Shield references Pyth Entropy seed generation in logs

---

## Hackathon Categories Targeted

| Category | Prize | How Sentinel-1 Qualifies |
|----------|-------|--------------------------|
| **1st Place** | 50,000 PYTH | Full-featured autonomous risk dashboard using live Pyth Pro feeds + Publisher Radar oracle meta-analysis |
| **Most Creative Pyth Pro Use** | 10,000 PYTH | Publisher Radar analyzes the "sources of the source" — deviation tracking, confidence sensitivity, stake cap visualization. AI reasoning engine interprets Pyth confidence intervals, EMA crosses, and feed microstructure in real-time. |
| **Best Educational Content** | 10,000 PYTH | Guardian Shield demonstrates how Pyth Entropy prevents MEV during emergency liquidations. Publisher Radar teaches users about oracle economics (publisher staking, confidence intervals, latency). |
| **Community Choice** | 10,000 PYTH | High-end UI (Tailwind v4 + Framer Motion) designed for visual impact during community voting (April 2–15) |
| **Content Bonuses** | 5–20,000 PYTH | Demo-ready with dramatic Guardian Shield liquidation defense + Publisher Radar suspicious publisher detection |

---

## License

Apache 2.0
