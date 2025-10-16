// === ebookjapan cart filter v1.2.7 ===
(() => {
  const PANEL_ID = "ej-cart-filter-panel";
  const BTN_CLASS = "ejcf-btn";
  const SELECTED_CLASS = "ejcf-selected";
  const HIDDEN_CLASS = "ejcf-hidden";
  const COUNT_ATTR = "data-ejcf-count";
  const VERSION = "v1.2.7";

  const SEL = {
    cartRoots: [".page-cart", "#cartContents", ".cart-contents"],
    cartListItems: [
      "#cartContents .cart-list > li.cart-item",
      "#cartContents .cart-contents__list.cart-list > li.cart-item",
      ".cart-contents .cart-list > li.cart-item"
    ],
    laterListItems: [
      "#laterContents .later-list > li.later-item",
      ".later-contents .later-list > li.later-item"
    ],
    tagWrap: [".book-caption__tagtext-wrap"],
    tag: [".book-caption__tagtext-wrap .tagtext", ".tagtext"],
    moreToggles: [".contents-more-toggle .contents-more-toggle__text", ".contents-more-toggle__text"]
  };

  let booted = false;
  let isBusy = false;
  let observers = [];
  let hrefSnapshot = location.href;

  // --- CSS ---
  const INLINE_CSS = `
#${PANEL_ID} {
  position: fixed !important;
  left: 12px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  z-index: 2147483647 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
  background: #515254 !important;
  -webkit-backdrop-filter: blur(4px) saturate(110%) !important;
  backdrop-filter: blur(4px) saturate(110%) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  padding: 10px !important;
  border-radius: 14px !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35) !important;
}
#${PANEL_ID} .ejcf-header {
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: .08em !important;
  color: #eceef1 !important;
  text-align: center !important;
  user-select: none !important;
  background: rgba(255,255,255,0.06) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  border-radius: 10px !important;
  padding: 6px 8px !important;
  position: relative !important;
}
#${PANEL_ID} .ejcf-badge {
  display: none !important;
  position: absolute !important;
  right: 6px !important;
  top: 6px !important;
  font-size: 10px !important;
  padding: 2px 6px !important;
  border-radius: 999px !important;
  background: rgba(255,255,255,0.18) !important;
  color: #e5e7eb !important;
}
#${PANEL_ID}.ejcf-busy .ejcf-badge { display: inline-block !important; }
#${PANEL_ID} .ejcf-buttons, #${PANEL_ID} .ejcf-ops { display: flex !important; flex-direction: column !important; gap: 8px !important; }
#${PANEL_ID} .${BTN_CLASS} {
  appearance: none !important;
  border: 1px solid rgba(255,255,255,0.14) !important;
  border-radius: 12px !important;
  background: #5b5c5f !important;
  color: #f3f4f6 !important;
  padding: 11px 12px 10px 16px !important;
  font-size: 12px !important;
  line-height: 1.15 !important;
  text-align: center !important;
  cursor: pointer !important;
  word-break: keep-all !important;
  transition: none !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05) !important;
}
#${PANEL_ID} .${BTN_CLASS}.${SELECTED_CLASS} {
  border-color: #4da6ff !important;
  border-width: 2px !important;
  background: #4da6ff1f !important;
  color: #e9f4ff !important;
  font-weight: 700 !important;
  position: relative !important;
}
#${PANEL_ID} .${BTN_CLASS}.${SELECTED_CLASS}::before {
  content: "" !important;
  position: absolute !important;
  left: 6px !important;
  top: 8px !important;
  bottom: 8px !important;
  width: 4px !important;
  border-radius: 3px !important;
  background: #4da6ff !important;
  pointer-events: none !important;
}
#${PANEL_ID}.ejcf-busy .${BTN_CLASS}, #${PANEL_ID} .${BTN_CLASS}[disabled] {
  opacity: .55 !important;
  cursor: not-allowed !important;
  filter: grayscale(10%) !important;
  pointer-events: none !important;
}
#${PANEL_ID} .${BTN_CLASS} small { opacity: .9 !important; font-size: 11px !important; }
#${PANEL_ID} .ejcf-ops { border-top: 1px solid rgba(255,255,255,0.08) !important; padding-top: 8px !important; }
.${HIDDEN_CLASS} { display: none !important; }
#${PANEL_ID} .ejcf-total {
  font-size: 10px !important;
  opacity: .8 !important;
  color: #e5e7eb !important;
  text-align: center !important;
  margin-top: 4px !important;
}

`;

  function injectInlineCSS() {
    const id = "ejcf-inline-style";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = INLINE_CSS;
    document.documentElement.appendChild(style);
  }

  const getActive = () => window.__ejcfActiveLabel || null;
  const setActive = (label) => { window.__ejcfActiveLabel = label || null; };
  const waitFor = (ms) => new Promise(r => setTimeout(r, ms));
  const debounce = (fn, ms) => { let id; return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); }; };
  const escapeHtml = (s) => s.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));

  // --- Draggable ---
  function dragEnable(panel, handle) {
    let dragging = false; let startY = 0; let startTop = 0;
    handle.style.cursor = "grab";
    handle.addEventListener("mousedown", (e) => {
      dragging = true; startY = e.clientY; startTop = panel.getBoundingClientRect().top; handle.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return; const dy = e.clientY - startY; panel.style.top = `${startTop + dy}px`;
    });
    window.addEventListener("mouseup", () => { dragging = false; handle.style.cursor = "grab"; });
  }

  // --- Guards（空カート対応: root があればOK） ---
  const isOnCartPath = () => /^\/cart\/?$/.test(location.pathname);
  const q = (sels) => document.querySelector(sels.join(", "));
  const qAll = (sels) => Array.from(document.querySelectorAll(sels.join(", ")));
  function hasCartDomLoose() {
    const root = q(SEL.cartRoots);
    return !!root;
  }

  // ===== UI =====
  function setBusy(state) {
    isBusy = !!state;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.classList.toggle("ejcf-busy", isBusy);
    panel.querySelectorAll("." + BTN_CLASS).forEach(b => {
      if (isBusy) b.setAttribute("disabled", "true");
      else b.removeAttribute("disabled");
    });
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = PANEL_ID;

    const header = document.createElement("div");
    header.className = "ejcf-header";
    header.textContent = "filter " + VERSION;
    const badge = document.createElement("span");
    badge.className = "ejcf-badge";
    badge.textContent = "sync…";
    header.appendChild(badge);
    panel.appendChild(header);

    // subtle total line (cart + later)
    const total = document.createElement("div");
    total.id = PANEL_ID + "-total";
    total.className = "ejcf-total";
    total.textContent = "合計 0 件";
    panel.appendChild(total);


    const btns = document.createElement("div");
    btns.className = "ejcf-buttons";
    panel.appendChild(btns);

    const ops = document.createElement("div");
    ops.className = "ejcf-ops";
    ops.appendChild(makeOpBtn("全て展開", async () => {
      setBusy(true);
      await expandAll();
      refreshButtons();
      updateTotalLine();
      reapplyIfNeeded();
      setBusy(false);
    }));
    ops.appendChild(makeOpBtn("リセット", () => {
      setBusy(true);
      resetFilter();
      setActive(null);
      clearSelectedUI();
      setBusy(false);
    }));
    panel.appendChild(ops);

    document.body.appendChild(panel);
    dragEnable(panel, header);
    return panel;
  }

  function makeOpBtn(text, handler) {
    const btn = document.createElement("button");
    btn.className = BTN_CLASS + " ejcf-op";
    btn.textContent = text;
    btn.addEventListener("click", handler);
    return btn;
  }

  // ===== Items / Labels =====
  const getAllItemEls = () => {
    const cart = qAll(SEL.cartListItems);
    const later = qAll(SEL.laterListItems);
    return [...cart, ...later];
  };

  const extractLabels = (itemEl) => {
    const labels = new Set();
    const tagWrap = itemEl.querySelector(SEL.tagWrap.join(", ")) || itemEl;
    tagWrap.querySelectorAll(SEL.tag.join(", ")).forEach(span => {
      const t = (span.textContent || "").trim().replace(/\s+/g, "");
      if (t) labels.add(t);
    });
    if (labels.size === 0) labels.add("ラベルなし");
    return Array.from(labels);
  };

  const computeLabelMap = () => {
    const map = new Map();
    getAllItemEls().forEach(item => {
      const labels = extractLabels(item);
      labels.forEach(l => {
        if (!map.has(l)) map.set(l, { count: 0, items: new Set() });
        const v = map.get(l);
        v.count += 1; v.items.add(item);
      });
      item.dataset.ejcfLabels = labels.join("||");
    });
    return map;
  };

  function makeLabelBtn(label, count) {
    const btn = document.createElement("button");
    btn.className = BTN_CLASS;
    btn.setAttribute(COUNT_ATTR, String(count));
    btn.title = `${label} (${count})`;
    btn.innerHTML = `${escapeHtml(label)}<br><small>${count}</small>`;
    btn.setAttribute("data-ejcf-label", label);
    btn.addEventListener("click", async () => {
      if (isBusy) return;
      setBusy(true);
      setActive(label);
      applyFilter(label);
      clearSelectedUI();
      btn.classList.add(SELECTED_CLASS);
      btn.setAttribute("aria-pressed", "true");
      refreshButtons();
      updateTotalLine();
      reapplyIfNeeded();
      setBusy(false);
    });
    if (getActive() && getActive() === label) {
      btn.classList.add(SELECTED_CLASS);
      btn.setAttribute("aria-pressed", "true");
    }
    if (isBusy) btn.setAttribute("disabled", "true");
    return btn;
  }

  function refreshButtons() {
    const panel = ensurePanel();
    const wrap = panel.querySelector(".ejcf-buttons");
    wrap.innerHTML = "";
    const map = computeLabelMap();
    const entries = Array.from(map.entries())
      .sort(([a], [b]) => labelSortKey(a).localeCompare(labelSortKey(b), "ja"));

    if (entries.length === 0) {
      const empty = document.createElement("button");
      empty.className = BTN_CLASS;
      empty.setAttribute("disabled", "true");
      empty.innerHTML = `商品なし<br><small>0</small>`;
      wrap.appendChild(empty);
      return;
    }

    for (const [label, info] of entries) {
      wrap.appendChild(makeLabelBtn(label, info.count));
    }
  }

  function clearSelectedUI() {
    document.querySelectorAll(`#${PANEL_ID} .${BTN_CLASS}.${SELECTED_CLASS}`)
      .forEach(b => b.classList.remove(SELECTED_CLASS));
    document.querySelectorAll(`#${PANEL_ID} .${BTN_CLASS}[aria-pressed="true"]`)
      .forEach(b => b.removeAttribute("aria-pressed"));
  }

  function labelSortKey(s) {
    const t = s.toUpperCase();
    if (/^[0-9]+%OFF$/.test(t)) return `0-${t.padStart(8,"0")}`;
    if (/^[0-9]+%獲得$/.test(s)) return `1-${t}`;
    if (/^(NEW|新刊|新着)/.test(s)) return `2-${t}`;
    if (s === "ラベルなし") return `9-`;
    return `5-${t}`;
  }

  function applyFilter(label) {
    const items = getAllItemEls();
    items.forEach(el => {
      const has = (el.dataset.ejcfLabels || "").split("||").includes(label);
      el.classList.toggle(HIDDEN_CLASS, !has);
    });
  }
  function updateTotalLine() {
    try {
      const el = document.getElementById(PANEL_ID + "-total");
      if (!el) return;
      const total = getAllItemEls().length;
      el.textContent = `合計 ${total} 件`;
    } catch {}
  }

  function reapplyIfNeeded() {
    const active = getActive();
    if (active) {
      applyFilter(active);
      const btn = Array.from(document.querySelectorAll(`#${PANEL_ID} .${BTN_CLASS}`))
        .find(b => b.getAttribute("data-ejcf-label") === active);
      clearSelectedUI();
      if (btn) {
        btn.classList.add(SELECTED_CLASS);
        btn.setAttribute("aria-pressed", "true");
      }
    }
  }

  function resetFilter() {
    getAllItemEls().forEach(el => el.classList.remove(HIDDEN_CLASS));
  }

  async function expandAll() {
    const toggles = Array.from(document.querySelectorAll(SEL.moreToggles.join(", ")));
    let clicked = 0;
    toggles.forEach(node => {
      const txt = (node.textContent || "").trim();
      if (/開く/.test(txt)) { node.dispatchEvent(new MouseEvent("click", { bubbles: true })); clicked++; }
    });
    if (clicked > 0) await waitFor(300);
  }

  function setupObserver() {
    const conf = { childList: true, subtree: true };
    const debounced = debounce(async () => {
      if (!hasCartDomLoose()) return;
      setBusy(true);
      await expandAll();
      refreshButtons();
      updateTotalLine();
      reapplyIfNeeded();
      setBusy(false);
    }, 250);
    const mo = new MutationObserver(debounced);
    mo.observe(document.body, conf);
    observers.push(mo);
  }

  function disconnectObservers() {
    observers.forEach(mo => { try { mo.disconnect(); } catch {} });
    observers = [];
  }

  async function boot() {
    if (booted) return;
    injectInlineCSS();
    document.documentElement.dataset.ejcfVersion = VERSION;

    const start = performance.now();
    while (!(isOnCartPath() && hasCartDomLoose()) && performance.now() - start < 15000) {
      await waitFor(150);
    }
    if (!(isOnCartPath() && hasCartDomLoose())) return;

    booted = true;
    setBusy(true);
    await expandAll();
    refreshButtons();
      updateTotalLine();
    reapplyIfNeeded();
    setupObserver();
    setBusy(false);
  }

  function teardown() {
    disconnectObservers();
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
    booted = false;
  }

  // --- URL / DOM Change Detection ---
  function installUrlGuards() {
    if (window.__ejcfUrlGuardInstalled) return;
    window.__ejcfUrlGuardInstalled = true;

    const fire = () => window.dispatchEvent(new Event("ejcf-location-change"));

    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function() { origPush.apply(this, arguments); fire(); };
    history.replaceState = function() { origReplace.apply(this, arguments); fire(); };
    window.addEventListener("popstate", fire);

    // href polling
    setInterval(() => {
      if (location.href !== hrefSnapshot) {
        hrefSnapshot = location.href;
        fire();
      }
    }, 400);

    // global mutation
    const mo = new MutationObserver(() => fire());
    mo.observe(document.documentElement, {subtree: true, childList: true});
  }

  function handleRoute() {
    setTimeout(() => {
      if (isOnCartPath() && hasCartDomLoose()) boot();
      else teardown();
    }, 120);
  }

  // init
  installUrlGuards();
  window.addEventListener("ejcf-location-change", handleRoute);
  handleRoute();
})();
