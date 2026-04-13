/* ══════════════════════════════════════════════════
   shop.js — Laughtale SMP Store (Animated SVG Edition)
   ⚠ Jangan edit file ini. Edit shop-config.js saja.
══════════════════════════════════════════════════ */
(function () {
    /* ── Inject CSS ── */
    const CSS = `
:root{--s-green:#17dd62;--s-diamond:#4ee3e3;--s-gold:#f4c430;--s-red:#ff3a3a;
  --s-purple:#a855f7;--s-bg:#0d1117;--s-bg2:#111827;--s-bg3:#161f2e;
  --s-border:rgba(255,255,255,0.09);--s-text:#e8eaf0;--s-muted:#8892a4;}

/* ── Join info ── */
.shop-join-info{display:flex;align-items:flex-start;gap:10px;
  background:rgba(37,211,102,0.07);border:1px solid rgba(37,211,102,0.22);
  border-radius:10px;padding:12px 16px;margin-bottom:20px;
  font-size:0.84rem;color:var(--s-muted);line-height:1.5;}
.shop-join-info strong{color:var(--s-green);}

/* ── Tabs ── */
.shop-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px;}
.shop-tab{font-family:'Press Start 2P',monospace;font-size:0.46rem;
  padding:9px 16px;border-radius:8px;border:1px solid var(--s-border);
  background:transparent;color:var(--s-muted);cursor:pointer;
  transition:all 0.18s;letter-spacing:0.04em;}
.shop-tab:hover{color:var(--s-text);border-color:var(--s-green);}
.shop-tab.active{background:rgba(23,221,98,0.12);border-color:rgba(23,221,98,0.45);color:var(--s-green);}

/* ── Grid ── */
.shop-grid{display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:clamp(8px,1.2vw,12px);}

/* ── Card ── */
.shop-card{position:relative;isolation:isolate;background:var(--s-bg3);
  border:1px solid var(--s-border);border-radius:10px;padding:0.65rem;
  display:flex;flex-direction:column;gap:4px;
  transition:border-color 0.2s,transform 0.2s,box-shadow 0.2s;overflow:hidden;}
.shop-card::before{content:'';position:absolute;inset:0;
  background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(168,85,247,0.05),transparent 70%);
  pointer-events:none;}
.shop-card:hover{border-color:rgba(168,85,247,0.45);transform:translateY(-4px);
  box-shadow:0 12px 32px rgba(0,0,0,0.45),0 0 0 1px rgba(168,85,247,0.15);}
.shop-sold-out{opacity:0.45;filter:grayscale(40%);}
.shop-sold-out:hover{transform:none;box-shadow:none;}

/* ── Animated thumb ── */
.shop-anim-thumb{width:100%;border-radius:8px;overflow:hidden;
  margin-bottom:0;background:#080c12;aspect-ratio:1/1;
  display:flex;align-items:center;justify-content:center;position:relative;}
.shop-anim-thumb svg{width:100%;height:100%;display:block;}

/* ── Card badge ── */
.shop-badge{font-family:'Press Start 2P',monospace;font-size:0.4rem;
  padding:3px 8px;border-radius:4px;width:fit-content;letter-spacing:0.06em;}

/* ── Card text ── */
.shop-card-emoji{font-size:1.6rem;line-height:1;margin:0;}
.shop-card-name{font-family:'Press Start 2P',monospace;font-size:0.45rem;
  color:var(--s-text);line-height:1.5;}
.shop-card-cat{font-size:0.72rem;color:var(--s-muted);font-weight:700;}
.shop-card-desc{font-size:0.72rem;color:var(--s-muted);line-height:1.45;flex:1;
  display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;}
.shop-feat-list{list-style:none;display:none;flex-direction:column;gap:3px;margin-top:0;}
.shop-feat-list li{font-size:0.76rem;color:var(--s-green);font-weight:700;
  padding-left:14px;position:relative;}
.shop-feat-list li::before{content:'▸';position:absolute;left:0;opacity:0.7;}

/* ── Card footer ── */
.shop-card-footer{display:flex;flex-direction:column;align-items:stretch;
  margin-top:auto;gap:6px;padding-top:8px;border-top:1px solid var(--s-border);}
.shop-card-price{font-family:'Press Start 2P',monospace;font-size:0.55rem;
  color:var(--s-gold);display:flex;align-items:center;gap:5px;flex-wrap:nowrap;}
.shop-price-orig{font-size:0.55rem;color:#ff5a5a;font-weight:normal;text-decoration:none;background:linear-gradient(#ff5a5a,#ff5a5a) no-repeat 0 50%/100% 1.5px;white-space:nowrap;line-height:inherit;}
.shop-btn{font-family:'Press Start 2P',monospace;font-size:0.42rem;
  padding:9px 14px;border-radius:7px;border:none;cursor:pointer;
  transition:all 0.15s;letter-spacing:0.05em;white-space:nowrap;}
.shop-btn-buy{background:var(--s-purple);color:#fff;width:100%;box-shadow:0 2px 0 #6d28d9;}
.shop-btn-buy:hover{background:#c084fc;transform:translateY(-2px);
  box-shadow:0 4px 0 #6d28d9,0 6px 18px rgba(168,85,247,0.4);}
.shop-btn-buy:active{transform:translateY(0);box-shadow:0 1px 0 #6d28d9;}
.shop-btn-sold{background:var(--s-bg2);color:var(--s-muted);border:1px solid var(--s-border);cursor:not-allowed;}

/* ── Gallery ── */
.shop-gallery{border-radius:10px;overflow:hidden;margin-top:12px;
  background:var(--s-bg3);border:1px solid var(--s-border);}
.shop-gallery-track{position:relative;width:100%;aspect-ratio:16/9;background:var(--s-bg3);}
.shop-gallery-img{display:none;width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;}
.shop-gallery-img.active{display:block;}
.shop-gallery-nav{display:flex;align-items:center;justify-content:space-between;
  padding:8px 12px;background:rgba(0,0,0,0.2);gap:8px;}
.shop-gallery-btn{background:var(--s-bg2);border:1px solid var(--s-border);
  color:var(--s-text);border-radius:6px;width:32px;height:32px;
  font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;
  transition:background 0.15s,color 0.15s;flex-shrink:0;}
.shop-gallery-btn:hover{background:var(--s-purple);color:#fff;border-color:var(--s-purple);}
.shop-gallery-dots{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}
.shop-gallery-dot{width:7px;height:7px;border-radius:50%;background:var(--s-border);
  cursor:pointer;transition:background 0.15s,transform 0.15s;}
.shop-gallery-dot.active{background:var(--s-purple);transform:scale(1.3);}

/* ── Modal overlay ── */
.shop-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.78);
  z-index:9999;display:flex;align-items:center;justify-content:center;
  padding:1rem;opacity:0;transition:opacity 0.25s;
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
.shop-modal-overlay.open{opacity:1;}
.shop-modal-box{background:var(--s-bg2);border:1px solid rgba(255,255,255,0.1);
  border-radius:18px;padding:clamp(1.4rem,4vw,2rem);
  max-width:520px;width:100%;max-height:90vh;overflow-y:auto;
  position:relative;transform:scale(0.93) translateY(10px);
  transition:transform 0.28s cubic-bezier(0.34,1.56,0.64,1);}
.shop-modal-overlay.open .shop-modal-box{transform:scale(1) translateY(0);}
.shop-modal-box::-webkit-scrollbar{width:4px;}
.shop-modal-box::-webkit-scrollbar-track{background:var(--s-bg3);}
.shop-modal-box::-webkit-scrollbar-thumb{background:var(--s-purple);border-radius:4px;}

/* ── Modal header ── */
.shop-modal-close{position:absolute;top:14px;right:14px;
  background:var(--s-bg3);border:1px solid var(--s-border);
  border-radius:8px;color:var(--s-muted);width:34px;height:34px;
  cursor:pointer;font-size:0.9rem;transition:all 0.15s;
  display:flex;align-items:center;justify-content:center;}
.shop-modal-close:hover{color:var(--s-text);border-color:var(--s-red);}
.shop-modal-emoji{font-size:3rem;line-height:1;margin-bottom:8px;}
.shop-modal-name{font-family:'Press Start 2P',monospace;font-size:0.72rem;
  color:var(--s-text);line-height:1.5;margin-bottom:4px;}

/* ── Modal sections ── */
.shop-modal-sec{background:var(--s-bg3);border:1px solid var(--s-border);
  border-radius:10px;padding:12px 16px;margin-top:12px;}
.shop-modal-label{font-family:'Press Start 2P',monospace;font-size:0.43rem;
  color:var(--s-muted);margin-bottom:7px;letter-spacing:0.1em;}
.shop-modal-text{font-size:0.84rem;color:var(--s-muted);line-height:1.65;}
.shop-total-sec{background:rgba(168,85,247,0.05);border-color:rgba(168,85,247,0.2);}

/* ── Modal animated preview ── */
.shop-modal-anim{border-radius:10px;overflow:hidden;margin-top:12px;
  background:#080c12;aspect-ratio:16/9;}
.shop-modal-anim svg{width:100%;height:100%;display:block;}

/* ── Form inputs ── */
.shop-input{width:100%;box-sizing:border-box;background:var(--s-bg3);
  border:1px solid var(--s-border);border-radius:8px;color:var(--s-text);
  font-family:'Nunito',sans-serif;font-size:0.88rem;padding:10px 12px;
  outline:none;transition:border-color 0.15s;margin-top:6px;resize:none;}
.shop-input:focus{border-color:var(--s-purple);}
.shop-input::placeholder{color:var(--s-muted);opacity:0.7;}
.shop-textarea{min-height:60px;}

/* ── Qty ── */
.shop-qty-wrap{display:flex;align-items:center;gap:10px;margin-top:6px;}
.shop-qty-btn{width:36px;height:36px;border-radius:8px;
  border:1px solid var(--s-border);background:var(--s-bg2);color:var(--s-text);
  font-size:1.2rem;font-weight:700;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:background 0.15s,border-color 0.15s;flex-shrink:0;}
.shop-qty-btn:hover{background:var(--s-bg3);border-color:var(--s-purple);color:var(--s-purple);}
.shop-qty-input{width:64px;text-align:center;background:var(--s-bg3);
  border:1px solid var(--s-border);border-radius:8px;color:var(--s-text);
  font-family:'Press Start 2P',monospace;font-size:0.72rem;
  padding:8px 4px;outline:none;transition:border-color 0.15s;}
.shop-qty-input:focus{border-color:var(--s-purple);}
.shop-qty-input::-webkit-inner-spin-button,.shop-qty-input::-webkit-outer-spin-button{-webkit-appearance:none;}
.shop-qty-input{-moz-appearance:textfield;}

/* ── Design notice ── */
.shop-design-notice{display:flex;gap:12px;align-items:flex-start;
  background:rgba(244,196,48,0.06);border:1px solid rgba(244,196,48,0.25);
  border-radius:10px;padding:14px 16px;margin-top:12px;}
.shop-design-icon{font-size:1.4rem;flex-shrink:0;line-height:1;margin-top:2px;}
.shop-design-title{font-family:'Press Start 2P',monospace;font-size:0.55rem;
  color:var(--s-gold);letter-spacing:0.04em;margin-bottom:6px;}
.shop-design-text{font-size:0.81rem;color:var(--s-muted);line-height:1.5;margin:0 0 8px 0;}
.shop-design-link{display:inline-flex;align-items:center;gap:6px;
  background:rgba(244,196,48,0.12);border:1px solid rgba(244,196,48,0.35);
  color:var(--s-gold);border-radius:8px;padding:7px 14px;
  font-size:0.78rem;font-weight:700;text-decoration:none;
  transition:background 0.15s,transform 0.1s;}
.shop-design-link:hover{background:rgba(244,196,48,0.22);transform:translateY(-1px);}

/* ── WA button ── */
.shop-wa-btn{display:flex;align-items:center;justify-content:center;gap:10px;
  width:100%;padding:14px;border-radius:10px;border:none;
  background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;
  font-family:'Press Start 2P',monospace;font-size:0.6rem;
  cursor:pointer;transition:opacity 0.15s,transform 0.1s;letter-spacing:0.04em;
  margin-top:14px;}
.shop-wa-btn:hover{opacity:0.9;transform:translateY(-2px);}
.shop-wa-btn:active{transform:translateY(0);}

/* ── Error ── */
.shop-err{display:none;color:var(--s-red);font-size:0.8rem;margin-top:8px;
  padding:8px 12px;background:rgba(255,58,58,0.08);
  border:1px solid rgba(255,58,58,0.25);border-radius:6px;}

/* ── QRIS Step ── */
.shop-qris-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:4px;}
.shop-qris-total-box{width:100%;background:rgba(168,85,247,0.08);border:1.5px solid rgba(168,85,247,0.35);border-radius:12px;padding:14px 18px;text-align:center;}
.shop-qris-total-label{font-family:'Press Start 2P',monospace;font-size:0.42rem;color:var(--s-muted);letter-spacing:0.12em;margin-bottom:6px;}
.shop-qris-total-amount{font-family:'Press Start 2P',monospace;font-size:1rem;color:var(--s-purple);line-height:1.3;}
.shop-qris-img-wrap{width:210px;height:210px;border-radius:14px;overflow:hidden;border:2px solid rgba(168,85,247,0.3);background:#fff;display:flex;align-items:center;justify-content:center;}
.shop-qris-img-wrap img{width:100%;height:100%;object-fit:contain;}
.shop-qris-steps{width:100%;display:flex;flex-direction:column;gap:8px;}
.shop-qris-step{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:9px;}
.shop-qris-step-num{width:22px;height:22px;border-radius:50%;background:rgba(168,85,247,0.2);border:1px solid rgba(168,85,247,0.5);color:var(--s-purple);font-family:'Press Start 2P',monospace;font-size:0.45rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.shop-qris-step-text{font-size:0.8rem;color:var(--s-muted);line-height:1.5;}
.shop-qris-step-text strong{color:var(--s-text);}
.shop-qris-note{width:100%;font-size:0.75rem;color:var(--s-muted);text-align:center;padding:10px 14px;background:rgba(244,196,48,0.05);border:1px solid rgba(244,196,48,0.2);border-radius:9px;line-height:1.6;}
.shop-qris-note strong{color:var(--s-gold);}
.shop-wa-btn-confirm{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;font-family:'Press Start 2P',monospace;font-size:0.52rem;cursor:pointer;transition:opacity 0.15s,transform 0.1s;letter-spacing:0.04em;}
.shop-wa-btn-confirm:hover{opacity:0.9;transform:translateY(-2px);}
.shop-wa-btn-confirm:active{transform:translateY(0);}
.shop-qris-back{background:none;border:1px solid var(--s-border);color:var(--s-muted);border-radius:8px;padding:8px 16px;font-size:0.75rem;cursor:pointer;transition:border-color 0.15s,color 0.15s;width:100%;}
.shop-qris-back:hover{border-color:var(--s-muted);color:var(--s-text);}

/* ── Responsive ── */
@media(max-width:640px){
  .shop-grid{grid-template-columns:1fr 1fr;gap:8px;}
  .shop-modal-box{padding:1.2rem;}
}

/* ════════════════════════════════
   ANIMASI SVG ITEM SHOP
════════════════════════════════ */

@keyframes saCursor{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes saFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes saFloat2{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes saNameColor{
  0%{fill:#c084fc}16%{fill:#f4c430}33%{fill:#4ee3e3}
  50%{fill:#ff8a65}66%{fill:#69ff7d}83%{fill:#f472b6}100%{fill:#c084fc}}
@keyframes saGlow{0%,100%{opacity:.35}50%{opacity:.85}}
@keyframes saGlow2{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes saTyping{0%{width:0}100%{width:100%}}
@keyframes saBadgeIn{0%{opacity:0;transform:translateX(-12px)}100%{opacity:1;transform:translateX(0)}}
@keyframes saGemSpin{
  0%{transform:scaleX(1)}25%{transform:scaleX(.15)}
  50%{transform:scaleX(1)}75%{transform:scaleX(.15)}100%{transform:scaleX(1)}}
@keyframes saGemSpinB{
  0%{transform:scaleX(.15)}25%{transform:scaleX(1)}
  50%{transform:scaleX(.15)}75%{transform:scaleX(1)}100%{transform:scaleX(.15)}}
@keyframes saShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
@keyframes saSparkle{0%,100%{transform:scale(0);opacity:0}50%{transform:scale(1);opacity:1}}
@keyframes saOrbit{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@keyframes saOrbitCCW{0%{transform:rotate(0deg)}100%{transform:rotate(-360deg)}}
@keyframes saCoinBounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}60%{transform:translateY(-4px)}}
@keyframes saMorph{0%,100%{opacity:1;transform:scaleX(1)}45%,55%{opacity:0;transform:scaleX(0)}}
@keyframes saMorphIn{0%,45%{opacity:0;transform:scaleX(0)}55%,100%{opacity:1;transform:scaleX(1)}}
@keyframes saStar{0%,100%{transform:scale(0) rotate(0deg);opacity:0}50%{transform:scale(1) rotate(180deg);opacity:1}}
`;

    const styleEl = document.createElement("style");
    styleEl.id = "shop-injected-css";
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* ── Badge colors ── */
    const BC = {
        gold: { bg: "rgba(244,196,48,0.14)", bd: "rgba(244,196,48,0.4)", cl: "#f4c430" },
        green: { bg: "rgba(23,221,98,0.12)", bd: "rgba(23,221,98,0.4)", cl: "#17dd62" },
        diamond: { bg: "rgba(168,85,247,0.14)", bd: "rgba(168,85,247,0.4)", cl: "#c084fc" },
        red: { bg: "rgba(255,58,58,0.13)", bd: "rgba(255,58,58,0.35)", cl: "#ff3a3a" },
        "": { bg: "rgba(139,148,158,0.1)", bd: "rgba(139,148,158,0.3)", cl: "#8892a4" },
    };

    function badgeHtml(item, extra) {
        if (!item.badge) return "";
        const c = BC[item.badgeColor] || BC[""];
        return `<span class="shop-badge" style="background:${c.bg};border:1px solid ${c.bd};color:${c.cl};${extra || ""}">${item.badge}</span>`;
    }

    function fmtPrice(p) {
        if (p === 0) return `<span style="color:#17dd62">GRATIS</span>`;
        return "Rp\u00a0" + p.toLocaleString("id-ID");
    }
    function fmtPlain(p) {
        return p === 0 ? "GRATIS" : "Rp\u00a0" + p.toLocaleString("id-ID");
    }

    /* ════════════════════════════════════════════════════
   ANIMATED SVG GENERATORS — satu fungsi per item
════════════════════════════════════════════════════ */

    const C = {
        bg: "#080c12",
        bg2: "#0f1724",
        bg3: "#161f2e",
        border: "rgba(255,255,255,0.08)",
        purple: "#a855f7",
        purpleL: "#c084fc",
        purpleD: "#7c3aed",
        gold: "#f4c430",
        teal: "#4ee3e3",
        green: "#17dd62",
        red: "#ff3a3a",
        text: "#e8eaf0",
        muted: "#8892a4",
        orange: "#ff8a65",
    };

    /* ─── 1. Name Style (Chat) ─── */
    function svgNameChat() {
        return `<svg viewBox="0 0 260 146" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="nc-glow-xs" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.8" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="nc-glow-md" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="nc-drop" x="-20%" y="-30%" width="140%" height="160%">
      <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="#a855f7" flood-opacity="0.55"/>
    </filter>
    <linearGradient id="nc-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c1220"/>
      <stop offset="100%" stop-color="#080c12"/>
    </linearGradient>
    <radialGradient id="nc-ambient" cx="18%" cy="62%" r="52%">
      <stop offset="0%" stop-color="rgba(168,85,247,0.09)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <linearGradient id="nc-row-hl" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(168,85,247,0.16)"/>
      <stop offset="50%" stop-color="rgba(168,85,247,0.06)"/>
      <stop offset="100%" stop-color="transparent"/>
    </linearGradient>
    <linearGradient id="nc-shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.13)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <clipPath id="nc-r2clip"><rect x="0" y="49" width="260" height="29"/></clipPath>
    <filter id="nc-pill-glow" x="-10%" y="-40%" width="120%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      @keyframes nc-hue{0%{fill:#c084fc}16%{fill:#f4c430}33%{fill:#4ee3e3}50%{fill:#fb923c}66%{fill:#a3e635}83%{fill:#f472b6}100%{fill:#c084fc}}
      @keyframes nc-pulse{0%,100%{opacity:0.28}50%{opacity:0.88}}
      @keyframes nc-bar-pulse{0%,100%{opacity:0.65}50%{opacity:1}}
      @keyframes nc-shimmer{0%{transform:translateX(-270px)}100%{transform:translateX(540px)}}
      @keyframes nc-sparkle{0%{transform:scale(0) rotate(0deg);opacity:0}42%{transform:scale(1.18) rotate(80deg);opacity:1}58%{transform:scale(0.92) rotate(88deg);opacity:0.9}100%{transform:scale(0) rotate(90deg);opacity:0}}
      @keyframes nc-pill-oscillate{0%,100%{opacity:0.8}50%{opacity:1}}
      @keyframes nc-teal-bar{0%,100%{opacity:0.5}50%{opacity:0.85}}
    </style>
  </defs>
  <rect width="260" height="146" fill="url(#nc-bg)"/>
  <rect width="260" height="146" fill="url(#nc-ambient)"/>
  <rect width="260" height="22" fill="rgba(255,255,255,0.025)"/>
  <rect x="0" y="21.5" width="260" height="0.5" fill="rgba(255,255,255,0.07)"/>
  <circle cx="226" cy="11" r="2.5" fill="#ff5f57" opacity=".55"/>
  <circle cx="235" cy="11" r="2.5" fill="#febc2e" opacity=".55"/>
  <circle cx="244" cy="11" r="2.5" fill="#28c840" opacity=".55"/>
  <text x="12" y="14.5" font-family="'Press Start 2P',monospace" font-size="5" letter-spacing="0.1em" fill="#2d3748">CHAT</text>
  <rect x="0" y="27" width="260" height="21" fill="rgba(255,255,255,0.01)"/>
  <rect x="0" y="27" width="2" height="21" fill="rgba(139,148,158,0.25)"/>
  <text x="12" y="41.5" font-family="'Nunito',sans-serif" font-size="9" font-weight="600" fill="#3d4a5e">&lt;Steve&gt;</text>
  <text x="60" y="41.5" font-family="'Nunito',sans-serif" font-size="9" fill="#4a5568">Halo semua, baru join!</text>
  <rect x="0" y="49" width="260" height="29" fill="url(#nc-row-hl)"/>
  <rect x="0" y="49" width="2.5" height="29" fill="#a855f7" filter="url(#nc-glow-xs)" style="animation:nc-bar-pulse 2.2s cubic-bezier(0.4,0,0.6,1) infinite;"/>
  <text x="12" y="68" font-family="'Nunito',sans-serif" font-size="11" font-weight="800" fill="#9333ea" filter="url(#nc-glow-md)" style="animation:nc-pulse 2.8s cubic-bezier(0.4,0,0.6,1) infinite;">&#x2736; Steve &#x2736;</text>
  <text x="12" y="68" font-family="'Nunito',sans-serif" font-size="11" font-weight="800">
    <tspan fill="#7c3aed">&#x2736; </tspan>
    <tspan style="animation:nc-hue 3.8s cubic-bezier(0.4,0,0.6,1) infinite 0.00s;fill:#c084fc">S</tspan>
    <tspan style="animation:nc-hue 3.8s cubic-bezier(0.4,0,0.6,1) infinite 0.19s;fill:#f4c430">t</tspan>
    <tspan style="animation:nc-hue 3.8s cubic-bezier(0.4,0,0.6,1) infinite 0.38s;fill:#4ee3e3">e</tspan>
    <tspan style="animation:nc-hue 3.8s cubic-bezier(0.4,0,0.6,1) infinite 0.57s;fill:#fb923c">v</tspan>
    <tspan style="animation:nc-hue 3.8s cubic-bezier(0.4,0,0.6,1) infinite 0.76s;fill:#a3e635">e</tspan>
    <tspan fill="#7c3aed"> &#x2736;</tspan>
  </text>
  <text x="111" y="68" font-family="'Nunito',sans-serif" font-size="9" fill="#c9d1dc">Halo semua, baru join!</text>
  <rect x="-270" y="49" width="270" height="29" fill="url(#nc-shimmer)" clip-path="url(#nc-r2clip)" style="animation:nc-shimmer 3.8s cubic-bezier(0.4,0,0.6,1) infinite 1.5s;"/>
  <rect x="0" y="80" width="260" height="22" fill="rgba(78,227,227,0.038)"/>
  <rect x="0" y="80" width="2.5" height="22" fill="#4ee3e3" style="animation:nc-teal-bar 2.4s cubic-bezier(0.4,0,0.6,1) infinite 0.7s;"/>
  <text x="12" y="95" font-family="'Nunito',sans-serif" font-size="10" font-weight="800">
    <tspan fill="#4ee3e3">&#x3010;</tspan><tspan fill="#f4c430">A</tspan><tspan fill="#c084fc">l</tspan><tspan fill="#4ee3e3">e</tspan><tspan fill="#f472b6">x</tspan><tspan fill="#4ee3e3">&#x3011;</tspan>
  </text>
  <text x="74" y="95" font-family="'Nunito',sans-serif" font-size="9" fill="#4a5568">Selamat datang di server!</text>
  <rect x="0" y="106" width="260" height="40" fill="rgba(0,0,0,0.28)"/>
  <rect x="0" y="106" width="260" height="0.5" fill="rgba(255,255,255,0.05)"/>
  <rect x="10" y="116" width="64" height="18" rx="9" fill="rgba(45,55,72,0.5)" stroke="rgba(74,85,104,0.45)" stroke-width="1"/>
  <text x="42" y="128.5" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="4.8" fill="#4a5568">BEFORE</text>
  <rect x="83" y="116" width="168" height="18" rx="9" fill="rgba(109,40,217,0.18)" stroke="rgba(168,85,247,0.55)" stroke-width="1" filter="url(#nc-pill-glow)" style="animation:nc-pill-oscillate 2.5s cubic-bezier(0.4,0,0.6,1) infinite 0.7s;"/>
  <text x="167" y="128.5" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="4.8" fill="#c084fc">AFTER &#x2014; NAME STYLE &#x2736;</text>
  <circle cx="252" cy="52" r="2.6" fill="#c084fc" filter="url(#nc-glow-xs)" style="animation:nc-sparkle 2.4s cubic-bezier(0.34,1.56,0.64,1) infinite 0.00s;transform-origin:252px 52px;"/>
  <circle cx="9" cy="78" r="2" fill="#f4c430" filter="url(#nc-glow-xs)" style="animation:nc-sparkle 2.4s cubic-bezier(0.34,1.56,0.64,1) infinite 0.65s;transform-origin:9px 78px;"/>
  <circle cx="238" cy="103" r="1.8" fill="#4ee3e3" filter="url(#nc-glow-xs)" style="animation:nc-sparkle 2.4s cubic-bezier(0.34,1.56,0.64,1) infinite 1.30s;transform-origin:238px 103px;"/>
  <circle cx="36" cy="112" r="2.2" fill="#f472b6" filter="url(#nc-glow-xs)" style="animation:nc-sparkle 2.4s cubic-bezier(0.34,1.56,0.64,1) infinite 0.33s;transform-origin:36px 112px;"/>
  <circle cx="205" cy="51" r="1.6" fill="#a3e635" filter="url(#nc-glow-xs)" style="animation:nc-sparkle 2.4s cubic-bezier(0.34,1.56,0.64,1) infinite 1.05s;transform-origin:205px 51px;"/>
</svg>`;
    }

    /* ─── 2. Name Style (Player) ─── */
    function svgNamePlayer() {
        return `<svg viewBox="0 0 260 146" xmlns="http://www.w3.org/2000/svg">
    <rect width="260" height="146" fill="${C.bg}"/>
    <line x1="0" y1="73" x2="260" y2="73" stroke="rgba(168,85,247,0.04)" stroke-width="1"/>
    <line x1="130" y1="0" x2="130" y2="146" stroke="rgba(168,85,247,0.04)" stroke-width="1"/>
    <text x="20" y="16" font-size="6" fill="${C.muted}" font-family="'Press Start 2P',monospace">SEBELUM</text>
    <rect x="10" y="24" width="110" height="16" rx="3" fill="${C.bg3}" stroke="${C.border}" stroke-width="1"/>
    <text x="65" y="35" text-anchor="middle" font-size="8" fill="${C.muted}">Steve</text>
    <rect x="50" y="46" width="30" height="30" rx="2" fill="#c8a87a" stroke="${C.border}" stroke-width="1"/>
    <rect x="57" y="54" width="5" height="5" fill="#3a2a1a"/>
    <rect x="68" y="54" width="5" height="5" fill="#3a2a1a"/>
    <rect x="46" y="78" width="38" height="28" rx="1" fill="#4a5568"/>
    <rect x="32" y="78" width="12" height="26" rx="1" fill="#4a5568"/>
    <rect x="86" y="78" width="12" height="26" rx="1" fill="#4a5568"/>
    <rect x="49" y="108" width="14" height="22" rx="1" fill="#2d3748"/>
    <rect x="67" y="108" width="14" height="22" rx="1" fill="#2d3748"/>
    <text x="140" y="16" font-size="6" fill="${C.purpleL}" font-family="'Press Start 2P',monospace">SESUDAH</text>
    <g style="animation:saFloat 2.5s ease-in-out infinite;transform-origin:195px 35px">
      <rect x="135" y="22" width="120" height="20" rx="4" fill="rgba(168,85,247,0.18)" style="animation:saGlow 2.5s ease-in-out infinite"/>
      <rect x="138" y="24" width="114" height="16" rx="8" fill="${C.purpleD}" stroke="${C.purple}" stroke-width="1.5"/>
      <clipPath id="ntClip"><rect x="138" y="24" width="114" height="16" rx="8"/></clipPath>
      <rect x="138" y="24" width="40" height="16" fill="rgba(255,255,255,0.08)" clip-path="url(#ntClip)" style="animation:saShimmer 2.5s ease-in-out infinite"/>
      <text x="195" y="35" text-anchor="middle" font-size="9" font-weight="bold" font-family="'Nunito',sans-serif">
        <tspan style="animation:saNameColor 3s infinite 0s;fill:#c084fc">S</tspan>
        <tspan style="animation:saNameColor 3s infinite 0.12s;fill:#f4c430">t</tspan>
        <tspan style="animation:saNameColor 3s infinite 0.24s;fill:#4ee3e3">e</tspan>
        <tspan style="animation:saNameColor 3s infinite 0.36s;fill:#ff8a65">v</tspan>
        <tspan style="animation:saNameColor 3s infinite 0.48s;fill:#69ff7d">e</tspan>
      </text>
    </g>
    <line x1="195" y1="42" x2="195" y2="50" stroke="rgba(168,85,247,0.4)" stroke-width="1.5" stroke-dasharray="2,2"/>
    <rect x="180" y="46" width="30" height="30" rx="2" fill="#c8a87a" stroke="${C.border}" stroke-width="1"/>
    <rect x="187" y="54" width="5" height="5" fill="#3a2a1a"/>
    <rect x="198" y="54" width="5" height="5" fill="#3a2a1a"/>
    <rect x="176" y="78" width="38" height="28" rx="1" fill="#4a5568"/>
    <rect x="162" y="78" width="12" height="26" rx="1" fill="#4a5568"/>
    <rect x="216" y="78" width="12" height="26" rx="1" fill="#4a5568"/>
    <rect x="179" y="108" width="14" height="22" rx="1" fill="#2d3748"/>
    <rect x="197" y="108" width="14" height="22" rx="1" fill="#2d3748"/>
    <circle cx="225" cy="48" r="2.5" fill="${C.gold}" style="animation:saSparkle 1.8s infinite 0s;transform-origin:225px 48px"/>
    <circle cx="160" cy="55" r="2" fill="${C.teal}" style="animation:saSparkle 1.8s infinite 0.6s;transform-origin:160px 55px"/>
    <circle cx="230" cy="70" r="2" fill="${C.purpleL}" style="animation:saSparkle 1.8s infinite 1.2s;transform-origin:230px 70px"/>
  </svg>`;
    }

    /* ─── 3. Name Style (Custom Design) ─── */
    function svgNameReplace() {
        return `<svg viewBox="0 0 260 146" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="nr-tag" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#5b21b6"/>
    </linearGradient>
    <linearGradient id="nr-sh" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.14)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <radialGradient id="nr-amb" cx="50%" cy="38%" r="52%">
      <stop offset="0%" stop-color="rgba(109,40,217,0.13)"/><stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <filter id="nr-glow" x="-40%" y="-100%" width="180%" height="300%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="nr-sm" x="-50%" y="-80%" width="200%" height="260%">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="nr-clip"><rect x="36" y="46" width="188" height="54" rx="10"/></clipPath>
    <style>
      @keyframes nr-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes nr-shimmer{0%{transform:translateX(-200px)}100%{transform:translateX(430px)}}
      @keyframes nr-gp{0%,100%{opacity:0.35}50%{opacity:0.85}}
      @keyframes nr-sp{0%,100%{transform:scale(0);opacity:0}45%{transform:scale(1.15);opacity:1}60%{transform:scale(0.92);opacity:0.9}}
      @keyframes nr-dot{0%,100%{transform:scale(0.8);opacity:0.4}50%{transform:scale(1.05);opacity:0.9}}
    </style>
  </defs>
  <rect width="260" height="146" fill="#080c12"/>
  <rect width="260" height="146" fill="url(#nr-amb)"/>
  <text x="130" y="19" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="4.8" fill="#2a1f4a" letter-spacing="0.12em">CUSTOM DESIGN</text>
  <line x1="20" y1="24" x2="240" y2="24" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <g style="animation:nr-float 3.4s ease-in-out infinite;transform-origin:130px 73px">
    <rect x="36" y="46" width="188" height="54" rx="10" fill="#6d28d9" filter="url(#nr-glow)" style="animation:nr-gp 3.4s ease-in-out infinite;"/>
    <rect x="36" y="46" width="188" height="54" rx="10" fill="url(#nr-tag)"/>
    <rect x="36" y="46" width="188" height="17" rx="10" fill="rgba(255,255,255,0.11)"/>
    <rect x="36" y="56" width="188" height="8" fill="rgba(255,255,255,0.04)"/>
    <rect x="36" y="46" width="188" height="54" rx="10" fill="none" stroke="rgba(196,132,252,0.55)" stroke-width="1.5"/>
    <line x1="47" y1="73" x2="62" y2="73" stroke="rgba(196,132,252,0.35)" stroke-width="1" stroke-dasharray="2 3"/>
    <line x1="198" y1="73" x2="213" y2="73" stroke="rgba(196,132,252,0.35)" stroke-width="1" stroke-dasharray="2 3"/>
    <polygon points="43,73 48,67 53,73 48,79" fill="rgba(196,132,252,0.55)"/>
    <polygon points="217,73 212,67 207,73 212,79" fill="rgba(196,132,252,0.55)"/>
    <text x="130" y="80" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="18" font-weight="800" fill="#f5f3ff" letter-spacing="0.06em">PlayerName</text>
    <rect x="-200" y="46" width="200" height="54" fill="url(#nr-sh)" clip-path="url(#nr-clip)" style="animation:nr-shimmer 4.2s ease-in-out infinite 1.4s;"/>
  </g>
  <text x="130" y="114" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="7.5" fill="#3d4a5e">Dirancang dari nol — bukan dari template</text>
  <circle cx="112" cy="131" r="4.5" fill="#c084fc" filter="url(#nr-sm)" style="animation:nr-dot 2.8s ease-in-out infinite 0s;transform-origin:112px 131px"/>
  <circle cx="130" cy="131" r="4.5" fill="#f4c430" filter="url(#nr-sm)" style="animation:nr-dot 2.8s ease-in-out infinite 0.35s;transform-origin:130px 131px"/>
  <circle cx="148" cy="131" r="4.5" fill="#4ee3e3" filter="url(#nr-sm)" style="animation:nr-dot 2.8s ease-in-out infinite 0.7s;transform-origin:148px 131px"/>
  <circle cx="22" cy="48" r="1.8" fill="#c084fc" filter="url(#nr-sm)" style="animation:nr-sp 3s ease-in-out infinite 0.3s;transform-origin:22px 48px"/>
  <circle cx="238" cy="48" r="1.8" fill="#c084fc" filter="url(#nr-sm)" style="animation:nr-sp 3s ease-in-out infinite 1.1s;transform-origin:238px 48px"/>
</svg>`;
    }

    /* ─── 4. Title Rank/Clan (Chat) ─── */
    function svgTitleChat() {
        return `<svg viewBox="0 0 260 146" xmlns="http://www.w3.org/2000/svg" style="font-family:'Nunito',sans-serif;">
    <rect width="260" height="146" fill="${C.bg}"/>
    <text x="13" y="18" font-size="6" fill="${C.muted}" font-family="'Press Start 2P',monospace">CHAT</text>
    <line x1="0" y1="24" x2="260" y2="24" stroke="${C.border}" stroke-width="1"/>
    <rect x="10" y="30" width="240" height="20" rx="3" fill="rgba(255,255,255,0.015)"/>
    <text x="18" y="44" font-size="9" fill="${C.muted}">Steve: sup everyone</text>
    <rect x="10" y="54" width="240" height="22" rx="4" fill="rgba(168,85,247,0.07)" stroke="rgba(168,85,247,0.15)" stroke-width="1"/>
    <g style="animation:saBadgeIn 0.6s ease-out both">
      <rect x="16" y="59" width="46" height="12" rx="3" fill="${C.purpleD}" stroke="${C.purple}" stroke-width="1"/>
      <text x="39" y="68.5" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#fff" font-family="'Press Start 2P',monospace">CLAN</text>
    </g>
    <text x="68" y="68" font-size="9" fill="${C.purpleL}" font-weight="bold">Alex</text>
    <text x="100" y="68" font-size="9" fill="${C.text}">: kita raid jam 8 ya!</text>
    <rect x="10" y="80" width="240" height="22" rx="4" fill="rgba(244,196,48,0.04)"/>
    <rect x="16" y="85" width="46" height="12" rx="3" fill="rgba(244,196,48,0.2)" stroke="rgba(244,196,48,0.5)" stroke-width="1"/>
    <text x="39" y="94.5" text-anchor="middle" font-size="6.5" font-weight="bold" fill="${C.gold}" font-family="'Press Start 2P',monospace">VIP</text>
    <text x="68" y="94" font-size="9" fill="${C.gold}" font-weight="bold">Zara</text>
    <text x="96" y="94" font-size="9" fill="${C.text}">: siap, gg!!</text>
    <rect x="10" y="106" width="240" height="20" rx="4" fill="rgba(255,58,58,0.04)"/>
    <rect x="16" y="110" width="56" height="12" rx="3" fill="rgba(255,58,58,0.18)" stroke="rgba(255,58,58,0.4)" stroke-width="1"/>
    <text x="44" y="119.5" text-anchor="middle" font-size="6.5" font-weight="bold" fill="${C.red}" font-family="'Press Start 2P',monospace">ADMIN</text>
    <text x="78" y="119" font-size="9" fill="${C.red}" font-weight="bold">Riko</text>
    <text x="108" y="119" font-size="9" fill="${C.text}">: event jam 9 malam!</text>
    <circle cx="250" cy="34" r="2" fill="${C.purpleL}" style="animation:saSparkle 2s infinite 0.3s;transform-origin:250px 34px"/>
    <circle cx="248" cy="90" r="2.5" fill="${C.gold}" style="animation:saSparkle 2s infinite 1s;transform-origin:248px 90px"/>
  </svg>`;
    }

    /* ─── 5. Title Rank/Clan (Player) ─── */
    function svgTitlePlayer() {
        return `<svg viewBox="0 0 260 146" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="tp-glow-xs" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="tp-glow-badge-p" x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation="4.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="tp-glow-badge-g" x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="tp-char-shadow" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    <linearGradient id="tp-face" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e8b97a"/><stop offset="100%" stop-color="#c8904e"/>
    </linearGradient>
    <linearGradient id="tp-shirt-l" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5b6e8c"/><stop offset="100%" stop-color="#374151"/>
    </linearGradient>
    <linearGradient id="tp-shirt-r" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2d6a4f"/><stop offset="100%" stop-color="#1b4332"/>
    </linearGradient>
    <linearGradient id="tp-pant-l" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2e3a4c"/><stop offset="100%" stop-color="#1a2230"/>
    </linearGradient>
    <linearGradient id="tp-pant-r" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1a3326"/><stop offset="100%" stop-color="#0d1e14"/>
    </linearGradient>
    <linearGradient id="tp-clan-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#5b21b6"/><stop offset="50%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#5b21b6"/>
    </linearGradient>
    <linearGradient id="tp-vip-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(120,80,0,0.6)"/><stop offset="50%" stop-color="rgba(244,196,48,0.28)"/><stop offset="100%" stop-color="rgba(120,80,0,0.6)"/>
    </linearGradient>
    <linearGradient id="tp-shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.15)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <clipPath id="tp-clan-clip"><rect x="8" y="22" width="114" height="19" rx="5"/></clipPath>
    <clipPath id="tp-vip-clip"><rect x="138" y="22" width="114" height="19" rx="5"/></clipPath>
    <radialGradient id="tp-amb-l" cx="25%" cy="50%" r="40%">
      <stop offset="0%" stop-color="rgba(168,85,247,0.10)"/><stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="tp-amb-r" cx="75%" cy="50%" r="40%">
      <stop offset="0%" stop-color="rgba(244,196,48,0.07)"/><stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <style>
      @keyframes tp-float-l{0%,100%{transform:translateY(0px)}50%{transform:translateY(-6.5px)}}
      @keyframes tp-float-r{0%,100%{transform:translateY(0px)}50%{transform:translateY(-5px)}}
      @keyframes tp-bob-l{0%,100%{transform:translateY(0px)}50%{transform:translateY(-1.8px)}}
      @keyframes tp-bob-r{0%,100%{transform:translateY(0px)}50%{transform:translateY(-1.4px)}}
      @keyframes tp-pulse-p{0%,100%{opacity:0.35}50%{opacity:0.9}}
      @keyframes tp-pulse-g{0%,100%{opacity:0.25}50%{opacity:0.75}}
      @keyframes tp-shimmer{0%{transform:translateX(-120px)}100%{transform:translateX(240px)}}
      @keyframes tp-sparkle{0%,100%{transform:scale(0);opacity:0}42%{transform:scale(1.22);opacity:1}58%{transform:scale(0.9);opacity:0.9}}
    </style>
  </defs>
  <rect width="260" height="146" fill="#080c12"/>
  <rect width="260" height="146" fill="url(#tp-amb-l)"/>
  <rect width="260" height="146" fill="url(#tp-amb-r)"/>
  <line x1="130" y1="14" x2="130" y2="140" stroke="rgba(255,255,255,0.045)" stroke-width="1" stroke-dasharray="3,5"/>
  <text x="65" y="13" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="4.5" fill="#2d3748" letter-spacing="0.05em">CLAN TAG</text>
  <text x="195" y="13" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="4.5" fill="#3b2800" letter-spacing="0.05em">VIP TAG</text>
  <g style="animation:tp-float-l 2.8s cubic-bezier(0.45,0.05,0.55,0.95) infinite;transform-origin:65px 31px;">
    <rect x="6" y="20" width="118" height="23" rx="8" fill="#7c3aed" filter="url(#tp-glow-badge-p)" style="animation:tp-pulse-p 2.8s cubic-bezier(0.4,0,0.6,1) infinite;"/>
    <rect x="8" y="22" width="114" height="19" rx="5" fill="url(#tp-clan-grad)"/>
    <rect x="8" y="22" width="114" height="7" rx="5" fill="rgba(255,255,255,0.12)"/>
    <rect x="-120" y="22" width="120" height="19" fill="url(#tp-shimmer)" clip-path="url(#tp-clan-clip)" style="animation:tp-shimmer 3s cubic-bezier(0.4,0,0.6,1) infinite 0.5s;"/>
    <polygon points="14,31 17,27 20,31 17,35" fill="rgba(255,255,255,0.32)"/>
    <polygon points="106,31 109,27 112,31 109,35" fill="rgba(255,255,255,0.32)"/>
    <text x="65" y="34.5" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="7" font-weight="bold" fill="#f5f3ff" letter-spacing="0.04em">[CLAN]</text>
    <circle cx="8" cy="22" r="2" fill="#c4b5fd" filter="url(#tp-glow-xs)" style="animation:tp-sparkle 2.1s cubic-bezier(0.34,1.56,0.64,1) infinite 0.0s;transform-origin:8px 22px;"/>
    <circle cx="122" cy="22" r="2" fill="#c4b5fd" filter="url(#tp-glow-xs)" style="animation:tp-sparkle 2.1s cubic-bezier(0.34,1.56,0.64,1) infinite 0.5s;transform-origin:122px 22px;"/>
    <circle cx="8" cy="41" r="1.8" fill="#c4b5fd" filter="url(#tp-glow-xs)" style="animation:tp-sparkle 2.1s cubic-bezier(0.34,1.56,0.64,1) infinite 1.0s;transform-origin:8px 41px;"/>
    <circle cx="122" cy="41" r="1.8" fill="#c4b5fd" filter="url(#tp-glow-xs)" style="animation:tp-sparkle 2.1s cubic-bezier(0.34,1.56,0.64,1) infinite 1.5s;transform-origin:122px 41px;"/>
  </g>
  <line x1="65" y1="43" x2="65" y2="51" stroke="rgba(168,85,247,0.55)" stroke-width="1.5" stroke-dasharray="2,2"/>
  <rect x="36" y="51" width="58" height="11" rx="5.5" fill="rgba(91,33,182,0.7)" stroke="rgba(168,85,247,0.65)" stroke-width="1"/>
  <text x="65" y="59.5" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="6.5" font-weight="800" fill="#ede9fe">Alex</text>
  <g style="animation:tp-bob-l 3s cubic-bezier(0.45,0.05,0.55,0.95) infinite;transform-origin:65px 100px;" filter="url(#tp-char-shadow)">
    <rect x="51" y="63" width="28" height="28" rx="2" fill="url(#tp-face)"/>
    <rect x="67" y="63" width="12" height="28" rx="2" fill="rgba(0,0,0,0.14)"/>
    <rect x="51" y="81" width="28" height="10" rx="2" fill="rgba(0,0,0,0.10)"/>
    <rect x="51" y="63" width="28" height="5" rx="2" fill="rgba(255,255,255,0.13)"/>
    <rect x="51" y="63" width="5" height="28" rx="2" fill="rgba(255,255,255,0.06)"/>
    <rect x="56" y="70" width="5" height="5" rx="0.5" fill="#1a0f00"/>
    <rect x="57" y="71" width="1.5" height="1.5" fill="rgba(255,255,255,0.7)"/>
    <rect x="65" y="70" width="5" height="5" rx="0.5" fill="#1a0f00"/>
    <rect x="66" y="71" width="1.5" height="1.5" fill="rgba(255,255,255,0.7)"/>
    <rect x="46" y="93" width="38" height="26" rx="1.5" fill="url(#tp-shirt-l)"/>
    <rect x="64" y="93" width="20" height="26" fill="rgba(0,0,0,0.12)"/>
    <line x1="65" y1="93" x2="65" y2="119" stroke="rgba(0,0,0,0.2)" stroke-width="0.8"/>
    <rect x="36" y="93" width="9" height="23" rx="1.5" fill="#4d5f7a"/>
    <rect x="40" y="93" width="5" height="23" fill="rgba(0,0,0,0.1)"/>
    <rect x="85" y="93" width="9" height="23" rx="1.5" fill="#374151"/>
    <rect x="49" y="121" width="12" height="18" rx="1.5" fill="url(#tp-pant-l)"/>
    <rect x="63" y="121" width="12" height="18" rx="1.5" fill="url(#tp-pant-l)"/>
    <rect x="66" y="121" width="9" height="18" fill="rgba(0,0,0,0.12)"/>
    <ellipse cx="65" cy="140" rx="18" ry="3" fill="rgba(0,0,0,0.3)"/>
  </g>
  <g style="animation:tp-float-r 2.4s cubic-bezier(0.45,0.05,0.55,0.95) infinite 0.4s;transform-origin:195px 31px;">
    <rect x="136" y="20" width="118" height="23" rx="8" fill="#b45309" filter="url(#tp-glow-badge-g)" style="animation:tp-pulse-g 2.4s cubic-bezier(0.4,0,0.6,1) infinite 0.4s;"/>
    <rect x="138" y="22" width="114" height="19" rx="5" fill="url(#tp-vip-grad)" stroke="#f4c430" stroke-width="1.5"/>
    <rect x="138" y="22" width="114" height="7" rx="5" fill="rgba(255,255,255,0.09)"/>
    <rect x="-120" y="22" width="120" height="19" fill="url(#tp-shimmer)" clip-path="url(#tp-vip-clip)" style="animation:tp-shimmer 3.2s cubic-bezier(0.4,0,0.6,1) infinite 1.2s;"/>
    <polygon points="148,37 151,30 155,35 158,27 162,35 165,30 168,37" fill="#f4c430" opacity=".9"/>
    <text x="205" y="34.5" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="9" font-weight="bold" fill="#fef3c7" letter-spacing="0.05em">VIP</text>
    <circle cx="138" cy="22" r="2" fill="#fcd34d" filter="url(#tp-glow-xs)" style="animation:tp-sparkle 2.1s cubic-bezier(0.34,1.56,0.64,1) infinite 0.3s;transform-origin:138px 22px;"/>
    <circle cx="252" cy="22" r="2" fill="#fcd34d" filter="url(#tp-glow-xs)" style="animation:tp-sparkle 2.1s cubic-bezier(0.34,1.56,0.64,1) infinite 0.8s;transform-origin:252px 22px;"/>
    <circle cx="138" cy="41" r="1.8" fill="#fcd34d" filter="url(#tp-glow-xs)" style="animation:tp-sparkle 2.1s cubic-bezier(0.34,1.56,0.64,1) infinite 1.3s;transform-origin:138px 41px;"/>
    <circle cx="252" cy="41" r="1.8" fill="#fcd34d" filter="url(#tp-glow-xs)" style="animation:tp-sparkle 2.1s cubic-bezier(0.34,1.56,0.64,1) infinite 1.8s;transform-origin:252px 41px;"/>
  </g>
  <line x1="195" y1="43" x2="195" y2="51" stroke="rgba(244,196,48,0.55)" stroke-width="1.5" stroke-dasharray="2,2"/>
  <rect x="166" y="51" width="58" height="11" rx="5.5" fill="rgba(120,60,0,0.5)" stroke="rgba(244,196,48,0.6)" stroke-width="1"/>
  <text x="195" y="59.5" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="6.5" font-weight="800" fill="#fde68a">Zara</text>
  <g style="animation:tp-bob-r 2.7s cubic-bezier(0.45,0.05,0.55,0.95) infinite 0.5s;transform-origin:195px 100px;" filter="url(#tp-char-shadow)">
    <rect x="181" y="63" width="28" height="28" rx="2" fill="url(#tp-face)"/>
    <rect x="197" y="63" width="12" height="28" rx="2" fill="rgba(0,0,0,0.14)"/>
    <rect x="181" y="81" width="28" height="10" rx="2" fill="rgba(0,0,0,0.10)"/>
    <rect x="181" y="63" width="28" height="5" rx="2" fill="rgba(255,255,255,0.13)"/>
    <rect x="181" y="63" width="5" height="28" rx="2" fill="rgba(255,255,255,0.06)"/>
    <rect x="186" y="70" width="5" height="5" rx="0.5" fill="#1a0f00"/>
    <rect x="187" y="71" width="1.5" height="1.5" fill="rgba(255,255,255,0.7)"/>
    <rect x="195" y="70" width="5" height="5" rx="0.5" fill="#1a0f00"/>
    <rect x="196" y="71" width="1.5" height="1.5" fill="rgba(255,255,255,0.7)"/>
    <rect x="176" y="93" width="38" height="26" rx="1.5" fill="url(#tp-shirt-r)"/>
    <rect x="194" y="93" width="20" height="26" fill="rgba(0,0,0,0.12)"/>
    <line x1="195" y1="93" x2="195" y2="119" stroke="rgba(0,0,0,0.18)" stroke-width="0.8"/>
    <rect x="166" y="93" width="9" height="23" rx="1.5" fill="#236b48"/>
    <rect x="170" y="93" width="5" height="23" fill="rgba(0,0,0,0.1)"/>
    <rect x="215" y="93" width="9" height="23" rx="1.5" fill="#1b5438"/>
    <rect x="179" y="121" width="12" height="18" rx="1.5" fill="url(#tp-pant-r)"/>
    <rect x="193" y="121" width="12" height="18" rx="1.5" fill="url(#tp-pant-r)"/>
    <rect x="196" y="121" width="9" height="18" fill="rgba(0,0,0,0.14)"/>
    <ellipse cx="195" cy="140" rx="18" ry="3" fill="rgba(0,0,0,0.3)"/>
  </g>
  <circle cx="130" cy="80" r="1.4" fill="rgba(255,255,255,0.3)" style="animation:tp-sparkle 3.2s cubic-bezier(0.34,1.56,0.64,1) infinite 1.6s;transform-origin:130px 80px;"/>
  <circle cx="26" cy="100" r="1.6" fill="#c4b5fd" filter="url(#tp-glow-xs)" style="animation:tp-sparkle 2.8s cubic-bezier(0.34,1.56,0.64,1) infinite 0.9s;transform-origin:26px 100px;"/>
  <circle cx="234" cy="96" r="1.6" fill="#fcd34d" filter="url(#tp-glow-xs)" style="animation:tp-sparkle 2.8s cubic-bezier(0.34,1.56,0.64,1) infinite 0.2s;transform-origin:234px 96px;"/>
</svg>`;
    }

    /* ─── 6. Title (Replace Design) ─── */
    function svgTitleReplace() {
        return `<svg viewBox="0 0 260 146" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tr-body" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#78350f"/><stop offset="100%" stop-color="#92400e"/>
    </linearGradient>
    <linearGradient id="tr-border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(244,196,48,0.2)"/>
      <stop offset="50%" stop-color="rgba(244,196,48,0.85)"/>
      <stop offset="100%" stop-color="rgba(244,196,48,0.2)"/>
    </linearGradient>
    <linearGradient id="tr-sh" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.15)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <radialGradient id="tr-amb" cx="50%" cy="38%" r="52%">
      <stop offset="0%" stop-color="rgba(180,83,9,0.11)"/><stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <filter id="tr-glow" x="-40%" y="-100%" width="180%" height="300%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="tr-sm" x="-50%" y="-80%" width="200%" height="260%">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="tr-clip"><rect x="28" y="46" width="204" height="54" rx="10"/></clipPath>
    <style>
      @keyframes tr-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes tr-shimmer{0%{transform:translateX(-210px)}100%{transform:translateX(450px)}}
      @keyframes tr-gp{0%,100%{opacity:0.32}50%{opacity:0.78}}
      @keyframes tr-line{0%,100%{opacity:0.35}50%{opacity:0.8}}
      @keyframes tr-sp{0%,100%{transform:scale(0);opacity:0}45%{transform:scale(1.15);opacity:1}60%{transform:scale(0.92);opacity:0.9}}
      @keyframes tr-dot{0%,100%{transform:scale(0.8);opacity:0.4}50%{transform:scale(1.05);opacity:0.9}}
    </style>
  </defs>
  <rect width="260" height="146" fill="#080c12"/>
  <rect width="260" height="146" fill="url(#tr-amb)"/>
  <text x="130" y="19" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="4.8" fill="#3b2000" letter-spacing="0.12em">CUSTOM DESIGN</text>
  <line x1="20" y1="24" x2="240" y2="24" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <g style="animation:tr-float 3.2s ease-in-out infinite;transform-origin:130px 73px">
    <rect x="28" y="46" width="204" height="54" rx="10" fill="#b45309" filter="url(#tr-glow)" style="animation:tr-gp 3.2s ease-in-out infinite;"/>
    <rect x="28" y="46" width="204" height="54" rx="10" fill="url(#tr-body)"/>
    <rect x="28" y="46" width="204" height="17" rx="10" fill="rgba(255,255,255,0.11)"/>
    <rect x="28" y="57" width="204" height="8" fill="rgba(255,255,255,0.04)"/>
    <rect x="28" y="46" width="204" height="54" rx="10" fill="none" stroke="url(#tr-border)" stroke-width="1.5"/>
    <line x1="44" y1="60" x2="216" y2="60" stroke="rgba(244,196,48,0.18)" stroke-width="0.8" style="animation:tr-line 3.2s ease-in-out infinite;"/>
    <line x1="44" y1="90" x2="216" y2="90" stroke="rgba(244,196,48,0.18)" stroke-width="0.8" style="animation:tr-line 3.2s ease-in-out infinite 0.6s;"/>
    <polygon points="35,73 41,66 47,73 41,80" fill="rgba(244,196,48,0.7)"/>
    <polygon points="225,73 219,66 213,73 219,80" fill="rgba(244,196,48,0.7)"/>
    <text x="130" y="80" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="14" fill="#f4c430" letter-spacing="0.08em">[CLAN]</text>
    <rect x="-210" y="46" width="210" height="54" fill="url(#tr-sh)" clip-path="url(#tr-clip)" style="animation:tr-shimmer 4.2s ease-in-out infinite 1.2s;"/>
  </g>
  <text x="130" y="114" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="7.5" fill="#3d4a5e">Teks, warna, dan desain bisa dikustomisasi penuh</text>
  <circle cx="112" cy="131" r="4.5" fill="#f4c430" filter="url(#tr-sm)" style="animation:tr-dot 2.8s ease-in-out infinite 0s;transform-origin:112px 131px"/>
  <circle cx="130" cy="131" r="4.5" fill="#c084fc" filter="url(#tr-sm)" style="animation:tr-dot 2.8s ease-in-out infinite 0.35s;transform-origin:130px 131px"/>
  <circle cx="148" cy="131" r="4.5" fill="#ff8a65" filter="url(#tr-sm)" style="animation:tr-dot 2.8s ease-in-out infinite 0.7s;transform-origin:148px 131px"/>
  <circle cx="22" cy="48" r="1.8" fill="#f4c430" filter="url(#tr-sm)" style="animation:tr-sp 3s ease-in-out infinite 0.4s;transform-origin:22px 48px"/>
  <circle cx="238" cy="48" r="1.8" fill="#f4c430" filter="url(#tr-sm)" style="animation:tr-sp 3s ease-in-out infinite 1.2s;transform-origin:238px 48px"/>
</svg>`;
    }

    /* ─── 7. All Custom Bundle ─── */
    function svgBundle() {
        return `<svg viewBox="0 0 260 146" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bn-nt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#5b21b6"/>
    </linearGradient>
    <linearGradient id="bn-tl" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#78350f"/><stop offset="100%" stop-color="#92400e"/>
    </linearGradient>
    <linearGradient id="bn-tl-border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(244,196,48,0.25)"/>
      <stop offset="50%" stop-color="rgba(244,196,48,0.8)"/>
      <stop offset="100%" stop-color="rgba(244,196,48,0.25)"/>
    </linearGradient>
    <radialGradient id="bn-amb-l" cx="28%" cy="50%" r="38%">
      <stop offset="0%" stop-color="rgba(109,40,217,0.1)"/><stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="bn-amb-r" cx="72%" cy="50%" r="38%">
      <stop offset="0%" stop-color="rgba(180,83,9,0.09)"/><stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <filter id="bn-glow-p" x="-30%" y="-70%" width="160%" height="240%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="bn-glow-g" x="-30%" y="-70%" width="160%" height="240%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="bn-sm" x="-50%" y="-80%" width="200%" height="260%">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      @keyframes bn-fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
      @keyframes bn-fr{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
      @keyframes bn-gp{0%,100%{opacity:0.32}50%{opacity:0.8}}
      @keyframes bn-gg{0%,100%{opacity:0.28}50%{opacity:0.7}}
      @keyframes bn-plus{0%,100%{opacity:0.28;transform:scale(0.92)}50%{opacity:0.7;transform:scale(1)}}
      @keyframes bn-sp{0%,100%{transform:scale(0);opacity:0}45%{transform:scale(1.2);opacity:1}60%{transform:scale(0.9);opacity:0.85}}
    </style>
  </defs>
  <rect width="260" height="146" fill="#080c12"/>
  <rect width="260" height="146" fill="url(#bn-amb-l)"/>
  <rect width="260" height="146" fill="url(#bn-amb-r)"/>
  <text x="130" y="19" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="4.8" fill="#2d3748" letter-spacing="0.1em">PAKET LENGKAP</text>
  <line x1="20" y1="24" x2="240" y2="24" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <line x1="130" y1="28" x2="130" y2="108" stroke="rgba(255,255,255,0.04)" stroke-width="1" stroke-dasharray="3 4"/>
  <text x="65" y="32" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="3.8" fill="#3d2d6a" letter-spacing="0.06em">NAMETAG</text>
  <text x="195" y="32" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="3.8" fill="#5a3a00" letter-spacing="0.06em">TITLE</text>
  <g style="animation:bn-fl 3.2s ease-in-out infinite;transform-origin:65px 68px">
    <rect x="8" y="38" width="114" height="60" rx="9" fill="#6d28d9" filter="url(#bn-glow-p)" style="animation:bn-gp 3.2s ease-in-out infinite;"/>
    <rect x="8" y="38" width="114" height="60" rx="9" fill="url(#bn-nt)"/>
    <rect x="8" y="38" width="114" height="18" rx="9" fill="rgba(255,255,255,0.1)"/>
    <rect x="8" y="38" width="114" height="60" rx="9" fill="none" stroke="rgba(196,132,252,0.5)" stroke-width="1.3"/>
    <text x="65" y="73" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="14" font-weight="800" fill="#f5f3ff" letter-spacing="0.05em">PlayerName</text>
  </g>
  <text x="130" y="72" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="24" font-weight="200" fill="#2d3748" style="animation:bn-plus 2.8s ease-in-out infinite;transform-origin:130px 68px">+</text>
  <g style="animation:bn-fr 3.2s ease-in-out infinite 1.1s;transform-origin:195px 68px">
    <rect x="138" y="38" width="114" height="60" rx="9" fill="#b45309" filter="url(#bn-glow-g)" style="animation:bn-gg 3.2s ease-in-out infinite 1.1s;"/>
    <rect x="138" y="38" width="114" height="60" rx="9" fill="url(#bn-tl)"/>
    <rect x="138" y="38" width="114" height="18" rx="9" fill="rgba(255,255,255,0.1)"/>
    <rect x="138" y="38" width="114" height="60" rx="9" fill="none" stroke="url(#bn-tl-border)" stroke-width="1.3"/>
    <text x="195" y="73" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="10" fill="#f4c430" letter-spacing="0.05em">[CLAN]</text>
  </g>
  <text x="130" y="117" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="7.5" fill="#3d4a5e">Hemat Rp15.000 dibanding beli terpisah</text>
  <circle cx="22" cy="42" r="1.8" fill="#c084fc" filter="url(#bn-sm)" style="animation:bn-sp 3s ease-in-out infinite 0.2s;transform-origin:22px 42px"/>
  <circle cx="238" cy="42" r="1.8" fill="#f4c430" filter="url(#bn-sm)" style="animation:bn-sp 3s ease-in-out infinite 1s;transform-origin:238px 42px"/>
  <circle cx="130" cy="107" r="1.5" fill="rgba(255,255,255,0.3)" style="animation:bn-sp 3s ease-in-out infinite 1.8s;transform-origin:130px 107px"/>
</svg>`;
    }

    /* ─── 8. Gem Coins ─── */
    function svgGemCoins() {
        return `<svg viewBox="0 0 260 146" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gc-amb" cx="50%" cy="44%" r="50%">
      <stop offset="0%" stop-color="rgba(109,40,217,0.15)"/><stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <filter id="gc-glow" x="-60%" y="-100%" width="220%" height="300%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="gc-sm" x="-60%" y="-100%" width="220%" height="300%">
      <feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      @keyframes gc-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
      @keyframes gc-glow{0%,100%{opacity:0.38}50%{opacity:0.9}}
      @keyframes gc-shine{0%,100%{opacity:0.12}50%{opacity:0.38}}
      @keyframes gc-sp{0%,100%{transform:scale(0);opacity:0}45%{transform:scale(1.2);opacity:1}60%{transform:scale(0.9);opacity:0.85}}
    </style>
  </defs>
  <rect width="260" height="146" fill="#080c12"/>
  <rect width="260" height="146" fill="url(#gc-amb)"/>
  <g style="animation:gc-float 3.8s ease-in-out infinite;transform-origin:130px 64px">
    <ellipse cx="130" cy="97" rx="36" ry="7" fill="#7c3aed" filter="url(#gc-glow)" style="animation:gc-glow 3.8s ease-in-out infinite;"/>
    <polygon points="130,22 106,54 130,48 154,54" fill="#a855f7" opacity="0.95"/>
    <polygon points="130,22 106,54 88,54" fill="#c084fc" opacity="0.68"/>
    <polygon points="130,22 154,54 172,54" fill="#7c3aed" opacity="0.78"/>
    <polygon points="88,54 106,54 130,96" fill="#6d28d9" opacity="0.88"/>
    <polygon points="106,54 130,48 130,96" fill="#7c3aed" opacity="0.96"/>
    <polygon points="130,48 154,54 130,96" fill="#5b21b6" opacity="0.9"/>
    <polygon points="154,54 172,54 130,96" fill="#4c1d95" opacity="0.84"/>
    <polyline points="130,22 88,54 130,96 172,54 130,22" fill="none" stroke="rgba(196,132,252,0.4)" stroke-width="1.2"/>
    <line x1="88" y1="54" x2="172" y2="54" stroke="rgba(196,132,252,0.3)" stroke-width="1"/>
    <line x1="130" y1="22" x2="130" y2="48" stroke="rgba(196,132,252,0.25)" stroke-width="0.8"/>
    <line x1="106" y1="54" x2="130" y2="48" stroke="rgba(196,132,252,0.2)" stroke-width="0.8"/>
    <line x1="154" y1="54" x2="130" y2="48" stroke="rgba(196,132,252,0.2)" stroke-width="0.8"/>
    <polygon points="130,22 106,54 130,48" fill="rgba(255,255,255,0.24)" style="animation:gc-shine 4s ease-in-out infinite;"/>
    <circle cx="130" cy="22" r="2.8" fill="rgba(255,255,255,0.9)" filter="url(#gc-sm)"/>
    <circle cx="88" cy="54" r="1.5" fill="rgba(196,132,252,0.65)" filter="url(#gc-sm)"/>
    <circle cx="172" cy="54" r="1.5" fill="rgba(196,132,252,0.65)" filter="url(#gc-sm)"/>
  </g>
  <text x="130" y="116" text-anchor="middle" font-family="'Press Start 2P',monospace" font-size="8.5" fill="#c084fc" letter-spacing="0.06em">GEM COINS</text>
  <text x="130" y="131" text-anchor="middle" font-family="'Nunito',sans-serif" font-size="7.5" fill="#3d4a5e">Mata uang Gacha in-game · Rp600 / koin</text>
  <circle cx="52" cy="36" r="1.8" fill="#c084fc" filter="url(#gc-sm)" style="animation:gc-sp 3.2s ease-in-out infinite 0.3s;transform-origin:52px 36px"/>
  <circle cx="208" cy="32" r="1.8" fill="#c084fc" filter="url(#gc-sm)" style="animation:gc-sp 3.2s ease-in-out infinite 1.1s;transform-origin:208px 32px"/>
  <circle cx="36" cy="90" r="1.3" fill="#a78bfa" style="animation:gc-sp 3.2s ease-in-out infinite 1.8s;transform-origin:36px 90px"/>
  <circle cx="224" cy="88" r="1.3" fill="#a78bfa" style="animation:gc-sp 3.2s ease-in-out infinite 0.7s;transform-origin:224px 88px"/>
</svg>`;
    }

    /* ── Map item id → SVG generator ── */
    const SVG_MAP = {
        1: svgNameChat,
        2: svgNamePlayer,
        3: svgNameReplace,
        4: svgTitleChat,
        5: svgTitlePlayer,
        6: svgTitleReplace,
        7: svgBundle,
        8: svgGemCoins,
    };

    /* ── Animated thumbnail html ── */
    function animThumbHtml(item) {
        const gen = SVG_MAP[item.id];
        if (!gen) return "";
        return `<div class="shop-anim-thumb">${gen()}</div>`;
    }

    /* ── Feature list ── */
    function featHtml(item) {
        if (!item.features || !item.features.length) return "";
        return `<ul class="shop-feat-list">${item.features.map(f => `<li>${f}</li>`).join("")}</ul>`;
    }

    /* ── Build card ── */
    window.shopBuildCard = function buildCard(item) {
        const sold = item.stock === "Habis";
        const origHtml =
            item.originalPrice && item.originalPrice > item.price
                ? `<span class="shop-price-orig">${fmtPlain(item.originalPrice)}</span>`
                : "";
        return `<div class="shop-card${sold ? " shop-sold-out" : ""}" data-category="${item.category}">
    ${badgeHtml(item, "position:absolute;top:12px;right:12px;z-index:2;")}
    ${animThumbHtml(item)}
    <div class="shop-card-name">${item.name}</div>
    <div class="shop-card-cat">${item.category}</div>
    <div class="shop-card-desc">${item.description}</div>
    ${featHtml(item)}
    <div class="shop-card-footer">
      <div class="shop-card-price">${fmtPrice(item.price)}${origHtml}</div>
      ${
          sold
              ? `<button class="shop-btn shop-btn-sold" disabled>HABIS</button>`
              : `<button class="shop-btn shop-btn-buy" onclick="shopOpenModal(${item.id})">Pesan</button>`
      }
    </div>
  </div>`;
    };

    /* ── Gallery html (for modal) ── */
    function galleryHtml(item) {
        const gen = SVG_MAP[item.id];
        if (gen) return `<div class="shop-modal-anim">${gen()}</div>`;
        return "";
    }

    /* ── Design notice ── */
    function designNoticeHtml(item) {
        if (!item.requiresDesign) return "";
        return `<div class="shop-design-notice">
    <div class="shop-design-icon">✏️</div>
    <div>
      <div class="shop-design-title">Syarat Sebelum Memesan</div>
      <p class="shop-design-text">Siapkan desain terlebih dahulu — buat sendiri atau gunakan jasa desain. Setelah pesan, kirimkan <strong>file dokumen 1:1</strong> langsung ke admin via WhatsApp.</p>
      <a href="https://afarhansib.github.io/tiro/" target="_blank" rel="noopener" class="shop-design-link">🎨 Buat Desain di Tiro</a>
    </div>
  </div>`;
    }

    /* ── Build modal ── */
    function buildModal(item) {
        const canQty = item.canBuyMultiple !== false;
        const maxQty = item.maxQuantity || 99;

        const qtySection = canQty
            ? `
    <div class="shop-modal-sec">
      <div class="shop-modal-label">JUMLAH</div>
      <div class="shop-qty-wrap">
        <button class="shop-qty-btn" onclick="shopQtyChange(-1)">−</button>
        <input class="shop-qty-input" id="order-qty" type="number" value="1" min="1" max="${maxQty}" oninput="shopQtyInput(this,${maxQty})">
        <button class="shop-qty-btn" onclick="shopQtyChange(1)">+</button>
      </div>
      <div style="font-size:0.72rem;color:var(--s-muted);margin-top:5px">Maks. ${maxQty} per pesanan</div>
    </div>`
            : "";

        const userSection = item.needsUsername
            ? `
    <div class="shop-modal-sec">
      <div class="shop-modal-label">USERNAME MINECRAFT <span style="color:var(--s-red)">*</span></div>
      <input class="shop-input" id="order-username" type="text" placeholder="Contoh: Steve123" maxlength="50" autocomplete="off">
    </div>`
            : "";

        const notePlaceholder = item.requiresDesign
            ? "Catatan tambahan (opsional). File desain 1:1 dikirim langsung di chat WA."
            : "Tulis catatan jika ada...";
        const noteSection = `
    <div class="shop-modal-sec">
      <div class="shop-modal-label">CATATAN <span style="color:var(--s-muted);font-size:0.6rem">(opsional)</span></div>
      <textarea class="shop-input shop-textarea" id="order-note" placeholder="${notePlaceholder}" maxlength="500" rows="2"></textarea>
    </div>`;

        const totalSection = `
    <div class="shop-modal-sec shop-total-sec" style="margin-top:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="shop-modal-label" style="margin:0">${canQty ? "TOTAL" : "HARGA"}</span>
        <span id="modal-total" style="font-family:'Press Start 2P',monospace;font-size:0.82rem;color:var(--s-purple)">…</span>
      </div>
    </div>`;

        const origBadge =
            item.originalPrice && item.originalPrice > item.price
                ? `<span style="font-size:0.7rem;color:var(--s-muted);text-decoration:line-through;margin-left:6px;vertical-align:top">${fmtPlain(item.originalPrice)}</span>`
                : "";

        return `<div id="shop-modal-overlay" class="shop-modal-overlay" onclick="shopCloseModal()">
    <div class="shop-modal-box" onclick="event.stopPropagation()" data-price="${item.price}" data-itemid="${item.id}" data-canbuy="${!!item.canBuyMultiple}" data-max="${maxQty}" id="shop-order-form">
      <button class="shop-modal-close" onclick="shopCloseModal()">✕</button>
      <div style="text-align:center;margin-bottom:16px;">
        ${badgeHtml(item, "margin-bottom:6px")}
        <div class="shop-modal-name">${item.name}</div>
        <div class="shop-card-cat" style="margin-top:4px">${item.category}</div>
        <div style="font-family:'Press Start 2P',monospace;font-size:0.7rem;color:var(--s-gold);margin-top:8px;">${fmtPlain(item.price)}${origBadge}</div>
      </div>
      ${item.description ? `<div class="shop-modal-sec"><div class="shop-modal-text">${item.description}</div></div>` : ""}
      ${item.features && item.features.length ? `<div class="shop-modal-sec"><ul class="shop-feat-list" style="display:flex;">${item.features.map(f => `<li>${f}</li>`).join("")}</ul></div>` : ""}
      ${galleryHtml(item)}
      ${designNoticeHtml(item)}
      <div style="border-top:1px solid var(--s-border);margin-top:18px;padding-top:14px">
        <div style="font-family:'Press Start 2P',monospace;font-size:0.52rem;color:var(--s-muted);margin-bottom:10px;letter-spacing:0.06em;">📋 FORM PESANAN</div>
        ${qtySection}
        ${userSection}
        ${noteSection}
        ${totalSection}
        <div class="shop-err" id="shop-form-error"></div>
        <button class="shop-wa-btn" onclick="shopOrderWA(${item.id})">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          LANJUT KE PEMBAYARAN
        </button>
        <div style="text-align:center;font-size:0.72rem;color:var(--s-muted);margin-top:8px;">Bayar via QRIS → kirim bukti ke WhatsApp Admin.</div>
      </div>
    </div>
  </div>`;
    }

    /* ── Gallery navigation ── */
    window.shopGalleryNav = function (id, dir) {
        const g = document.getElementById("gal-" + id);
        if (!g) return;
        const imgs = g.querySelectorAll(".shop-gallery-img");
        const dots = g.querySelectorAll(".shop-gallery-dot");
        let cur = Array.from(imgs).findIndex(i => i.classList.contains("active"));
        imgs[cur].classList.remove("active");
        if (dots[cur]) dots[cur].classList.remove("active");
        cur = (cur + dir + imgs.length) % imgs.length;
        imgs[cur].classList.add("active");
        if (dots[cur]) dots[cur].classList.add("active");
    };
    window.shopGalleryGoto = function (id, idx) {
        const g = document.getElementById("gal-" + id);
        if (!g) return;
        g.querySelectorAll(".shop-gallery-img").forEach((el, i) => el.classList.toggle("active", i === idx));
        g.querySelectorAll(".shop-gallery-dot").forEach((el, i) => el.classList.toggle("active", i === idx));
    };

    /* ── Qty controls ── */
    window.shopQtyChange = function (delta) {
        const input = document.getElementById("order-qty");
        if (!input) return;
        const max = parseInt(document.getElementById("shop-order-form")?.dataset.max) || 99;
        input.value = Math.max(1, Math.min(max, (parseInt(input.value) || 1) + delta));
        updateTotal();
    };
    window.shopQtyInput = function (el, max) {
        el.value = Math.max(1, Math.min(max, parseInt(el.value) || 1));
        updateTotal();
    };

    /* ── Update total display ── */
    function updateTotal() {
        const form = document.getElementById("shop-order-form");
        const tot = document.getElementById("modal-total");
        if (!form || !tot) return;
        if (form.dataset.canbuy !== "true") return;
        const qty = parseInt(document.getElementById("order-qty")?.value) || 1;
        const itemId = parseInt(form.dataset.itemid) || 0;
        const liveItem = window.SHOP_CONFIG?.items?.find(i => i.id === itemId);
        const livePrice = liveItem ? liveItem.price : parseInt(form.dataset.price) || 0;
        tot.textContent = fmtPlain(livePrice * qty);
    }

    /* ── Admin WA numbers ── */
    const SHOP_ADMINS = [
        { name: "Blackdamen", number: "+6282323645879" },
        { name: "Zoe", number: "+6285246205803" },
        { name: "Nuna", number: "+6285186844434" },
    ];
    const SHOP_ADMIN_GEM = { name: "Baim", number: "+6282172955865" };
    const GEM_ITEM_ID = 8;

    /* ── Send WA order ── */
    /* ── Pending order (disimpan sementara setelah validasi form) ── */
    window._pendingWAOrder = null;

    window.shopOrderWA = function (id) {
        const _src =
            window._shopItemsFromSupabase && window._shopItemsFromSupabase.length
                ? window._shopItemsFromSupabase
                : SHOP_CONFIG.items;
        const item = _src.find(i => i.id === id);
        if (!item) return;

        const errEl = document.getElementById("shop-form-error");
        errEl.style.display = "none";

        const unEl = document.getElementById("order-username");
        if (item.needsUsername && (!unEl || !unEl.value.trim())) {
            errEl.textContent = "Harap isi username Minecraft kamu.";
            errEl.style.display = "block";
            unEl?.focus();
            return;
        }

        const qty = item.canBuyMultiple ? parseInt(document.getElementById("order-qty")?.value) || 1 : 1;
        const un = unEl?.value.trim() || "";
        const note = document.getElementById("order-note")?.value.trim() || "";

        const _wa = window._supabaseWA;
        const _admins = _wa && _wa.main && _wa.main.length ? _wa.main : SHOP_ADMINS;
        const _gem = _wa && _wa.gem && _wa.gem.length ? _wa.gem[0] : SHOP_ADMIN_GEM;
        const admin = item.id === GEM_ITEM_ID ? _gem : _admins[Math.floor(Math.random() * _admins.length)];

        const _lines = [
            `Halo *${admin.name}* 👋`,
            "",
            `Saya mau pesan dari *Laughtale Store*:`,
            "",
            `🛒 *${item.name}*`,
            `📂 Kategori : ${item.category}`,
        ];
        if (item.canBuyMultiple) _lines.push(`📦 Jumlah   : ${qty}x`);
        _lines.push(`💰 Total    : *${fmtPlain(item.price * qty)}*`);
        if (un) _lines.push(`👤 Username : ${un}`);
        if (note) _lines.push(`📝 Catatan  : ${note}`);
        if (item.requiresDesign) {
            _lines.push("");
            _lines.push("📎 File desain akan saya kirimkan langsung di sini.");
        }
        _lines.push("");
        _lines.push("💳 *Bukti pembayaran QRIS* terlampir.");
        _lines.push("");
        _lines.push("Terima kasih! 🙏");

        const msg = _lines.join("\n");
        const totalAmount = fmtPlain(item.price * qty);

        /* Simpan pending order (url + data untuk Supabase), lalu tampilkan QRIS step */
        window._pendingWAOrder = {
            url: "https://wa.me/" + admin.number.replace(/\D/g, "") + "?text=" + encodeURIComponent(msg),
            orderData: {
                item_id:        String(item.id),
                item_name:      item.name,
                item_emoji:     item.emoji || "🛒",
                item_category:  item.category,
                qty:            qty,
                unit_price:     item.price,
                total_price:    item.price * qty,
                username:       un || null,
                customer_note:  note || null,
                wa_admin_name:  admin.name,
                wa_admin_number: admin.number,
                status:         "pending",
            },
        };
        shopShowQRIS(totalAmount, item.price === 0);
    };

    /* ── Tampilkan QRIS payment step di dalam modal box ── */
    window.shopShowQRIS = function (totalAmount, isFree) {
        const box = document.getElementById("shop-order-form");
        if (!box) return;

        /* Determine QRIS image path relative to page */
        const qrisImg = (function () {
            /* coba dari root, fallback ke assets/ */
            const scripts = document.querySelectorAll("script[src]");
            for (const s of scripts) {
                if (s.src && s.src.includes("shop.js")) {
                    const base = s.src.replace(/js\/shop\.js.*$/, "");
                    return base + "assets/Laughtale-Qris-Payment.jpeg";
                }
            }
            return "assets/Laughtale-Qris-Payment.jpeg";
        })();

        const freeNote = `<div class="shop-qris-note">Item ini <strong>GRATIS</strong> — tidak perlu pembayaran.<br>Langsung kirim konfirmasi ke WhatsApp Admin.</div>`;
        const qrisContent = isFree ? freeNote : `
            <div class="shop-qris-img-wrap">
                <img src="${qrisImg}" alt="QRIS Laughtale SMP" loading="lazy">
            </div>
            <div class="shop-qris-steps">
                <div class="shop-qris-step">
                    <div class="shop-qris-step-num">1</div>
                    <div class="shop-qris-step-text">Buka aplikasi dompet digital atau mobile banking kamu, lalu <strong>scan kode QRIS</strong> di atas.</div>
                </div>
                <div class="shop-qris-step">
                    <div class="shop-qris-step-num">2</div>
                    <div class="shop-qris-step-text">Transfer tepat <strong>${totalAmount}</strong> sesuai total pesanan.</div>
                </div>
                <div class="shop-qris-step">
                    <div class="shop-qris-step-num">3</div>
                    <div class="shop-qris-step-text">Klik tombol di bawah, lalu <strong>kirim screenshot bukti bayar</strong> ke WhatsApp Admin.</div>
                </div>
            </div>
            <div class="shop-qris-note">⚠️ <strong>Pesanan belum diproses</strong> sebelum admin menerima bukti pembayaran.</div>`;

        box.innerHTML = `
            <button class="shop-modal-close" onclick="shopCloseModal()">✕</button>
            <div style="text-align:center;margin-bottom:16px;">
                <div style="font-family:'Press Start 2P',monospace;font-size:0.52rem;color:var(--s-muted);letter-spacing:0.1em;margin-bottom:8px;">LANGKAH 2 / 2</div>
                <div style="font-family:'Press Start 2P',monospace;font-size:0.72rem;color:var(--s-text);line-height:1.6;">PEMBAYARAN QRIS</div>
            </div>
            <div class="shop-qris-wrap">
                <div class="shop-qris-total-box">
                    <div class="shop-qris-total-label">TOTAL PEMBAYARAN</div>
                    <div class="shop-qris-total-amount">${totalAmount}</div>
                </div>
                ${qrisContent}
                <button class="shop-wa-btn-confirm" onclick="shopPaidGoWA()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    SUDAH BAYAR — KIRIM BUKTI KE WA
                </button>
                <button class="shop-qris-back" onclick="shopCloseModal()">← Batalkan</button>
            </div>`;

        /* Scroll ke atas modal box */
        box.scrollTop = 0;
    };

    /* ── Setelah user klik "Sudah Bayar", simpan ke Supabase lalu buka WhatsApp ── */
    window.shopPaidGoWA = async function () {
        if (!window._pendingWAOrder) return;
        const { url, orderData } = window._pendingWAOrder;

        /* Simpan ke tabel orders (anon insert, RLS allow) */
        try {
            const SUPABASE_URL = "https://jlxtnbnrirxhwuyqjlzw.supabase.co";
            const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI";
            await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "Prefer": "return=minimal",
                },
                body: JSON.stringify(orderData),
            });
        } catch (err) {
            /* Jangan blokir user — order tetap dikirim ke WA meskipun DB error */
            console.warn("[shop.js] Gagal simpan order ke DB:", err.message);
        }

        window.open(url, "_blank", "noopener");
        window._pendingWAOrder = null;
        window.shopCloseModal();
    };

    /* ── Open / close modal ── */
    window.shopOpenModal = function (id) {
        const _src =
            window._shopItemsFromSupabase && window._shopItemsFromSupabase.length
                ? window._shopItemsFromSupabase
                : SHOP_CONFIG.items;
        const item = _src.find(i => i.id === id);
        if (!item) return;
        document.getElementById("shop-modal-overlay")?.remove();
        document.body.insertAdjacentHTML("beforeend", buildModal(item));
        requestAnimationFrame(() => {
            document.getElementById("shop-modal-overlay")?.classList.add("open");
            updateTotal();
        });
        document.body.style.overflow = "hidden";
    };
    window.shopCloseModal = function () {
        const ov = document.getElementById("shop-modal-overlay");
        if (ov) {
            ov.classList.remove("open");
            setTimeout(() => ov.remove(), 260);
        }
        document.body.style.overflow = "";
    };
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") window.shopCloseModal();
    });

    /* ── Render shop ── */
    function renderShop() {
        const cfg = SHOP_CONFIG;
        if (!cfg || !cfg.items) return;
        const titleEl = document.getElementById("shop-section-title");
        const subtitleEl = document.getElementById("shop-section-subtitle");
        const tabsEl = document.getElementById("shop-tabs");
        const gridEl = document.getElementById("shop-grid");
        if (titleEl) titleEl.textContent = cfg.title;
        if (subtitleEl) subtitleEl.textContent = cfg.subtitle;
        if (!tabsEl || !gridEl) return;
        tabsEl.insertAdjacentHTML(
            "beforebegin",
            `
    <div class="shop-join-info">
      <span style="font-size:1.1rem;flex-shrink:0">📢</span>
      <span>Pendaftaran untuk <strong>masuk server</strong> hanya bisa dilakukan melalui <strong>Grup WhatsApp Community</strong> — bukan Discord atau platform lain.</span>
    </div>`,
        );
        tabsEl.innerHTML = cfg.categories
            .map((c, i) => `<button class="shop-tab${i === 0 ? " active" : ""}" data-cat="${c}">${c}</button>`)
            .join("");
        gridEl.innerHTML = cfg.items.map(buildCard).join("");
        tabsEl.addEventListener("click", e => {
            const btn = e.target.closest(".shop-tab");
            if (!btn) return;
            tabsEl.querySelectorAll(".shop-tab").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const cat = btn.dataset.cat;
            gridEl.querySelectorAll(".shop-card").forEach(c => {
                c.style.display = cat === "Semua" || c.dataset.category === cat ? "" : "none";
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderShop);
    } else {
        renderShop();
    }

    /* ── Re-render saat Supabase selesai fetch ── */
    var _shopRendered = false;

    document.addEventListener("shopItemsReady", function (e) {
        var items = e.detail && e.detail.items;
        if (!items || !items.length) return;
        if (window.SHOP_CONFIG) window.SHOP_CONFIG.items = items;
        var gridEl = document.getElementById("shop-grid");
        if (!gridEl) return;
        var tabsEl = document.getElementById("shop-tabs");
        var activeCat =
            tabsEl && tabsEl.querySelector(".shop-tab.active")
                ? tabsEl.querySelector(".shop-tab.active").dataset.cat
                : "Semua";
        gridEl.innerHTML = items.map(buildCard).join("");
        if (activeCat && activeCat !== "Semua") {
            gridEl.querySelectorAll(".shop-card").forEach(function (card) {
                card.style.display = card.dataset.category === activeCat ? "" : "none";
            });
        }
        _shopRendered = true;
        console.log("[shop.js] ✅ Grid & SHOP_CONFIG sinkron dari DB (" + items.length + " item).");
    });

    /* ── Fallback: 4 detik tanpa response DB → pakai harga statis ── */
    setTimeout(function () {
        if (!_shopRendered) {
            console.warn("[shop.js] ⚠️ DB timeout — harga dari shop-config.js (statis).");
        }
    }, 4000);
})();