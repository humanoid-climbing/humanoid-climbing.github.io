// Humanoid Wall Climbing project page: menu, reveal, lazy videos, highlights carousel, comparisons, FAQ, maths.
(() => {
  const d = document;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 734px)').matches;
  const hasIO = 'IntersectionObserver' in window;

  /* ---------- maths (KaTeX auto-render, loaded before this file) ---------- */
  if (window.renderMathInElement) {
    renderMathInElement(d.body, {
      delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
      throwOnError: false,
    });
  }

  /* ---------- explore menu ---------- */
  const exBtn = d.getElementById('exploreBtn');
  const exMenu = d.getElementById('exploreMenu');
  if (exBtn && exMenu) {
    const setMenu = open => { exBtn.setAttribute('aria-expanded', String(open)); exMenu.hidden = !open; };
    exBtn.addEventListener('click', e => { e.stopPropagation(); setMenu(exMenu.hidden); });
    exMenu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    d.addEventListener('click', e => { if (!exMenu.hidden && !e.target.closest('.explore')) setMenu(false); });
    d.addEventListener('keydown', e => { if (e.key === 'Escape' && !exMenu.hidden) { setMenu(false); exBtn.focus(); } });
  }

  /* ---------- reveal on scroll ---------- */
  const rvs = d.querySelectorAll('.rv');
  if (hasIO && !reduce) {
    const rio = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); }
    }), { rootMargin: '0px 0px -6% 0px' });
    rvs.forEach(el => rio.observe(el));
  } else {
    rvs.forEach(el => el.classList.add('in'));
  }

  /* ---------- videos: the file for the screen, loaded when it nears the viewport ---------- */
  const lazy = [...d.querySelectorAll('video[data-src]')];
  const load = v => {
    if (v.dataset.src && !v.getAttribute('src')) v.src = (small && v.dataset.srcSm) || v.dataset.src;
  };
  const play = v => {
    load(v);
    const p = v.play();
    if (p) p.catch(() => {});
  };
  lazy.forEach(v => { if (small && v.dataset.posterSm) v.poster = v.dataset.posterSm; });
  if (hasIO) {
    const lio = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { load(e.target); lio.unobserve(e.target); }
    }), { rootMargin: '600px 0px' });
    lazy.forEach(v => lio.observe(v));
  } else {
    lazy.forEach(load);
  }

  // play / pause buttons swap their icon with .paused and their label between Play and Pause
  const setBtn = (btn, playing) => {
    if (!btn) return;
    btn.classList.toggle('paused', !playing);
    btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace(/^(Pause|Play)/, playing ? 'Pause' : 'Play'));
  };

  /* ---------- autoplay groups: one clip (data-auto) or a side-by-side pair (data-pair) ----------
     A group plays while a third of it is on screen, unless the viewer paused it or prefers reduced motion. */
  const groups = [...d.querySelectorAll('[data-auto], [data-pair]')].map(el => ({
    el, vids: [...el.querySelectorAll('video')], btn: el.querySelector('.vbtn, .fplay'), held: reduce,
  }));
  const run = (g, on) => {
    g.vids.forEach(v => (on ? play(v) : v.pause()));
    setBtn(g.btn, on);
  };
  groups.forEach(g => {
    setBtn(g.btn, !g.held);
    const toggle = () => {
      const on = g.vids.some(v => v.paused);
      g.held = !on;
      run(g, on);
    };
    if (g.btn) g.btn.addEventListener('click', toggle);
    else g.vids.forEach(v => v.addEventListener('click', toggle));
  });
  if (hasIO) {
    const gio = new IntersectionObserver(entries => entries.forEach(e => {
      const g = groups.find(x => x.el === e.target);
      if (e.isIntersecting && !g.held) run(g, true);
      else if (!e.isIntersecting) g.vids.forEach(v => v.pause());
    }), { threshold: .3 });
    groups.forEach(g => gio.observe(g.el));
  }

  /* ---------- highlights: one card at a time; the active dot fills as its clip plays ---------- */
  const track = d.getElementById('hlTrack');
  if (track) {
    const cards = [...track.children];
    const vids = cards.map(c => c.querySelector('video'));
    const pager = d.getElementById('hlPager');
    const pbtn = d.getElementById('hlPlay');
    let cur = -1;
    let playing = !reduce;
    let visible = false;

    const pad = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const go = i => track.scrollTo({ left: cards[i].offsetLeft - pad(), behavior: reduce ? 'auto' : 'smooth' });
    const nearest = () => {
      const x = track.scrollLeft + pad();
      let best = 0;
      cards.forEach((c, i) => { if (Math.abs(c.offsetLeft - x) < Math.abs(cards[best].offsetLeft - x)) best = i; });
      return best;
    };
    const dots = cards.map((c, i) => {
      const b = d.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      b.setAttribute('aria-label', `Highlight ${i + 1} of ${cards.length}`);
      b.innerHTML = '<i></i>';
      b.addEventListener('click', () => go(i));
      pager.append(b);
      return b;
    });
    const activate = i => {
      if (i === cur) return;
      if (cur >= 0) {
        vids[cur].pause();
        dots[cur].classList.remove('on');
        dots[cur].removeAttribute('aria-current');
      }
      cur = i;
      dots[i].classList.add('on');
      dots[i].setAttribute('aria-current', 'true');
      dots[i].style.setProperty('--p', 0);
      load(vids[i]);
      try { vids[i].currentTime = 0; } catch (_) { /* not loaded yet */ }
      if (playing && visible) play(vids[i]);
    };
    vids.forEach((v, i) => {
      v.addEventListener('timeupdate', () => {
        if (i === cur && v.duration) dots[i].style.setProperty('--p', v.currentTime / v.duration);
      });
      v.addEventListener('ended', () => { if (i === cur && playing) go((i + 1) % cards.length); });
    });
    let settle;
    track.addEventListener('scroll', () => {
      clearTimeout(settle);
      settle = setTimeout(() => activate(nearest()), 80);
    }, { passive: true });
    pbtn.addEventListener('click', () => {
      playing = !playing;
      setBtn(pbtn, playing);
      const v = vids[cur];
      if (!playing) v.pause();
      else if (v.ended) go((cur + 1) % cards.length);
      else play(v);
    });
    setBtn(pbtn, playing);
    if (hasIO) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && playing) play(vids[cur]);
        else vids[cur].pause();
      }, { threshold: .35 }).observe(track);
    }
    activate(0);
  }

  /* ---------- FAQ: expand or collapse all ---------- */
  const faqAll = d.getElementById('faqAll');
  if (faqAll) {
    const items = [...d.querySelectorAll('#faqList details')];
    const sync = () => {
      const all = items.every(x => x.open);
      faqAll.setAttribute('aria-expanded', String(all));
      faqAll.firstChild.textContent = all ? 'Collapse all ' : 'Expand all ';
    };
    faqAll.addEventListener('click', () => {
      const open = !items.every(x => x.open);
      items.forEach(x => { x.open = open; });
      sync();
    });
    items.forEach(x => x.addEventListener('toggle', sync));
  }
})();
