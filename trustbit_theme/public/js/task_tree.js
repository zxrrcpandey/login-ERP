// Task Tree additions, loaded through the doctype_tree_js hook:
// - Clicking the task name opens a read-only quick view with activity.
//   Ctrl/Cmd-click opens the Task form in a new tab.
// - "View" in the row's ... menu opens the Task form.
// - The chevron and the rest of the row still expand and collapse.
// - Each task and sub-task shows a status icon after its name. A parent whose
//   sub-tasks are all Completed or Cancelled shows as finished.
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
	const FINISHED_STATUSES = new Set(["Completed", "Cancelled"]);
	const STATUS_PAGE_SIZE = 500;
	const STATUS_REFRESH_DELAY = 120;

	const set_status_icon = (row, { status, saved_status }) => {
		row.querySelector(":scope > .trustbit-task-status")?.remove();
		const icon = STATUS_ICONS[status];
		const label = row.querySelector(":scope > a.tree-label");
		if (!icon || !label) return;
		const text = frappe.utils.escape_html(
			status === saved_status
				? __(status)
				: __("{0} (all sub-tasks finished, saved status: {1})", [
						__(status),
						__(saved_status),
				  ])
		);
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

	// get_children doesn't return status, and collapsed sub-tasks aren't on screen.
	const fetch_task_statuses = async () => {
		const tasks = [];
		for (let start = 0; ; start += STATUS_PAGE_SIZE) {
			const page = await frappe.db.get_list("Task", {
				filters: [["docstatus", "<", 2]],
				fields: ["name", "status", "parent_task"],
				order_by: "name asc",
				limit: STATUS_PAGE_SIZE,
				limit_start: start,
			});
			tasks.push(...(page || []));
			if (!page || page.length < STATUS_PAGE_SIZE) return tasks;
		}
	};

	// Display only: a parent whose sub-tasks are all Completed or Cancelled shows as
	// finished. The saved status is never changed.
	const get_display_statuses = (tasks) => {
		const by_name = new Map(tasks.map((task) => [task.name, task]));
		const children = new Map();
		tasks.forEach((task) => {
			if (!task.parent_task || !by_name.has(task.parent_task)) return;
			if (!children.has(task.parent_task)) children.set(task.parent_task, []);
			children.get(task.parent_task).push(task.name);
		});

		const resolved = new Map();
		const resolve = (name, path = new Set()) => {
			if (resolved.has(name)) return resolved.get(name);
			const task = by_name.get(name);
			// A broken parent loop falls back to the saved status.
			if (path.has(name)) return task.status;
			path.add(name);
			const child_statuses = (children.get(name) || []).map((child) => resolve(child, path));
			path.delete(name);

			let status = task.status;
			if (
				child_statuses.length &&
				!FINISHED_STATUSES.has(status) &&
				status !== "Template" &&
				child_statuses.every((child) => FINISHED_STATUSES.has(child))
			) {
				status = child_statuses.every((child) => child === "Cancelled")
					? "Cancelled"
					: "Completed";
			}
			resolved.set(name, status);
			return status;
		};
		tasks.forEach((task) => resolve(task.name));
		return resolved;
	};

	let status_refresh_timer = null;
	let status_refresh_id = 0;
	const refresh_status_icons = ($tree) => {
		clearTimeout(status_refresh_timer);
		status_refresh_timer = setTimeout(async () => {
			const refresh_id = ++status_refresh_id;
			const tasks = await fetch_task_statuses();
			// A newer refresh has started, so this data may already be out of date.
			if (refresh_id !== status_refresh_id) return;
			const saved = new Map(tasks.map((task) => [task.name, task.status]));
			const display = get_display_statuses(tasks);
			$tree.find(".tree-link").each(function () {
				const name = this.dataset.label;
				if (saved.has(name)) {
					set_status_icon(this, {
						status: display.get(name),
						saved_status: saved.get(name),
					});
				}
			});
		}, STATUS_REFRESH_DELAY);
	};

	// Coming back from a Task form, show any status changed there.
	if (frappe.router && !frappe.trustbit.task_status_refresh) {
		frappe.trustbit.task_status_refresh = true;
		frappe.router.on("change", () => {
			const [view, doctype] = frappe.get_route() || [];
			const tree = frappe.views?.trees?.["Task"]?.tree;
			if (view === "Tree" && doctype === "Task" && tree) {
				refresh_status_icons(tree.wrapper);
			}
		});
	}

	const base_on_node_render = settings.on_node_render;
	settings.on_node_render = function (node, deep) {
		link_labels(node);
		refresh_status_icons(node.$tree_link.closest(".tree"));
		return base_on_node_render && base_on_node_render.call(this, node, deep);
	};
})();
