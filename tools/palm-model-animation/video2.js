(function () {
  // Section 05 player: one timeline drives the pad (left) and the tree, then the outcome chart (right).
  const root = document.getElementById('player');
  if (!root) return;
  const DATA = JSON.parse(document.getElementById('vdata').textContent);
  const zh = () => document.body.dataset.lang !== 'en';
  const T = (a, b) => (zh() ? a : b);
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p));
  const lerp = (a, b, p) => a + (b - a) * p;
  const pc = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const low = (m) => Math.log2(m & -m);
  const f2 = (v) => (v == null ? '—' : (Math.abs(v) < 0.005 ? 0 : v).toFixed(2).replace('-', '−'));
  const pct = (v) => (v >= 0.9995 ? '100%' : (100 * v).toFixed(1) + '%');
  const FULL = 4095;

  function b64(s, Ctor) {
    const bin = atob(s), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Ctor(buf.buffer);
  }
  const KS = b64(DATA.KS, Uint16Array), DEG = b64(DATA.D, Uint8Array);

  // Unit positions in the pad frame (mm): x is shear (drawn downward), y is lateral (drawn rightward).
  const UX = [31.5, 31.5, 31.5, 31.5, 0, 0, 0, 0, -31.5, -31.5, -31.5, -31.5];
  const UY = [42, 14, -14, -42, 42, 14, -14, -42, 42, 14, -14, -42];
  const PX0 = 205, SXP = 2.15, PY0 = 238, SYP = 3.11;
  const sx = (i) => PX0 + UY[i] * SXP, sy = (i) => PY0 + UX[i] * SYP;
  const names = (mask, sep) => { const a = []; for (let i = 0; i < 12; i++) if ((mask >> i) & 1) a.push('#' + (i + 1)); return a.join(sep || (zh() ? '、' : ', ')); };
  function centroid(mask) {
    let n = 0, x = 0, y = 0;
    for (let i = 0; i < 12; i++) if ((mask >> i) & 1) { n++; x += sx(i); y += sy(i); }
    return n ? [x / n, y / n] : [PX0, PY0];
  }

  // ---------- data ----------
  const MAIN = DATA.main.rounds, HT = DATA.holdTree, LV = HT.levels;
  const holdAfter = (r) => LV[r].example.hold;
  const holdBefore = (r) => (r === 0 ? HT.root : LV[r - 1].example.hold);
  // The sample tree: each round either stabilizes (left leaf), releases (right leaf) or continues; rounds from LAST on are merged.
  const LAST = 6;

  // Monte Carlo samples: persistent ranks, the same synchronous transition as the plant.
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const R = rng(20261015), NS = 600, SAMPLES = [];
  for (let s = 0; s < NS; s++) {
    const k = []; for (let i = 0; i < 12; i++) k.push(Math.floor(R() * 1024));
    let m = FULL, failed = 0, kind, round = 0;
    for (;;) {
      if (DEG[m] && m !== FULL) { kind = 'R'; break; }
      round++;
      let f = 0; for (let i = 0; i < 12; i++) if ((m >> i) & 1 && k[i] < KS[m * 12 + i]) f |= 1 << i;
      if (!f) { kind = 'S'; break; }
      failed |= f; m &= ~f;
    }
    SAMPLES.push({ bin: kind === 'R' ? 'R' : pc(m), kind, failed, round, level: Math.min(round, LAST), jx: R() });
  }

  // ---------- timeline ----------
  const SC = [
    { id: 'intro', d: 2.5, ch: ['刺垫与载荷', 'Pad and load'] },
    { id: 'alloc', d: 3, ch: ['第 1 轮', 'Round 1'] },
    { id: 'judge', r: 0, d: 4 },
    { id: 'move', r: 0, d: 2.5 },
    { id: 'judge', r: 1, d: 3, ch: ['第 2–4 轮', 'Rounds 2–4'] },
    { id: 'move', r: 1, d: 2.2 },
    { id: 'judge', r: 2, d: 3 },
    { id: 'move', r: 2, d: 2.2 },
    { id: 'judge', r: 3, d: 3 },
    { id: 'mc', d: 12, ch: ['很多样本', 'Many samples'] },
    { id: 'end', d: 1.5 },
  ];
  let acc = 0; for (const s of SC) { s.t0 = acc; acc += s.d; }
  const TOTAL = acc;
  function sceneAt(t) { for (const s of SC) if (t < s.t0 + s.d) return [s, clamp((t - s.t0) / s.d, 0, 1)]; return [SC[SC.length - 1], 1]; }

  // Monte Carlo schedule: ten slow samples, then the rest quickly.
  const SLOW = 6, FAST_FROM = 3.5, STEP = 0.18;
  const startOf = (j) => (j < SLOW ? 0.3 + j * 0.5 : FAST_FROM + ((j - SLOW) / (NS - SLOW)) * 5);
  const mcLocal = (s, p) => (s.id === 'end' ? 1e9 : p * s.d);
  const landedAt = (j) => startOf(j) + STEP * SAMPLES[j].level;
  const landedBy = (tl) => { let c = 0; for (let j = 0; j < NS; j++) if (tl >= landedAt(j)) c++; return c; };

  // ---------- pad drawing ----------
  const BAR_MIN = -2, BAR_MAX = 6, BAR_W = 54;
  const bx = (cx, v) => cx - BAR_W / 2 + ((clamp(v, BAR_MIN, BAR_MAX) - BAR_MIN) / (BAR_MAX - BAR_MIN)) * BAR_W;
  function arrowsSvg() {
    let h = '<defs><marker id="vArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="s-ink"/></marker></defs>';
    h += '<line x1="364" y1="150" x2="364" y2="320" class="s-stroke-ink" stroke-width="2.2" marker-end="url(#vArr)"/>';
    h += `<text x="364" y="138" text-anchor="middle" font-size="12" class="s-ink" font-weight="700">${T('剪切', 'shear')}</text><text x="364" y="342" text-anchor="middle" font-size="11.5" class="s-ink">90 N</text>`;
    h += '<circle cx="36" cy="232" r="11" fill="none" class="s-stroke-ink" stroke-width="1.6"/><circle cx="36" cy="232" r="3" class="s-ink"/>';
    h += `<text x="36" y="262" text-anchor="middle" font-size="11.5" class="s-ink">${T('外拉', 'pull')}</text><text x="36" y="277" text-anchor="middle" font-size="11.5" class="s-ink">8 N</text>`;
    h += '<path d="M 112 92 Q 205 64 298 92" fill="none" class="s-stroke-ink" stroke-width="1.6" marker-end="url(#vArr)"/>';
    h += `<text x="205" y="62" text-anchor="middle" font-size="11.5" class="s-muted">${T('剥离弯矩：上排受拉最大', 'peel moment: top row pulls hardest')}</text>`;
    return h;
  }
  function drawPad(st) {
    let h = arrowsSvg();
    h += '<rect x="80" y="102" width="250" height="292" rx="16" fill="none" class="s-stroke-muted" stroke-dasharray="5 4" stroke-width="1.2"/>';
    h += `<text x="12" y="24" font-size="13" font-weight="700" class="s-ink">${st.header || ''}</text>`;
    if (st.sub) h += `<text x="12" y="42" font-size="11.5" class="s-muted">${st.sub}</text>`;
    for (let i = 0; i < 12; i++) {
      const cx = sx(i), cy = sy(i), status = st.status[i], alive = status !== 'gone';
      let style;
      if (st.heat) style = `fill:var(--fail);fill-opacity:${(0.12 + 0.88 * st.heat[i]).toFixed(3)};stroke:var(--fail)`;
      else if (status === 'fail') style = 'fill:var(--fail-soft);stroke:var(--fail)';
      else if (status === 'ok') style = 'fill:var(--accent-soft);stroke:var(--accent)';
      else if (status === 'gone') style = 'fill:none;stroke:var(--muted);stroke-dasharray:3 3';
      else style = 'fill:var(--tint);stroke:var(--muted)';
      const op = st.fade && st.fade[i] != null ? st.fade[i] : 1;
      h += `<g opacity="${op.toFixed(3)}">`;
      if (st.flash && st.flash[i]) h += `<circle cx="${cx}" cy="${cy}" r="${(17 + 9 * st.flash[i]).toFixed(1)}" fill="none" style="stroke:var(--fail)" stroke-width="2" opacity="${(1 - st.flash[i]).toFixed(2)}"/>`;
      h += `<circle cx="${cx}" cy="${cy}" r="16" stroke-width="1.8" style="${style}"/>`;
      h += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10.5" font-weight="700" class="s-ink">#${i + 1}</text>`;
      if (st.heat) {
        h += `<text x="${cx}" y="${cy + 31}" text-anchor="middle" font-size="10.5" class="s-ink">${Math.round(100 * st.heat[i])}%</text>`;
      } else if (alive && st.loads) {
        const v = st.loads[i], c = st.caps ? st.caps[i] : null, by = cy + 22, x0 = cx - BAR_W / 2;
        const over = c != null && st.capOp > 0.5 && v > c;
        h += `<rect x="${x0}" y="${by}" width="${BAR_W}" height="7" rx="2" style="fill:var(--tint)"/>`;
        const z = bx(cx, 0), e = bx(cx, v);
        h += `<rect x="${Math.min(z, e)}" y="${by}" width="${Math.max(Math.abs(e - z), 0.8)}" height="7" rx="1.5" style="fill:${over ? 'var(--fail)' : 'var(--accent)'}"/>`;
        h += `<line x1="${z}" y1="${by - 2}" x2="${z}" y2="${by + 9}" class="s-stroke-muted" stroke-width="0.8"/>`;
        if (c != null && st.capOp > 0) {
          const cxp = bx(cx, c);
          h += `<line x1="${cxp}" y1="${by - 4}" x2="${cxp}" y2="${by + 11}" style="stroke:var(--ink)" stroke-width="2" opacity="${st.capOp.toFixed(2)}"/>`;
        }
        h += `<text x="${cx}" y="${by + 21}" text-anchor="middle" font-size="9.5" class="${over ? 's-fail' : 's-muted'}">${f2(v)}${c != null && st.capOp > 0.5 ? ' / ' + f2(c) : ''}</text>`;
      }
      h += '</g>';
    }
    if (st.centroid) {
      const [x, y] = st.centroid;
      h += `<g opacity="0.85"><line x1="${x - 6}" y1="${y - 6}" x2="${x + 6}" y2="${y + 6}" style="stroke:var(--amber)" stroke-width="2.2"/><line x1="${x - 6}" y1="${y + 6}" x2="${x + 6}" y2="${y - 6}" style="stroke:var(--amber)" stroke-width="2.2"/>`;
      h += '</g>';
    }
    if (st.banner) h += `<text x="205" y="428" text-anchor="middle" font-size="15" font-weight="700" class="${st.banner[1]}">${st.banner[0]}</text>`;
    const legend = st.heat ? T('颜色越深 = 这个单元在样本里失效得越频繁', 'darker = the unit failed in more of the samples')
      : st.loads ? T('条 = 法向力，黑竖线 = 此刻容量，数字 = 力 / 容量，× = 存活形心', 'bar = normal force · tick = capacity · load / capacity · × = centroid') : '';
    if (legend) h += `<text x="205" y="456" text-anchor="middle" font-size="10.5" class="s-muted">${legend}</text>`;
    return h;
  }
  const loadsOf = (r) => r.units.map((u) => (u ? u.n : 0));
  const capsOf = (r) => r.units.map((u) => (u ? u.cap : null));
  const statusFor = (mask, failMask, failStatus) => { const a = []; for (let i = 0; i < 12; i++) a.push(!((mask >> i) & 1) ? 'gone' : (failMask >> i) & 1 ? failStatus : 'idle'); return a; };
  const mix = (a, b, p) => a.map((v, i) => (v == null || b[i] == null ? (b[i] == null ? v : b[i]) : lerp(v, b[i], p)));
  const survLine = (n, hold) => T(`存活 ${n} 个 · 此刻存活概率 ${pct(hold)}`, `${n} holding · survival now ${pct(hold)}`);

  function padState(s, p) {
    const hdr = (r, what) => T(`第 ${r} 轮 · ${what[0]}`, `Round ${r} · ${what[1]}`);
    switch (s.id) {
      case 'intro':
        return { header: T('刺垫（从墙外看）', 'The pad (seen from outside the wall)'), sub: T('12 个单元：3 排（剪切方向）× 4 列（侧向）', '12 units: 3 rows (shear) × 4 columns (lateral)'), status: new Array(12).fill('idle'), centroid: centroid(FULL) };
      case 'alloc': {
        const tt = p * s.d, g = ease(tt / 1);
        return { header: hdr(1, ['分配', 'allocate']), sub: survLine(12, HT.root), status: new Array(12).fill('idle'), loads: loadsOf(MAIN[0]).map((v) => v * g), caps: capsOf(MAIN[0]), capOp: ease((tt - 1.2) / 0.4), centroid: centroid(FULL) };
      }
      case 'judge': {
        const r = MAIN[s.r], tt = p * s.d, k = ease(tt / 0.3), known = tt >= 1.2;
        const st = { header: hdr(s.r + 1, ['同时判定', 'judge together']), sub: survLine(pc(r.mask), known ? holdAfter(s.r) : holdBefore(s.r)), loads: loadsOf(r), caps: capsOf(r), capOp: 1, centroid: centroid(r.mask) };
        st.status = statusFor(r.mask, r.fail, k > 0.5 ? 'fail' : 'idle');
        if (!r.fail && k > 0.5) { st.status = st.status.map((x) => (x === 'gone' ? x : 'ok')); st.banner = [T(`稳定：剩 ${pc(r.mask)} 个，垫挂住`, `Stable: ${pc(r.mask)} left, the pad holds`), 's-accent']; }
        const fl = (tt * 2) % 1; st.flash = r.units.map((u, i) => ((r.fail >> i) & 1 && k > 0.5 ? fl : 0));
        return st;
      }
      case 'move': {
        const r = MAIN[s.r], nx = MAIN[s.r + 1], tt = p * s.d, fadeP = ease(tt / 0.5), mv = ease((tt - 0.5) / 1.2);
        const st = { header: T(`第 ${s.r + 1} 轮 · 一起移除，再重新分配`, `Round ${s.r + 1} · remove together, then reallocate`), sub: survLine(pc(nx.mask), holdAfter(s.r)), capOp: 1 };
        st.status = statusFor(r.mask, r.fail, 'fail').map((x, i) => ((r.fail >> i) & 1 && fadeP >= 1 ? 'gone' : x));
        st.fade = r.units.map((u, i) => ((r.fail >> i) & 1 ? 1 - 0.6 * fadeP : 1));
        st.loads = mix(loadsOf(r), loadsOf(nx), mv); st.caps = mix(capsOf(r), capsOf(nx), mv);
        const c0 = centroid(r.mask), c1 = centroid(nx.mask); st.centroid = [lerp(c0[0], c1[0], mv), lerp(c0[1], c1[1], mv)];
        return st;
      }
      default: {
        const tl = mcLocal(s, p), landed = landedBy(tl);
        if (s.id === 'mc' && tl < FAST_FROM) {
          if (tl < 0.3) return { header: T('很多样本', 'Many samples'), sub: '', status: new Array(12).fill('idle') };
          const j = clamp(Math.floor((tl - 0.3) / 0.5), 0, SLOW - 1), sm = SAMPLES[j];
          const status = []; for (let i = 0; i < 12; i++) status.push((sm.failed >> i) & 1 ? 'fail' : sm.kind === 'R' ? 'idle' : 'ok');
          const res = sm.kind === 'R' ? [T('脱落', 'released'), 's-fail'] : [T(`挂住，剩 ${sm.bin} 个`, `holds with ${sm.bin}`), 's-accent'];
          return { header: T(`样本 ${j + 1}`, `Sample ${j + 1}`), sub: T('红色 = 这个样本里失效的单元', 'red = units that failed in this sample'), status, banner: res };
        }
        const heat = new Array(12).fill(0);
        for (let n = 0; n < NS; n++) if (tl >= landedAt(n)) for (let i = 0; i < 12; i++) if ((SAMPLES[n].failed >> i) & 1) heat[i]++;
        return { header: T('很多样本：每个单元的失效频率', 'Many samples: how often each unit failed'), sub: T(`已有 ${landed} / ${NS} 个样本`, `${landed} / ${NS} samples so far`), status: new Array(12).fill('idle'), heat: heat.map((v) => (landed ? v / landed : 0)) };
      }
    }
  }

  // ---------- right panel: tree ----------
  const COL = { none: 120, path: 246, alt: 372, rest: 494 };
  const LEVY = (l) => 70 + l * 88;
  const NW = 120, NH = 34;
  const TOP_ROW = (1 << 8) | (1 << 9) | (1 << 10) | (1 << 11);
  const failLabel = (m) => (m === TOP_ROW ? T('上排全坏', 'top row fails') : T(`${names(m, ' ')} 坏`, `${names(m, ' ')} fail`));
  const ROWOF = (i) => (UX[i] < 0 ? 0 : UX[i] === 0 ? 1 : 2), COLOF = (i) => [-42, -14, 14, 42].indexOf(UY[i]);
  function icon(cx, cy, holding, now, before) {
    let h = '';
    for (let i = 0; i < 12; i++) {
      const x = cx + (COLOF(i) - 1.5) * 8, y = cy + (ROWOF(i) - 1) * 8;
      if ((now >> i) & 1) h += `<circle cx="${x}" cy="${y}" r="3.1" style="fill:var(--fail)"/>`;
      else if ((before >> i) & 1) h += `<circle cx="${x}" cy="${y}" r="2.6" style="fill:none;stroke:var(--muted)" stroke-width="1"/>`;
      else if ((holding >> i) & 1) h += `<circle cx="${x}" cy="${y}" r="3.1" style="fill:var(--ink)"/>`;
    }
    return h;
  }
  const holdCls = (v) => (v >= 0.9 ? 's-accent' : v <= 0.1 ? 's-fail' : 's-ink');
  function node(cx, cy, o) {
    let h = `<g opacity="${o.op.toFixed(3)}">`;
    const fill = o.stable ? 'fill:var(--accent-soft);stroke:var(--accent)' : 'fill:var(--surface);stroke:var(--muted)';
    const x0 = cx - NW / 2, y0 = cy - NH / 2, ic = x0 + 22, tx = x0 + 42;
    h += `<rect x="${x0}" y="${y0}" width="${NW}" height="${NH}" rx="7" style="${fill}" stroke-width="1"/>`;
    if (o.on) h += `<rect x="${x0}" y="${y0}" width="${NW}" height="${NH}" rx="7" fill="none" style="stroke:var(--ink)" stroke-width="2.6"/>`;
    if (o.rest) h += `<text x="${ic}" y="${cy + 4}" text-anchor="middle" font-size="16" class="s-muted">…</text>`;
    else h += icon(ic, cy, o.holding, o.now, o.before);
    h += `<text x="${tx}" y="${cy - 3}" font-size="10" class="s-ink">${o.label}</text>`;
    h += `<text x="${tx}" y="${cy + 12}" font-size="11" font-weight="700" class="${holdCls(o.hold)}">${T('存活', 'hold')} ${pct(o.hold)}</text>`;
    return h + '</g>';
  }
  const edge = (x1, y1, x2, y2, on, op) => `<path d="M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}" fill="none" style="stroke:${on ? 'var(--ink)' : 'var(--muted)'}" stroke-width="${on ? 2.6 : 1.1}" opacity="${(on ? 1 : 0.6) * op}"/>`;

  function drawTree(s, p) {
    let h = `<text x="10" y="22" font-size="13" font-weight="700" class="s-ink">${T('所有可能：每往下一层是一轮', 'Every possibility: one row per round')}</text>`;
    h += `<text x="10" y="40" font-size="10.5" class="s-muted">${T('节点 = 这一轮恰好坏了哪几个（红点）· 存活 = 之后最终挂住的概率', 'node = which units fail this round (red) · hold = survival probability')}</text>`;
    let levels = 0, grow = 1, chosen = 0;
    if (s.id === 'judge') { levels = s.r + 1; grow = p * s.d; chosen = s.r + (grow >= 1.2 ? 1 : 0); }
    else if (s.id === 'move') { levels = s.r + 1; chosen = s.r + 1; }
    for (let l = 0; l <= levels; l++) h += `<text x="10" y="${LEVY(l) + 4}" font-size="10.5" class="s-muted">${l === 0 ? T('开始', 'start') : T(`第 ${l} 轮`, `round ${l}`)}</text>`;
    let failedBefore = 0;
    const body = [];
    body.push(node(COL.path, LEVY(0), { op: 1, holding: FULL, now: 0, before: 0, label: T('12 个都在', 'all 12 hold'), hold: HT.root, on: true }));
    for (let l = 1; l <= levels; l++) {
      const L = LV[l - 1], parentMask = MAIN[l - 1].mask, yP = LEVY(l - 1) + NH / 2, yC = LEVY(l) - NH / 2;
      const fresh = l === levels && s.id === 'judge';
      const appear = (k) => (fresh ? ease((grow - 0.4 - 0.25 * k) / 0.35) : 1);
      const kids = [];
      if (L.none) kids.push({ x: COL.none, now: 0, label: T('无人失效', 'none fail'), hold: 1, stable: true });
      kids.push({ x: COL.path, now: L.example.fail, label: L.example.fail ? failLabel(L.example.fail) : T('无人失效', 'none fail'), hold: L.example.hold, stable: !L.example.fail, ex: true });
      kids.push({ x: COL.alt, now: L.alt.fail, label: failLabel(L.alt.fail), hold: L.alt.hold });
      kids.push({ x: COL.rest, rest: true, label: T(`其余 ${L.rest.n} 种`, `other ${L.rest.n}`), hold: L.rest.hold });
      kids.forEach((kd, k) => {
        const op = appear(k), on = kd.ex && l <= chosen;
        if (op <= 0) return;
        h += edge(COL.path, yP, kd.x, yC, on, op);
        body.push(node(kd.x, LEVY(l), { op, holding: parentMask, now: kd.now || 0, before: failedBefore, label: kd.label, hold: kd.hold, stable: kd.stable, rest: kd.rest, on }));
      });
      failedBefore |= MAIN[l - 1].fail;
    }
    return h + body.join('');
  }

  // ---------- right panel: samples flowing down the tree, plus the outcome counts ----------
  const LX = { S: 62, C: 172, R: 282 }, LY = (l) => 72 + l * 54, LW = 108, CWID = 78, BOXH = 30;
  const OUTCOMES = [12, 11, 10, 9, 8, 7, 6, 5, 4, 'R'];
  const pathPts = (sm) => {
    const pts = [[LX.C, LY(0)]];
    for (let l = 1; l < sm.level; l++) pts.push([LX.C, LY(l)]);
    pts.push([sm.kind === 'S' ? LX.S : LX.R, LY(sm.level)]);
    return pts;
  };
  function drawLadder(s, p) {
    const tl = mcLocal(s, p), fadeIn = s.id === 'end' ? 1 : ease(tl / 0.3);
    const leaf = {}, past = new Array(LAST + 1).fill(0), bins = {};
    let n = 0, held = 0;
    for (let j = 0; j < NS; j++) {
      if (tl < landedAt(j)) continue;
      const sm = SAMPLES[j];
      leaf[sm.level + sm.kind] = (leaf[sm.level + sm.kind] || 0) + 1;
      for (let l = 1; l < sm.level; l++) past[l]++;
      bins[sm.bin] = (bins[sm.bin] || 0) + 1;
      n++; if (sm.kind === 'S') held++;
    }
    const share = (c) => (n ? pct(c / n) : '—');
    let h = `<g opacity="${fadeIn.toFixed(3)}">`;
    h += `<text x="10" y="22" font-size="13" font-weight="700" class="s-ink">${T('很多样本：流过同一棵树，再按结局统计', 'Many samples: down the same tree, then counted by outcome')}</text>`;
    h += `<text x="10" y="40" font-size="10.5" class="s-muted">${T('每一轮：没人坏 → 稳定（左）· 不足 3 个 → 脱落（右）· 否则继续（中）· 数字 = 样本里的比例', 'each round: none fail → stable (left) · under 3 left → released (right) · else continue · % of samples')}</text>`;
    const box = (cx, cy, w, style, l1, l2, c1) => {
      let g = `<rect x="${cx - w / 2}" y="${cy - BOXH / 2}" width="${w}" height="${BOXH}" rx="7" style="${style}" stroke-width="1.1"/>`;
      g += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="10" font-weight="700" class="${c1}">${l1}</text>`;
      g += `<text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="9.5" class="s-ink">${l2}</text>`;
      return g;
    };
    const curve = (x1, y1, x2, y2) => `<path d="M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}" fill="none" style="stroke:var(--muted)" stroke-width="1.1" opacity="0.6"/>`;
    for (let l = 1; l <= LAST; l++) {
      const y0 = LY(l - 1) + BOXH / 2, y1 = LY(l) - BOXH / 2;
      h += curve(LX.C, y0, LX.S, y1) + curve(LX.C, y0, LX.R, y1);
      if (l < LAST) h += curve(LX.C, y0, LX.C, y1);
    }
    const nodes = [box(LX.C, LY(0), CWID, 'fill:var(--tint);stroke:var(--muted)', T('开始', 'start'), T(`${NS} 个样本`, `${NS} samples`), 's-ink')];
    for (let l = 1; l <= LAST; l++) {
      const lab = l < LAST ? T(`第 ${l} 轮`, `round ${l}`) : T(`第 ${LAST}+ 轮`, `round ${LAST}+`);
      nodes.push(box(LX.S, LY(l), LW, 'fill:var(--accent-soft);stroke:var(--accent)', `${lab} · ${T('稳定', 'stable')}`, share(leaf[l + 'S'] || 0), 's-accent'));
      nodes.push(box(LX.R, LY(l), LW, 'fill:var(--fail-soft);stroke:var(--fail)', `${lab} · ${T('脱落', 'released')}`, share(leaf[l + 'R'] || 0), 's-fail'));
      if (l < LAST) nodes.push(box(LX.C, LY(l), CWID, 'fill:var(--surface);stroke:var(--muted)', T('继续', 'continue'), share(past[l]), 's-ink'));
    }
    h += nodes.join('');
    if (s.id === 'mc') {
      for (let j = 0; j < NS; j++) {
        const sm = SAMPLES[j], tt = tl - startOf(j), L = sm.level;
        if (tt < 0 || tt >= STEP * L) continue;
        const pts = pathPts(sm), seg = Math.min(Math.floor(tt / STEP), L - 1), u = ease(tt / STEP - seg);
        const [x1, y1] = pts[seg], [x2, y2] = pts[seg + 1];
        const yy1 = y1 + BOXH / 2, yy2 = y2 - BOXH / 2, ym = (yy1 + yy2) / 2;
        const cx = (1 - u) ** 3 * x1 + 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3 * x2;
        const cy = (1 - u) ** 3 * yy1 + 3 * (1 - u) ** 2 * u * ym + 3 * (1 - u) * u * u * ym + u ** 3 * yy2;
        h += `<circle cx="${(cx + (sm.jx - 0.5) * 10).toFixed(1)}" cy="${cy.toFixed(1)}" r="${j < SLOW ? 5 : 3}" style="fill:${sm.kind === 'R' ? 'var(--fail)' : 'var(--accent)'};stroke:var(--surface)" stroke-width="1"/>`;
      }
    }
    // outcome counts: horizontal bars, samples only
    const HX = 352, HL = 400, HB = 404, HW = 104, HY = (k) => 92 + k * 27;
    h += `<line x1="${HX - 10}" y1="56" x2="${HX - 10}" y2="${HY(OUTCOMES.length - 1) + 20}" style="stroke:var(--line)"/>`;
    h += `<text x="${HX}" y="68" font-size="11.5" font-weight="700" class="s-ink">${T('最后剩几个', 'Units left at the end')}</text>`;
    let peak = 0; for (const b of OUTCOMES) peak = Math.max(peak, n ? (bins[b] || 0) / n : 0);
    const scale = HW / Math.max(peak, 0.2);
    OUTCOMES.forEach((b, k) => {
      const y = HY(k), isR = b === 'R', f = n ? (bins[b] || 0) / n : 0;
      h += `<text x="${HL}" y="${y + 4}" text-anchor="end" font-size="10" class="${isR ? 's-fail' : 's-ink'}" font-weight="${isR ? 700 : 400}">${isR ? T('脱落', 'released') : T(`剩 ${b}`, `${b} left`)}</text>`;
      h += `<rect x="${HB}" y="${y - 7}" width="${HW}" height="13" rx="2" style="fill:var(--tint)"/>`;
      if (f > 0) h += `<rect x="${HB}" y="${y - 7}" width="${(f * scale).toFixed(1)}" height="13" rx="2" style="fill:${isR ? 'var(--fail)' : 'var(--accent)'};opacity:0.8"/>`;
      h += `<text x="${HB + HW + 34}" y="${y + 4}" text-anchor="end" font-size="9.5" class="s-ink">${n ? pct(f) : '—'}</text>`;
    });
    h += `<text x="280" y="${LY(LAST) + 42}" text-anchor="middle" font-size="12" font-weight="700" class="s-ink">${T('样本里的存活比例：', 'Share of samples that hold: ')}${n ? pct(held / n) : '—'}${T(`（${n} / ${NS}）`, ` (${n} / ${NS})`)}</text>`;
    return h + '</g>';
  }

  // ---------- player ----------
  let t = 0, playing = false, speed = 1, last = 0;
  const seek = $('vSeek');
  seek.max = TOTAL; seek.step = 0.01;
  const fmtT = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
  const chaptersHtml = () => SC.filter((s) => s.ch).map((s) => `<button type="button" data-t="${s.t0}">${T(s.ch[0], s.ch[1])}</button>`).join('');
  let lastPad = '', lastRight = '';
  function render() {
    const [s, p] = sceneAt(t);
    const pad = drawPad(padState(s, p));
    const right = s.id === 'mc' || s.id === 'end' ? drawLadder(s, p) : drawTree(s, p);
    if (pad !== lastPad) { $('vPad').innerHTML = pad; lastPad = pad; }
    if (right !== lastRight) { $('vTree').innerHTML = right; lastRight = right; }
    seek.value = t;
    $('vTime').textContent = `${fmtT(t)} / ${fmtT(TOTAL)}`;
    $('vPlay').innerHTML = playing ? `<span aria-hidden="true">❚❚</span> ${T('暂停', 'Pause')}` : `<span aria-hidden="true">▶</span> ${T(t >= TOTAL ? '重播' : '播放', t >= TOTAL ? 'Replay' : 'Play')}`;
    const chs = SC.filter((x) => x.ch);
    for (const b of $('vChapters').querySelectorAll('button')) {
      const s0 = +b.dataset.t, next = chs.find((x) => x.t0 > s0);
      b.setAttribute('aria-current', String(t >= s0 && (!next || t < next.t0)));
    }
  }
  function frame(now) {
    if (!playing) return;
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    t = Math.min(TOTAL, t + dt * speed);
    if (t >= TOTAL) playing = false;
    render();
    if (playing) requestAnimationFrame(frame);
  }
  function play() { if (t >= TOTAL) t = 0; playing = true; last = performance.now(); requestAnimationFrame(frame); render(); }
  function pause() { playing = false; render(); }
  $('vPlay').addEventListener('click', () => (playing ? pause() : play()));
  seek.addEventListener('input', () => { t = +seek.value; render(); });
  $('vChapters').innerHTML = chaptersHtml();
  $('vChapters').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { t = +b.dataset.t + 0.001; render(); } });
  for (const b of $('vSpeed').querySelectorAll('button')) b.addEventListener('click', () => {
    speed = +b.dataset.speed;
    for (const x of $('vSpeed').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
  });
  root.addEventListener('keydown', (e) => {
    if (e.target !== root) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); playing ? pause() : play(); }
    else if (e.key === 'ArrowRight') { t = Math.min(TOTAL, t + 5); render(); }
    else if (e.key === 'ArrowLeft') { t = Math.max(0, t - 5); render(); }
  });
  document.addEventListener('langchange', () => { $('vChapters').innerHTML = chaptersHtml(); lastPad = lastRight = ''; render(); });
  render();
})();
