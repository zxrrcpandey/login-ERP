// Task Tree additions, loaded through the doctype_tree_js hook:
// - Clicking the task name opens a read-only quick view with activity.
//   Ctrl/Cmd-click opens the Task form in a new tab.
// - "View" in the row's ... menu opens the Task form.
// - The chevron and the rest of the row still expand and collapse.
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

	const RICH_TAGS = new Set(
		"p br b strong i em u s ul ol li h1 h2 h3 h4 h5 h6 blockquote pre code span div table thead tbody tr th td".split(
			" "
		)
	);
	const DROPPED_TAGS = new Set(
		"script style iframe object embed svg math template noscript form input button textarea select link meta base".split(
			" "
		)
	);
	const IMAGE_STYLE =
		"max-width: 100%; max-height: 240px; height: auto; border-radius: 4px; cursor: zoom-in;";

	const is_image_url = (url) => {
		try {
			return /\.(png|jpe?g|gif|webp)$/i.test(new URL(url).pathname);
		} catch (e) {
			return false;
		}
	};

	// Larger preview on top of the quick view. Esc, the X, or the backdrop closes it.
	const open_image_preview = (src, alt) => {
		const $overlay = $(`
			<div class="trustbit-image-preview" role="dialog" aria-modal="true"
				style="position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center;
					justify-content: center; background: rgba(0, 0, 0, 0.85);">
				<img style="max-width: 92vw; max-height: 86vh; object-fit: contain; border-radius: 4px;">
				<div style="position: absolute; top: 14px; right: 18px; display: flex; gap: 14px;
					align-items: center;">
					<a class="preview-original" target="_blank" rel="noopener noreferrer"
						style="color: #fff;"></a>
					<button type="button" class="preview-close" style="color: #fff; background: none;
						border: 0; font-size: 26px; line-height: 1;">&times;</button>
				</div>
			</div>
		`);
		$overlay.find("img").attr({ src, alt: alt || "" });
		$overlay.find(".preview-close").attr("aria-label", __("Close"));
		const $original = $overlay.find(".preview-original").text(__("Open original"));
		if (src.startsWith("data:")) $original.remove();
		else $original.attr("href", src);

		const close = () => {
			document.removeEventListener("keydown", on_key, true);
			$overlay.remove();
		};
		// Capture phase, so Esc closes only the preview and not the quick view behind it.
		const on_key = (e) => {
			if (e.key !== "Escape") return;
			e.preventDefault();
			e.stopPropagation();
			close();
		};
		document.addEventListener("keydown", on_key, true);
		$overlay.on("click", (e) => {
			if (e.target === e.currentTarget || $(e.target).closest(".preview-close").length) {
				close();
			}
		});
		$overlay.appendTo(document.body);
		$overlay.find(".preview-close").trigger("focus");
	};

	const safe_url = (value, is_image) => {
		const raw = (value || "").trim();
		if (is_image && /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(raw)) {
			return raw;
		}
		try {
			const url = new URL(raw, window.location.origin);
			return ["http:", "https:"].includes(url.protocol) ? url.href : "";
		} catch (e) {
			return "";
		}
	};

	// Rebuilds stored HTML from an allowlist: no attributes, scripts or handlers survive
	// except checked link and image URLs.
	const sanitize_html = (html) => {
		if (!html) return "";
		const source = new DOMParser().parseFromString(String(html), "text/html");
		const output = document.implementation.createHTMLDocument("");
		const root = output.createElement("div");

		const copy = (from, to, in_link) => {
			from.childNodes.forEach((child) => {
				if (child.nodeType === Node.TEXT_NODE) {
					to.appendChild(output.createTextNode(child.textContent));
					return;
				}
				if (child.nodeType !== Node.ELEMENT_NODE) return;

				const tag = child.tagName.toLowerCase();
				if (DROPPED_TAGS.has(tag)) return;

				if (tag === "img") {
					const src = safe_url(child.getAttribute("src"), true);
					if (!src) return;
					const img = output.createElement("img");
					img.setAttribute("src", src);
					img.setAttribute("alt", child.getAttribute("alt") || "");
					img.setAttribute("loading", "lazy");
					img.setAttribute("style", IMAGE_STYLE);
					if (in_link || src.startsWith("data:")) {
						to.appendChild(img);
					} else {
						const link = output.createElement("a");
						link.setAttribute("href", src);
						link.setAttribute("target", "_blank");
						link.setAttribute("rel", "noopener noreferrer");
						link.appendChild(img);
						to.appendChild(link);
					}
					return;
				}
				if (tag === "a") {
					const href = safe_url(child.getAttribute("href"), false);
					if (!href) {
						copy(child, to, in_link);
						return;
					}
					const link = output.createElement("a");
					link.setAttribute("href", href);
					link.setAttribute("target", "_blank");
					link.setAttribute("rel", "noopener noreferrer");
					copy(child, link, true);
					to.appendChild(link);
					return;
				}
				if (!RICH_TAGS.has(tag)) {
					copy(child, to, in_link);
					return;
				}
				const element = output.createElement(tag);
				copy(child, element, in_link);
				to.appendChild(element);
			});
		};

		copy(source.body, root, false);
		return root.textContent.trim() || root.querySelector("img") ? root.innerHTML : "";
	};

	// Attached images that have no Activity entry of their own to show them.
	const render_attached_images = (files, shown_in_activity) => {
		const images = (files || [])
			.map((file) => ({ url: safe_url(file.file_url, false), name: file.file_name || "" }))
			.filter((file) => is_image_url(file.url) && !shown_in_activity.has(file.url));
		if (!images.length) return "";
		const thumbnails = images
			.map(
				(file) => `
				<a href="${esc(file.url)}" target="_blank" rel="noopener noreferrer" title="${esc(
					file.name
				)}">
					<img src="${esc(file.url)}" alt="${esc(file.name)}" loading="lazy"
						style="height: 88px; max-width: 160px; object-fit: cover; border-radius: 4px; cursor: zoom-in;">
				</a>`
			)
			.join("");
		return `<div style="display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 8px;">${thumbnails}</div>`;
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
		const description = sanitize_html(doc.description);
		return `
			<div class="row">${cells}</div>
			<div class="text-muted small">${esc(__("Description"))}</div>
			<div style="max-height: 40vh; overflow-y: auto;">${description || "-"}</div>`;
	};

	const format_change_value = (value) => {
		if (value === null || value === undefined || value === "") return "-";
		const text = to_plain_text(String(value));
		return text.length > 120 ? `${text.slice(0, 120)}…` : text || "-";
	};

	// Only fields this user may read, matching the form's own timeline.
	const get_version_text = (version) => {
		let data;
		try {
			data = JSON.parse(version.data || "{}");
		} catch (e) {
			return "";
		}
		if (data.comment) return to_plain_text(data.comment);

		const lines = (data.changed || []).reduce((out, [fieldname, before, after]) => {
			const df = frappe.meta.get_docfield("Task", fieldname);
			if (df && !df.hidden && frappe.perm.has_perm("Task", df.permlevel || 0, "read")) {
				out.push(
					`${__(df.label)}: ${format_change_value(before)} → ${format_change_value(after)}`
				);
			}
			return out;
		}, []);

		const table_changes =
			(data.added || []).length +
			(data.removed || []).length +
			(data.row_changed || []).length;
		if (table_changes) lines.push(__("Updated {0} table row(s)", [table_changes]));
		return lines.join("\n");
	};

	const get_activity_items = (doc, info) => {
		const items = [{ when: doc.creation, who: doc.owner, type: __("Created"), text: "" }];
		const add_logs = (logs, type) =>
			(logs || []).forEach((log) => {
				items.push({
					when: log.creation,
					who: log.owner,
					type,
					html: sanitize_html(log.content),
				});
			});

		add_logs(info.comments, __("Comment"));
		add_logs(info.assignment_logs, __("Assignment"));
		// Preview only files still attached, so removed ones don't show a broken image.
		const current_images = new Set(
			(info.attachments || []).map((file) => safe_url(file.file_url, false)).filter(is_image_url)
		);
		(info.attachment_logs || []).forEach((log) => {
			const html = sanitize_html(log.content);
			const is_added = log.comment_type === "Attachment";
			const href = new DOMParser()
				.parseFromString(html, "text/html")
				.querySelector("a")
				?.getAttribute("href");
			items.push({
				when: log.creation,
				who: log.owner,
				type: is_added ? __("Attachment") : __("Attachment Removed"),
				html,
				image: is_added && current_images.has(href) ? href : "",
			});
		});
		add_logs(info.workflow_logs, __("Workflow"));
		add_logs(info.info_logs, __("Info"));

		(info.versions || []).forEach((version) => {
			const text = get_version_text(version);
			if (text) {
				items.push({ when: version.creation, who: version.owner, type: __("Changed"), text });
			}
		});
		[...(info.communications || []), ...(info.automated_messages || [])].forEach((message) => {
			items.push({
				when: message.communication_date || message.creation,
				who: message.sender_full_name || message.sender,
				type: __("Email"),
				text: message.subject || to_plain_text(message.content),
			});
		});

		return items.sort((a, b) => String(b.when).localeCompare(String(a.when)));
	};

	const render_activity = (items) =>
		items
			.map(
				(item) => `
				<div style="padding: 8px 0; border-top: 1px solid var(--border-color);">
					<div class="small text-muted">
						<strong>${esc(item.type)}</strong> ·
						${esc(frappe.user_info(item.who).fullname || item.who)} ·
						${esc(frappe.datetime.str_to_user(item.when))}
					</div>
					${item.html ? `<div>${item.html}</div>` : ""}
					${
						item.image
							? `<a href="${esc(item.image)}" target="_blank" rel="noopener noreferrer">
								<img src="${esc(item.image)}" alt="" loading="lazy"
									style="${IMAGE_STYLE} margin-top: 6px;">
							</a>`
							: ""
					}
					${item.text ? `<div style="white-space: pre-wrap;">${esc(item.text)}</div>` : ""}
				</div>`
			)
			.join("");

	const load_activity = (doc, $target) => {
		frappe.call({
			method: "frappe.desk.form.load.get_docinfo",
			args: { doctype: "Task", name: doc.name },
			callback: (r) => {
				const info = r.docinfo || {};
				frappe.update_user_info(info.user_info || {});
				const items = get_activity_items(doc, info);
				const shown = new Set(items.map((item) => item.image).filter(Boolean));
				$target.html(render_attached_images(info.attachments, shown) + render_activity(items));
			},
			error: () => $target.text(__("Could not load activity.")),
		});
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
			const $details = dialog.fields_dict.details.$wrapper;
			$details.html(render_quick_view(doc));
			$details.on("click", "img", (e) => {
				// Ctrl/Cmd/Shift click keeps the browser's new-tab behaviour.
				if (e.ctrlKey || e.metaKey || e.shiftKey) return;
				e.preventDefault();
				e.stopPropagation();
				open_image_preview(e.currentTarget.currentSrc || e.currentTarget.src, e.currentTarget.alt);
			});
			$(`<div class="text-muted small" style="margin: 16px 0 6px;">${esc(
				__("Activity")
			)}</div>`).appendTo($details);
			const $activity = $(
				'<div style="max-height: 35vh; overflow-y: auto;"></div>'
			)
				.text(__("Loading..."))
				.appendTo($details);
			dialog.show();
			load_activity(doc, $activity);
		});
	};

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
					show_quick_view(name);
				});
		});
	};

	const base_on_node_render = settings.on_node_render;
	settings.on_node_render = function (node, deep) {
		link_labels(node);
		return base_on_node_render && base_on_node_render.call(this, node, deep);
	};
})();
