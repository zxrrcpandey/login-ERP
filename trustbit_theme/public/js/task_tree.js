// Task Tree additions, loaded through the doctype_tree_js hook:
// - Clicking the task name opens a read-only quick view with activity.
//   Ctrl/Cmd-click opens the Task form in a new tab.
// - "View" in the row's ... menu opens the Task form.
// - The chevron and the rest of the row still expand and collapse.
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

	const base_on_node_render = settings.on_node_render;
	settings.on_node_render = function (node, deep) {
		link_labels(node);
		return base_on_node_render && base_on_node_render.call(this, node, deep);
	};
})();
