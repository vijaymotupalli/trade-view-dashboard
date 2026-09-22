(() => {
  "use strict";

  const {
    escapeHtml,
    formatAction,
    formatClass,
    formatPrice,
    formatTargets,
    robinhoodLink,
    robinhoodUrl,
    primaryView,
    CLASS_ORDER,
  } = window.TradeDesk;


  function livePriceLink(ticker, label) {
    const sym = String(ticker || "").trim().toUpperCase();
    const text = label == null ? "" : String(label);
    const url = robinhoodUrl(sym);
    const safeSym = escapeHtml(sym);
    const safeText = escapeHtml(text);
    if (!url) {
      return '<span class="js-live-price" data-ticker="' + safeSym + '">' + safeText + "</span>";
    }
    return (
      '<a class="rh-link price-rh js-live-price" data-ticker="' +
      safeSym +
      '" href="' +
      escapeHtml(url) +
      '" target="_blank" rel="noopener noreferrer" title="Open on Robinhood">' +
      safeText +
      "</a>"
    );
  }

  function findTickerDetail(tickers, symbol) {
    const key = String(symbol || "").toUpperCase();
    if (!key || !Array.isArray(tickers)) return null;
    return tickers.find((t) => String(t.ticker || "").toUpperCase() === key) || null;
  }

  function hasTradeFields(obj) {
    return !!(obj && (obj.summary || obj.direction || obj.entry || obj.target || obj.stop));
  }

  function notesView(detail, notesKey) {
    let primary = Object.assign({}, primaryView(detail));
    const named =
      notesKey && detail && detail[notesKey] && typeof detail[notesKey] === "object"
        ? detail[notesKey]
        : null;
    if (!hasTradeFields(primary) && hasTradeFields(named)) primary = Object.assign({}, named);
    const levels = detail && detail.levels && typeof detail.levels === "object" ? detail.levels : null;
    if (levels) {
      if (!primary.entry && levels.entry) primary.entry = levels.entry;
      if (!primary.target && levels.target) primary.target = levels.target;
      if ((primary.stop == null || primary.stop === "") && levels.stop != null) primary.stop = levels.stop;
      if (!primary.direction && levels.direction) primary.direction = levels.direction;
    }
    if (!primary.summary && detail && (detail.summary || detail.thesis)) {
      primary.summary = detail.summary || detail.thesis;
    }
    return primary;
  }

  function renderExpandAnalysis(detail, ticker, opts) {
    const options = opts || {};
    if (!detail) {
      return '<p class="expand-empty">No deep analysis yet for ' + escapeHtml(ticker) + ".</p>";
    }
    const primary = options.resilient ? notesView(detail, options.notesKey) : primaryView(detail);
    let analysis = {};
    let opinion = "";
    if (options.resilient && typeof detail.analysis === "string") {
      opinion = detail.analysis;
    } else if (detail.analysis && typeof detail.analysis === "object") {
      analysis = detail.analysis;
      opinion = analysis.opinion;
    } else if (!options.resilient) {
      analysis = detail.analysis || {};
      opinion = analysis.opinion;
    }
    const risks = Array.isArray(analysis.risks) ? analysis.risks : [];
    const analysisTitle = options.analysisTitle || "My analysis";

    return (
      '<div class="card-cols">' +
      '<div class="col-box"><h4>Primary view</h4><dl class="kv">' +
      '<dt>Summary</dt><dd style="font-family:var(--font)">' +
      escapeHtml(primary.summary) +
      "</dd>" +
      "<dt>Direction</dt><dd>" +
      escapeHtml(primary.direction) +
      "</dd>" +
      "<dt>Entry</dt><dd>" +
      escapeHtml(primary.entry) +
      "</dd>" +
      "<dt>Target</dt><dd>" +
      escapeHtml(primary.target) +
      "</dd>" +
      "<dt>Stop</dt><dd>" +
      formatPrice(primary.stop) +
      "</dd></dl></div>" +
      '<div class="col-box mine"><h4>' +
      escapeHtml(analysisTitle) +
      "</h4><dl class=\"kv\">" +
      "<dt>Preferred</dt><dd>" +
      escapeHtml(analysis.preferred_entry) +
      "</dd>" +
      "<dt>Aggressive</dt><dd>" +
      formatPrice(analysis.aggressive_entry) +
      "</dd>" +
      "<dt>Conservative</dt><dd>" +
      formatPrice(analysis.conservative_entry) +
      "</dd>" +
      "<dt>Stop</dt><dd>" +
      formatPrice(analysis.stop) +
      "</dd>" +
      "<dt>Targets</dt><dd>" +
      formatTargets(analysis.targets) +
      "</dd>" +
      "<dt>Confidence</dt><dd>" +
      escapeHtml(analysis.confidence) +
      "</dd>" +
      "<dt>Horizon</dt><dd>" +
      escapeHtml(analysis.horizon) +
      "</dd></dl>" +
      '<p class="opinion">' +
      escapeHtml(opinion) +
      "</p>" +
      (risks.length
        ? '<ul class="risks">' +
          risks.map((r) => "<li>" + escapeHtml(r) + "</li>").join("") +
          "</ul>"
        : "") +
      '<p class="rh-card-link">' +
      robinhoodLink(ticker, "Open " + String(ticker || "") + " on Robinhood", "rh-link") +
      "</p>" +
      "</div></div>"
    );
  }

  function renderCompactStrip(best) {
    if (!best) {
      return '<div class="stocks-strip panel"><p class="section-sub">No best opportunity in data.</p></div>';
    }
    const actionClass = "action-" + escapeHtml(best.action || "WATCH_ONLY");
    return (
      '<div class="stocks-strip panel" aria-label="Best opportunity">' +
      '<div class="strip-left">' +
      '<span class="hero-label">Best opportunity</span>' +
      '<span class="strip-ticker">' +
      robinhoodLink(best.ticker, best.ticker, "rh-link hero-rh") +
      "</span>" +
      '<span class="action-badge ' +
      actionClass +
      '">' +
      escapeHtml(formatAction(best.action)) +
      "</span>" +
      "</div>" +
      '<div class="strip-right">' +
      '<span class="meta-chip mono">' +
      livePriceLink(best.ticker, formatPrice(best.current_price)) +
      "</span>" +
      robinhoodLink(best.ticker, "Open on Robinhood", "meta-chip rh-chip") +
      "</div></div>"
    );
  }

  function sortDashboard(rows) {
    return [...(rows || [])].sort((a, b) => {
      const ca = CLASS_ORDER[a.class] ?? 99;
      const cb = CLASS_ORDER[b.class] ?? 99;
      if (ca !== cb) return ca - cb;
      const tb = Date.parse(b.post_time_et || "") || 0;
      const ta = Date.parse(a.post_time_et || "") || 0;
      if (tb !== ta) return tb - ta;
      return String(a.ticker).localeCompare(String(b.ticker));
    });
  }

  function numberField(obj, keys) {
    if (!obj || typeof obj !== "object") return null;
    for (let i = 0; i < keys.length; i++) {
      const value = obj[keys[i]];
      if (value == null || value === "") continue;
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function metaFillLine(meta) {
    if (!meta || typeof meta !== "object") return "";
    const src = meta.fill_in && typeof meta.fill_in === "object" ? meta.fill_in : meta;
    const filled = numberField(src, [
      "filled",
      "filled_count",
      "fill_in_count",
      "with_analysis",
      "complete_count",
    ]);
    const total = numberField(src, ["total", "total_count", "ticker_count", "expected"]);
    const parts = [];
    if (filled != null && total != null) parts.push(filled + " of " + total + " filled in");
    else if (filled != null) parts.push(filled + " filled in");
    if (typeof meta.note === "string" && meta.note.trim()) parts.push(meta.note.trim());
    return parts.join(" · ");
  }

  function tickerToRow(detail) {
    const item = detail && typeof detail === "object" ? detail : {};
    const primary = primaryView(item);
    const analysis = item.analysis && typeof item.analysis === "object" ? item.analysis : {};
    const levels = item.levels && typeof item.levels === "object" ? item.levels : {};
    const targets = Array.isArray(analysis.targets) ? analysis.targets : [];
    return {
      ticker: item.ticker || item.symbol || "",
      company: item.company || item.name || item.headline || item.title || "",
      current_price: item.current_price ?? primary.current_price ?? analysis.current_price ?? levels.price,
      class: item.class || analysis.class || "watchlist",
      direction: item.direction || primary.direction || analysis.direction || levels.direction || "",
      entry: item.entry || primary.entry || analysis.preferred_entry || levels.entry || "",
      target: item.target ?? primary.target ?? (targets.length ? targets[0] : levels.target),
      stop: item.stop ?? primary.stop ?? analysis.stop ?? levels.stop,
      status: item.status || analysis.status || "",
      my_rating: item.my_rating || item.rating || analysis.confidence || "",
      post_url: item.post_url || item.url || "",
      post_time_et: item.post_time_et || item.post_time || item.time || "",
      _detail: item,
    };
  }

  function resolveDashboardRows(data, resilient) {
    const dashboard = Array.isArray(data.dashboard) ? data.dashboard : null;
    if (!resilient) return data.dashboard;
    if (dashboard && dashboard.length) return dashboard;
    const posts = Array.isArray(data.posts) ? data.posts : null;
    if (posts && posts.length) return posts.map(tickerToRow);
    const tickers = Array.isArray(data.tickers) ? data.tickers : [];
    if (tickers.length) return tickers.map(tickerToRow);
    return dashboard || [];
  }

  function renderPostCell(row, resilient) {
    const time =
      '<span class="post-time">' + escapeHtml(row.post_time_et) + "</span>";
    if (resilient && !row.post_url) {
      return '<span class="story-nolink">No link</span>' + time;
    }
    return (
      '<a class="post-link" href="' +
      escapeHtml(row.post_url) +
      '" target="_blank" rel="noopener noreferrer">View</a>' +
      time
    );
  }

  function renderStocksTab(stocksData, options) {
    const opts = options || {};
    const root = document.querySelector(opts.root || "#stocks-root");
    if (!root) return;

    if (!stocksData) {
      root.innerHTML =
        opts.emptyHtml ||
        '<div class="panel market-notice"><strong>Stocks feed unavailable.</strong> Could not load protected feed data.</div>';
      return;
    }

    const resilient = !!opts.resilient;
    const idPrefix = opts.idPrefix ? String(opts.idPrefix) + "-" : "";
    const titleId = idPrefix + "dashboard-title";
    const tableId = idPrefix ? idPrefix + "dash-table" : "dash-table";
    const bodyId = idPrefix ? idPrefix + "dash-body" : "dash-body";
    const sectionTitle = opts.sectionTitle || "Trade Desk";
    const sectionSub =
      opts.sectionSub ||
      "High conviction → watchlist → avoid · click a row for deep analysis · ticker & price open on Robinhood";
    const metaLine = resilient ? metaFillLine(stocksData.meta) : "";
    const tickers = stocksData.tickers || [];
    const sorted = sortDashboard(resolveDashboardRows(stocksData, resilient));
    const colCount = 11;

    let tableBody;
    if (!sorted.length) {
      tableBody = '<tr><td colspan="' + colCount + '">No dashboard rows.</td></tr>';
    } else {
      tableBody = sorted
        .map((row, idx) => {
          const cls = escapeHtml(row.class || "watchlist");
          const dirRaw = String(row.direction || "");
          const dirClass = escapeHtml(dirRaw.replace(/[^A-Za-z]/g, "").toUpperCase() || "NA");
          const dir = escapeHtml(dirRaw);
          const priceLabel = formatPrice(row.current_price);
          const detail = findTickerDetail(tickers, row.ticker) || (resilient ? row._detail : null);
          const expandId = idPrefix + "expand-" + idx;

          const mainRow =
            '<tr class="dash-row" data-expand="' +
            expandId +
            '" tabindex="0" role="button" aria-expanded="false" aria-controls="' +
            expandId +
            '">' +
            '<td class="expand-cell"><span class="row-chevron" aria-hidden="true">▸</span></td>' +
            '<td class="ticker-cell">' +
            robinhoodLink(row.ticker, row.ticker, "rh-link ticker-rh") +
            '<span class="company">' +
            escapeHtml(row.company || "") +
            "</span></td>" +
            '<td class="mono current-price-cell">' +
            livePriceLink(row.ticker, priceLabel) +
            "</td>" +
            '<td><span class="class-pill class-' +
            cls +
            '">' +
            escapeHtml(formatClass(row.class)) +
            "</span></td>" +
            '<td class="dir-' +
            dirClass +
            '">' +
            (dir || "-") +
            "</td>" +
            '<td class="mono">' +
            escapeHtml(row.entry) +
            "</td>" +
            '<td class="mono">' +
            formatPrice(row.target) +
            "</td>" +
            '<td class="mono">' +
            formatPrice(row.stop) +
            "</td>" +
            "<td>" +
            escapeHtml(row.status) +
            "</td>" +
            '<td class="mono">' +
            escapeHtml(row.my_rating) +
            "</td>" +
            "<td>" +
            renderPostCell(row, resilient) +
            "</td>" +
            "</tr>";

          const expandRow =
            '<tr class="expand-row" id="' +
            expandId +
            '" hidden>' +
            '<td colspan="' +
            colCount +
            '"><div class="expand-body">' +
            renderExpandAnalysis(detail, row.ticker, opts) +
            "</div></td></tr>";

          return mainRow + expandRow;
        })
        .join("");
    }

    root.innerHTML =
      renderCompactStrip(stocksData.best_opportunity) +
      '<section class="section" aria-labelledby="' +
      titleId +
      '">' +
      '<div class="section-head">' +
      '<h2 id="' +
      titleId +
      '">' +
      escapeHtml(sectionTitle) +
      "</h2>" +
      '<p class="section-sub">' +
      escapeHtml(sectionSub) +
      "</p>" +
      (metaLine ? '<p class="section-sub">' + escapeHtml(metaLine) + "</p>" : "") +
      "</div>" +
      '<div class="table-wrap panel">' +
      '<table class="dash-table" id="' +
      tableId +
      '">' +
      "<thead><tr>" +
      '<th class="expand-th" aria-label="Expand"></th>' +
      "<th>Ticker</th><th>Current price</th><th>Class</th><th>Dir</th>" +
      "<th>Entry</th><th>Target</th><th>Stop</th><th>Status</th><th>Rating</th><th>Post</th>" +
      "</tr></thead>" +
      '<tbody id="' +
      bodyId +
      '">' +
      tableBody +
      "</tbody></table></div></section>";

    bindExpandHandlers(root);
  }

  function toggleExpand(row) {
    const id = row.getAttribute("data-expand");
    if (!id) return;
    const expand = document.getElementById(id);
    if (!expand) return;
    const scope = row.closest("#stocks-root, #cassy-root") || document;
    const open = expand.hidden === false;
    scope.querySelectorAll(".expand-row").forEach((r) => {
      r.hidden = true;
    });
    scope.querySelectorAll(".dash-row").forEach((r) => {
      r.classList.remove("is-expanded");
      r.setAttribute("aria-expanded", "false");
    });
    if (!open) {
      expand.hidden = false;
      row.classList.add("is-expanded");
      row.setAttribute("aria-expanded", "true");
    }
  }

  function bindExpandHandlers(root) {
    root.querySelectorAll(".dash-row").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        toggleExpand(row);
      });
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleExpand(row);
        }
      });
    });
  }

  window.TradeDeskStocks = { renderStocksTab };
})();
