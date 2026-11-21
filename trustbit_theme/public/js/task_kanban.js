// Task Kanban: clicking a card opens the shared quick view. Double-click still opens
// the Task form. Touch screens keep Frappe's own card sheet.
(() => {
	frappe.provide("frappe.kanban_v2.settings");
	const existing = frappe.kanban_v2.settings["Task"] || {};
	if (existing.trustbit_quick_view) return;
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
	frappe.kanban_v2.settings["Task"] = {
		...existing,
		trustbit_quick_view: true,
		// The title would otherwise go straight to the form.
		open_on_title_click: false,
		callbacks: {
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
		},
	};
})();
