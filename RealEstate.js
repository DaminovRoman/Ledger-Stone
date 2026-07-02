/* ==========================================================================
   LEDGER & STONE — INTERACTION LAYER
   Vanilla JS, no dependencies. Organized by feature; each module is self-
   contained and guards for the presence of its own DOM nodes so the script
   never throws if a section is edited or removed later.
   ========================================================================== */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const html = document.documentElement;

  /* ------------------------------------------------------------------
     UTIL — throttle via requestAnimationFrame for scroll/resize work
     ------------------------------------------------------------------ */
  function rafThrottle(fn) {
    let ticking = false;
    return (...args) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        fn(...args);
        ticking = false;
      });
    };
  }

  /* ==================================================================
     MODULE — VERTICAL LEDGER (signature scroll-progress rail)
     Trigger: scroll. Duration: continuous, throttled to rAF.
     Purpose: gives the visit itself a sense of being recorded, echoing
     the "недвижимость становится частью вашей истории" thesis.
     ================================================================== */
  (function ledgerRail() {
    const fill = document.getElementById('ledgerFill');
    const marker = document.getElementById('ledgerMarker');
    if (!fill || !marker) return;

    const sectionEls = Array.from(document.querySelectorAll('main > section[id]'));

    function update() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
      const pct = progress * 100;
      fill.style.height = pct + '%';
      marker.style.top = pct + '%';

      // Snap a subtle "at section" glow when a section's midpoint crosses viewport center
      const viewportMid = scrollTop + window.innerHeight / 2;
      const atSection = sectionEls.some(sec => {
        const top = sec.offsetTop;
        const bottom = top + sec.offsetHeight;
        return viewportMid >= top && viewportMid <= top + 60 || (bottom - viewportMid > 0 && bottom - viewportMid < 60);
      });
      marker.classList.toggle('is-at-section', atSection);
    }

    window.addEventListener('scroll', rafThrottle(update), { passive: true });
    window.addEventListener('resize', rafThrottle(update));
    update();
  })();

  /* ==================================================================
     MODULE — HEADER STATE (glass background on scroll)
     Trigger: scroll past 40px. Duration: 380ms (defined in CSS).
     ================================================================== */
  (function headerState() {
    const header = document.getElementById('siteHeader');
    if (!header) return;

    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 40);
    }
    window.addEventListener('scroll', rafThrottle(update), { passive: true });
    update();
  })();

  /* ==================================================================
     MODULE — SCROLLSPY (highlight active nav link)
     ================================================================== */
  (function scrollspy() {
    const links = Array.from(document.querySelectorAll('[data-nav]'));
    if (!links.length) return;

    const sections = links
      .map(link => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    if (!sections.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = '#' + entry.target.id;
        const link = links.find(l => l.getAttribute('href') === id);
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach(l => l.classList.remove('is-active'));
          link.classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    sections.forEach(sec => observer.observe(sec));
  })();

  /* ==================================================================
     MODULE — MOBILE NAV DRAWER
     Trigger: burger click. Duration: 700ms slide (CSS). Easing: luxury.
     ================================================================== */
  (function navDrawer() {
    const burger = document.getElementById('navBurger');
    const menu = document.getElementById('navMenu');
    if (!burger || !menu) return;

    function closeMenu() {
      burger.setAttribute('aria-expanded', 'false');
      menu.classList.remove('is-open');
      html.style.overflow = '';
    }
    function openMenu() {
      burger.setAttribute('aria-expanded', 'true');
      menu.classList.add('is-open');
      html.style.overflow = 'hidden';
    }

    burger.addEventListener('click', () => {
      const isOpen = burger.getAttribute('aria-expanded') === 'true';
      isOpen ? closeMenu() : openMenu();
    });

    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    // Close drawer if resized back to desktop
    window.addEventListener('resize', rafThrottle(() => {
      if (window.innerWidth > 767) closeMenu();
    }));
  })();

  /* ==================================================================
     MODULE — CUSTOM CURSOR (Cursor Effects)
     Trigger: pointer move (fine pointer only). Duration: 180ms ease.
     Purpose: quiet luxury detail; hollow gold ring, expands over links.
     ================================================================== */
  (function customCursor() {
    const cursor = document.getElementById('cursorDot');
    if (!cursor) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let x = 0, y = 0;
    window.addEventListener('mousemove', (e) => {
      x = e.clientX; y = e.clientY;
      cursor.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      cursor.classList.add('is-active');
    }, { passive: true });

    document.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));

    const interactiveSelector = 'a, button, .filter-chip, .property-card, [role="tab"], input, select';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactiveSelector)) cursor.classList.add('is-hovering-link');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactiveSelector)) cursor.classList.remove('is-hovering-link');
    });

    const darkSections = document.querySelectorAll('.hero, .investments, .cta, .contacts');
    const darkObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
          cursor.classList.add('is-hovering-dark');
        }
      });
    }, { threshold: [0, 0.4, 1] });
    darkSections.forEach(sec => darkObserver.observe(sec));

    // Simple leave detection per dark section: recompute on scroll
    window.addEventListener('scroll', rafThrottle(() => {
      const overDark = Array.from(darkSections).some(sec => {
        const r = sec.getBoundingClientRect();
        return r.top < y && r.bottom > y;
      });
      cursor.classList.toggle('is-hovering-dark', overDark);
    }), { passive: true });
  })();

  /* ==================================================================
     MODULE — SCROLL REVEALS (Fade Up + Stagger Animation)
     Trigger: element enters viewport (20% visible). Duration: 900ms.
     Delay: 70ms × sibling index within the same parent (stagger).
     Easing: cubic-bezier(0.16, 1, 0.3, 1) — "luxury" ease, defined in CSS.
     Purpose: sections arrive with quiet confidence rather than popping in.
     ================================================================== */
  (function scrollReveals() {
    const items = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!items.length) return;

    if (prefersReducedMotion) {
      items.forEach(el => el.classList.add('is-visible'));
      return;
    }

    // Assign stagger index per shared parent so siblings cascade, not the whole page at once
    const groups = new Map();
    items.forEach(el => {
      const parent = el.parentElement;
      if (!groups.has(parent)) groups.set(parent, 0);
      const idx = groups.get(parent);
      el.style.setProperty('--stagger-index', Math.min(idx, 6)); // cap stagger so long lists don't lag
      groups.set(parent, idx + 1);
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    items.forEach(el => observer.observe(el));
  })();

  /* ==================================================================
     MODULE — HERO ENTRANCE SEQUENCE
     Trigger: page load (DOMContentLoaded). Duration: title lines 1000ms
     each, staggered 120ms; subtitle/actions/stats follow at 380–520ms
     offsets. Easing: luxury ease. Purpose: an orchestrated first moment,
     per the frontend-design principle of one deliberate opening beat
     rather than scattered effects.
     ================================================================== */
  (function heroEntrance() {
    const titleLines = document.querySelectorAll('.hero__title-line');
    const eyebrow = document.querySelector('.hero__eyebrow');
    const subtitle = document.querySelector('.hero__subtitle');
    const actions = document.querySelector('.hero__actions');
    const stats = document.querySelector('.hero__stats');

    if (prefersReducedMotion) {
      [...titleLines, eyebrow, subtitle, actions, stats].forEach(el => el && el.classList.add('is-visible'));
      startCounters();
      return;
    }

    function run() {
      if (eyebrow) eyebrow.classList.add('is-visible');
      titleLines.forEach((line, i) => {
        setTimeout(() => line.classList.add('is-visible'), 160 + i * 120);
      });
      const afterTitles = 160 + titleLines.length * 120 + 200;
      setTimeout(() => subtitle && subtitle.classList.add('is-visible'), afterTitles);
      setTimeout(() => actions && actions.classList.add('is-visible'), afterTitles + 150);
      setTimeout(() => { stats && stats.classList.add('is-visible'); startCounters(); }, afterTitles + 300);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  })();

  /* ==================================================================
     MODULE — STAT COUNTERS
     Trigger: called once by heroEntrance after stats become visible.
     Duration: 1400ms per counter. Easing: ease-out (quad).
     ================================================================== */
  function startCounters() {
    const counters = document.querySelectorAll('[data-counter]');
    counters.forEach(el => {
      const target = parseFloat(el.getAttribute('data-counter'));
      const suffix = el.getAttribute('data-suffix') || '';
      const duration = 1400;
      const startTime = performance.now();

      function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const value = Math.round(target * eased);
        el.textContent = value + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  /* ==================================================================
     MODULE — MAGNETIC BUTTONS
     Trigger: pointermove within button bounds. Duration: 180ms return.
     Easing: standard ease. Purpose: buttons feel weighted, drift subtly
     toward the cursor within a small radius — restrained, not gimmicky.
     ================================================================== */
  (function magneticButtons() {
    if (prefersReducedMotion) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const buttons = document.querySelectorAll('.hero__actions .btn, .cta-form__submit');
    const strength = 0.25;
    const maxOffset = 10;

    buttons.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const relX = e.clientX - rect.left - rect.width / 2;
        const relY = e.clientY - rect.top - rect.height / 2;
        const offsetX = Math.max(Math.min(relX * strength, maxOffset), -maxOffset);
        const offsetY = Math.max(Math.min(relY * strength, maxOffset), -maxOffset);
        btn.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  })();

  /* ==================================================================
     MODULE — HERO SCROLL INDICATOR
     Trigger: click. Scrolls to the section immediately after hero.
     ================================================================== */
  (function scrollIndicator() {
    const btn = document.getElementById('scrollIndicator');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const about = document.getElementById('about');
      if (about) about.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  })();

  /* ==================================================================
     MODULE — CATALOG FILTERS
     Trigger: chip click / select change. Duration: 380ms fade (CSS via
     is-hidden toggling display, kept simple/instant to avoid layout
     thrash on grid reflow — the card hover motion carries the "luxury"
     feel elsewhere, filtering itself should feel immediate and precise).
     ================================================================== */
  (function catalogFilters() {
    const grid = document.getElementById('propertyGrid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.property-card'));
    const chips = Array.from(document.querySelectorAll('.filter-chip'));
    const priceSelect = document.getElementById('filterPrice');
    const roomsSelect = document.getElementById('filterRooms');
    const countEl = document.getElementById('filtersCount');
    const emptyState = document.getElementById('emptyState');

    let activeCategory = 'all';

    function pluralize(n) {
      const mod10 = n % 10, mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) return 'объект';
      if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'объекта';
      return 'объектов';
    }

    function applyFilters() {
      const priceVal = priceSelect ? priceSelect.value : 'all';
      const roomsVal = roomsSelect ? roomsSelect.value : 'all';
      let visibleCount = 0;

      cards.forEach(card => {
        const matchesCategory = activeCategory === 'all' || card.dataset.category === activeCategory;
        const matchesPrice = priceVal === 'all' || card.dataset.price === priceVal;
        const matchesRooms = roomsVal === 'all' || card.dataset.rooms === roomsVal;
        const visible = matchesCategory && matchesPrice && matchesRooms;
        card.classList.toggle('is-hidden', !visible);
        if (visible) visibleCount++;
      });

      if (countEl) countEl.textContent = `${visibleCount} ${pluralize(visibleCount)}`;
      if (emptyState) emptyState.hidden = visibleCount !== 0;
    }

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => { c.classList.remove('is-active'); c.setAttribute('aria-pressed', 'false'); });
        chip.classList.add('is-active');
        chip.setAttribute('aria-pressed', 'true');
        activeCategory = chip.dataset.filter;
        applyFilters();
      });
    });

    if (priceSelect) priceSelect.addEventListener('change', applyFilters);
    if (roomsSelect) roomsSelect.addEventListener('change', applyFilters);
  })();

  /* ==================================================================
     MODULE — TESTIMONIAL SLIDER
     Trigger: prev/next click, dot click, or 7s auto-advance (paused on
     hover/focus). Duration: 700ms cross-fade + rise (CSS). Easing: luxury.
     ================================================================== */
  (function testimonialSlider() {
    const track = document.getElementById('testimonialTrack');
    const slider = document.getElementById('testimonialSlider');
    if (!track || !slider) return;

    const slides = Array.from(track.querySelectorAll('.testimonial-slide'));
    const dots = Array.from(document.querySelectorAll('.testimonial-dot'));
    const prevBtn = document.getElementById('testimonialPrev');
    const nextBtn = document.getElementById('testimonialNext');
    if (!slides.length) return;

    let current = 0;
    let autoTimer = null;

    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('is-active', i === current));
      dots.forEach((d, i) => {
        d.classList.toggle('is-active', i === current);
        d.setAttribute('aria-selected', i === current ? 'true' : 'false');
      });
    }

    function next() { show(current + 1); }
    function prev() { show(current - 1); }

    function startAuto() {
      if (prefersReducedMotion) return;
      stopAuto();
      autoTimer = setInterval(next, 13000);
    }
    function stopAuto() {
      if (autoTimer) clearInterval(autoTimer);
    }

    if (nextBtn) nextBtn.addEventListener('click', () => { next(); startAuto(); });
    if (prevBtn) prevBtn.addEventListener('click', () => { prev(); startAuto(); });
    dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i); startAuto(); }));

    slider.addEventListener('mouseenter', stopAuto);
    slider.addEventListener('mouseleave', startAuto);
    slider.addEventListener('focusin', stopAuto);
    slider.addEventListener('focusout', startAuto);

    show(0);
    startAuto();
  })();

  /* ==================================================================
     MODULE — FAQ ACCORDION
     Trigger: trigger click. Duration: 380ms grid-template-rows (CSS).
     Easing: luxury. Behavior: single-open (opening one closes others),
     matching the "красивый Accordion" brief — one clear focal answer.
     ================================================================== */
  (function faqAccordion() {
    const accordion = document.getElementById('accordion');
    if (!accordion) return;

    const items = Array.from(accordion.querySelectorAll('.accordion-item'));

    items.forEach(item => {
      const trigger = item.querySelector('.accordion-item__trigger');
      if (!trigger) return;
      trigger.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');
        items.forEach(other => {
          other.classList.remove('is-open');
          const t = other.querySelector('.accordion-item__trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });
  })();

  /* ==================================================================
     MODULE — CTA FORM (client-side validation + success state)
     Trigger: submit. Purpose: no backend in this deliverable — validates
     and shows a confirmation state so the flow reads as complete. Wire
     the fetch/POST call to the studio's CRM endpoint at integration time.
     ================================================================== */
  (function ctaForm() {
    const form = document.getElementById('ctaForm');
    if (!form) return;

    const nameField = document.getElementById('ctaName');
    const phoneField = document.getElementById('ctaPhone');
    const successMsg = document.getElementById('ctaSuccess');

    function setError(field, hasError) {
      const wrapper = field.closest('.cta-form__field');
      if (wrapper) wrapper.classList.toggle('has-error', hasError);
    }

    function isValidPhone(value) {
      const digits = value.replace(/\D/g, '');
      return digits.length >= 10;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;

      if (!nameField.value.trim()) { setError(nameField, true); valid = false; }
      else setError(nameField, false);

      if (!isValidPhone(phoneField.value)) { setError(phoneField, true); valid = false; }
      else setError(phoneField, false);

      if (!valid) {
        const firstError = form.querySelector('.has-error input');
        if (firstError) firstError.focus();
        return;
      }

      // Integration point: replace with real submission (fetch to CRM/API).
      form.reset();
      if (successMsg) {
        successMsg.hidden = false;
        successMsg.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
      }
    });

    [nameField, phoneField].forEach(field => {
      field.addEventListener('input', () => setError(field, false));
    });
  })();

  /* ==================================================================
     MODULE — FOOTER YEAR
     ================================================================== */
  (function footerYear() {
    const yearEl = document.getElementById('currentYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  })();

})();
