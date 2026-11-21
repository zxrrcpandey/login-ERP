// Task Kanban: each card shows a status icon, and a Status button filters columns. On desktop, clicking a card opens the shared
// quick view and double-click opens the Task form. Touch screens keep Frappe's card sheet.
(() => {
	frappe.provide("frappe.kanban_v2.settings");
	const existing = frappe.kanban_v2.settings["Task"] || {};
	if (existing.trustbit_quick_view) return;

	const render_card = (card, el, ctx, page) => {
		const cleanup = existing.renderCard
			? existing.renderCard(card, el, ctx, page)
			: page.render_card(card, el);
		// The card's column is its saved status, so the icon always agrees with it.
		const status = card.status || ctx?.column?.id;
		el.querySelector(".kn-card-title")?.insertAdjacentHTML(
			"afterend",
			frappe.trustbit.task_status_icon_html(status)
		);
		return cleanup;
	};

	// Status filter: the columns are the statuses, so it shows or hides columns. Hiding them with
	// CSS survives Frappe re-rendering the board, and never changes the board or any task.
	const FILTER_STYLE_ID = "trustbit-kanban-status-filter";
	const FILTER_ATTRIBUTE = "data-trustbit-status-filter";

	const board_statuses = (page) =>
		(page.board_doc?.columns || [])
			.filter((column) => column.status !== "Archived")
			.map((column) => column.column_name);

	const filter_key = (page) =>
		`trustbit_kanban_hidden:${frappe.session.user}:${page.current_board}`;

	const get_hidden = (page) => {
		const statuses = board_statuses(page);
		let saved = [];
		try {
			saved = JSON.parse(localStorage.getItem(filter_key(page)) || "[]");
		} catch (e) {
			saved = [];
		}
		const hidden = statuses.filter((status) => saved.includes(status));
		return hidden.length < statuses.length ? hidden : [];
	};

	const update_filter_button = (page) => {
		const $label = page.$trustbit_status_button?.find(".trustbit-status-label");
		if (!$label) return;
		const total = board_statuses(page).length;
		const shown = total - get_hidden(page).length;
		$label.text(shown < total ? __("Status ({0}/{1})", [shown, total]) : __("Status"));
	};

	const apply_status_filter = (page) => {
		let style = document.getElementById(FILTER_STYLE_ID);
		if (!style) {
			style = document.createElement("style");
			style.id = FILTER_STYLE_ID;
			document.head.appendChild(style);
		}
		// Phones move between columns with chips, so they always keep every column.
		const hidden = frappe.is_mobile() ? [] : get_hidden(page);
		page.$container.attr(FILTER_ATTRIBUTE, "1");
		style.textContent = hidden.length
			? `${hidden
					.map(
						(status) =>
							`[${FILTER_ATTRIBUTE}] .kn-column[data-col="${CSS.escape(status)}"]`
					)
					.join(",")} { display: none !important; }`
			: "";
		update_filter_button(page);
	};

	const save_hidden = (page, hidden) => {
		const had_hidden = get_hidden(page);
		localStorage.setItem(filter_key(page), JSON.stringify(hidden));
		apply_status_filter(page);
		// Columns that were hidden have no measured height, so redraw them when they return.
		if (had_hidden.some((status) => !hidden.includes(status))) page.board?.refresh();
	};

	const open_status_menu = (page, button) => {
		$(".trustbit-status-menu").remove();
		const rect = button.getBoundingClientRect();
		const $menu = $(`<div class="trustbit-status-menu" role="menu"
			style="position: fixed; z-index: 1050; min-width: 210px; padding: 6px;
				background: var(--surface-modal, var(--fg-color, #fff));
				border: 1px solid var(--outline-gray-2, #e5e7eb); border-radius: 8px;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);"></div>`).css({
			top: rect.bottom + 4,
			left: Math.max(8, Math.min(rect.left, window.innerWidth - 226)),
		});

		const close = () => {
			$menu.remove();
			document.removeEventListener("mousedown", on_outside, true);
			document.removeEventListener("keydown", on_key, true);
		};
		const on_outside = (e) => {
			if (!$menu[0].contains(e.target) && !button.contains(e.target)) close();
		};
		const on_key = (e) => {
			if (e.key === "Escape") close();
		};

		const render = () => {
			$menu.empty();
			const statuses = board_statuses(page);
			const hidden = get_hidden(page);
			statuses.forEach((status) => {
				const checked = !hidden.includes(status);
				const $row = $(`<label style="display: flex; align-items: center; gap: 8px;
					margin: 0; padding: 5px 8px; border-radius: 6px; cursor: pointer;">
					<input type="checkbox" style="margin: 0;">
					<span class="trustbit-status-name" style="flex: 1;"></span>
				</label>`);
				$row.find(".trustbit-status-name").text(__(status));
				$row.append(frappe.trustbit.task_status_icon_html(status));
				const $input = $row.find("input").prop("checked", checked);
				// At least one column stays visible, so the board is never blank.
				$input.prop("disabled", checked && hidden.length === statuses.length - 1);
				$input.on("change", () => {
					save_hidden(
						page,
						$input.prop("checked")
							? hidden.filter((item) => item !== status)
							: [...hidden, status]
					);
					render();
				});
				$menu.append($row);
			});
			if (hidden.length) {
				$(`<button type="button" class="btn btn-link btn-xs" style="width: 100%;"></button>`)
					.text(__("Show All"))
					.on("click", () => {
						save_hidden(page, []);
						render();
					})
					.appendTo($menu);
			}
		};

		render();
		$menu.appendTo(document.body);
		document.addEventListener("mousedown", on_outside, true);
		document.addEventListener("keydown", on_key, true);
	};

	const add_status_button = (page) => {
		if (frappe.is_mobile()) return;
		const $button = $(`<button type="button" class="btn btn-default btn-sm"
			aria-haspopup="menu" style="margin-right: 8px;">
			<span class="trustbit-status-label"></span>
		</button>`).on("click", function () {
			if ($(".trustbit-status-menu").length) {
				$(".trustbit-status-menu").remove();
				return;
			}
			open_status_menu(page, this);
		});
		page.$trustbit_status_button = $button;
		page.$filter_section.prepend($button);
		update_filter_button(page);
	};

	const install_status_filter = (Page) => {
		if (Page.prototype.trustbit_status_filter) return;
		Page.prototype.trustbit_status_filter = true;
		const base_setup_filter_bar = Page.prototype.setup_filter_bar;
		const base_mount_board = Page.prototype.mount_board;
		Page.prototype.setup_filter_bar = function (...args) {
			const result = base_setup_filter_bar.apply(this, args);
			if (this.doctype === "Task") add_status_button(this);
			return result;
		};
		Page.prototype.mount_board = function (...args) {
			if (this.doctype === "Task") apply_status_filter(this);
			else this.$container?.removeAttr(FILTER_ATTRIBUTE);
			return base_mount_board.apply(this, args);
		};
	};

	// Frappe loads the Kanban page class after this script, so install when it arrives.
	if (frappe.views?.KanbanV2Page) {
		install_status_filter(frappe.views.KanbanV2Page);
	} else {
		frappe.provide("frappe.views");
		let page_class;
		Object.defineProperty(frappe.views, "KanbanV2Page", {
			configurable: true,
			enumerable: true,
			get: () => page_class,
			set: (value) => {
				page_class = value;
				install_status_filter(value);
			},
		});
	}

	const settings = { ...existing, trustbit_quick_view: true, renderCard: render_card };
	frappe.kanban_v2.settings["Task"] = settings;

	if (frappe.is_mobile() || window.matchMedia("(hover: none)").matches) return;

	// Controls inside a card keep their own click behaviour.
	const CARD_CONTROLS =
		"a, button, input, select, textarea, [role='button'], [role='menuitem'], .kn-assign-group";
	const DOUBLE_CLICK_WINDOW = 250;
	let pending_open = null;

	const cancel_pending = () => {
		clearTimeout(pending_open);
		pending_open = null;
	};

	const callbacks = existing.callbacks || {};
	// The title would otherwise go straight to the form.
	settings.open_on_title_click = false;
	settings.callbacks = {
		...callbacks,
		onCardClick(card, ev) {
			callbacks.onCardClick && callbacks.onCardClick(card, ev);
			cancel_pending();
			// Ctrl/Cmd/Shift click is Kanban's multi-select.
			if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
			if (ev.target.closest && ev.target.closest(CARD_CONTROLS)) return;
			pending_open = setTimeout(() => {
				pending_open = null;
				frappe.trustbit.show_task_quick_view(card.name);
			}, DOUBLE_CLICK_WINDOW);
		},
		onCardOpen(card) {
			cancel_pending();
			if (callbacks.onCardOpen) callbacks.onCardOpen(card);
			else frappe.set_route("Form", "Task", card.name);
		},
	};
})();
