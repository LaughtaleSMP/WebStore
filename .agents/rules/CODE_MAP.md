# LAUGHTALE SMP — Code Map

**v4.3** · Peta kode untuk LT-Economy behavior pack & WebStore web dashboard.

> Update file ini setiap kali menambah/menghapus/memindahkan file.
> Companion: [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) · [`AI_AGENT.md`](./AI_AGENT.md)

---

## 14. Code Map — LT-Economy (Behavior Pack)

> Referensi cepat agar AI langsung paham lokasi dan peran setiap file.

### 14.1 Entry Point & Shared Utilities

| File | Peran | Key exports |
|---|---|---|
| `scripts/main.js` | Entry point — import semua module, boot sequence, startup log | — |
| `scripts/dp_manager.js` | DP read/write abstraction, batch flush, byte monitoring | `dp.get()`, `dp.set()`, `dp.del()` |
| `scripts/player_dp.js` | Per-player DP helpers (scoped ke player entity) | `pGet()`, `pSet()`, `getOnlinePlayer()` |
| `scripts/eco_flow.js` | Economy flow tracking — semua faucet/sink tercatat | `trackFlow(source, ±amount)` |
| `scripts/kill_fx.js` | Kill effect cosmetic system (particles + sound) | `getKillFx()`, `setKillFx()`, `spawnKillEffect()` |
| `scripts/purge_gate.js` | Purge event active flag (read dari scoreboard bridge) | `isPurgeActive()` |
| `scripts/ui_close.js` | Close UI helper | `UIClose()` |
| `scripts/nudge.js` | Behavioral nudge messaging | — |
| `scripts/topup_info.js` | Topup information display | — |
| `scripts/eid_quest.js` | Seasonal Eid quest system | `isEidActive()`, `getToken()`, `addToken()` |

### 14.2 Module Map

