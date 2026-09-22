import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const { $, escapeHtml, formatGenerated } = window.TradeDesk;
const { renderMarketTab } = window.TradeDeskMarket;
const { renderStocksTab } = window.TradeDeskStocks;

const TAB_KEY = "trade-desk-tab";
const TAB_KEY_LEGACY = "han-dash-tab";
const cfg = window.TRADE_DESK_SUPABASE || window.HAN_SUPABASE || {};

if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
  $("#loading").hidden = true;
  $("#error").hidden = false;
  $("#error-message").textContent = "Missing Supabase config (config.js).";
} else {
  const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      flowType: "pkce",
    },
  });

  let dashboardLoadedForUser = null;

  function authRedirectTo() {
    return (
      window.location.origin +
      window.location.pathname.replace(/\/index\.html$/, "/")
    );
  }

  const TABS = ["market", "stocks", "cassy"];

  function readSavedTab() {
    try {
      let saved = localStorage.getItem(TAB_KEY);
      if (TABS.indexOf(saved) >= 0) return saved;
      const legacy = localStorage.getItem(TAB_KEY_LEGACY);
      if (legacy === "market" || legacy === "stocks") {
        localStorage.setItem(TAB_KEY, legacy);
        return legacy;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function setTab(tab) {
    const active = TABS.indexOf(tab) >= 0 ? tab : "market";
    const nodes = TABS.map((name) => ({
      btn: $("#tab-btn-" + name),
      panel: $("#panel-" + name),
    }));
    if (nodes.some((node) => !node.btn || !node.panel)) return;

    nodes.forEach((node, i) => {
      const on = TABS[i] === active;
      node.btn.setAttribute("aria-selected", on ? "true" : "false");
      node.panel.hidden = !on;
    });
    try {
      localStorage.setItem(TAB_KEY, active);
    } catch {
      /* ignore */
    }
  }

  function bindTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setTab(btn.getAttribute("data-tab") || "market");
      });
    });
  }

  function pickDefaultTab(marketData, stocksData, cassyData) {
    const saved = readSavedTab();
    if (saved === "market" && marketData) return "market";
    if (saved === "stocks" && stocksData) return "stocks";
    if (saved === "cassy" && cassyData) return "cassy";
    if (marketData) return "market";
    if (stocksData) return "stocks";
    if (cassyData) return "cassy";
    return "market";
  }

  function renderFooter(stocksData, marketData, cassyData) {
    const parts = [];
    if (stocksData) {
      const ctx = stocksData.market_context || {};
      parts.push(
        "<div><strong>Stocks feed:</strong> " +
          escapeHtml(formatGenerated(stocksData.generated_at)) +
          " / " +
          escapeHtml(stocksData.source || "-") +
          "</div>"
      );
      if (ctx.fomc || ctx.note) {
        parts.push(
          "<div><strong>Market context:</strong> FOMC " +
            escapeHtml(ctx.fomc || "-") +
            " | " +
            escapeHtml(ctx.note || "") +
            "</div>"
        );
      }
    } else {
      parts.push("<div><strong>Stocks feed:</strong> unavailable</div>");
    }
    if (marketData) {
      parts.push(
        "<div><strong>Cary market:</strong> " +
          escapeHtml(formatGenerated(marketData.generated_at)) +
          " / " +
          escapeHtml(marketData.source || "Cary market intelligence") +
          "</div>"
      );
    } else {
      parts.push("<div><strong>Cary market:</strong> unavailable</div>");
    }
    if (cassyData) {
      parts.push(
        "<div><strong>Cassy feed:</strong> " +
          escapeHtml(formatGenerated(cassyData.generated_at)) +
          " / " +
          escapeHtml(cassyData.source || "Cassy") +
          "</div>"
      );
      const cassyNote = cassyData.market_context && cassyData.market_context.note;
      if (cassyNote) {
        parts.push("<div><strong>Cassy context:</strong> " + escapeHtml(cassyNote) + "</div>");
      }
    } else {
      parts.push("<div><strong>Cassy feed:</strong> unavailable</div>");
    }
    $("#footer-meta").innerHTML = parts.join("");

    const badgeTimes = [];
    if (marketData && marketData.generated_at) badgeTimes.push(formatGenerated(marketData.generated_at));
    if (stocksData && stocksData.generated_at) badgeTimes.push(formatGenerated(stocksData.generated_at));
    if (cassyData && cassyData.generated_at) badgeTimes.push(formatGenerated(cassyData.generated_at));
    const badge = $("#generated-badge");
    if (badge) {
      badge.textContent = badgeTimes[0] || "-";
      badge.hidden = false;
    }

    const feedBadge = $("#feed-badge");
    if (feedBadge) {
      const present = [marketData, stocksData, cassyData].filter(Boolean).length;
      if (present === 3) {
        feedBadge.textContent = "Live feeds";
        feedBadge.hidden = false;
      } else if (present > 0) {
        feedBadge.textContent = "Partial feeds";
        feedBadge.hidden = false;
      } else {
        feedBadge.hidden = true;
      }
    }
  }

  function showLoginOnly() {
    dashboardLoadedForUser = null;
    $("#loading").hidden = true;
    $("#login").hidden = false;
    $("#app").hidden = true;
    $("#error").hidden = true;
    $("#auth-user").hidden = true;
    const badge = $("#generated-badge");
    if (badge) badge.hidden = true;
    const feedBadge = $("#feed-badge");
    if (feedBadge) feedBadge.hidden = true;
    $("#footer-meta").innerHTML = "<div>Sign in to load protected feeds.</div>";
  }

  function showAuthedChrome(email) {
    $("#login").hidden = true;
    $("#auth-user").hidden = false;
    $("#user-email").textContent = email || "Signed in";
  }

  async function fetchFeeds() {
    const { data, error } = await supabase
      .from("dashboard_feeds")
      .select("id,payload,updated_at");
    if (error) throw error;
    let stocksData = null;
    let stocksLegacy = null;
    let marketData = null;
    let cassyData = null;
    (data || []).forEach((row) => {
      if (row.id === "stocks") stocksData = row.payload;
      else if (row.id === "han_view") stocksLegacy = row.payload;
      if (row.id === "cary_market") marketData = row.payload;
      if (row.id === "cassy") cassyData = row.payload;
    });
    // Prefer `stocks`; fall back to legacy feed id `han_view`.
    if (!stocksData) stocksData = stocksLegacy;
    return { stocksData, marketData, cassyData };
  }

  function cassyHasContent(data) {
    if (!data || typeof data !== "object") return false;
    if (Array.isArray(data.dashboard) && data.dashboard.length) return true;
    if (Array.isArray(data.tickers) && data.tickers.length) return true;
    if (Array.isArray(data.posts) && data.posts.length) return true;
    if (data.best_opportunity && typeof data.best_opportunity === "object") return true;
    return false;
  }

  function renderCassyTab(cassyData) {
    renderStocksTab(cassyHasContent(cassyData) ? cassyData : null, {
      root: "#cassy-root",
      idPrefix: "cassy",
      sectionTitle: "Cassy trades",
      sectionSub:
        "Cassy research · high conviction → watchlist → avoid · click a row for analysis · ticker & price open on Robinhood",
      analysisTitle: "Cassy analysis",
      levelsKey: "cassy",
      levelsTitle: "Cassy",
      resilient: true,
      emptyHtml:
        '<div class="panel market-notice"><strong>No Cassy feed yet.</strong></div>',
    });
  }

  async function loadDashboard() {
    $("#loading").hidden = false;
    $("#loading").querySelector("p").textContent = "Loading protected feeds...";
    $("#error").hidden = true;

    try {
      const { stocksData, marketData, cassyData } = await fetchFeeds();
      $("#loading").hidden = true;

      if (!marketData && !stocksData && !cassyData) {
        $("#error").hidden = false;
        $("#error-message").textContent =
          "No feed rows returned. Check RLS and that you are signed in.";
        $("#app").hidden = true;
        renderFooter(null, null, null);
        return;
      }

      $("#error").hidden = true;
      $("#app").hidden = false;
      renderMarketTab(marketData);
      renderStocksTab(stocksData);
      renderCassyTab(cassyData);
      setTab(pickDefaultTab(marketData, stocksData, cassyData));
      if (window.TradeDeskPrices) {
        window.TradeDeskPrices.stop();
        if (stocksData || cassyData) {
          window.TradeDeskPrices.start({
            supabase,
            supabaseUrl: cfg.SUPABASE_URL,
            anonKey: cfg.SUPABASE_ANON_KEY,
          });
        }
      }
      renderFooter(stocksData, marketData, cassyData);
    } catch (err) {
      console.error(err);
      $("#loading").hidden = true;
      $("#app").hidden = true;
      $("#error").hidden = false;
      $("#error-message").textContent =
        (err && (err.message || String(err))) || "Failed to load feeds from Supabase.";
      renderFooter(null, null, null);
    }
  }

  async function onSignedIn(session) {
    const uid = session.user && session.user.id;
    showAuthedChrome(session.user && session.user.email);
    if (uid && dashboardLoadedForUser === uid) return;
    dashboardLoadedForUser = uid || "session";
    await loadDashboard();
  }

  function bindAuthUi() {
    const form = $("#login-form");
    const status = $("#login-status");
    const submit = $("#login-submit");
    const googleBtn = $("#google-sign-in");

    googleBtn.addEventListener("click", async () => {
      status.classList.remove("is-error", "is-success");
      status.textContent = "Redirecting to Google...";
      googleBtn.disabled = true;
      submit.disabled = true;
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: authRedirectTo(),
            queryParams: {
              access_type: "offline",
              prompt: "select_account",
            },
          },
        });
        if (error) throw error;
      } catch (err) {
        console.error(err);
        status.classList.add("is-error");
        const msg = (err && err.message) || "Google sign-in failed.";
        const hint =
          /provider|not enabled|unsupported|oauth/i.test(msg)
            ? " Enable Google under Supabase Authentication → Providers and paste the OAuth Client ID + Secret."
            : "";
        status.textContent = msg + hint;
        googleBtn.disabled = false;
        submit.disabled = false;
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = ($("#login-email").value || "").trim();
      if (!email) return;
      status.classList.remove("is-error", "is-success");
      status.textContent = "Sending magic link...";
      submit.disabled = true;
      googleBtn.disabled = true;
      try {
        const redirectTo = authRedirectTo();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        status.classList.add("is-success");
        status.textContent =
          "Check your email for the magic link. After you click it, you will return here signed in.";
      } catch (err) {
        console.error(err);
        status.classList.add("is-error");
        status.textContent =
          (err && err.message) || "Could not send magic link. Check Auth redirect URLs.";
      } finally {
        submit.disabled = false;
        googleBtn.disabled = false;
      }
    });

    $("#sign-out-btn").addEventListener("click", async () => {
      await supabase.auth.signOut();
      $("#app").hidden = true;
      showLoginOnly();
      status.classList.remove("is-error", "is-success");
      status.textContent = "Signed out.";
    });
  }

  async function boot() {
    bindTabs();
    bindAuthUi();

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        if (window.TradeDeskPrices) window.TradeDeskPrices.stop();
        showLoginOnly();
        return;
      }
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        await onSignedIn(session);
      }
    });

    const { data, error } = await supabase.auth.getSession();
    if (error) console.error(error);

    const session = data && data.session;
    if (!session) {
      showLoginOnly();
      return;
    }
    await onSignedIn(session);
  }

  boot();
}
