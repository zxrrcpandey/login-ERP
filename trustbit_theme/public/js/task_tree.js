// Task Tree additions, loaded through the doctype_tree_js hook:
// - "View" in the row's ... menu opens a read-only quick view.
// - The task name is a real link to the Task form. The chevron and the rest of
//   the row still expand and collapse.
(() => {
	const settings = frappe.treeview_settings && frappe.treeview_settings["Task"];
	if (!settings || settings.trustbit_extended) return;
	settings.trustbit_extended = true;

	const esc = (value) => frappe.utils.escape_html(value == null ? "" : String(value));

	// Description is rich text. Reduce it to plain text so stored HTML never runs here.
	const to_plain_text = (html) => {
		if (!html) return "";
		const marked = String(html).replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, "$&\n");
		const parsed = new DOMParser().parseFromString(marked, "text/html");
		parsed.querySelectorAll("script, style").forEach((el) => el.remove());
		return (parsed.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
	};

	const get_assignees = (doc) => {
		try {
			return JSON.parse(doc._assign || "[]")
				.map((user) => frappe.user_info(user).fullname || user)
				.join(", ");
		} catch (e) {
			return "";
		}
	};

	const format_date = (value) => (value ? frappe.datetime.str_to_user(value) : "");

	const render_quick_view = (doc) => {
		const rows = [
			[__("Status"), doc.status],
			[__("Priority"), doc.priority],
			[__("Project"), doc.project],
			[__("Parent Task"), doc.parent_task],
			[__("Assigned To"), get_assignees(doc)],
			[__("Expected Start"), format_date(doc.exp_start_date)],
			[__("Expected End"), format_date(doc.exp_end_date)],
			[__("Progress"), doc.progress != null ? `${doc.progress}%` : ""],
		];
		const cells = rows
			.map(
				([label, value]) => `
				<div class="col-sm-6" style="margin-bottom: 12px;">
					<div class="text-muted small">${esc(label)}</div>
					<div>${esc(value) || "-"}</div>
				</div>`
			)
			.join("");
		const description = to_plain_text(doc.description);
		return `
			<div class="row">${cells}</div>
			<div class="text-muted small">${esc(__("Description"))}</div>
			<div style="white-space: pre-wrap; max-height: 40vh; overflow-y: auto;">${
				esc(description) || "-"
			}</div>`;
	};

	const show_quick_view = (name) => {
		frappe.db.get_doc("Task", name).then((doc) => {
			const dialog = new frappe.ui.Dialog({
				// Dialog renders its title as HTML.
				title: esc(`${doc.subject || doc.name} (${doc.name})`),
				size: "large",
				fields: [{ fieldtype: "HTML", fieldname: "details" }],
				primary_action_label: __("Open Task"),
				primary_action: () => {
					dialog.hide();
					frappe.set_route("Form", "Task", doc.name);
				},
			});
			dialog.fields_dict.details.$wrapper.html(render_quick_view(doc));
			dialog.show();
		});
	};

	settings.toolbar = settings.toolbar || [];
	settings.extend_toolbar = true;
	settings.toolbar.push({
		label: __("View"),
		icon: "eye",
		trustbit_view: true,
		condition: (node) => !node.is_root && frappe.model.can_read("Task"),
		click: (node) => show_quick_view(node.label),
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
					frappe.set_route("Form", "Task", name);
				});
		});
	};

	const base_on_node_render = settings.on_node_render;
	settings.on_node_render = function (node, deep) {
		link_labels(node);
		return base_on_node_render && base_on_node_render.call(this, node, deep);
	};
})();
