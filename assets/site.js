// Humanoid Wall Climbing project page: menu, reveal, lazy videos, highlights carousel, comparisons, card tracks, explorers, FAQ, maths.
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

  /* ---------- card tracks: a counter and arrows; the bar hides when every card fits ---------- */
  const behavior = reduce ? 'auto' : 'smooth';
  d.querySelectorAll('[data-scroller]').forEach(root => {
    const track = root.querySelector('.strack');
    const items = [...track.children];
    const count = root.querySelector('.count');
    const prev = root.querySelector('.prev');
    const next = root.querySelector('.next');
    const pitch = () => (items[1] ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth);
    const sync = () => {
      const max = track.scrollWidth - track.clientWidth;
      root.classList.toggle('fits', track.clientWidth > 0 && max <= 2);
      // the cards in view: the first whose start is on screen, through the last that fits after it
      const p = pitch();
      const shown = Math.max(1, Math.floor((track.clientWidth + p - items[0].offsetWidth) / p));
      const last = track.scrollLeft >= max - 2 ? items.length : Math.min(items.length, Math.ceil(track.scrollLeft / p - .05) + shown);
      const first = Math.max(1, last - shown + 1);
      count.textContent = first === last ? `${last} / ${items.length}` : `${first}–${last} / ${items.length}`;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -pitch(), behavior }));
    next.addEventListener('click', () => track.scrollBy({ left: pitch(), behavior }));
    let raf = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
    addEventListener('resize', sync);
    root.sync = sync;
    root.to = el => {
      track.scrollTo({ left: el.offsetLeft - items[0].offsetLeft, behavior });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1400);
    };
    sync();
  });

  /* ---------- explorers: one panel at a time, from the tab bar, a figure block, a "next" link or a deep link ---------- */
  const explorers = [...d.querySelectorAll('[data-tabs]')].map(root => {
    const seg = root.querySelector('.seg');
    const tabs = [...seg.querySelectorAll('[role=tab]')];
    const panels = tabs.map(t => d.getElementById(t.getAttribute('aria-controls')));
    const hots = [...root.querySelectorAll('.hot-area[data-go]')];
    // bring the bar into view when the panel below it changed out of sight
    const reveal = () => {
      const top = seg.getBoundingClientRect().top;
      if (top < 60 || top > innerHeight * .55) scrollTo({ top: scrollY + top - 90, behavior });
    };
    const show = i => {
      tabs.forEach((t, j) => {
        t.setAttribute('aria-selected', String(j === i));
        t.tabIndex = j === i ? 0 : -1;
        panels[j].classList.toggle('on', j === i);
      });
      hots.forEach(h => h.classList.toggle('on', !h.classList.contains('sub') && h.dataset.go === panels[i].id));
      seg.scrollTo({ left: tabs[i].offsetLeft - 24, behavior });
      panels[i].querySelectorAll('[data-scroller]').forEach(s => s.sync());
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(i));
      t.addEventListener('keydown', e => {
        const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (j === undefined) return;
        e.preventDefault();
        const k = (j + tabs.length) % tabs.length;
        show(k);
        tabs[k].focus();
      });
    });
    panels.forEach((p, i) => {
      if (i === panels.length - 1) return;
      const b = d.createElement('button');
      b.type = 'button';
      b.className = 'tab-next';
      b.innerHTML = `Next: ${tabs[i + 1].textContent} <span aria-hidden="true">›</span>`;
      b.addEventListener('click', () => { show(i + 1); reveal(); tabs[i + 1].focus({ preventScroll: true }); });
      p.append(b);
    });
    hots.forEach(h => h.addEventListener('click', () => {
      show(panels.findIndex(p => p.id === h.dataset.go));
      reveal();
      const step = h.dataset.step && d.getElementById(h.dataset.step);
      if (step) step.closest('[data-scroller]').to(step);
    }));
    show(Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true')));
    return { panels, show };
  });
  const openHash = () => {
    const el = location.hash.length > 1 && d.getElementById(decodeURIComponent(location.hash.slice(1)));
    const p = el && el.closest('.tabpanel');
    if (!p) return;
    explorers.forEach(x => { const i = x.panels.indexOf(p); if (i >= 0) x.show(i); });
    el.scrollIntoView();
  };
  addEventListener('hashchange', openHash);
  openHash();

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