```
scripts/
├── Bank/                    # Perbankan — transfer, saldo, admin
│   ├── config.js            # Konstanta bank (fee, limit, cooldown)
│   └── main.js              # Transfer logic, UI, admin commands
│
├── Combat/                  # PvP — auto-activation, kill rewards, KillFX
│   ├── config.js            # PvP config (tags, timers, rewards, penalties)
│   ├── main.js              # entityHurt/entityDie handlers, combat tag, HUD
│   └── knockback.js         # Custom KB override (admin slider via /lt:kb)
│
├── gacha/                   # Gacha pull system
│   ├── config.js            # Pull rates, pity config, tier definitions
│   ├── data.js              # Static gacha data
│   ├── main.js              # Pull logic, banner rotation, admin UI
│   ├── security.js          # Anti-exploit, rate limiting, pull validation
│   └── utils/
│       ├── core.js          # Core gacha math
│       ├── roll.js          # RNG roll logic
│       ├── reward.js        # Reward distribution
│       ├── scoreboard.js    # Scoreboard helpers (gems, coins)
│       ├── storage.js       # Gacha history persistence
│       ├── stats.js         # Pull statistics
│       ├── player.js        # Player gacha state
│       ├── leaderboard.js   # Gacha leaderboard
│       ├── particles.js     # Pull visual effects
│       ├── bulk.js          # Bulk pull logic
│       ├── discount.js      # Gem discount calculations
│       └── export.js        # Data export helpers
│
├── auction/                 # Player-to-player auction house
│   ├── config.js            # Fee, listing limits, expiry
│   ├── main.js              # Auction lifecycle, event handlers
│   ├── ui/
│   │   ├── browse.js        # Buyer browsing UI
│   │   ├── sell.js          # Seller listing UI
│   │   └── admin.js         # Admin management UI
│   └── utils/
│       ├── storage.js       # Listing persistence (DP chunking)
│       ├── items.js         # Item serialization/deserialization
│       ├── helpers.js       # Price formatting, filtering
│       └── pricing.js       # Smart pricing engine (EWMA, Bayesian, enchant/durability)
│
├── store/                   # In-game shop (admin-managed catalog)
│   ├── config.js            # Store config, categories
│   ├── main.js              # Store entry point
│   ├── catalog.js           # Item catalog definitions
│   ├── storage.js           # Purchase history, inventory tracking
│   ├── helpers.js           # Price/quantity helpers
│   ├── ui.js                # Store browsing UI
│   └── README.md            # Store documentation
│
├── leaderboard/             # Server-to-Supabase leaderboard sync
│   ├── config.js            # Sync intervals, Supabase endpoints
│   ├── main.js              # Main leaderboard display + commands
│   ├── sync.js              # Master sync orchestrator
│   ├── sync_http.js         # HTTP transport layer
│   ├── sync_metrics.js      # Economy metrics aggregation
│   ├── sync_pricing.js      # Price/market data sync
│   ├── sync_boot_pricing.js # Initial pricing bootstrap
│   ├── sync_history.js      # Transaction history sync
│   ├── sync_chat.js         # Live chat sync
│   ├── sync_topup.js        # Topup data sync
│   ├── sync_gacha.js        # Gacha stats sync
│   ├── sync_mimi.js         # Mimi data sync
│   ├── sync_mimi_cmd.js     # Mimi command processor
│   ├── sync_recovery.js     # Recovery/retry logic
│   ├── sync_dp.js           # DP usage sync
│   ├── sync_world_guard.js  # World guard data sync
│   └── sync_guide.js        # Guide/tutorial sync
│
├── hologram/                # Floating text hologram system
│   ├── config.js            # Hologram config (max count, refresh)
│   ├── engine.js            # Entity spawn/despawn engine
│   └── main.js              # Hologram CRUD, admin builder UI
│
├── MobuXP/                  # Mob management + XP system
│   ├── main.js              # Entry point (imports sub-modules)
│   ├── monitor/
│   │   ├── tps_tracker.js   # TPS measurement (exported globally)
│   │   ├── entity_counter.js # Entity population monitor
│   │   ├── auto_throttle.js # Auto mob throttling when TPS drops
│   │   └── ui.js            # Server monitor admin panel
│   ├── mobu/
│   │   └── pigman_blocker.js # Pigman spawn control
│   ├── xp/
│   │   ├── xp_config.js     # XP rates, caps
│   │   ├── xp_manager.js    # XP distribution logic
│   │   └── vanilla_xp.js    # Vanilla XP override
│   └── shared/              # (reserved)
│
├── daily/                   # Daily login reward system
│   ├── achievement.js       # Achievement tracking
│   ├── config.js            # Daily reward config, streak limits
│   ├── login.js             # Login detection + reward trigger
│   ├── main.js              # Entry point, event wiring
│   ├── quest.js             # Daily quest system
│   └── ui.js                # Daily reward UI forms
│
├── jobs/                    # Job System (Miner, Woodcutter, Farmer, Hunter, Fisher)
│   ├── config.js            # Job definitions, rates, levels, titles, SFX
│   ├── db.js                # Jobs storage, player DP & scoreboard integration
│   ├── logic.js             # Core math, progressive tax, coordinate hotspots, leveling logic
│   ├── main.js              # Event registrations, ticking flush orchestrator
│   └── ui.js                # ActionForm dashboard & detail screens
│
├── Tax/                     # Wealth tax + redistribution
│   └── tier.js              # Tax bracket definitions + calc
│
├── welfare/                 # Economic safety nets
│   ├── ubi.js               # Universal Basic Income distribution
│   ├── demurrage.js         # Demurrage (negative interest on idle wealth)
│   └── stagflation.js       # Stagflation detection + response
│
├── insights/                # Economy analytics
│   └── baseline.js          # Baseline metric collection
│
├── market/                  # Dynamic market pricing (reserved)
│
│
├── npc/                     # NPC Market system (custom entity: lt:market_npc)
│   └── market.js            # NPC interaction handler, registry, purge despawn, Steve skin
│
└── welcome/                 # New player onboarding
    ├── _shared.js           # Shared welcome utils
    ├── commands.js           # Welcome commands
    ├── economy.js           # Economy tutorial
    ├── gem.js               # Gem introduction
    └── systems.js           # System overview tutorial
```

### 14.3 Event Subscription Map

Mana file yang subscribe ke event apa — untuk hindari konflik listener:

| Event | File | Tujuan |
|---|---|---|
| `entityHurt` (after) | `Combat/main.js`, `jobs/main.js` | PvP detection, damage tracking, KB override / Last attacker tracking for Hunter |
| `entityDie` (after) | `Combat/main.js`, `jobs/main.js` | Kill reward, streak, KillFX / Hunter job kills |
| `playerLeave` (after) | `Combat/main.js`, `jobs/main.js` | Combat log penalty / Job data flush & cache cleanup |
| `playerSpawn` (after) | `welcome.js` | New player detection |
| `playerInteractWithEntity` (before) | `npc/market.js` | NPC Market interaction (cancel NPC dialog) |
| `scriptEventReceive` (after) | `Combat/main.js` | Admin commands (combat:*) |
| `startup` (before) | `Combat/main.js`, `jobs/main.js` | Custom command registration (`/lt:jobs`) |
| `playerBreakBlock` (after) | `jobs/main.js` | Miner, Woodcutter, Farmer activity |
| `playerFisher` (after) | `jobs/main.js` | Fisher activity |

