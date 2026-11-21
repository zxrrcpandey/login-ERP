// Trustbit View: a Task board organised by Is Group folders, listed below Tree in the view
// menu. Layouts: folder sidebar, breadcrumb, tabs with progress, and swimlanes.
(() => {
	const PAGE = "trustbit-view";
	const STATUSES = [
		"Open",
		"Working",
		"Pending Review",
		"Need Clarification",
		"Overdue",
		"Completed",
		"Cancelled",
	];
	const FINISHED = new Set(["Completed", "Cancelled"]);
	const LAYOUTS = [
		["sidebar", "Sidebar"],
		["breadcrumb", "Breadcrumb"],
		["tabs", "Tabs"],
		["lanes", "Swimlanes"],
	];
	const ALL = "__all";
	const NO_GROUP = "__none";
	const PAGE_SIZE = 500;
	const DOUBLE_CLICK_WINDOW = 250;
	const CHIP_LIMIT = 8;
	const TASK_FIELDS = [
		"name",
		"subject",
		"status",
		"priority",
		"parent_task",
		"is_group",
		"project",
		"exp_end_date",
		"_assign",
		"modified",
	];

	const esc = (value) => frappe.utils.escape_html(value == null ? "" : String(value));
	const FOLDER_ICON = `<svg class="tbv-folder" width="14" height="14" viewBox="0 0 16 16"
		aria-hidden="true"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.6 1.8h4.8A1.5 1.5 0 0 1 14
		6.3v5.2a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" fill="none" stroke="currentColor"
		stroke-width="1.4" stroke-linejoin="round"/></svg>`;
	const line_icon = (path) => `<svg class="tbv-ricon" width="14" height="14" viewBox="0 0 16 16"
		aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.4"
		stroke-linecap="round" stroke-linejoin="round"/></svg>`;
	const PROJECT_ICON = line_icon("M2.5 5.5h11v7.5h-11zM5.5 5.5V3.5h5v2M2.5 9h11");
	const CALENDAR_ICON = line_icon("M3 3.5h10v9.5H3zM3 6.5h10M5.5 2v3M10.5 2v3");
	const FLAG_ICON = line_icon("M3.5 14V2.5h9l-2 3 2 3h-9");
	const CLOCK_ICON = line_icon("M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5v3.2l2 1.3");
	const chevron = (open) => `<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
		<path d="${open ? "m4 6 4 4 4-4" : "m6 4 4 4-4 4"}" fill="none" stroke="currentColor"
		stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

	const STYLE = `
	.tbv { display: flex; flex-direction: column; box-sizing: border-box; height: var(--tbv-height, calc(100vh - 120px));
		min-height: 420px; padding: 0 12px; color: var(--ink-gray-8, #262626); }
	.tbv-toolbar { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 0; }
	.tbv-toolbar select { height: 32px; width: 220px; padding: 0 8px; border-radius: 6px;
		border: 1px solid var(--outline-gray-2, #e5e5e5); background: var(--surface-white, #fff); color: inherit; }
	.tbv-seg { display: inline-flex; padding: 2px; border-radius: 7px; background: var(--surface-gray-2, #f3f3f3); }
	.tbv-seg button, .tbv-seg a { display: inline-flex; align-items: center; height: 28px; padding: 0 10px; border: 0;
		border-radius: 5px; background: transparent; color: inherit; font-size: 13px; cursor: pointer; }
	.tbv-seg a:hover { background: var(--surface-white, #fff); text-decoration: none; }
	.tbv-seg button[aria-pressed="true"] { background: var(--surface-white, #fff); font-weight: 600;
		box-shadow: 0 1px 2px rgba(0, 0, 0, .12); }
	.tbv-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; list-style: none;
		border: 1px solid var(--outline-gray-2, #e5e5e5); border-radius: 6px; background: var(--surface-white, #fff);
		color: inherit; font-size: 13px; white-space: nowrap; cursor: pointer; }
	.tbv-btn::-webkit-details-marker { display: none; }
	.tbv-btn:disabled { opacity: .6; cursor: wait; }
	.tbv-right { margin-left: auto; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
	.tbv-dd { position: relative; }
	.tbv-dd-menu { position: absolute; z-index: 20; top: 36px; left: 0; min-width: 240px; max-height: 420px; overflow-y: auto;
		padding: 6px; border: 1px solid var(--outline-gray-2, #e5e5e5); border-radius: 8px;
		background: var(--surface-modal, var(--surface-white, #fff)); box-shadow: 0 8px 24px rgba(0, 0, 0, .14); }
	.tbv-dd-menu label { display: flex; align-items: center; gap: 8px; margin: 0; padding: 5px 8px; border-radius: 5px;
		font-size: 13px; cursor: pointer; }
	.tbv-dd-menu label span:first-of-type { flex: 1; }
	.tbv-layout { flex: 1; min-height: 0; display: flex; gap: 12px; }
	.tbv-side { flex: 0 0 264px; box-sizing: border-box; overflow-y: auto; padding-right: 8px;
		border-right: 1px solid var(--outline-gray-2, #e5e5e5); }
	.tbv-main, .tbv-layout-full { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
	.tbv-g { display: flex; align-items: center; gap: 2px; }
	.tbv-g-toggle { flex: none; display: flex; align-items: center; justify-content: center; width: 22px; height: 30px;
		padding: 0; border: 0; background: transparent; color: var(--ink-gray-5, #6b6b6b); cursor: pointer; }
	.tbv-g-spacer { flex: none; width: 22px; }
	.tbv-g-btn { flex: 1; width: 100%; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px;
		min-height: 30px; padding: 3px 8px; border: 0; border-radius: 6px; background: transparent; color: inherit;
		font-size: 13px; text-align: left; cursor: pointer; }
	.tbv-g-btn:hover { background: var(--surface-gray-2, #f3f3f3); }
	.tbv-g-btn.tbv-g-empty { color: var(--ink-gray-5, #6b6b6b); }
	.tbv-g-btn.active { background: #eff6ff; color: #1d4ed8; font-weight: 600; }
	.tbv-g-name { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
	.tbv-g-name > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.tbv-folder { flex: none; }
	.tbv-count { flex: none; font-size: 12px; font-weight: 400; color: var(--ink-gray-6, #525252); }
	.tbv-g-btn.active .tbv-count, .tbv-tab.active .tbv-count, .tbv-chip.active .tbv-count { color: inherit; }
	.tbv-crumbs { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 0 0 8px; }
	.tbv-link { padding: 4px 6px; border: 0; border-radius: 5px; background: transparent; color: #1d4ed8; font-size: 13px; cursor: pointer; }
	.tbv-chips { flex: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 0 0 8px; }
	.tbv-chip { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; font-size: 13px;
		border: 1px solid var(--outline-gray-2, #e5e5e5); border-radius: 14px; background: var(--surface-white, #fff);
		color: inherit; cursor: pointer; }
	.tbv-chip.active { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; font-weight: 600; }
	.tbv-chip-more { border-style: dashed; color: #1d4ed8; }
	.tbv-tabs-wrap { flex: none; display: flex; align-items: flex-start; gap: 4px; padding-bottom: 8px; }
	.tbv-tabs { flex: 1; min-width: 0; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
	.tbv-tabs::-webkit-scrollbar { display: none; }
	.tbv-tab-arrow { flex: none; width: 28px; height: 46px; padding: 0; border: 1px solid var(--outline-gray-2, #e5e5e5);
		border-radius: 6px; background: var(--surface-white, #fff); color: inherit; cursor: pointer; }
	.tbv-tab { flex: none; width: 176px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 6px;
		height: 46px; padding: 0 10px; border: 1px solid var(--outline-gray-2, #e5e5e5); border-radius: 7px;
		background: var(--surface-white, #fff); color: inherit; font-size: 13px; text-align: left; cursor: pointer; }
	.tbv-tab.active { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; font-weight: 600; }
	.tbv-tab-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; }
	.tbv-bar { display: block; width: 100%; height: 4px; overflow: hidden; border-radius: 2px; background: var(--surface-gray-3, #e5e5e5); }
	.tbv-bar > span { display: block; height: 100%; background: #15803d; }
	.tbv-board { flex: 1; min-height: 0; display: flex; align-items: stretch; gap: 10px; overflow-x: auto; padding-bottom: 8px; }
	.tbv-col { flex: 1 1 220px; min-width: 220px; min-height: 0; display: flex; flex-direction: column; border-radius: 8px;
		background: var(--surface-gray-1, #f7f7f7); }
	.tbv-col.tbv-over, .tbv-cell.tbv-over { outline: 2px solid #2563eb; outline-offset: -2px; }
	.tbv-col-head { flex: none; display: flex; align-items: center; margin: 0; padding: 10px; font-size: 13px; font-weight: 600; }
	.tbv-col-head .trustbit-task-status { margin: 0 6px 0 0 !important; }
	.tbv-col-head .tbv-count { margin-left: auto; padding: 0 7px; border-radius: 9px; background: var(--surface-gray-3, #e5e5e5); }
	/* Block layout: a scrollbar narrows the cards, and each must regrow to fit its wrapped title. */
	.tbv-col-body { flex: 1; min-height: 0; display: block; overflow-y: auto; scrollbar-gutter: stable; padding: 0 8px 8px; }
	.tbv-col-body > .tbv-card + .tbv-card, .tbv-cell > .tbv-card + .tbv-card { margin-top: 6px; }
	.tbv-card { box-sizing: border-box; flex: none; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-radius: 7px; cursor: pointer;
		border: 1px solid var(--outline-gray-2, #e5e5e5); background: var(--surface-white, #fff); }
	.tbv-card:hover { border-color: var(--outline-gray-4, #a3a3a3); box-shadow: 0 1px 4px rgba(0, 0, 0, .08); }
	.tbv-card[draggable="true"] { cursor: grab; }
	.tbv-card.tbv-dragging { opacity: .4; }
	.tbv-card-head { display: flex; align-items: flex-start; gap: 6px; }
	.tbv-card-row { display: flex; align-items: center; gap: 6px; min-width: 0; min-height: 20px; font-size: 12px;
		color: var(--ink-gray-6, #525252); }
	.tbv-ricon, .tbv-card-row .tbv-folder { flex: none; color: var(--ink-gray-5, #6b6b6b); }
	.tbv-trunc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.tbv-card-due { align-self: flex-start; max-width: 100%; padding: 0 4px 0 0; border: 0; border-radius: 4px; background: transparent; cursor: pointer; }
	.tbv-card-due:hover { background: var(--surface-gray-2, #f3f3f3); color: #1d4ed8; }
	.tbv-unset { font-style: italic; color: var(--ink-gray-5, #6b6b6b); }
	.tbv-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 26px; }
	.tbv-age { flex: none; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--ink-gray-6, #525252); }
	.tbv-card-title { min-width: 0; color: inherit; font-size: 13px; font-weight: 500; line-height: 18px; overflow-wrap: anywhere; }
	.tbv-card-title:hover { color: inherit; text-decoration: underline; }
	.tbv-card-group { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; max-width: 100%; padding: 0; border: 0;
		background: transparent; color: var(--ink-gray-6, #525252); font-size: 12px; cursor: pointer; }
	.tbv-card-group:hover { color: #1d4ed8; }
	.tbv-card-group > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.tbv-card-meta { display: flex; align-items: center; gap: 8px; min-height: 20px; font-size: 12px; color: var(--ink-gray-6, #525252); }
	.tbv-pri { padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 500; background: #f1f5f9; color: #475569; }
	.tbv-pri-urgent { background: #fee2e2; color: #b91c1c; }
	.tbv-pri-high { background: #ffedd5; color: #c2410c; }
	.tbv-pri-medium { background: #dbeafe; color: #1d4ed8; }
	.tbv-avatars { display: inline-flex; align-items: center; gap: 3px; }
	.tbv-avatar { display: inline-flex; align-items: center; justify-content: center; overflow: hidden; width: 24px; height: 24px;
		padding: 0; border: 0; border-radius: 50%; background: #e0e7ff; color: #3730a3; font-size: 10px; font-weight: 600; }
	button.tbv-avatar { cursor: pointer; }
	button.tbv-avatar:hover { box-shadow: 0 0 0 2px #93c5fd; }
	.tbv-avatar img { width: 100%; height: 100%; object-fit: cover; }
	.tbv-avatar-add { background: var(--surface-gray-2, #f3f3f3); color: var(--ink-gray-7, #404040); font-size: 15px; font-weight: 400; }
	.tbv-empty { margin: 0; padding: 12px 4px; font-size: 12px; text-align: center; color: var(--ink-gray-5, #6b6b6b); }
	.tbv-lanes-wrap { flex: 1; min-height: 0; overflow: auto; border: 1px solid var(--outline-gray-2, #e5e5e5); border-radius: 8px; margin-bottom: 8px; }
	.tbv-lanes { min-width: max-content; }
	.tbv-lane-row { display: grid; width: 100%; grid-template-columns: 260px repeat(var(--tbv-cols), minmax(190px, 1fr));
		border-bottom: 1px solid var(--outline-gray-2, #e5e5e5); }
	.tbv-lane-top { position: sticky; top: 0; z-index: 3; background: var(--surface-gray-1, #f7f7f7); }
	.tbv-lane-top .tbv-col-head { padding: 8px 10px; }
	.tbv-lane-corner, .tbv-lane-head { position: sticky; left: 0; z-index: 2; box-sizing: border-box; background: var(--surface-white, #fff);
		border-right: 1px solid var(--outline-gray-2, #e5e5e5); }
	.tbv-lane-corner { display: flex; align-items: center; padding: 0 6px; background: var(--surface-gray-1, #f7f7f7); }
	.tbv-lane-head { display: flex; flex-direction: column; justify-content: flex-start; gap: 5px; min-height: 44px; padding: 7px 10px;
		border-top: 0; border-bottom: 0; border-left: 0; color: inherit; font-size: 13px; font-weight: 600; text-align: left; cursor: pointer; }
	.tbv-lane-head:hover { background: var(--surface-gray-1, #f7f7f7); }
	.tbv-lane-title { display: flex; align-items: center; gap: 5px; min-width: 0; }
	.tbv-lane-title > span:first-of-type { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.tbv-cell { display: block; min-width: 0; padding: 6px; border-right: 1px solid var(--surface-gray-2, #f3f3f3); }
	.tbv-cell-count { display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--ink-gray-7, #404040); }
	.tbv-cell-zero { color: var(--ink-gray-3, #c7c7c7); }
	.tbv-state { padding: 48px 16px; text-align: center; color: var(--ink-gray-6, #525252); }
	@media (max-width: 767px) { .tbv { height: auto; } .tbv-layout { flex-direction: column; }
		.tbv-side { flex: none; max-height: 220px; padding-right: 0; border-right: 0; border-bottom: 1px solid var(--outline-gray-2, #e5e5e5); }
		.tbv-board { align-items: flex-start; } .tbv-col { flex: 0 0 250px; } .tbv-col-body { overflow: visible; }
		.tbv-right { margin-left: 0; } .tbv-lanes-wrap { max-height: 75vh; }
		.tbv-lane-row { grid-template-columns: 150px repeat(var(--tbv-cols), 190px); } }
	`;

	class TrustbitView {
		constructor(wrapper) {
			this.wrapper = wrapper;
			this.page = wrapper.page;
			this.tasks = [];
			this.projects = [];
			this.load_id = 0;
			this.click_timer = null;
			this.layout = this.read("layout", "sidebar");
			if (!LAYOUTS.some(([id]) => id === this.layout)) this.layout = "sidebar";
			this.project = this.read("project", "");
			this.group = ALL;
			this.expanded = new Set(this.read("expanded", []));
			this.open_lanes = new Set(this.read("open_lanes", []));
			this.chips_open = false;
			this.hidden_statuses = new Set(this.read("hidden", ["Cancelled"]));

			if (!document.getElementById("tbv-style")) {
				$("<style id='tbv-style'></style>").text(STYLE).appendTo(document.head);
			}
			this.$root = $('<div class="tbv"></div>').appendTo($(wrapper).find(".layout-main-section"));
			this.page.set_primary_action(__("Add Task"), () => this.add_task(), "plus");
			this.bind_events();
			$(wrapper).on("show", () => {
				this.fit_height();
				this.load();
			});
		}

		key(name) {
			return `trustbit_view:${frappe.session.user}:${name}`;
		}

		read(name, fallback) {
			try {
				const value = localStorage.getItem(this.key(name));
				return value === null ? fallback : JSON.parse(value);
			} catch (e) {
				return fallback;
			}
		}

		write(name, value) {
			try {
				localStorage.setItem(this.key(name), JSON.stringify(value));
			} catch (e) {
				// Private browsing can refuse storage; the view still works for this visit.
			}
		}

		async fetch_all(doctype, fields, filters) {
			const rows = [];
			for (let start = 0; ; start += PAGE_SIZE) {
				const page = await frappe.xcall("frappe.desk.reportview.get_list", {
					doctype,
					fields: JSON.stringify(fields),
					filters: JSON.stringify(filters),
					order_by: "name asc",
					limit: PAGE_SIZE,
					limit_start: start,
				});
				rows.push(...(page || []));
				if (!page || page.length < PAGE_SIZE) return rows;
			}
		}

		async load() {
			const load_id = ++this.load_id;
			if (!this.tasks.length) this.show_state(__("Loading tasks..."));
			try {
				// Also loads the shared popup and status icons from the Task view scripts.
				await frappe.model.with_doctype("Task");
				if (!frappe.model.can_read("Task")) {
					this.show_state(__("You don't have permission to read Tasks."));
					return;
				}
				const filters = [["docstatus", "<", 2]];
				if (this.project) filters.push(["project", "=", this.project]);
				const [projects, tasks] = await Promise.all([
					frappe.model.can_read("Project")
						? this.fetch_all("Project", ["name", "project_name"], [])
						: Promise.resolve([]),
					this.fetch_all("Task", TASK_FIELDS, filters),
				]);
				if (load_id !== this.load_id) return;
				this.projects = projects;
				this.set_tasks(tasks);
				this.render();
				return true;
			} catch (e) {
				// Keep a board that is already on screen; Reload reports the failure.
				if (load_id === this.load_id && !this.tasks.length) {
					this.show_state(__("Could not load tasks. Please reload."));
				}
				return load_id === this.load_id ? false : undefined;
			}
		}

		async reload() {
			if (this.reloading) return;
			this.reloading = true;
			this.$root.find('[data-act="reload"]').prop("disabled", true).text(__("Reloading..."));
			const loaded = await this.load();
			this.reloading = false;
			this.$root.find('[data-act="reload"]').prop("disabled", false).text(__("Reload"));
			if (loaded === true) {
				frappe.show_alert({ message: __("Tasks updated"), indicator: "green" });
			} else if (loaded === false) {
				frappe.show_alert({ message: __("Could not reload tasks"), indicator: "red" });
			}
		}

		set_tasks(tasks) {
			this.tasks = tasks;
			this.by_name = new Map(tasks.map((task) => [task.name, task]));
			this.groups = new Map(tasks.filter((task) => task.is_group).map((task) => [task.name, task]));
			// Templates are not work in progress, so they stay off the board and out of the totals.
			this.leaves = tasks.filter((task) => !task.is_group && task.status !== "Template");
			this.children = new Map();
			this.groups.forEach((group) => {
				const parent = this.groups.has(group.parent_task) ? group.parent_task : null;
				if (!this.children.has(parent)) this.children.set(parent, []);
				this.children.get(parent).push(group);
			});
			this.children.forEach((list) =>
				list.sort((a, b) => String(a.subject).localeCompare(String(b.subject)))
			);
			this.has_ungrouped = this.leaves.some((task) => !this.groups.has(task.parent_task));
			if (this.group !== ALL && this.group !== NO_GROUP && !this.groups.has(this.group)) {
				this.group = ALL;
			}
			if (this.group === NO_GROUP && !this.has_ungrouped) this.group = ALL;
		}

		// The group and its parents, nearest first. A broken parent loop stops the walk.
		chain(name) {
			const out = [];
			const seen = new Set();
			let group = this.groups.get(name);
			while (group && !seen.has(group.name)) {
				seen.add(group.name);
				out.push(group);
				group = this.groups.get(group.parent_task);
			}
			return out;
		}

		in_group(task, key) {
			if (key === ALL) return true;
			if (key === NO_GROUP) return !this.groups.has(task.parent_task);
			return this.chain(task.parent_task).some((group) => group.name === key);
		}

		stats(key) {
			const list = this.leaves.filter((task) => this.in_group(task, key));
			const done = list.filter((task) => FINISHED.has(task.status)).length;
			return { count: list.length, done, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
		}

		group_label(key) {
			if (key === ALL) return __("All Tasks");
			if (key === NO_GROUP) return __("No group");
			return this.groups.get(key)?.subject || key;
		}

		top_group(key) {
			if (key === ALL || key === NO_GROUP) return key === NO_GROUP ? NO_GROUP : null;
			const chain = this.chain(key);
			return chain.length ? chain[chain.length - 1].name : null;
		}

		// Tree order. `respect_open` leaves out the children of collapsed folders.
		flatten(parent = null, depth = 0, respect_open = false) {
			return (this.children.get(parent) || []).flatMap((group) => {
				const has_kids = (this.children.get(group.name) || []).length > 0;
				const row = { key: group.name, label: group.subject, depth, has_kids };
				const open = this.expanded.has(group.name);
				const kids =
					has_kids && (!respect_open || open)
						? this.flatten(group.name, depth + 1, respect_open)
						: [];
				return [row, ...kids];
			});
		}

		visible_statuses() {
			return STATUSES.filter((status) => !this.hidden_statuses.has(status));
		}

		icon(status) {
			return frappe.trustbit?.task_status_icon_html?.(status) || "";
		}

		show_state(message) {
			this.$root.html(`<div class="tbv-state">${esc(message)}</div>`);
		}

		render() {
			const scroll = {
				board: this.$root.find(".tbv-board").scrollLeft() || 0,
				lanes_left: this.$root.find(".tbv-lanes-wrap").scrollLeft() || 0,
				lanes_top: this.$root.find(".tbv-lanes-wrap").scrollTop() || 0,
				tabs: this.$root.find(".tbv-tabs").scrollLeft() || 0,
				side: this.$root.find(".tbv-side").scrollTop() || 0,
				columns: {},
			};
			this.$root.find(".tbv-col").each(function () {
				scroll.columns[this.dataset.status] = $(this).find(".tbv-col-body").scrollTop();
			});
			const body = {
				sidebar: () => this.render_sidebar(),
				breadcrumb: () => this.render_breadcrumb(),
				tabs: () => this.render_tabs(),
				lanes: () => this.render_lanes(),
			}[this.layout]();
			this.$root.html(this.render_toolbar() + body);
			this.fit_height();
			this.$root.find(".tbv-board").scrollLeft(scroll.board);
			this.$root.find(".tbv-lanes-wrap").scrollLeft(scroll.lanes_left).scrollTop(scroll.lanes_top);
			this.$root.find(".tbv-side").scrollTop(scroll.side);
			this.$root.find(".tbv-col").each(function () {
				$(this).find(".tbv-col-body").scrollTop(scroll.columns[this.dataset.status] || 0);
			});
			const tabs = this.$root.find(".tbv-tabs").scrollLeft(scroll.tabs)[0];
			const active = tabs?.querySelector(".tbv-tab.active");
			if (active) {
				const box = tabs.getBoundingClientRect();
				const tab = active.getBoundingClientRect();
				if (tab.left < box.left) tabs.scrollLeft -= box.left - tab.left;
				else if (tab.right > box.right) tabs.scrollLeft += tab.right - box.right;
			}
		}

		// The board fills the window, and columns scroll on their own.
		fit_height() {
			const root = this.$root[0];
			if (!root.offsetParent) return;
			const top = root.getBoundingClientRect().top + window.scrollY;
			root.style.setProperty("--tbv-height", `${Math.max(420, window.innerHeight - top - 8)}px`);
		}

		render_toolbar() {
			const projects = this.projects
				.map(
					(project) =>
						`<option value="${esc(project.name)}" ${
							project.name === this.project ? "selected" : ""
						}>${esc(project.project_name || project.name)}</option>`
				)
				.join("");
			const layouts = LAYOUTS.map(
				([id, label]) => `<button type="button" data-act="layout" data-id="${id}"
					aria-pressed="${id === this.layout}">${esc(__(label))}</button>`
			).join("");
			const visible = this.visible_statuses();
			const status_rows = STATUSES.map((status) => {
				const checked = visible.includes(status);
				const locked = checked && visible.length === 1;
				return `<label><input type="checkbox" data-act="status" value="${esc(status)}"
					${checked ? "checked" : ""} ${locked ? "disabled" : ""}>
					<span>${esc(__(status))}</span>${this.icon(status)}</label>`;
			}).join("");
			const status_label =
				visible.length < STATUSES.length
					? __("Status ({0}/{1})", [visible.length, STATUSES.length])
					: __("Status");
			return `<div class="tbv-toolbar">
				<select data-act="project" aria-label="${esc(__("Project"))}">
					<option value="">${esc(__("All Projects"))}</option>${projects}
				</select>
				<div class="tbv-seg" role="group" aria-label="${esc(__("Layout"))}">${layouts}</div>
				<details class="tbv-dd"><summary class="tbv-btn">${esc(status_label)}</summary>
					<div class="tbv-dd-menu">${status_rows}</div></details>
				<div class="tbv-right">
					<button type="button" class="tbv-btn" data-act="reload" ${this.reloading ? "disabled" : ""}>${esc(
						this.reloading ? __("Reloading...") : __("Reload")
					)}</button>
					<div class="tbv-seg">
						<a href="/desk/task">${esc(__("List"))}</a>
						<a href="/desk/task/view/tree">${esc(__("Tree"))}</a>
						<a href="/desk/task/view/kanban">${esc(__("Kanban"))}</a>
					</div>
				</div>
			</div>`;
		}

		group_button(key, label, active) {
			const stats = this.stats(key);
			return `<button type="button" class="tbv-g-btn ${active ? "active" : ""} ${
				stats.count ? "" : "tbv-g-empty"
			}" data-act="group"
				data-id="${esc(key)}"><span class="tbv-g-name">${FOLDER_ICON}<span>${esc(label)}</span></span>
				<span class="tbv-count">${stats.done}/${stats.count}</span></button>`;
		}

		render_sidebar() {
			const rows = this.flatten(null, 0, true)
				.map((row) => {
					const open = this.expanded.has(row.key);
					const toggle = row.has_kids
						? `<button type="button" class="tbv-g-toggle" data-act="expand" data-id="${esc(row.key)}"
							aria-expanded="${open}" aria-label="${esc(
								__("Expand or collapse {0}", [row.label])
							)}">${chevron(open)}</button>`
						: '<span class="tbv-g-spacer"></span>';
					return `<div class="tbv-g" style="padding-left: ${row.depth * 16}px">${toggle}${this.group_button(
						row.key,
						row.label,
						this.group === row.key
					)}</div>`;
				})
				.join("");
			const ungrouped = this.has_ungrouped
				? `<div class="tbv-g"><span class="tbv-g-spacer"></span>${this.group_button(
						NO_GROUP,
						__("No group"),
						this.group === NO_GROUP
				  )}</div>`
				: "";
			return `<div class="tbv-layout"><nav class="tbv-side" aria-label="${esc(__("Task groups"))}">
				<div class="tbv-g"><span class="tbv-g-spacer"></span>${this.group_button(
					ALL,
					__("All Tasks"),
					this.group === ALL
				)}</div>${rows}${ungrouped}</nav>
				<div class="tbv-main">${this.render_board(this.group)}</div></div>`;
		}

		render_breadcrumb() {
			const chain = this.group === NO_GROUP ? [] : this.chain(this.group).reverse();
			const crumbs = [
				`<button type="button" class="tbv-link" data-act="group" data-id="${ALL}">${esc(
					__("All Tasks")
				)}</button>`,
				...(this.group === NO_GROUP
					? [`<span>/</span><span class="tbv-link">${esc(__("No group"))}</span>`]
					: chain.map(
							(group) => `<span aria-hidden="true">/</span><button type="button" class="tbv-link"
								data-act="group" data-id="${esc(group.name)}">${esc(group.subject)}</button>`
					  )),
			].join("");
			const rows = [
				{ key: ALL, label: __("All Tasks"), depth: 0 },
				...this.flatten(),
				...(this.has_ungrouped ? [{ key: NO_GROUP, label: __("No group"), depth: 0 }] : []),
			]
				.map(
					(row) =>
						`<div style="padding-left: ${row.depth * 16}px">${this.group_button(
							row.key,
							row.label,
							this.group === row.key
						)}</div>`
				)
				.join("");
			const parent = this.group === ALL ? null : this.group;
			const subgroups = this.group === NO_GROUP ? [] : this.children.get(parent) || [];
			const chips = this.render_chips(
				subgroups
					.filter((group) => this.stats(group.name).count)
					.map((group) => ({ key: group.name, label: group.subject }))
			);
			const stats = this.stats(this.group);
			return `<div class="tbv-layout-full"><div class="tbv-crumbs">
				<details class="tbv-dd"><summary class="tbv-btn">${FOLDER_ICON}${esc(
					__("Switch group")
				)}${chevron(true)}</summary><div class="tbv-dd-menu" style="min-width: 320px">${rows}</div></details>
				${crumbs}<span class="tbv-count" style="margin-left: auto">${esc(
				__("{0} of {1} finished", [stats.done, stats.count])
			)}</span></div>${chips}${this.render_board(this.group)}</div>`;
		}

		// Long folder lists stay to one short row until "more" is clicked.
		render_chips(rows) {
			if (!rows.length) return "";
			const shown = rows.filter(
				(row, index) => this.chips_open || index < CHIP_LIMIT || row.key === this.group
			);
			const hidden = rows.length - shown.length;
			const toggle =
				hidden || this.chips_open && rows.length > CHIP_LIMIT
					? `<button type="button" class="tbv-chip tbv-chip-more" data-act="chips">${esc(
							this.chips_open ? __("Show less") : __("+{0} more", [hidden])
					  )}</button>`
					: "";
			return `<div class="tbv-chips">${shown
				.map(
					(row) => `<button type="button" class="tbv-chip ${
						this.group === row.key ? "active" : ""
					}" data-act="group" data-id="${esc(row.key)}">${FOLDER_ICON}${esc(row.label)}
						<span class="tbv-count">${this.stats(row.key).count}</span></button>`
				)
				.join("")}${toggle}</div>`;
		}

		render_tabs() {
			const top = this.top_group(this.group);
			const tab = (key, label, active) => {
				const stats = this.stats(key);
				return `<button type="button" class="tbv-tab ${active ? "active" : ""}" data-act="group"
					data-id="${esc(key)}" title="${esc(label)}"><span class="tbv-tab-row"><span class="tbv-g-name">${FOLDER_ICON}<span>${esc(
					label
				)}</span></span><span class="tbv-count">${stats.done}/${stats.count}</span></span>
					<span class="tbv-bar"><span style="width: ${stats.pct}%"></span></span></button>`;
			};
			const tabs = [
				tab(ALL, __("All Tasks"), this.group === ALL),
				...(this.children.get(null) || [])
					.filter((group) => group.name === top || this.stats(group.name).count)
					.map((group) => tab(group.name, group.subject, top === group.name)),
				...(this.has_ungrouped ? [tab(NO_GROUP, __("No group"), this.group === NO_GROUP)] : []),
			].join("");
			let chips = "";
			if (top && top !== NO_GROUP && (this.children.get(top) || []).length) {
				chips = this.render_chips([
					{ key: top, label: __("All in {0}", [this.group_label(top)]) },
					...this.flatten(top).filter((row) => this.stats(row.key).count),
				]);
			}
			return `<div class="tbv-layout-full"><div class="tbv-tabs-wrap">
				<button type="button" class="tbv-tab-arrow" data-act="tabs-scroll" data-id="-1"
					aria-label="${esc(__("Previous groups"))}">&lsaquo;</button>
				<nav class="tbv-tabs" aria-label="${esc(__("Task groups"))}">${tabs}</nav>
				<button type="button" class="tbv-tab-arrow" data-act="tabs-scroll" data-id="1"
					aria-label="${esc(__("Next groups"))}">&rsaquo;</button>
			</div>${chips}${this.render_board(this.group)}</div>`;
		}

		render_board(key) {
			const columns = this.visible_statuses()
				.map((status) => {
					const cards = this.leaves.filter(
						(task) => task.status === status && this.in_group(task, key)
					);
					return `<section class="tbv-col" data-status="${esc(status)}">
						<h3 class="tbv-col-head">${this.icon(status)}<span>${esc(__(status))}</span>
							<span class="tbv-count">${cards.length}</span></h3>
						<div class="tbv-col-body">${
							cards.map((task) => this.render_card(task, key)).join("") ||
							`<p class="tbv-empty">${esc(__("No tasks"))}</p>`
						}</div>
					</section>`;
				})
				.join("");
			return `<div class="tbv-board">${columns}</div>`;
		}

		lane_rows() {
			return [
				...(this.children.get(null) || [])
					.filter((group) => this.stats(group.name).count)
					.map((group) => ({ key: group.name, label: group.subject })),
				...(this.has_ungrouped ? [{ key: NO_GROUP, label: __("No group") }] : []),
			];
		}

		// Lanes start closed as a status overview, and open one at a time to show cards.
		render_lanes() {
			const statuses = this.visible_statuses();
			const lanes = this.lane_rows();
			const all_open = lanes.length > 0 && lanes.every((lane) => this.open_lanes.has(lane.key));
			const heads = statuses
				.map((status) => {
					const count = this.leaves.filter((task) => task.status === status).length;
					return `<div class="tbv-col-head">${this.icon(status)}<span>${esc(__(status))}</span>
						<span class="tbv-count">${count}</span></div>`;
				})
				.join("");
			const rows = lanes
				.map((lane) => {
					const open = this.open_lanes.has(lane.key);
					const stats = this.stats(lane.key);
					const cells = statuses
						.map((status) => {
							const cards = this.leaves.filter(
								(task) => task.status === status && this.in_group(task, lane.key)
							);
							if (open) {
								return `<div class="tbv-cell" data-status="${esc(status)}">${cards
									.map((task) => this.render_card(task, lane.key))
									.join("")}</div>`;
							}
							return `<div class="tbv-cell tbv-cell-count ${cards.length ? "" : "tbv-cell-zero"}"
								data-status="${esc(status)}">${cards.length || "–"}</div>`;
						})
						.join("");
					return `<section class="tbv-lane tbv-lane-row">
						<button type="button" class="tbv-lane-head" data-act="lane" data-id="${esc(lane.key)}"
							aria-expanded="${open}"><span class="tbv-lane-title">${chevron(open)}${FOLDER_ICON}<span>${esc(
						lane.label
					)}</span><span class="tbv-count">${stats.done}/${stats.count}</span></span>
							<span class="tbv-bar"><span style="width: ${stats.pct}%"></span></span></button>
						${cells}</section>`;
				})
				.join("");
			return `<div class="tbv-lanes-wrap"><div class="tbv-lanes" style="--tbv-cols: ${statuses.length}">
				<div class="tbv-lane-row tbv-lane-top"><div class="tbv-lane-corner"><button type="button" class="tbv-link"
					data-act="lanes-all">${esc(all_open ? __("Collapse all") : __("Expand all"))}</button></div>${heads}</div>
				${rows || `<p class="tbv-empty">${esc(__("No groups in this project"))}</p>`}
			</div></div>`;
		}

		assignees(task) {
			try {
				return JSON.parse(task._assign || "[]");
			} catch (e) {
				return [];
			}
		}

		render_assignees(task, can_write) {
			const users = this.assignees(task);
			const initials = (name) =>
				String(name)
					.split("@")[0]
					.split(/[\s._-]+/)
					.filter(Boolean)
					.slice(0, 2)
					.map((part) => part[0].toUpperCase())
					.join("");
			const avatar = (user) => {
				const info = frappe.user_info(user);
				const name = info.fullname || user;
				const face = info.image
					? `<img src="${esc(info.image)}" alt="" draggable="false">`
					: esc(initials(name));
				return can_write
					? `<button type="button" class="tbv-avatar" data-act="unassign" data-user="${esc(user)}"
						title="${esc(__("{0}. Click to unassign", [name]))}">${face}</button>`
					: `<span class="tbv-avatar" title="${esc(name)}">${face}</span>`;
			};
			const extra =
				users.length > 3
					? `<span class="tbv-avatar" title="${esc(
							users.slice(3).map((user) => frappe.user_info(user).fullname || user).join(", ")
					  )}">+${users.length - 3}</span>`
					: "";
			const add = can_write
				? `<button type="button" class="tbv-avatar tbv-avatar-add" data-act="assign"
					title="${esc(__("Assign"))}" aria-label="${esc(__("Assign"))}">+</button>`
				: "";
			return `<span class="tbv-avatars">${users.slice(0, 3).map(avatar).join("")}${extra}${add}</span>`;
		}

		render_card(task, context) {
			const has_group = this.groups.has(task.parent_task) && task.parent_task !== context;
			const can_write = frappe.model.can_write("Task");
			const project = task.project
				? this.projects.find((row) => row.name === task.project)?.project_name || task.project
				: "";
			const due = task.exp_end_date
				? frappe.datetime.str_to_user(String(task.exp_end_date).split(" ")[0])
				: "";
			const due_text = due
				? `<span>${esc(due)}</span>`
				: `<span class="tbv-unset">${esc(__("Set Expected End Date..."))}</span>`;
			const priority = String(task.priority || "");
			const priority_class = ["Urgent", "High", "Medium"].includes(priority)
				? `tbv-pri-${priority.toLowerCase()}`
				: "";
			const age = task.modified ? frappe.datetime.prettyDate(task.modified, true) : "";
			return `<article class="tbv-card" data-task="${esc(task.name)}" ${
				can_write ? 'draggable="true"' : ""
			}>
				<div class="tbv-card-head"><a class="tbv-card-title" data-act="open" draggable="false"
					href="${esc(frappe.utils.get_form_link("Task", task.name))}">${esc(
				task.subject || task.name
			)}</a>${this.icon(task.status)}</div>
				${
					project
						? `<div class="tbv-card-row" title="${esc(__("Project"))}">${PROJECT_ICON}<span class="tbv-trunc">${esc(
								project
						  )}</span></div>`
						: ""
				}
				${
					has_group
						? `<button type="button" class="tbv-card-group tbv-card-row" data-act="group"
							data-id="${esc(task.parent_task)}">${FOLDER_ICON}<span>${esc(
								this.group_label(task.parent_task)
						  )}</span></button>`
						: ""
				}
				${
					can_write
						? `<button type="button" class="tbv-card-row tbv-card-due" data-act="due"
							title="${esc(__("Expected End Date"))}">${CALENDAR_ICON}${due_text}</button>`
						: due
						? `<div class="tbv-card-row">${CALENDAR_ICON}${due_text}</div>`
						: ""
				}
				${
					priority
						? `<div class="tbv-card-row tbv-card-meta">${FLAG_ICON}<span class="tbv-pri ${priority_class}">${esc(
								__(priority)
						  )}</span></div>`
						: ""
				}
				<div class="tbv-card-foot">${this.render_assignees(task, can_write)}${
				age
					? `<span class="tbv-age" title="${esc(
							__("Updated {0}", [frappe.datetime.str_to_user(task.modified)])
					  )}">${CLOCK_ICON}${esc(age)}</span>`
					: ""
			}</div>
			</article>`;
		}

		select_group(key) {
			this.group = key;
			this.chain(key)
				.slice(1)
				.forEach((group) => this.expanded.add(group.name));
			this.write("expanded", [...this.expanded]);
			this.render();
		}

		bind_events() {
			this.$root.on("click", "[data-act]", (e) => {
				const el = e.currentTarget;
				const act = el.dataset.act;
				const id = el.dataset.id;
				if (act === "open") {
					// Keep Frappe's link handler out; Ctrl/Cmd/Shift click opens a new tab.
					e.stopPropagation();
					if (e.ctrlKey || e.metaKey || e.shiftKey) return;
					e.preventDefault();
					this.open_card(el.closest(".tbv-card").dataset.task);
				} else if (act === "group") {
					e.stopPropagation();
					this.select_group(id);
				} else if (act === "expand") {
					this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id);
					this.write("expanded", [...this.expanded]);
					this.render();
				} else if (act === "layout") {
					this.layout = id;
					this.write("layout", id);
					this.render();
				} else if (act === "lane") {
					this.open_lanes.has(id) ? this.open_lanes.delete(id) : this.open_lanes.add(id);
					this.write("open_lanes", [...this.open_lanes]);
					this.render();
				} else if (act === "lanes-all") {
					const keys = this.lane_rows().map((lane) => lane.key);
					const all_open = keys.every((key) => this.open_lanes.has(key));
					this.open_lanes = new Set(all_open ? [] : keys);
					this.write("open_lanes", [...this.open_lanes]);
					this.render();
				} else if (act === "chips") {
					this.chips_open = !this.chips_open;
					this.render();
				} else if (act === "tabs-scroll") {
					this.$root.find(".tbv-tabs")[0].scrollBy({ left: Number(id) * 540, behavior: "smooth" });
				} else if (act === "reload") {
					this.reload();
				} else if (act === "due" || act === "assign" || act === "unassign") {
					e.stopPropagation();
					const name = el.closest(".tbv-card").dataset.task;
					if (act === "due") this.edit_due_date(name);
					else if (act === "assign") this.open_assign(name);
					else this.unassign(name, el.dataset.user);
				}
			});

			this.$root.on("change", '[data-act="project"]', (e) => {
				this.project = e.currentTarget.value;
				this.write("project", this.project);
				this.group = ALL;
				this.load();
			});
			this.$root.on("change", '[data-act="status"]', (e) => {
				const { value, checked } = e.currentTarget;
				checked ? this.hidden_statuses.delete(value) : this.hidden_statuses.add(value);
				this.write("hidden", [...this.hidden_statuses]);
				this.render();
				this.$root.find(".tbv-toolbar details").prop("open", true);
			});

			this.$root.on("click", ".tbv-card", (e) => {
				if ($(e.target).closest("a, button").length) return;
				this.open_card(e.currentTarget.dataset.task);
			});
			this.$root.on("dblclick", ".tbv-card", (e) => {
				if ($(e.target).closest("button").length) return;
				clearTimeout(this.click_timer);
				frappe.set_route("Form", "Task", e.currentTarget.dataset.task);
			});

			$(window).on("resize.trustbitview", () => this.fit_height());
			$(document).on("mousedown.trustbitview", (e) => {
				this.$root.find("details[open]").each(function () {
					if (!this.contains(e.target)) this.open = false;
				});
			});

			this.$root.on("dragstart", ".tbv-card", (e) => {
				e.originalEvent.dataTransfer.setData("text/plain", e.currentTarget.dataset.task);
				e.originalEvent.dataTransfer.effectAllowed = "move";
				this.dragging = e.currentTarget.dataset.task;
				this.drag_lane = e.currentTarget.closest(".tbv-lane");
				const card = e.currentTarget;
				requestAnimationFrame(() => card.classList.add("tbv-dragging"));
			});
			this.$root.on("dragend", ".tbv-card", () => {
				this.dragging = null;
				this.drag_lane = null;
				this.$root.find(".tbv-dragging").removeClass("tbv-dragging");
				this.$root.find(".tbv-over").removeClass("tbv-over");
			});
			this.$root.on("dragover", ".tbv-col, .tbv-cell", (e) => {
				// A swimlane is a folder, so a drag only changes status within its own lane.
				if (!this.dragging || (this.drag_lane && e.currentTarget.closest(".tbv-lane") !== this.drag_lane)) {
					this.$root.find(".tbv-over").removeClass("tbv-over");
					return;
				}
				e.preventDefault();
				this.$root.find(".tbv-over").not(e.currentTarget).removeClass("tbv-over");
				$(e.currentTarget).addClass("tbv-over");
			});
			this.$root.on("drop", ".tbv-col, .tbv-cell", (e) => {
				if (!this.dragging || (this.drag_lane && e.currentTarget.closest(".tbv-lane") !== this.drag_lane)) return;
				e.preventDefault();
				const name = this.dragging;
				this.dragging = null;
				this.$root.find(".tbv-over").removeClass("tbv-over");
				this.move_task(name, e.currentTarget.dataset.status);
			});
		}

		open_card(name) {
			clearTimeout(this.click_timer);
			this.click_timer = setTimeout(() => {
				frappe.trustbit.show_task_quick_view(name);
			}, DOUBLE_CLICK_WINDOW);
		}

		async move_task(name, status) {
			const task = this.by_name.get(name);
			if (!task || task.status === status) return;
			const previous = task.status;
			task.status = status;
			this.render();
			try {
				const saved = await frappe.xcall("frappe.client.set_value", {
					doctype: "Task",
					name,
					fieldname: "status",
					value: status,
				});
				// The server can choose another status, so show what it saved.
				task.status = saved?.status || status;
				task.modified = saved?.modified || task.modified;
			} catch (e) {
				task.status = previous;
			}
			this.render();
		}

		async refresh_task(name) {
			const [row] = await this.fetch_all("Task", TASK_FIELDS, [["name", "=", name]]);
			this.set_tasks(
				row
					? this.tasks.map((task) => (task.name === name ? row : task))
					: this.tasks.filter((task) => task.name !== name)
			);
			this.render();
		}

		edit_due_date(name) {
			const task = this.by_name.get(name);
			if (!task) return;
			const df = frappe.meta.get_docfield("Task", "exp_end_date");
			frappe.prompt(
				{
					fieldname: "exp_end_date",
					label: __("Expected End Date"),
					fieldtype: df?.fieldtype || "Date",
					default: task.exp_end_date,
				},
				async ({ exp_end_date }) => {
					try {
						await frappe.xcall("frappe.client.set_value", {
							doctype: "Task",
							name,
							fieldname: "exp_end_date",
							value: exp_end_date || "",
						});
					} finally {
						// On failure this puts back the saved date; Frappe shows the error.
						await this.refresh_task(name);
					}
				},
				task.subject || name,
				__("Save")
			);
		}

		async open_assign(name) {
			if (!frappe.ui.form?.AssignToDialog) await frappe.require("form.bundle.js");
			const assign = new frappe.ui.form.AssignToDialog({
				obj: this,
				method: "frappe.desk.form.assign_to.add",
				doctype: "Task",
				docname: name,
				callback: () => this.refresh_task(name),
			});
			assign.dialog.show();
		}

		unassign(name, user) {
			const label = frappe.user_info(user).fullname || user;
			frappe.confirm(__("Unassign {0} from {1}?", [esc(label), esc(name)]), async () => {
				await frappe.xcall("frappe.desk.form.assign_to.remove", {
					doctype: "Task",
					name,
					assign_to: user,
				});
				await this.refresh_task(name);
			});
		}

		add_task() {
			const values = {};
			if (this.project) values.project = this.project;
			if (this.group !== ALL && this.group !== NO_GROUP) values.parent_task = this.group;
			frappe.new_doc("Task", values);
		}
	}

	frappe.provide("frappe.standard_pages");
	frappe.standard_pages[PAGE] = () => {
		const wrapper = frappe.container.add_page(PAGE);
		frappe.ui.make_app_page({ parent: wrapper, title: __("Trustbit View"), single_column: true });
		new TrustbitView(wrapper);
	};

	// Add the entry directly below Tree in the Task view menu.
	const add_menu_entry = (ViewSelect) => {
		if (ViewSelect.prototype.trustbit_view_entry) return;
		ViewSelect.prototype.trustbit_view_entry = true;
		const base_get_view_options = ViewSelect.prototype.get_view_options;
		ViewSelect.prototype.get_view_options = function (...args) {
			const options = base_get_view_options.apply(this, args);
			if (this.doctype !== "Task") return options;
			const tree_label = this.label_map?.Tree || __("Tree");
			const tree_index = options.findIndex((option) => option.label === tree_label);
			options.splice(tree_index < 0 ? options.length : tree_index + 1, 0, {
				label: __("Trustbit View"),
				icon: "folder-tree",
				onclick: () => frappe.set_route(PAGE),
			});
			return options;
		};
	};

	frappe.provide("frappe.views");
	if (frappe.views.ListViewSelect) {
		add_menu_entry(frappe.views.ListViewSelect);
	} else {
		let view_select;
		Object.defineProperty(frappe.views, "ListViewSelect", {
			configurable: true,
			enumerable: true,
			get: () => view_select,
			set: (value) => {
				view_select = value;
				add_menu_entry(value);
			},
		});
	}
})();
