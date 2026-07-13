# LAUGHTALE SMP — Code Map

**v4.3** · Peta kode untuk LT-Economy behavior pack & WebStore web dashboard.
Companion: [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) · [`AI_AGENT.md`](./AI_AGENT.md)

---

## 14. Code Map — LT-Economy (Behavior Pack)

### 14.1 Entry Point & Shared Utilities
- `scripts/main.js`: Entry point, boot sequence, startup logs.
- `scripts/dp_manager.js`: DP read/write abstraction, batch flush, byte monitoring (`dp.get()`, `dp.set()`, `dp.del()`).
- `scripts/player_dp.js`: Per-player DP helpers scoped to player entity (`pGet()`, `pSet()`).
- `scripts/eco_flow.js`: Economy flow tracking (faucets/sinks) (`trackFlow()`).
- `scripts/kill_fx.js`: Kill cosmetic particle system (`spawnKillEffect()`).
- `scripts/purge_gate.js`: Purge event active flag (`isPurgeActive()`).
- `scripts/ui_close.js` & `nudge.js` & `topup_info.js`: UI & messaging helpers.
- `scripts/eid_quest.js`: Seasonal Eid quest system (`isEidActive()`).

### 14.2 Module Map
```
scripts/
├── Bank/         # config.js, main.js (transfer, saldo, admin)
├── Combat/       # config.js, main.js, knockback.js (PvP, rewards, KB override)
├── gacha/        # config.js, data.js, main.js, security.js
│   └── utils/    # [core, roll, reward, scoreboard, storage, stats, player, leaderboard, particles, bulk, discount, export]
├── auction/      # config.js, main.js
│   ├── ui/       # [browse, sell, admin]
│   └── utils/    # [storage, items, helpers, pricing (smart pricing engine)]
├── store/        # config.js, main.js, catalog.js, storage.js, helpers.js, ui.js
├── leaderboard/  # config.js, main.js, sync.js, sync_http.js, sync_metrics.js,
│                 # sync_pricing.js, sync_boot_pricing.js, sync_history.js, sync_chat.js,
│                 # sync_topup.js, sync_gacha.js, sync_mimi.js, sync_mimi_cmd.js,
│                 # sync_recovery.js, sync_dp.js, sync_world_guard.js, sync_guide.js
├── hologram/     # config.js, engine.js, main.js (floating text engine)
├── MobuXP/       # main.js
│   ├── monitor/  # [tps_tracker, entity_counter, auto_throttle, ui]
│   ├── mobu/     # pigman_blocker.js
│   └── xp/       # [xp_config, xp_manager, vanilla_xp]
├── daily/        # main.js, config.js, login.js, achievement.js, quest.js, ui.js
├── jobs/         # config.js, db.js, logic.js, main.js, ui.js (Miner/Woodcutter/Farmer/Hunter/Fisher)
├── Tax/          # tier.js (tax brackets)
├── welfare/      # ubi.js, demurrage.js, stagflation.js (economic safety nets)
├── insights/     # baseline.js (metrics)
├── npc/          # market.js (custom market entity)
└── welcome/      # [_shared, commands, economy, gem, systems].js (tutorials)
```

### 14.3 Event Subscription Map
- `entityHurt`: `Combat/main.js` (PvP/KB), `jobs/main.js` (Hunter job target).
- `entityDie`: `Combat/main.js` (rewards, FX), `jobs/main.js` (Hunter kills).
- `playerLeave`: `Combat/main.js` (combat log), `jobs/main.js` (cache flush/cleanup).
- `playerSpawn`: `welcome/systems.js` (onboarding).
- `playerInteractWithEntity`: `npc/market.js` (NPC shop dialog).
- `scriptEventReceive`: `Combat/main.js` (admin settings command).
- `startup`: `Combat/main.js`, `jobs/main.js` (commands registration).
- `playerBreakBlock`: `jobs/main.js` (Miner, Woodcutter, Farmer).
- `playerFisher`: `jobs/main.js` (Fisher job).

### 14.4 Shared Scoreboard Bridge
- `coin`: Primary currency scoreboard (LT-Economy).
- `_purge_state`: Purge status flag (LT-Economy ↔ LT-Dragon).

---

## 15. Code Map — WebStore (Web Dashboard)

### 15.1 Pages & Controllers
- `index.html`: Landing page (scripts: `animations.js`, `atmo-canvas.js`, `particles.js`).
- `shop.html`: Shop page (scripts: `shop-page.js`, `shop.js`, `shop-config.js`, `store-catalog.js`).
- `economy.html`: Candlestick charts & pricing logs (scripts: `economy-page.js`).
- `monitor.html`: Server performance charts & forecast (scripts: `monitor-page.js`, `monitor-forecast.js`).
- `topup.html` & `status.html`: Topup and server info pages.
- `dokumentasi.html`: Tutorial page.
- `admin/index.html`: Admin dashboard.

### 15.2 JavaScript Files (`js/`)
- **Core**: `auth.js` (Supabase), `supabase-sync.js` (Realtime), `auto-refresh.js`, `loading.js`, `ui.js`.
- **Navigation**: `nav.js`, `page-nav.js`, `back-to-top.js`.
- **Landing Page**: `animations.js`, `atmo-canvas.js`, `hero-utils.js`, `feat-icons-enhanced.js`, `particles.js`, `typewriter.js`, `banner-popup.js`, `order-feed.js`.
- **Shop**: `shop-page.js`, `shop.js`, `shop-config.js`, `store-catalog.js`, `store-catalog.json`, `store-page.js`.
- **Economy & Monitor**: `economy-page.js`, `monitor-page.js`, `monitor-forecast.js`.
- **Others**: `topup-page.js`, `status-page.js`, `server-status.js`, `livechat.js`, `sw-monitor.js`.

### 15.3 CSS Files (`css/`)
`base.css` (reset/tokens), `style.css` (global), `nav.css`, `hero.css`, `sections.css`, `pages.css`, `atmosphere.css`, `livechat.css`, `monitor.css`, `status.css`, `order-feed.css`, `skeleton.css`, `improvements.css`, `responsive.css`.

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
