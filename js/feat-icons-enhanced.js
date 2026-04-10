/**
 * feat-icons-enhanced.js
 * Drop this into your js/ folder and add:
 * <script src="js/feat-icons-enhanced.js"></script>
 * AFTER your existing scripts in index.html
 *
 * Replaces all 14 feat-icon SVGs with premium pixel-art designs.
 */
(function () {
  /* ── Inject CSS animations ── */
  const style = document.createElement('style');
  style.id = 'feat-icons-css';
  style.textContent = `
    @keyframes fia-spin  { to { transform: rotate(360deg); } }
    @keyframes fia-rspin { to { transform: rotate(-360deg); } }
    @keyframes fia-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    @keyframes fia-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.65;transform:scale(1.15)} }
    @keyframes fia-opulse{ 0%,100%{opacity:0.25} 50%{opacity:0.8} }
    @keyframes fia-swing { 0%,100%{transform:rotate(-14deg)} 50%{transform:rotate(14deg)} }
    @keyframes fia-blink { 0%,80%,100%{transform:scaleY(1)} 85%,95%{transform:scaleY(0.06)} }
    @keyframes fia-scan  { 0%{transform:translateY(-6px);opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{transform:translateY(22px);opacity:0} }
    @keyframes fia-glow  { 0%,100%{opacity:0.3} 50%{opacity:1} }
    @keyframes fia-rise  { 0%{transform:translateY(6px);opacity:0} 40%{opacity:0.9} 100%{transform:translateY(-10px);opacity:0} }
    @keyframes fia-chip  { 0%{transform:translate(0,0) rotate(0deg);opacity:0.8} 100%{transform:translate(var(--cx,6px),var(--cy,-10px)) rotate(40deg);opacity:0} }
    @keyframes fia-flame { 0%,100%{transform:scaleY(1) scaleX(1)} 50%{transform:scaleY(1.12) scaleX(0.92)} }
    @keyframes fia-coinx { 0%,100%{transform:scaleX(1)} 50%{transform:scaleX(0.05)} }
    @keyframes fia-treecap {
      0%,28%  { transform:rotate(0deg); }
      32%     { transform:rotate(5deg); }
      52%     { transform:rotate(72deg); }
      70%     { transform:rotate(72deg); }
      80%     { transform:rotate(-4deg); }
      90%     { transform:rotate(1.5deg); }
      100%    { transform:rotate(0deg); }
    }
  `;
  document.head.appendChild(style);

  /* ── Helper: wrap group that spins around SVG centre (24 24) ── */
  const spinGroup = (content, dur, delay, anim = 'fia-spin') =>
    `<g style="transform-origin:24px 24px;animation:${anim} ${dur}s linear infinite${delay ? ';animation-delay:' + delay + 's' : ''}">${content}</g>`;

  /* ── 14 icon strings ── */
  const icons = [

    /* 01 ─ CLAIM LAND ──────────────────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- rotating dashed protection ring -->
      ${spinGroup(`<circle cx="24" cy="26" r="21" stroke="currentColor" stroke-width="1.1" stroke-dasharray="5 4" opacity="0.28"/>`, 14, 0)}
      <!-- ground -->
      <rect x="6" y="40" width="36" height="4" rx="2" fill="currentColor" opacity="0.18"/>
      <!-- house body -->
      <rect x="10" y="24" width="28" height="18" rx="2" fill="currentColor" opacity="0.18" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <!-- door -->
      <rect x="19" y="31" width="10" height="11" rx="1.5" fill="currentColor" opacity="0.55"/>
      <circle cx="27" cy="37" r="1" fill="currentColor" opacity="1"/>
      <!-- window L -->
      <rect x="12" y="27" width="6" height="6" rx="1" fill="currentColor" opacity="0.35" stroke="currentColor" stroke-width="1" opacity="0.6"/>
      <line x1="15" y1="27" x2="15" y2="33" stroke="currentColor" stroke-width="0.9"/>
      <line x1="12" y1="30" x2="18" y2="30" stroke="currentColor" stroke-width="0.9"/>
      <!-- window R -->
      <rect x="30" y="27" width="6" height="6" rx="1" fill="currentColor" opacity="0.35" stroke="currentColor" stroke-width="1"/>
      <line x1="33" y1="27" x2="33" y2="33" stroke="currentColor" stroke-width="0.9"/>
      <line x1="30" y1="30" x2="36" y2="30" stroke="currentColor" stroke-width="0.9"/>
      <!-- roof triangle (3-layer pixel style) -->
      <polygon points="24,6 8,24 40,24" fill="currentColor" opacity="0.85"/>
      <polygon points="24,9 10,24 38,24" fill="currentColor" opacity="0.55"/>
      <polygon points="24,12 12,24 36,24" fill="currentColor" opacity="0.25"/>
      <!-- chimney -->
      <rect x="28" y="11" width="5" height="8" rx="1" fill="currentColor" opacity="0.8"/>
      <!-- smoke puff -->
      <circle cx="30" cy="9" r="2" fill="currentColor" opacity="0" style="animation:fia-rise 2.5s ease-out infinite"/>
      <!-- shield badge top-right -->
      <path d="M36 3 L42 5.5 L42 12 L36 15.5 L30 12 L30 5.5 Z" fill="currentColor" opacity="0.95" stroke="currentColor" stroke-width="0.6"/>
      <polyline points="33,10 35.5,12.5 39.5,7.5" stroke="rgba(0,0,0,0.6)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,

    /* 02 ─ BACKPACK ────────────────────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation:fia-float 3s ease-in-out infinite">
      <!-- top handle arch -->
      <path d="M19 12 Q24 7 29 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.9"/>
      <!-- shoulder strap left -->
      <path d="M14 14 C12 22 12 30 14 36" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.55"/>
      <!-- shoulder strap right -->
      <path d="M34 14 C36 22 36 30 34 36" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.55"/>
      <!-- main bag -->
      <rect x="10" y="13" width="28" height="28" rx="5" fill="currentColor" opacity="0.18"/>
      <rect x="10" y="13" width="28" height="28" rx="5" stroke="currentColor" stroke-width="1.8"/>
      <!-- top zipper seam -->
      <line x1="14" y1="20" x2="34" y2="20" stroke="currentColor" stroke-width="1" opacity="0.45"/>
      <!-- front pocket -->
      <rect x="14" y="26" width="20" height="12" rx="3" fill="currentColor" opacity="0.22"/>
      <rect x="14" y="26" width="20" height="12" rx="3" stroke="currentColor" stroke-width="1.4"/>
      <!-- pocket zip -->
      <line x1="17" y1="31" x2="31" y2="31" stroke="currentColor" stroke-width="1.1" stroke-dasharray="2 2.5" opacity="0.7"/>
      <!-- zip pull tab -->
      <rect x="22" y="28" width="4" height="3" rx="1.5" fill="currentColor" opacity="0.75"/>
      <!-- stitching dots on main bag -->
      <line x1="13" y1="13" x2="13" y2="41" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2 4" opacity="0.3"/>
      <line x1="35" y1="13" x2="35" y2="41" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2 4" opacity="0.3"/>
      <!-- reflective stripe -->
      <line x1="14" y1="22" x2="34" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    </svg>`,

    /* 03 ─ TREE CAPITATOR ──────────────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- stump (stays put after tree falls) -->
      <rect x="17" y="37" width="8" height="6" rx="1" fill="currentColor" opacity="0.45"/>
      <!-- stump growth rings -->
      <ellipse cx="21" cy="37" rx="3.2" ry="0.9" fill="none" stroke="currentColor" stroke-width="0.7" opacity="0.3"/>
      <ellipse cx="21" cy="37" rx="1.6" ry="0.5" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.25"/>
      <!-- ground line -->
      <rect x="4" y="43" width="40" height="2.5" rx="1.25" fill="currentColor" opacity="0.18"/>
      <!-- FALLING TREE GROUP — pivots at stump base -->
      <g style="transform-origin:21px 37px;animation:fia-treecap 3s cubic-bezier(.22,1,.36,1) infinite">
        <!-- trunk -->
        <rect x="18" y="24" width="6" height="14" rx="1" fill="currentColor" opacity="0.72"/>
        <!-- wood grain lines on trunk -->
        <line x1="19" y1="28" x2="23" y2="28" stroke="currentColor" stroke-width="0.7" opacity="0.25"/>
        <line x1="19" y1="32" x2="23" y2="32" stroke="currentColor" stroke-width="0.7" opacity="0.2"/>
        <!-- foliage layer 3 — bottom widest -->
        <polygon points="21,18 5,30 37,30" fill="currentColor" opacity="0.46"/>
        <!-- foliage layer 2 — middle -->
        <polygon points="21,11 7,22 35,22" fill="currentColor" opacity="0.66"/>
        <!-- foliage layer 1 — top smallest -->
        <polygon points="21,4 11,16 31,16" fill="currentColor" opacity="0.88"/>
      </g>
      <!-- falling leaf squares (scatter as tree falls) -->
      <rect x="13" y="19" width="3"   height="3"   rx="0.5" fill="currentColor" opacity="0" style="--cx:-9px;--cy:-10px;animation:fia-chip 2.4s ease-out 0.55s infinite"/>
      <rect x="29" y="23" width="2.5" height="2.5" rx="0.4" fill="currentColor" opacity="0" style="--cx:10px;--cy:-7px;animation:fia-chip 2.4s ease-out 0.85s infinite"/>
      <rect x="7"  y="25" width="2"   height="2"   rx="0.3" fill="currentColor" opacity="0" style="--cx:-6px;--cy:-12px;animation:fia-chip 2.4s ease-out 1.15s infinite"/>
      <rect x="33" y="15" width="2"   height="2"   rx="0.3" fill="currentColor" opacity="0" style="--cx:7px;--cy:-9px;animation:fia-chip 2.4s ease-out 0.3s infinite"/>
    </svg>`,

    /* 04 ─ PLAYER TITLE & NAMETAG ──────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- floating nametag -->
      <g style="animation:fia-float 2.8s ease-in-out infinite">
        <rect x="4" y="3" width="40" height="14" rx="4" fill="currentColor" opacity="0.18"/>
        <rect x="4" y="3" width="40" height="14" rx="4" stroke="currentColor" stroke-width="1.4"/>
        <!-- name line 1 -->
        <line x1="10" y1="9" x2="30" y2="9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
        <!-- name line 2 -->
        <line x1="10" y1="13" x2="22" y2="13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>
        <!-- star crown badge -->
        <path d="M36 4.5 L37.5 8 L41 7.5 L38.5 10 L40 13.5 L36 11 L32 13.5 L33.5 10 L31 7.5 L34.5 8 Z" fill="currentColor" opacity="0.9"/>
      </g>
      <!-- connector dashes -->
      <line x1="24" y1="17" x2="24" y2="22" stroke="currentColor" stroke-width="1.1" stroke-dasharray="2 2.5" opacity="0.45"/>
      <!-- minecraft player head -->
      <rect x="14" y="22" width="20" height="20" rx="2" fill="currentColor" opacity="0.18" stroke="currentColor" stroke-width="1.6"/>
      <!-- head pixels: eyes -->
      <rect x="17" y="27" width="5" height="4" rx="0.8" fill="currentColor" opacity="0.75"/>
      <rect x="26" y="27" width="5" height="4" rx="0.8" fill="currentColor" opacity="0.75"/>
      <!-- mouth -->
      <rect x="19" y="33" width="10" height="3" rx="0.5" fill="currentColor" opacity="0.55"/>
      <!-- hair top -->
      <rect x="14" y="22" width="20" height="4" rx="2" fill="currentColor" opacity="0.45"/>
      <!-- body/shirt bottom -->
      <rect x="17" y="42" width="14" height="5" rx="1.5" fill="currentColor" opacity="0.4"/>
    </svg>`,

    /* 05 ─ PLAYER PARTICLE ─────────────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- outer pulse ring -->
      <circle cx="24" cy="24" r="21" stroke="currentColor" stroke-width="1" opacity="0.2" style="animation:fia-opulse 3s ease-in-out infinite"/>
      <circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="0.8" opacity="0.15" style="animation:fia-opulse 3s ease-in-out infinite;animation-delay:0.5s"/>
      <!-- 4 main rays (slow cw) -->
      ${spinGroup(`
        <line x1="24" y1="3" x2="24" y2="10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>
        <line x1="24" y1="38" x2="24" y2="45" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>
        <line x1="3" y1="24" x2="10" y2="24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>
        <line x1="38" y1="24" x2="45" y2="24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>
      `, 9, 0, 'fia-spin')}
      <!-- 4 diagonal rays (fast ccw) -->
      ${spinGroup(`
        <line x1="11" y1="11" x2="16" y2="16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.65"/>
        <line x1="32" y1="32" x2="37" y2="37" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.65"/>
        <line x1="37" y1="11" x2="32" y2="16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.65"/>
        <line x1="11" y1="37" x2="16" y2="32" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.65"/>
      `, 6, 0, 'fia-rspin')}
      <!-- 3 orbiting dots at radius 13 -->
      ${spinGroup(`<circle cx="24" cy="11" r="3.2" fill="currentColor" opacity="0.95"/>`, 2, 0)}
      ${spinGroup(`<circle cx="24" cy="11" r="2.6" fill="currentColor" opacity="0.75"/>`, 2, -0.67)}
      ${spinGroup(`<circle cx="24" cy="11" r="2" fill="currentColor" opacity="0.55"/>`, 2, -1.33)}
      <!-- core glow -->
      <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.85" style="animation:fia-pulse 2s ease-in-out infinite"/>
      <circle cx="24" cy="24" r="3" fill="currentColor" opacity="1"/>
    </svg>`,

    /* 06 ─ BANNED BUNDLE ───────────────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- bundle cloth bag -->
      <ellipse cx="24" cy="30" rx="16" ry="12" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.5"/>
      <!-- fabric folds -->
      <path d="M10 28 Q14 22 24 24 Q34 22 38 28" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.45"/>
      <path d="M11 32 Q17 28 24 30 Q31 28 37 32" stroke="currentColor" stroke-width="1" fill="none" opacity="0.3"/>
      <!-- tie knot top -->
      <path d="M20 19 Q24 15 28 19 L26 23 Q24 21 22 23 Z" fill="currentColor" opacity="0.85"/>
      <!-- strings -->
      <line x1="22" y1="19" x2="18" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
      <line x1="26" y1="19" x2="30" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
      <!-- BIG prohibition circle (pulsing) -->
      <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="3" opacity="0.9" fill="none" style="animation:fia-opulse 1.8s ease-in-out infinite"/>
      <!-- diagonal slash -->
      <line x1="6" y1="6" x2="42" y2="42" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" style="animation:fia-opulse 1.8s ease-in-out infinite"/>
    </svg>`,

    /* 07 ─ X-RAY TRACKING ──────────────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- target corner brackets -->
      <path d="M4 12 L4 4 L12 4"  stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85"/>
      <path d="M36 4 L44 4 L44 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85"/>
      <path d="M4 36 L4 44 L12 44" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85"/>
      <path d="M36 44 L44 44 L44 36" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85"/>
      <!-- eye whites -->
      <path d="M4 24 Q24 6 44 24 Q24 42 4 24 Z" fill="currentColor" opacity="0.12"/>
      <path d="M4 24 Q24 6 44 24 Q24 42 4 24 Z" stroke="currentColor" stroke-width="1.8" opacity="0.9"/>
      <!-- iris ring -->
      <circle cx="24" cy="24" r="9.5" fill="currentColor" opacity="0.2"/>
      <circle cx="24" cy="24" r="9.5" stroke="currentColor" stroke-width="1.4" opacity="0.9"/>
      <!-- scan line (moves top→bottom through eye) -->
      <line x1="10" y1="20" x2="38" y2="20" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.7" style="animation:fia-scan 2.2s ease-in-out infinite"/>
      <!-- pupil (pulse) -->
      <circle cx="24" cy="24" r="4.5" fill="currentColor" opacity="0.9" style="animation:fia-pulse 2s ease-in-out infinite"/>
      <!-- specular dot -->
      <circle cx="21" cy="21" r="1.5" fill="currentColor" opacity="0.55"/>
      <!-- eyelid blink top arc -->
      <path d="M4 24 Q24 6 44 24" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.35" style="transform-origin:24px 24px;animation:fia-blink 5s ease-in-out infinite"/>
    </svg>`,

    /* 08 ─ THE END PROTECTION ──────────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- outer gear teeth ring (slow spin) -->
      ${spinGroup(`
        <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.2" stroke-dasharray="5 3" opacity="0.35"/>
        <!-- gear teeth (8 positions) -->
        <rect x="22" y="0"  width="4" height="5" rx="1" fill="currentColor" opacity="0.5"/>
        <rect x="22" y="43" width="4" height="5" rx="1" fill="currentColor" opacity="0.5"/>
        <rect x="0"  y="22" width="5" height="4" rx="1" fill="currentColor" opacity="0.5"/>
        <rect x="43" y="22" width="5" height="4" rx="1" fill="currentColor" opacity="0.5"/>
        <rect x="5"  y="5"  width="4" height="4" rx="1" fill="currentColor" opacity="0.4" transform="rotate(45 7 7)"/>
        <rect x="39" y="5"  width="4" height="4" rx="1" fill="currentColor" opacity="0.4" transform="rotate(45 41 7)"/>
        <rect x="5"  y="39" width="4" height="4" rx="1" fill="currentColor" opacity="0.4" transform="rotate(45 7 41)"/>
        <rect x="39" y="39" width="4" height="4" rx="1" fill="currentColor" opacity="0.4" transform="rotate(45 41 41)"/>
      `, 14, 0)}
      <!-- portal frame blocks -->
      <rect x="13" y="9"  width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="30" y="9"  width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="13" y="34" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="30" y="34" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="8"  y="14" width="5" height="20" rx="1" fill="currentColor" opacity="0.4"/>
      <rect x="35" y="14" width="5" height="20" rx="1" fill="currentColor" opacity="0.4"/>
      <!-- ender eye (elongated) -->
      <ellipse cx="24" cy="22" rx="9" ry="11" fill="currentColor" opacity="0.2"/>
      <ellipse cx="24" cy="22" rx="9" ry="11" stroke="currentColor" stroke-width="1.6" opacity="0.9"/>
      <!-- iris -->
      <ellipse cx="24" cy="22" rx="5" ry="6.5" fill="currentColor" opacity="0.6" style="animation:fia-pulse 3s ease-in-out infinite"/>
      <!-- pupil slit -->
      <ellipse cx="24" cy="22" rx="1.8" ry="3.5" fill="currentColor" opacity="1"/>
      <!-- specular -->
      <ellipse cx="21.5" cy="19" rx="1.5" ry="2" fill="currentColor" opacity="0.4"/>
      <!-- shield bottom -->
      <path d="M24 33 L29 35.5 L29 41 L24 44 L19 41 L19 35.5 Z" fill="currentColor" opacity="0.9"/>
      <polyline points="21.5,39 23.5,41.5 27,37" stroke="rgba(0,0,0,0.55)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,

    /* 09 ─ ADDON DUDUK & GENDONG ───────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- ═══ CARRIER (bottom player, strong stance) ═══ -->
      <!-- head -->
      <rect x="15" y="20" width="10" height="10" rx="2" fill="currentColor" opacity="0.85"/>
      <!-- face eyes -->
      <rect x="17" y="23" width="2" height="2" rx="0.4" fill="currentColor" opacity="0.35"/>
      <rect x="21" y="23" width="2" height="2" rx="0.4" fill="currentColor" opacity="0.35"/>
      <!-- smile -->
      <path d="M18 27 Q20 29 22 27" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.5"/>
      <!-- body torso -->
      <rect x="14" y="30" width="12" height="11" rx="2" fill="currentColor" opacity="0.65"/>
      <!-- arms raised (carrying) -->
      <line x1="14" y1="32" x2="7"  y2="25" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>
      <line x1="26" y1="32" x2="33" y2="25" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>
      <!-- legs -->
      <line x1="17" y1="41" x2="14" y2="47" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>
      <line x1="23" y1="41" x2="26" y2="47" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>

      <!-- ═══ PASSENGER (top player, being carried) ═══ -->
      <!-- head -->
      <rect x="24" y="4" width="9" height="9" rx="2" fill="currentColor" opacity="0.75"/>
      <!-- face (happy) -->
      <rect x="26" y="7" width="1.8" height="1.8" rx="0.3" fill="currentColor" opacity="0.3"/>
      <rect x="29" y="7" width="1.8" height="1.8" rx="0.3" fill="currentColor" opacity="0.3"/>
      <path d="M26 10.5 Q28.5 12.5 31 10.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.45"/>
      <!-- body  -->
      <rect x="23" y="13" width="11" height="9" rx="2" fill="currentColor" opacity="0.55"/>
      <!-- arms out for balance -->
      <line x1="23" y1="15" x2="17" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
      <line x1="34" y1="15" x2="40" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
      <!-- legs dangling -->
      <line x1="26" y1="22" x2="24" y2="29" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.65"/>
      <line x1="31" y1="22" x2="33" y2="29" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.65"/>

      <!-- floating heart -->
      <path d="M8 9 Q9.5 6.5 11 9 Q12.5 6.5 14 9 L11 13 Z" fill="currentColor" opacity="0.8" style="animation:fia-pulse 2.2s ease-in-out infinite"/>
    </svg>`,

    /* 10 ─ DRAGON FINAL BOSS ───────────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- dragon head shape -->
      <path d="M6 22 L8 12 L16 8 L32 8 L40 12 L42 22 L36 30 L12 30 Z"
            fill="currentColor" opacity="0.18" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <!-- horns (big) -->
      <path d="M15 8 L11 1 L19 7"  fill="currentColor" opacity="0.9"/>
      <path d="M33 8 L37 1 L29 7"  fill="currentColor" opacity="0.9"/>
      <!-- horns (small side) -->
      <path d="M10 10 L6 4  L13 9"  fill="currentColor" opacity="0.6"/>
      <path d="M38 10 L42 4 L35 9" fill="currentColor" opacity="0.6"/>
      <!-- spikes on top -->
      <path d="M20 8 L22 4 L24 8" fill="currentColor" opacity="0.5"/>
      <path d="M24 8 L26 4 L28 8" fill="currentColor" opacity="0.5"/>
      <!-- eyes (glow pulse) -->
      <ellipse cx="16" cy="19" rx="5.5" ry="5" fill="currentColor" opacity="0.25"/>
      <ellipse cx="16" cy="19" rx="5.5" ry="5" stroke="currentColor" stroke-width="1.3"/>
      <ellipse cx="16" cy="19" rx="2.8" ry="3.2" fill="currentColor" opacity="0.9" style="animation:fia-pulse 1.6s ease-in-out infinite"/>
      <ellipse cx="32" cy="19" rx="5.5" ry="5" fill="currentColor" opacity="0.25"/>
      <ellipse cx="32" cy="19" rx="5.5" ry="5" stroke="currentColor" stroke-width="1.3"/>
      <ellipse cx="32" cy="19" rx="2.8" ry="3.2" fill="currentColor" opacity="0.9" style="animation:fia-pulse 1.6s ease-in-out infinite;animation-delay:0.2s"/>
      <!-- nostrils -->
      <ellipse cx="20" cy="26" rx="2" ry="1.5" fill="currentColor" opacity="0.55"/>
      <ellipse cx="28" cy="26" rx="2" ry="1.5" fill="currentColor" opacity="0.55"/>
      <!-- teeth row -->
      <path d="M12 30 L14 36 L17 30" fill="currentColor" opacity="0.85"/>
      <path d="M19 30 L21 35 L23 30" fill="currentColor" opacity="0.75"/>
      <path d="M25 30 L27 35 L29 30" fill="currentColor" opacity="0.75"/>
      <path d="M31 30 L33 36 L36 30" fill="currentColor" opacity="0.85"/>
      <!-- fire breath -->
      <path d="M19 35 Q14 42 19 47 Q24 50 29 47 Q34 42 29 35 Q24 39 19 35 Z" fill="currentColor" opacity="0.7" style="transform-origin:24px 40px;animation:fia-flame 1.1s ease-in-out infinite"/>
      <path d="M21 37 Q18 43 24 46 Q30 43 27 37 Q24 40 21 37 Z" fill="currentColor" opacity="0.45" style="transform-origin:24px 41px;animation:fia-flame 1.1s ease-in-out infinite;animation-delay:0.25s"/>
    </svg>`,

    /* 11 ─ SLEEP 20% ───────────────────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- large moon crescent -->
      <path d="M14 7 A17 17 0 1 1 14 41 A11 11 0 1 0 14 7 Z" fill="currentColor" opacity="0.9"/>
      <!-- moon surface crater circles -->
      <circle cx="12" cy="22" r="3" fill="currentColor" opacity="0.3"/>
      <circle cx="18" cy="30" r="2" fill="currentColor" opacity="0.25"/>
      <circle cx="9"  cy="32" r="1.5" fill="currentColor" opacity="0.2"/>
      <!-- stars -->
      <circle cx="36" cy="7"  r="2.2" fill="currentColor" opacity="0.9" style="animation:fia-glow 2.2s ease-in-out infinite"/>
      <circle cx="43" cy="16" r="1.5" fill="currentColor" opacity="0.7" style="animation:fia-glow 2.8s ease-in-out infinite;animation-delay:0.4s"/>
      <circle cx="40" cy="28" r="1.2" fill="currentColor" opacity="0.5" style="animation:fia-glow 1.9s ease-in-out infinite;animation-delay:0.9s"/>
      <circle cx="44" cy="36" r="1.8" fill="currentColor" opacity="0.6" style="animation:fia-glow 2.5s ease-in-out infinite;animation-delay:1.3s"/>
      <!-- mini bed -->
      <rect x="28" y="42" width="16" height="5"  rx="2.5" fill="currentColor" opacity="0.45"/>
      <rect x="28" y="38" width="5"  height="9"  rx="2"   fill="currentColor" opacity="0.5"/>
      <rect x="39" y="38" width="5"  height="9"  rx="2"   fill="currentColor" opacity="0.5"/>
      <rect x="30" y="39" width="9"  height="7"  rx="1.5" fill="currentColor" opacity="0.3"/>
      <!-- floating Z letters -->
      <text fill="currentColor" font-family="'Press Start 2P', 'Courier New', monospace" font-size="8" x="33" y="30" opacity="0" style="animation:fia-rise 2s ease-in-out infinite">Z</text>
      <text fill="currentColor" font-family="'Press Start 2P', 'Courier New', monospace" font-size="6" x="38" y="23" opacity="0" style="animation:fia-rise 2s ease-in-out infinite;animation-delay:0.55s">Z</text>
      <text fill="currentColor" font-family="'Press Start 2P', 'Courier New', monospace" font-size="4.5" x="43" y="17" opacity="0" style="animation:fia-rise 2s ease-in-out infinite;animation-delay:1.1s">Z</text>
    </svg>`,

    /* 12 ─ ACHIEVEMENT ON ──────────────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- rotating sparkle rays behind trophy -->
      ${spinGroup(`
        <line x1="24" y1="2"  x2="24" y2="8"  stroke="currentColor" stroke-width="2"   stroke-linecap="round" opacity="0.55"/>
        <line x1="24" y1="36" x2="24" y2="42" stroke="currentColor" stroke-width="2"   stroke-linecap="round" opacity="0.55"/>
        <line x1="2"  y1="22" x2="8"  y2="22" stroke="currentColor" stroke-width="2"   stroke-linecap="round" opacity="0.55"/>
        <line x1="38" y1="22" x2="44" y2="22" stroke="currentColor" stroke-width="2"   stroke-linecap="round" opacity="0.55"/>
        <line x1="7"  y1="7"  x2="11" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
        <line x1="37" y1="33" x2="41" y2="37" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
        <line x1="41" y1="7"  x2="37" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
        <line x1="7"  y1="37" x2="11" y2="33" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
      `, 12, 0)}
      <!-- trophy cup body -->
      <path d="M12 5 L12 22 Q12 33 24 33 Q36 33 36 22 L36 5 Z"
            fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <!-- cup rim line -->
      <line x1="12" y1="5" x2="36" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
      <!-- handles -->
      <path d="M12 8 Q4 8 4 17 Q4 24 12 22"  stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.85"/>
      <path d="M36 8 Q44 8 44 17 Q44 24 36 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.85"/>
      <!-- stem -->
      <rect x="21" y="33" width="6" height="6" rx="1" fill="currentColor" opacity="0.7"/>
      <!-- base plate -->
      <rect x="14" y="39" width="20" height="5" rx="2.5" fill="currentColor" opacity="0.85"/>
      <!-- star inside cup (glow) -->
      <path d="M24 11 L26 17 L32.5 17 L27.2 21 L29.2 27 L24 23 L18.8 27 L20.8 21 L15.5 17 L22 17 Z"
            fill="currentColor" opacity="0.9" style="animation:fia-glow 1.8s ease-in-out infinite"/>
    </svg>`,

    /* 13 ─ GILDED DROP-XP SYSTEM ───────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- XP orb (floating) -->
      <g style="animation:fia-float 2.2s ease-in-out infinite">
        <circle cx="35" cy="13" r="10" fill="currentColor" opacity="0.2"/>
        <circle cx="35" cy="13" r="10" stroke="currentColor" stroke-width="1.6" opacity="0.9"/>
        <!-- inner glow ring -->
        <circle cx="35" cy="13" r="6.5" fill="currentColor" opacity="0.25"/>
        <!-- XP text -->
        <text fill="currentColor" font-family="'Press Start 2P','Courier New',monospace" font-size="6" font-weight="bold" x="29.5" y="16" opacity="0.9">XP</text>
        <!-- specular shine -->
        <circle cx="31" cy="9" r="2.5" fill="currentColor" opacity="0.35"/>
      </g>
      <!-- gold coin (front face, pulsing) -->
      <circle cx="19" cy="31" r="14" fill="currentColor" opacity="0.18"/>
      <circle cx="19" cy="31" r="14" stroke="currentColor" stroke-width="2.2" opacity="0.95"/>
      <!-- coin inner ring -->
      <circle cx="19" cy="31" r="9.5" stroke="currentColor" stroke-width="1" opacity="0.45"/>
      <!-- G letter inside -->
      <text fill="currentColor" font-family="'Press Start 2P','Courier New',monospace" font-size="9" font-weight="bold" x="13.5" y="35" opacity="0.85" style="animation:fia-coinx 2.5s ease-in-out infinite">G</text>
      <!-- sparkle particles -->
      <circle cx="40" cy="32" r="1.8" fill="currentColor" opacity="0.75" style="animation:fia-glow 1.4s ease-in-out infinite"/>
      <circle cx="9"  cy="18" r="1.2" fill="currentColor" opacity="0.55" style="animation:fia-glow 2s ease-in-out infinite;animation-delay:0.5s"/>
      <circle cx="5"  cy="32" r="1.5" fill="currentColor" opacity="0.45" style="animation:fia-glow 1.7s ease-in-out infinite;animation-delay:1s"/>
      <circle cx="38" cy="46" r="1"   fill="currentColor" opacity="0.4"  style="animation:fia-glow 2.3s ease-in-out infinite;animation-delay:0.7s"/>
      <!-- drop line connecting XP to coin -->
      <path d="M27 22 Q23 26 22 30" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 3" opacity="0.4" fill="none"/>
    </svg>`,

    /* 14 ─ INGAME GACHA ────────────────────────────────────────── */
    `<svg class="fi-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- machine body -->
      <rect x="4" y="7" width="34" height="37" rx="5" fill="currentColor" opacity="0.16"/>
      <rect x="4" y="7" width="34" height="37" rx="5" stroke="currentColor" stroke-width="1.8"/>
      <!-- top panel -->
      <rect x="7" y="10" width="28" height="9" rx="3" fill="currentColor" opacity="0.2"/>
      <rect x="7" y="10" width="28" height="9" rx="3" stroke="currentColor" stroke-width="1.1" opacity="0.6"/>
      <!-- ? in top panel (animate) -->
      <text fill="currentColor" font-family="'Press Start 2P','Courier New',monospace" font-size="7.5" font-weight="bold" x="17.5" y="18" opacity="0.9" style="animation:fia-pulse 2.4s ease-in-out infinite">?</text>
      <!-- 3 reel windows -->
      <rect x="7"  y="22" width="8" height="10" rx="2" fill="currentColor" opacity="0.18"/>
      <rect x="7"  y="22" width="8" height="10" rx="2" stroke="currentColor" stroke-width="1.2"/>
      <rect x="18" y="22" width="8" height="10" rx="2" fill="currentColor" opacity="0.18"/>
      <rect x="18" y="22" width="8" height="10" rx="2" stroke="currentColor" stroke-width="1.2"/>
      <rect x="29" y="22" width="8" height="10" rx="2" fill="currentColor" opacity="0.18"/>
      <rect x="29" y="22" width="8" height="10" rx="2" stroke="currentColor" stroke-width="1.2"/>
      <!-- reel symbols (spinning up) -->
      <text fill="currentColor" font-family="monospace" font-size="7" x="9.5"  y="29.5" opacity="0.85" style="animation:fia-rise 1.9s linear infinite">★</text>
      <text fill="currentColor" font-family="monospace" font-size="7" x="20.5" y="29.5" opacity="0.85" style="animation:fia-rise 1.9s linear infinite;animation-delay:0.45s">♦</text>
      <text fill="currentColor" font-family="monospace" font-size="7" x="31.5" y="29.5" opacity="0.85" style="animation:fia-rise 1.9s linear infinite;animation-delay:0.9s">★</text>
      <!-- win line -->
      <line x1="6" y1="27" x2="38" y2="27" stroke="currentColor" stroke-width="0.9" stroke-dasharray="2 3" opacity="0.4"/>
      <!-- draw button -->
      <rect x="8" y="35" width="26" height="7" rx="3.5" fill="currentColor" opacity="0.55"/>
      <rect x="8" y="35" width="26" height="7" rx="3.5" stroke="currentColor" stroke-width="1" opacity="0.7"/>
      <text fill="rgba(0,0,0,0.6)" font-family="'Press Start 2P','Courier New',monospace" font-size="4.5" x="12" y="40.5" font-weight="bold">DRAW!</text>
      <!-- lever (outside right) -->
      <line x1="38" y1="13" x2="45" y2="24" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" style="transform-origin:38px 13px;animation:fia-swing 2s ease-in-out infinite"/>
      <circle cx="45" cy="24" r="4" fill="currentColor" opacity="0.85" style="transform-origin:38px 13px;animation:fia-swing 2s ease-in-out infinite"/>
      <!-- coin drop slot bottom -->
      <rect x="16" y="44" width="10" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>
      <!-- sparkle particles (random) -->
      <circle cx="2"  cy="20" r="1.5" fill="currentColor" opacity="0.5" style="animation:fia-glow 1.3s ease-in-out infinite"/>
      <circle cx="2"  cy="34" r="1.2" fill="currentColor" opacity="0.4" style="animation:fia-glow 1.8s ease-in-out infinite;animation-delay:0.6s"/>
      <circle cx="46" cy="38" r="1.5" fill="currentColor" opacity="0.5" style="animation:fia-glow 2s ease-in-out infinite;animation-delay:1s"/>
    </svg>`,
  ];

  /* ── Apply icons to .feat-icon elements ── */
  document.querySelectorAll('.feat-icon').forEach(function (el, i) {
    if (icons[i] !== undefined) {
      el.innerHTML = icons[i];
    }
  });
})();