### 14.4 Shared Scoreboard Bridge

| Objective | Pack | Tujuan |
|---|---|---|
| `coin` | LT-Economy | Primary currency |
| `_purge_state` | LT-Economy ↔ LT-Dragon | Purge active flag |

---

## 15. Code Map — WebStore (Web Dashboard)

### 15.1 Pages

| HTML | Deskripsi | Key JS |
|---|---|---|
| `index.html` | Landing page — hero, features, atmosphere | `animations.js`, `atmo-canvas.js`, `particles.js` |
| `shop.html` | Player shop — purchase items | `shop-page.js`, `shop.js`, `shop-config.js` |
| `economy.html` | Economy dashboard — candlestick, metrics | `economy-page.js` |
| `monitor.html` | Server monitor — TPS, entities, performance | `monitor-page.js`, `monitor-forecast.js` |
| `topup.html` | Topup information page | `topup-page.js` |
| `status.html` | Server status page | `status-page.js`, `server-status.js` |
| `dokumentasi.html` | Documentation / tutorial | — |
| `admin/index.html` | Admin panel — item management, analytics | `admin/js/` |

### 15.2 JavaScript Map

```
js/
├── Core / Infrastructure
│   ├── auth.js              # Supabase auth, session management
│   ├── supabase-sync.js     # Supabase realtime sync client
│   ├── auto-refresh.js      # Auto-refresh polling logic
│   ├── loading.js           # Page loading states
│   └── ui.js                # Shared UI utilities
│
├── Navigation
│   ├── nav.js               # Main navigation bar
│   ├── page-nav.js          # In-page navigation
│   └── back-to-top.js       # Back-to-top button
│
├── Landing Page (index.html)
│   ├── animations.js        # Scroll/entrance animations
│   ├── atmo-canvas.js       # Background atmosphere canvas
│   ├── hero-utils.js        # Hero section helpers
│   ├── feat-icons-enhanced.js # Feature icons with animations
│   ├── particles.js         # Particle system background
│   ├── typewriter.js        # Typewriter text effect
│   ├── banner-popup.js      # Promotional banner/popup
│   └── order-feed.js        # Live order feed ticker
│
├── Shop (shop.html)
│   ├── shop-page.js         # Shop page controller
│   ├── shop.js              # Shop logic (cart, checkout, payment)
│   ├── shop-config.js       # Shop configuration
│   ├── store-catalog.js     # Catalog renderer
│   ├── store-catalog.json   # Static catalog data
│   └── store-page.js        # Store page wrapper
│
├── Economy (economy.html)
│   └── economy-page.js      # Candlestick chart, metrics, analytics
│
├── Monitor (monitor.html)
│   ├── monitor-page.js      # Server monitor dashboard
│   └── monitor-forecast.js  # TPS/entity forecast predictions
│
├── Other Pages
│   ├── topup-page.js        # Topup page controller
│   ├── status-page.js       # Status page controller
│   ├── server-status.js     # Server status polling
│   └── livechat.js          # Live chat widget
│
└── Service Workers
    └── sw-monitor.js        # Monitor offline cache
```

### 15.3 CSS Map

| File | Scope |
|---|---|
| `base.css` | Reset, variables, typography, design tokens |
| `style.css` | Global styles, component defaults |
| `nav.css` | Navigation bar |
| `hero.css` | Hero section |
| `sections.css` | Content sections |
| `pages.css` | Per-page specific styles |
| `atmosphere.css` | Background effects, gradients |
| `livechat.css` | Chat widget |
| `monitor.css` | Monitor dashboard |
| `status.css` | Status page |
| `order-feed.css` | Order feed ticker |
| `skeleton.css` | Loading skeleton placeholders |
| `improvements.css` | Progressive enhancement |
| `responsive.css` | Mobile/tablet breakpoints |

### 15.4 Data Flow

```
BDS Server (LT-Economy)
    │
    ├── leaderboard/sync_*.js ──► Supabase (PostgreSQL)
    │                                  │
    │                                  ▼
    │                           WebStore (browser)
    │                           ├── supabase-sync.js (realtime)
    │                           ├── economy-page.js (charts)
    │                           └── monitor-page.js (metrics)
    │
    └── store/catalog.js ──► shop-config.js ──► shop.html
```
