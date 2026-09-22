(() => {
  "use strict";

  const DATA_URL = "./data/latest.json";
  const MARKET_URL = "./data/market.json";
  const CLASS_ORDER = { high_conviction: 0, watchlist: 1, avoid: 2 };

  const $ = (sel) => document.querySelector(sel);

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatAction = (action) =>
    String(action || "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const formatClass = (cls) =>
    String(cls || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const formatPrice = (n) => {
    if (n === null || n === undefined || n === "") return "-";
    if (typeof n === "number") {
      return n.toLocaleString("en-US", {
        minimumFractionDigits: n % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      });
    }
    return escapeHtml(n);
  };

  const formatTargets = (targets) => {
    if (!Array.isArray(targets) || !targets.length) return "-";
    return targets.map(formatPrice).join(" | ");
  };

  const formatGenerated = (iso) => {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return escapeHtml(iso);
      return d.toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return escapeHtml(iso);
    }
  };

  const robinhoodUrl = (ticker) => {
    const sym = String(ticker || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!sym) return "";
    return "https://robinhood.com/stocks/" + encodeURIComponent(sym);
  };

  const robinhoodLink = (ticker, label, extraClass) => {
    const url = robinhoodUrl(ticker);
    const text = label == null ? String(ticker || "") : String(label);
    if (!url) return escapeHtml(text);
    const cls = extraClass ? ' class="' + extraClass + '"' : ' class="rh-link"';
    return '<a' + cls + ' href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" title="Open on Robinhood">' +
      escapeHtml(text) + '</a>';
  };

  const impactClass = (impact) => {
    const key = String(impact || "").toLowerCase();
    if (key.includes("bull")) return "impact-bullish";
    if (key.includes("bear")) return "impact-bearish";
    if (key.includes("high")) return "impact-bearish";
    if (key.includes("medium") || key.includes("med")) return "impact-neutral";
    if (key.includes("low")) return "impact-bullish";
    return "impact-neutral";
  };

  const signalTone = (label) => {
    const key = String(label || "").toLowerCase();
    if (key.includes("strong bull")) return "signal-strong-bull";
    if (key.includes("bull")) return "signal-bull";
    if (key.includes("strong bear")) return "signal-strong-bear";
    if (key.includes("bear")) return "signal-bear";
    return "signal-neutral";
  };

  /** Primary trader notes from ticker detail (prefer `primary`, fall back to legacy `han`). */
  const primaryView = (detail) => {
    if (!detail || typeof detail !== "object") return {};
    return detail.primary || detail.han || {};
  };

  const TAB_NAMES = ["market", "stocks", "cassy"];
  const MARKET_STALE_MS = 24 * 60 * 60 * 1000;

  /**
   * Switch whichever Market / Stocks / Cassy nodes exist.
   * A missing button or panel must not freeze the other tabs.
   */
  const applyTab = (tab, tabNames) => {
    const names = Array.isArray(tabNames) && tabNames.length ? tabNames : TAB_NAMES;
    const requested = names.indexOf(tab) >= 0 ? tab : names[0];
    const nodes = [];
    names.forEach((name) => {
      const btn = document.getElementById("tab-btn-" + name);
      const panel = document.getElementById("panel-" + name);
      if (btn && panel) nodes.push({ name: name, btn: btn, panel: panel });
    });
    if (!nodes.length) return { active: null, applied: false };

    const known = nodes.some((node) => node.name === requested);
    const active = known ? requested : nodes[0].name;
    nodes.forEach((node) => {
      const on = node.name === active;
      node.btn.setAttribute("aria-selected", on ? "true" : "false");
      node.panel.hidden = !on;
    });
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      const name = btn.getAttribute("data-tab");
      if (!nodes.some((node) => node.name === name)) {
        btn.setAttribute("aria-selected", "false");
      }
    });
    return { active: active, applied: known };
  };

  const marketFeedStamp = (generatedAt, updatedAt) => {
    if (generatedAt != null && generatedAt !== "" && Number.isFinite(Date.parse(generatedAt))) {
      return String(generatedAt);
    }
    if (updatedAt != null && updatedAt !== "" && Number.isFinite(Date.parse(updatedAt))) {
      return String(updatedAt);
    }
    return "";
  };

  const isMarketFeedStale = (generatedAt, updatedAt, nowMs) => {
    const stamp = marketFeedStamp(generatedAt, updatedAt);
    const ms = Date.parse(stamp);
    if (!Number.isFinite(ms)) return false;
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    return now - ms > MARKET_STALE_MS;
  };

  const marketPausedNoticeHtml = (generatedAt, updatedAt, nowMs) => {
    if (!isMarketFeedStale(generatedAt, updatedAt, nowMs)) return "";
    const stamp = marketFeedStamp(generatedAt, updatedAt);
    return (
      '<div class="panel market-notice market-stale" role="status">' +
      "<strong>Market feed paused — last update " +
      formatGenerated(stamp) +
      ".</strong></div>"
    );
  };

  const mountMarketPausedNotice = (root, generatedAt, updatedAt, nowMs) => {
    if (!root || typeof root.insertAdjacentHTML !== "function") return false;
    if (typeof root.querySelector === "function") {
      const existing = root.querySelector(".market-stale");
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    }
    const html = marketPausedNoticeHtml(generatedAt, updatedAt, nowMs);
    if (!html) return false;
    root.insertAdjacentHTML("afterbegin", html);
    return true;
  };

  window.TradeDesk = {
    $,
    escapeHtml,
    formatAction,
    formatClass,
    formatPrice,
    formatTargets,
    formatGenerated,
    robinhoodUrl,
    robinhoodLink,
    impactClass,
    signalTone,
    primaryView,
    applyTab,
    marketFeedStamp,
    isMarketFeedStale,
    marketPausedNoticeHtml,
    mountMarketPausedNotice,
    CLASS_ORDER,
    DATA_URL,
    MARKET_URL,
    TAB_NAMES,
    MARKET_STALE_MS,
  };
})();
