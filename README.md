# SENTINEL-1 · Autonomous Risk Warden

> **Built for the [Pyth Playground Community Hackathon](https://www.pyth.network/)**
> Live dashboard powered by **Pyth Pro** real-time price feeds, **Pyth Entropy** randomized execution & **Solana wallet integration**.

**[Live Demo → sentinel-1-delta.vercel.app](https://sentinel-1-delta.vercel.app)**

![Stack](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript_5.8-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_6-646CFF?logo=vite&logoColor=white)
![Pyth](https://img.shields.io/badge/Pyth_Network-AB87FF)
![Solana](https://img.shields.io/badge/Solana-9945FF?logo=solana&logoColor=white)

---

## What is Sentinel-1?

Sentinel-1 is an **autonomous AI risk warden** — a real-time portfolio monitoring & wallet security dashboard that:

- **Streams live price data** from 8 Pyth Hermes feeds (BTC, ETH, SOL, PYTH, LINK, AVAX, USDT, DOGE) via REST polling every 1.5 seconds
- **Connects Solana wallets** (Phantom) to scan token accounts for malicious delegations, scam tokens & drain attacks
- **Scans any wallet** — paste any Solana address to inspect token safety without connecting
- **Resolves token metadata** from Jupiter's verified token list (1,000+ tokens) + local trusted-mints database
- **Computes risk metrics in real-time** — volatility, correlation, liquidation proximity, and composite scoring
- **Simulates stress scenarios** using real Pyth Entropy seeds from Fortuna — flash crashes, correlated sell-offs, volatility spikes, and black swan events
- **Provides emergency actions** — Manual Shelter, Entropy-Randomized Exits (MEV-safe), and Guardian Shield (liquidation defense)
- **Monitors Pyth publishers** — deviation tracking, confidence sensitivity, stake caps, and latency for 12 institutional publishers
- **Generates context-aware reasoning logs** — 95% of agent messages reference live Pyth prices, EMA signals, confidence intervals, and feed latency
- **Answers natural language queries** about positions, risk, hedging, and individual assets using live feed data

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       SENTINEL-1 DASHBOARD                           │
├──────────────┬───────────────┬───────────────┬───────────────────────┤
│  Price       │  Reasoning    │  Risk Gauge   │  Agent                │
│  Ticker      │  Console      │  + Emergency  │  Chat                 │
│  (8 feeds)   │  (AI logs)    │  Controls     │  (NL query)           │
├──────────────┴───────────────┴───────────────┴───────────────────────┤
│  Publisher Radar — Oracle Meta-Analysis (Full Width)                  │
│  Publisher Table · Confidence Sensitivity · Stake Caps               │
├─────────────────────────┬────────────────────────────────────────────┤
│  Positions Panel        │  Entropy Stress Tests                      │
│  (4 leveraged)          │  (4 live scenarios — real Fortuna seeds)   │
├─────────────────────────┴────────────────────────────────────────────┤
│  Wallet Security │ Airdrop Guard (Token Scanner + Paste Address)     │
└──────────────────┴───────────────────────────────────────────────────┘
         │                    │                         │
         ▼                    ▼                         ▼
┌────────────────┐ ┌──────────────────┐  ┌─────────────────────────┐
│ usePriceFeeds  │ │ useLivePositions │  │ useWalletSecurity       │
│ (Hermes REST)  │ │ useLiveRisk      │  │ useAirdropGuard         │
│ 1.5s polling   │ │ useLiveEntropy   │  │ (SPL token scanning)    │
│ 10-fail retry  │ │ useAgentLogs     │  │ Jupiter metadata API    │
│ mock fallback  │ │ usePublisherRadar│  │ 60s auto-rescan         │
└───────┬────────┘ └──────────────────┘  └──────────┬──────────────┘
        │                                           │
        ▼                                           ▼
┌────────────────────────────┐    ┌──────────────────────────────────┐
│ Pyth Hermes REST API       │    │ Solana RPC (Mainnet)             │
│ hermes.pyth.network        │    │ getParsedTokenAccountsByOwner    │
│ 8 mainnet feed IDs         │    │ Phantom Wallet Adapter           │
└────────────────────────────┘    └──────────────────────────────────┘
        │                                           │
        ▼                                           ▼
┌────────────────────────────┐    ┌──────────────────────────────────┐
│ Pyth Entropy (Fortuna)     │    │ Jupiter Token List API           │
│ fortuna.pyth.network       │    │ token.jup.ag/strict              │
│ Real entropy seeds         │    │ Symbol/name resolution           │
└────────────────────────────┘    └──────────────────────────────────┘
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
- **SOL/USD entry at $172.30** ("legacy top-of-cycle") — creates critical health factor scenario
- P&L, percentage change, and health factor update reactively from live Pyth prices
- Health factor color-coding: green (>3.0), yellow (>1.5), red (<1.5)
- SHELTERED badge + spinner when positions are withdrawn

### 4. Emergency Controls
| Action | Behavior |
|--------|----------|
| **Manual Shelter** | Closes all positions instantly, logs total P&L, re-enters at current prices after 8s |
| **Entropy-Randomized Exit** | Closes ~75% of positions in shuffled order with randomized timing (1.2–3.2s per tranche), MEV-safe. Re-enters all at fresh prices. |
| **Guardian Shield** | Appears only when health factor < 1.0. Fires a scripted 4-step defense sequence, then stabilizes underwater position at current price. |

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

### 6. Entropy Stress Tests (Real Pyth Entropy)
- **Real entropy seeds** fetched from `fortuna.pyth.network` (Pyth's on-chain RNG)
- **4 scenarios** recomputed every 5 seconds from real position data:
  - Flash crash of largest position (-12%)
  - Correlated sell-off across all positions (-8%)
  - Volatility spike on weakest position (-18%)
  - Black swan cascading liquidations (-25%)
- Dollar impact calculated from `size × price × crash% × leverage`
- Live entropy seed displayed with chain/sequence metadata
- Statuses cycle through pending → running → complete

### 7. AI Reasoning Console
- **14 log message templates** referencing live data:
  - Feed health monitoring with latency
  - EMA cross detection (bullish divergence / bearish convergence)
  - Microstructure analysis (confidence tightening → institutional accumulation)
  - Volatility spike / flash crash protocol detection
  - Cross-asset sentiment scans (RISK-ON / RISK-OFF)
  - Pyth Entropy seed requests with MEV protection
  - Guardian monitoring scans
- **95% of messages use live Pyth data** (prices, confidence, EMA, change%)
- CRT scanline overlay with scrolling animation
- Log entries color-coded by type: `[SYSTEM]` cyan, `[ALERT]` yellow/red, `[ACTION]` lavender

### 8. Agent Chat (Natural Language)
- **5 dynamic response generators** using live feeds + positions:
  - **Asset analysis** — price, confidence, 24h range, feed latency, EMA signal, position details
  - **Hedge analysis** — long/short exposure, 5% drop stress test, VaR₉₅ estimate
  - **Risk report** — Markdown table with portfolio value, P&L, health factors, volatility
  - **Portfolio summary** — per-position listing with all metrics
  - **Default overview** — feed count, bullish/bearish ratio, top mover
- Intent matching detects asset tickers/names or keywords (hedge, risk, portfolio)
- Quick-suggestion chips: "Analyze SOL", "Risk report", "Hedge rates"

### 9. Publisher Radar — Oracle Meta-Analysis
Analyzes the "sources of the source" — Pyth's 120+ first-party institutional publishers.

- **Publisher Deviation Tracking**: Models 12 real Pyth publishers (Jane Street, Binance, Jump Trading, Wintermute, Cumberland, Galaxy Digital, OKX, Virtu Financial, DRW, Alameda Research, Raydium, CoinShares). Flags publishers exceeding 20σ as **SUSPICIOUS**.
- **Confidence Interval Sensitivity**: Tracks `±conf` with a live sparkline. Alerts on >30% widening — early warning of extreme volatility.
- **Publisher Stake Caps**: Visualizes staked PYTH tokens vs caps with animated bar charts.
- **Latency Leaderboard**: Institutional publishers (Jane Street ~8–23ms) vs DeFi publishers (Raydium ~50–130ms).
- **Three-Tab Interface**: Publishers, Confidence, Stakes
- **Per-Feed Selection**: Dropdown to analyze any of the 8 feeds.

### 10. Solana Wallet Integration
- **Phantom wallet adapter** with connect/disconnect/switch functionality
- **Wallet dropdown portal** (`createPortal` to `document.body`) to ensure proper z-index layering above all dashboard elements
- **Auto-reconnect prevention**: `localStorage.removeItem('walletName')` on disconnect/switch to prevent `autoConnect` from re-connecting
- **Switch Wallet** button in dropdown to easily change wallets
- **Wallet address display** with truncated public key

### 11. Wallet Security Panel
- **SOL balance display** from on-chain data
- **Recent transaction analysis** — fetches last 5 transactions from Solana RPC and checks for suspicious patterns
- **Drainer program detection** — cross-references transaction programs against known malicious contract addresses
- **Security score** — 0–100 composite based on transaction history, delegations, and suspicious interactions
- **Real-time status** — connected wallet address, balance, and security rating

### 12. Airdrop Guard — Token Security Scanner
Full SPL token account scanner protecting wallets from airdrop drain attacks:

- **Real RPC scanning** via `getParsedTokenAccountsByOwner()` — fetches all SPL token accounts
- **4-layer risk assessment** per token:
  1. **Active Delegations** (DANGEROUS) — delegate can transfer tokens without approval
  2. **Known Scam Mints** (DANGEROUS) — matched against community scam databases
  3. **Unknown/Untrusted Mints** (CAUTION) — not in verified token list
  4. **Zero-balance Unknown Accounts** (CAUTION) — residual from scam airdrops
- **Jupiter Token Metadata** — fetches `token.jup.ag/strict` (cached) to resolve symbol, name for 1,000+ verified tokens. Local fallback for 19 major tokens (SOL, USDC, USDT, PYTH, BONK, JUP, mSOL, etc.)
- **Paste Any Address** — text input to scan any Solana wallet without connecting. Works both in disconnected state and as an override when connected.
- **3-tab UI**: Overview (risk score gauge, metrics, quick actions), Tokens (all tokens with risk badges), Alerts (detailed findings)
- **Token Cards** with symbol/name, balance, risk badge (SAFE/CAUTION/SUSPICIOUS/DANGEROUS), expandable details with Solscan links
- **One-click delegation revoke** — builds `RevokeInstruction` transactions for individual or batch revocation
- **Composite risk score** (0–100) with deductions for delegations (-15 each) and alerts (-5 to -25 by severity)
- **Auto-scan** every 60 seconds while connected
- **Browser notifications** for dangerous findings (if permitted)

### 13. Performance Optimizations
- **All 14 components** wrapped in `React.memo` to prevent unnecessary re-renders
- **`useCallback`** for all event handlers in App.tsx (modal toggles, action handlers)
- **`useMemo`** for derived state (critical position detection)
- **Latency polling** slowed from 1s to 5s to reduce overhead

### 14. Mobile Responsive Design
- **Responsive grid**: `grid-cols-1 lg:grid-cols-12` layout adapts to all screen sizes
- **Touch-friendly** controls with appropriate tap targets
- **Compact mode** on mobile for emergency controls and positions

### 15. Visual Design System (Pyth Aesthetic)
- **Colors**: Deep black (`#0B0B0F`), Pyth Purple (`#AB87FF`), Lavender (`#E6DAFE`), Green (`#00FFA3`), Red (`#FF4162`), Yellow (`#FFD166`), Cyan (`#00D4FF`)
- **Glassmorphism cards** with backdrop blur and purple glow on hover
- **Fonts**: JetBrains Mono (terminal/data), Inter (UI headings)
- **Animations**: Framer Motion entry animations, price pulse, scanline scroll, sentinel blink, danger pulse, guardian glow
- **Custom CSS**: Grid background pattern, gradient text, typing cursor, button hover glow borders

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 + TypeScript 5.8 |
| **Build** | Vite 6.4.1 |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite` plugin, `@theme` directive) |
| **Animation** | Framer Motion |
| **Charts** | Recharts (sparkline AreaCharts) |
| **Icons** | Lucide React (~25 icons) |
| **Wallet** | `@solana/wallet-adapter-react` + `@solana/wallet-adapter-phantom` |
| **Blockchain** | `@solana/web3.js` + `@solana/spl-token` |
| **Data** | Pyth Hermes REST API (live) + Pyth Entropy (Fortuna) + Jupiter Token List |
| **Fonts** | Google Fonts (JetBrains Mono, Inter) |
| **Deployment** | Vercel |

---

## Project Structure

```
sentinel-1/
├── public/
│   └── sentinel.svg                    # Favicon
├── src/
│   ├── main.tsx                         # React entry point
│   ├── App.tsx                          # Root layout + hook orchestration (~310 lines)
│   ├── types.ts                         # TypeScript interfaces
│   ├── hooks.ts                         # All custom hooks (~1,300 lines)
│   ├── index.css                        # Tailwind theme + custom CSS (~250 lines)
│   ├── components/
│   │   ├── Header.tsx                   # Top bar with Pyth connection status
│   │   ├── PriceTicker.tsx              # 8-feed price card grid with sparklines
│   │   ├── ReasoningConsole.tsx         # Terminal-style AI reasoning log
│   │   ├── RiskGauge.tsx                # SVG semi-circular risk gauge
│   │   ├── ActionButtons.tsx            # Emergency controls + Guardian Shield
│   │   ├── PositionsPanel.tsx           # Active positions with P&L
│   │   ├── EntropyPanel.tsx             # Stress test scenarios (real Fortuna seeds)
│   │   ├── AgentChat.tsx                # NL query chat interface
│   │   ├── PublisherRadar.tsx           # Oracle meta-analysis (12 publishers)
│   │   ├── WalletButton.tsx             # Phantom connect/disconnect/switch (portal dropdown)
│   │   ├── WalletProvider.tsx           # Solana wallet adapter provider
│   │   ├── WalletSecurityPanel.tsx      # SOL balance + transaction security
│   │   ├── AirdropGuardPanel.tsx        # Token scanner + paste address (~640 lines)
│   │   └── ErrorBoundary.tsx            # React error boundary wrapper
│   └── services/
│       ├── pythHermesService.ts         # Live Pyth Hermes REST integration
│       ├── pythEntropyService.ts        # Real Pyth Entropy (Fortuna) integration
│       ├── publisherRadarService.ts     # Publisher simulation + confidence tracking
│       ├── airdropGuardService.ts       # SPL token scanning + Jupiter metadata (~450 lines)
│       └── mockPythService.ts           # Mock data fallback service
├── index.html                           # Entry HTML with Google Fonts
├── vite.config.ts                       # Vite + React + Tailwind plugins
├── tsconfig.json                        # TypeScript project references
├── tsconfig.app.json                    # App TypeScript config
├── package.json                         # Dependencies & scripts
└── README.md                            # This file
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

Connect a **Phantom wallet** to enable Wallet Security and Airdrop Guard, or **paste any Solana address** to scan tokens without connecting.

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
  | AVAX/USD | `0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7` |
  | USDT/USD | `0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b` |
  | DOGE/USD | `0xc96458d393fe9deb7a7d63a0ac41e2898a67a7750dbd166673279e06c868df0a` |
- **Polling interval**: 1.5 seconds
- **Parsed data**: price, confidence, EMA price, publish time — all converted from Pyth's integer+exponent format

### Pyth Entropy (Real On-Chain RNG)
- **Endpoint**: `https://fortuna.pyth.network/v1/chains`
- Real entropy seeds fetched from Pyth's Fortuna service
- Used for MEV-safe randomized exit timing and stress test seed generation
- Entropy seed, chain, and sequence number displayed in Entropy Panel

### Solana Integration
- **Wallet**: Phantom adapter via `@solana/wallet-adapter-react`
- **RPC**: Mainnet connection for `getParsedTokenAccountsByOwner`, `getBalance`, `getSignaturesForAddress`
- **SPL Token**: `@solana/spl-token` for `createRevokeInstruction` (delegation revocation)
- **Jupiter API**: `token.jup.ag/strict` for verified token metadata (symbol, name, logo)

---

## Hackathon Categories Targeted

| Category | Prize | How Sentinel-1 Qualifies |
|----------|-------|--------------------------|
| **1st Place** | 50,000 PYTH | Full-featured autonomous risk dashboard: live Pyth Pro feeds, real Pyth Entropy, Publisher Radar, Solana wallet security, Airdrop Guard, AI reasoning engine |
| **Most Creative Pyth Pro Use** | 10,000 PYTH | Publisher Radar analyzes the "sources of the source" — deviation tracking, confidence sensitivity, stake cap visualization. AI reasoning interprets Pyth confidence intervals, EMA crosses, and feed microstructure in real-time. |
| **Best Educational Content** | 10,000 PYTH | Guardian Shield demonstrates Pyth Entropy preventing MEV during liquidations. Publisher Radar teaches oracle economics. Airdrop Guard educates on SPL token delegation risks. |
| **Community Choice** | 10,000 PYTH | High-end UI (Tailwind v4 + Framer Motion), wallet security scanning, paste-any-address inspection — designed for visual impact during community voting |
| **Content Bonuses** | 5–20,000 PYTH | Demo-ready with dramatic Guardian Shield + Publisher Radar suspicious publisher detection + Airdrop Guard token risk flagging |

---

## Deployment

- **Live**: [sentinel-1-delta.vercel.app](https://sentinel-1-delta.vercel.app)
- **GitHub**: [github.com/Akadiri1/pyth-sentinel](https://github.com/Akadiri1/pyth-sentinel)

---

## License

Apache 2.0
