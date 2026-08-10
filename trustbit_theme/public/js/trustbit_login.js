/* ==========================================================================
   Trustbit ERP — login layout enhancer
   Wraps Frappe's existing login markup in a split-screen shell and adds a
   brand panel. It MOVES existing nodes (never rebuilds them), so every event
   handler Frappe's login.js binds stays attached.
   Entirely wrapped in try/catch: if anything fails, the stock login page is
   left exactly as it was and authentication is unaffected.
   ========================================================================== */
(function () {
	"use strict";

	/* ======================================================================
	   CONFIGURE ME — this is the only block you need to edit per project.
	   Everything below it is generic and site-agnostic.
	   ====================================================================== */
	var CONFIG = {
		// Brand-panel logo. Leave null to reuse the site's own logo
		// (Website Settings → App Logo) already rendered on the login card,
		// so a fresh install is branded correctly with zero edits.
		logo: null,

		// Small badge beside the logo. Set to "" to hide it.
		badge: "ERP",

		// Pill above the headline. "{app}" is replaced with the site's app name.
		eyebrow: "Internal Workspace &middot; {app}",

		// Headline. Rendered as two lines; the second gets the gradient accent.
		// Keep the accent to 2+ words — the prism effect targets the 2nd span.
		headline: "Where your team gets",
		headlineAccent: "work done.",

		intro:
			"Sign in to pick up your tasks, log your hours, and keep every " +
			"project moving &mdash; one workspace for the whole team.",

		features: [
			"Your tasks, deadlines and project progress",
			"Log hours against projects and activities",
			"Leave, attendance and team requests",
		],

		// null → "© <year> <app name>"
		footer: null,
	};
	/* ==================== end of configuration ==================== */

	function esc(s) {
		return String(s == null ? "" : s);
	}

	/** Site's display name, from Website Settings via the rendered page. */
	function appName() {
		var el = document.querySelector(".page-card-head img");
		var alt = el && el.getAttribute("alt");
		if (alt && alt.trim()) return alt.trim();
		var t = (document.title || "").trim();
		// login pages are titled "Login" — not useful as a brand name
		return t && t.toLowerCase() !== "login" ? t : "";
	}

	/** Reuse the site's own logo unless one is configured explicitly. */
	function logoSrc() {
		if (CONFIG.logo) return CONFIG.logo;
		var el = document.querySelector(".page-card-head img");
		return (el && el.getAttribute("src")) || "";
	}

	function tick() {
		return (
			'<i class="tb-tick"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></i>'
		);
	}

	function brandHTML() {
		var app = appName();
		var src = logoSrc();
		var eyebrow = esc(CONFIG.eyebrow).replace("{app}", app || "Workspace");
		var accentWords = esc(CONFIG.headlineAccent).split(/\s+/).filter(Boolean);

		var out = [
			'<div class="tb-aurora"><i class="tb-blob tb-b1"></i><i class="tb-blob tb-b2"></i><i class="tb-blob tb-b3"></i></div>',
			// grid is a real element, not ::after — the prism rake needs that pseudo
			'<i class="tb-grid"></i>',
			'<div class="tb-logo-row">',
		];
		// If the site has no logo configured, fall back to its name as text
		// rather than rendering a broken <img>.
		out.push(
			src
				? '  <img class="tb-logo-img" src="' + esc(src) + '" alt="' + esc(app) + '">'
				: '  <span class="tb-logo-text">' + esc(app || "Workspace") + "</span>"
		);
		if (CONFIG.badge) out.push('  <span class="tb-logo-erp">' + esc(CONFIG.badge) + "</span>");
		out.push("</div>", '<div class="tb-pitch">');
		out.push('  <div class="tb-eyebrow"><i class="tb-dot"></i> ' + eyebrow + "</div>");
		// The headline is split into two LINE SPANS on purpose. The chromatic
		// split animates text-shadow on these spans, never on the <h1> itself —
		// animating it on an h1 that contains background-clip:text spans
		// intermittently drops the whole headline's paint in Chrome.
		out.push(
			'  <h1><span class="tb-h1line1">' + esc(CONFIG.headline) + "</span>" +
				'<span class="tb-h1line2">' +
				accentWords
					.map(function (w) {
						return '<span class="tb-accent">' + esc(w) + "</span>";
					})
					.join(" ") +
				"</span></h1>"
		);
		out.push("  <p>" + esc(CONFIG.intro) + "</p>");
		out.push('  <ul class="tb-features">');
		(CONFIG.features || []).forEach(function (f) {
			out.push("    <li>" + tick() + " " + esc(f) + "</li>");
		});
		out.push("  </ul>", "</div>");
		out.push(
			'<div class="tb-foot">' +
				(CONFIG.footer || "&copy; " + new Date().getFullYear() + (app ? " " + esc(app) : "")) +
				"</div>"
		);
		return out.join("\n");
	}

	function enhance() {
		if (document.body.getAttribute("data-path") !== "login") return;
		if (document.querySelector(".tb-shell")) return; // already applied

		var content = document.querySelector(".page_content");
		if (!content) return; // unknown markup — leave stock page alone

		var shell = document.createElement("div");
		shell.className = "tb-shell";

		var brand = document.createElement("aside");
		brand.className = "tb-brand";
		brand.innerHTML = brandHTML();

		var formside = document.createElement("div");
		formside.className = "tb-formside";

		// Insert the shell where .page_content lives, then MOVE the node in.
		content.parentNode.insertBefore(shell, content);
		formside.appendChild(content); // move preserves all bound handlers
		shell.appendChild(brand);
		shell.appendChild(formside);
	}

	/* Frappe swaps between the login / forgot / signup cards by toggling the
	   `hide` class. A CSS entrance animation only fires once, so replay it
	   when a card becomes visible again. This ONLY adds and removes a
	   cosmetic class — it never touches form structure, values or handlers.
	   The `tbAnim` guard prevents the observer re-entering on its own
	   class mutation. */
	function watchPanels() {
		if (typeof MutationObserver !== "function") return;
		var cards = document.querySelectorAll(".login-content.page-card");
		if (!cards.length) return;

		var obs = new MutationObserver(function (muts) {
			for (var i = 0; i < muts.length; i++) {
				var m = muts[i];
				if (m.type !== "attributes" || m.attributeName !== "class") continue;
				var el = m.target;
				if (el.classList.contains("hide")) continue;
				if (el.dataset.tbAnim === "1") continue;
				el.dataset.tbAnim = "1";
				el.classList.remove("tb-replay");
				void el.offsetWidth; // force reflow so the animation restarts
				el.classList.add("tb-replay");
				(function (node) {
					setTimeout(function () {
						delete node.dataset.tbAnim;
					}, 500);
				})(el);
			}
		});

		for (var j = 0; j < cards.length; j++) {
			obs.observe(cards[j], { attributes: true, attributeFilter: ["class"] });
		}
	}

	/* ---- PRISM: pointer-driven glass glint on the card ----
	   Purely decorative. The CSS falls back to a fixed top-left glint without
	   it, so a failure here costs nothing. Called from boot() (NOT as an IIFE)
	   because the card must exist in the DOM first. Writes are coalesced into
	   one rAF, and it is inert under prefers-reduced-motion. */
	function initPrismGlint() {
		var root = document.documentElement;
		if (root.__prismBound) return; // idempotent
		if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		var card = document.querySelector(".login-content.page-card");
		if (!card) return; // flag stays unset so a later call can still bind
		root.__prismBound = true;

		var x = 22, y = 8, frame = 0;
		function paint() {
			frame = 0;
			card.style.setProperty("--prism-x", x.toFixed(1) + "%");
			card.style.setProperty("--prism-y", y.toFixed(1) + "%");
		}
		function schedule() { if (!frame) frame = requestAnimationFrame(paint); }
		function onMove(e) {
			var r = card.getBoundingClientRect();
			if (!r.width || !r.height) return;
			x = ((e.clientX - r.left) / r.width) * 100;
			y = ((e.clientY - r.top) / r.height) * 100;
			schedule();
		}
		function rest() { x = 22; y = 8; schedule(); }

		card.addEventListener("mousemove", onMove);
		card.addEventListener("mouseleave", rest);
		window.addEventListener("blur", rest);
	}

	function boot() {
		try {
			enhance();
			watchPanels();
			initPrismGlint();
		} catch (e) {
			// Never let a cosmetic failure block sign-in.
			if (window.console && console.warn) {
				console.warn("[trustbit_theme] login enhance skipped:", e);
			}
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot);
	} else {
		boot();
	}
})();
