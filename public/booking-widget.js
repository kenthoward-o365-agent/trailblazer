/*!
 * Trailblazer Booking Widget
 * Drop this on any page:
 *   <div data-tb-booking data-slug="YOUR_SLUG"></div>
 *   <script src="https://YOUR_APP/booking-widget.js" async></script>
 * Optional data attributes: data-primary, data-label, data-radius, data-layout ("inline"|"stacked")
 */
(function () {
  if (window.__tbBookingLoaded) return;
  window.__tbBookingLoaded = true;

  var SCRIPT = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();
  var ORIGIN = new URL(SCRIPT.src).origin;

  function todayIso(offset) {
    var d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    return d.toISOString().slice(0, 10);
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "style") Object.assign(e.style, attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  function parseTypes(host) {
    var raw = host.getAttribute("data-site-types");
    if (!raw) return [];
    try { return JSON.parse(raw) || []; } catch (e) { return []; }
  }


  function mount(host) {
    var slug = host.getAttribute("data-slug");
    if (!slug) return;
    var primary = host.getAttribute("data-primary") || "#0f766e";
    var label = host.getAttribute("data-label") || "Check availability";
    var radius = host.getAttribute("data-radius") || "8px";
    var layout = host.getAttribute("data-layout") || "inline"; // inline | stacked

    host.innerHTML = "";
    host.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

    var wrap = el("form", {
      style: {
        display: "grid",
        gridTemplateColumns: layout === "stacked" ? "1fr" : "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "10px",
        alignItems: "end",
        padding: "16px",
        background: "#fff",
        border: "1px solid rgba(0,0,0,.08)",
        borderRadius: radius,
        boxShadow: "0 4px 20px rgba(0,0,0,.06)",
        maxWidth: "980px",
      },
    });

    function field(labelText, input) {
      var lbl = el("label", { style: { fontSize: "12px", fontWeight: "600", color: "#334155", display: "block", marginBottom: "4px" } }, [labelText]);
      var w = el("div", null, [lbl, input]);
      return w;
    }

    var inStyle = { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: radius, fontSize: "14px", boxSizing: "border-box" };
    var ci = el("input", { type: "date", name: "checkin", value: todayIso(1), style: inStyle });
    var co = el("input", { type: "date", name: "checkout", value: todayIso(3), style: inStyle });
    var gu = el("input", { type: "number", name: "guests", min: "1", max: "20", value: "2", style: inStyle });
    var showTypes = host.getAttribute("data-show-site-type") !== "false";
    var types = parseTypes(host);
    var st = el("select", { name: "site_type_id", style: inStyle }, [el("option", { value: "" }, ["Any site type"])]);
    types.forEach(function (t) {
      st.appendChild(el("option", { value: t.id }, [t.name]));
    });

    var btn = el("button", {
      type: "submit",
      style: {
        padding: "11px 18px",
        background: primary,
        color: "#fff",
        border: "0",
        borderRadius: radius,
        fontWeight: "600",
        cursor: "pointer",
        fontSize: "14px",
      },
    }, [label]);

    wrap.appendChild(field("Check-in", ci));
    wrap.appendChild(field("Check-out", co));
    wrap.appendChild(field("Guests", gu));
    if (showTypes) wrap.appendChild(field("Site type", st));
    wrap.appendChild(btn);

    wrap.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var qs = new URLSearchParams({
        checkin: ci.value,
        checkout: co.value,
        guests: gu.value,
        auto: "1",
      });
      if (showTypes && st.value) qs.set("site_type_id", st.value);
      var url = ORIGIN + "/b/" + encodeURIComponent(slug) + "?" + qs.toString();
      window.open(url, host.getAttribute("data-target") || "_blank", "noopener");
    });

    host.appendChild(wrap);
  }

  function boot() {
    document.querySelectorAll("[data-tb-booking]:not([data-tb-mounted])").forEach(function (h) {
      h.setAttribute("data-tb-mounted", "1");
      mount(h);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
