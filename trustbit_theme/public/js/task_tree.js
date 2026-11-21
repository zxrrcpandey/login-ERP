// Task Tree additions, loaded through the doctype_tree_js hook:
// - Clicking the task name opens a read-only quick view with activity.
//   Ctrl/Cmd-click opens the Task form in a new tab.
// - "View" in the row's ... menu opens the Task form.
// - The chevron and the rest of the row still expand and collapse.
// - Each task and sub-task shows a status icon after its name.
(() => {
	const settings = frappe.treeview_settings && frappe.treeview_settings["Task"];
	if (!settings || settings.trustbit_extended) return;
	settings.trustbit_extended = true;

	settings.toolbar = settings.toolbar || [];
	settings.extend_toolbar = true;
	settings.toolbar.push({
		label: __("View"),
		icon: "eye",
		trustbit_view: true,
		condition: (node) => !node.is_root && frappe.model.can_read("Task"),
		click: (node) => frappe.set_route("Form", "Task", node.label),
	});

	// Frappe appends custom entries after its own. Keep View at the top of the menu.
	const base_onload = settings.onload;
	settings.onload = function (treeview) {
		const base_get_toolbar = treeview.get_toolbar;
		treeview.get_toolbar = function () {
			const items = base_get_toolbar.call(treeview);
			return [
				...items.filter((item) => item.trustbit_view),
				...items.filter((item) => !item.trustbit_view),
			];
		};
		return base_onload && base_onload.call(this, treeview);
	};

	const link_labels = (node) => {
		node.$ul.find("a.tree-label:not([href])").each(function () {
			const name = this.dataset.name;
			$(this)
				.attr("href", frappe.utils.get_form_link("Task", name))
				.on("click", (e) => {
					// Keep the row from toggling when the link is used.
					e.stopPropagation();
					// Ctrl/Cmd/Shift/middle click keep the browser's new-tab behaviour.
					if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
					e.preventDefault();
					frappe.trustbit.show_task_quick_view(name);
				});
		});
	};

	const OUTLINE = '<circle cx="8" cy="8" r="6"/>';
	const SOLID = '<circle cx="8" cy="8" r="6.6" fill="currentColor" stroke="none"/>';
	// Each status differs by shape as well as colour. Colours match the Task Status board.
	const STATUS_ICONS = {
		Open: { color: "#c2570c", shape: OUTLINE },
		Working: {
			color: "#2563eb",
			shape: `${OUTLINE}<path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" stroke="none"/>`,
		},
		"Pending Review": {
			color: "#7c3aed",
			shape: `${OUTLINE}<path d="M8 4.8V8l2.2 1.4"/>`,
		},
		Overdue: {
			color: "#dc2626",
			shape: `${SOLID}<path d="M8 4.6v4M8 11.3v.1" stroke="#fff"/>`,
		},
		Completed: {
			color: "#16a34a",
			shape: `${SOLID}<path d="m5 8.2 2.1 2.1L11 6" stroke="#fff"/>`,
		},
		Cancelled: {
			color: "#6b7280",
			shape: `${OUTLINE}<path d="m5.9 5.9 4.2 4.2m0-4.2-4.2 4.2"/>`,
		},
		Template: {
			color: "#6b7280",
			shape: '<circle cx="8" cy="8" r="6" stroke-dasharray="2.4 2.4"/>',
		},
	};
	const STATUS_BATCH_SIZE = 100;

	const set_status_icon = (row, status) => {
		row.querySelector(":scope > .trustbit-task-status")?.remove();
		const icon = STATUS_ICONS[status];
		const label = row.querySelector(":scope > a.tree-label");
		if (!icon || !label) return;
		const text = frappe.utils.escape_html(__(status));
		label.insertAdjacentHTML(
			"afterend",
			`<span class="trustbit-task-status" role="img" title="${text}" aria-label="${text}"
				style="flex: none; display: inline-flex; margin-left: 6px; color: ${icon.color};">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
					stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
					aria-hidden="true">${icon.shape}</svg>
			</span>`
		);
	};

	// get_children doesn't return status, so fetch it for the rows on screen.
	const load_status_icons = ($rows) => {
		const rows_by_name = new Map();
		$rows.each(function () {
			const name = this.dataset.label;
			if (!name) return;
			if (!rows_by_name.has(name)) rows_by_name.set(name, []);
			rows_by_name.get(name).push(this);
		});

		const names = [...rows_by_name.keys()];
		for (let i = 0; i < names.length; i += STATUS_BATCH_SIZE) {
			const batch = names.slice(i, i + STATUS_BATCH_SIZE);
			frappe.db
				.get_list("Task", {
					filters: [["name", "in", batch]],
					fields: ["name", "status"],
					limit: batch.length,
				})
				.then((tasks) => {
					(tasks || []).forEach((task) => {
						rows_by_name
							.get(task.name)
							?.forEach((row) => set_status_icon(row, task.status));
					});
				});
		}
	};

	// Coming back from a Task form, show any status changed there.
	if (frappe.router && !frappe.trustbit.task_status_refresh) {
		frappe.trustbit.task_status_refresh = true;
		frappe.router.on("change", () => {
			const [view, doctype] = frappe.get_route() || [];
			const tree = frappe.views?.trees?.["Task"]?.tree;
			if (view === "Tree" && doctype === "Task" && tree) {
				load_status_icons(tree.wrapper.find(".tree-link"));
			}
		});
	}

	const base_on_node_render = settings.on_node_render;
	settings.on_node_render = function (node, deep) {
		link_labels(node);
		load_status_icons(node.$tree_link.add(node.$ul.find(".tree-link")));
		return base_on_node_render && base_on_node_render.call(this, node, deep);
	};
})();
