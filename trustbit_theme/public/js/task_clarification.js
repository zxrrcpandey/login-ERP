// Task form: send a task for clarification, and reply when you are the person asked.
(() => {
	const STATUS = "Need Clarification";
	const CANNOT_REQUEST = ["Completed", "Cancelled", "Template", STATUS];
	const METHOD = "trustbit_theme.task_clarification";

	const full_name = (user) => frappe.user_info(user).fullname || user;

	const save_first = (frm) => {
		if (!frm.is_dirty()) return false;
		frappe.msgprint(__("Please save the task first."));
		return true;
	};

	const show_request_dialog = (frm) => {
		if (save_first(frm)) return;
		const creator = frm.doc.owner === frappe.session.user ? "" : frm.doc.owner;
		const dialog = new frappe.ui.Dialog({
			title: __("Need Clarification"),
			fields: [
				{
					fieldname: "user",
					fieldtype: "Link",
					options: "User",
					label: __("Ask"),
					reqd: 1,
					default: creator,
					description: __("The task creator is selected by default."),
					get_query: () => ({ filters: { enabled: 1 } }),
				},
				{
					fieldname: "question",
					fieldtype: "Small Text",
					label: __("What needs clarification?"),
					reqd: 1,
				},
			],
			primary_action_label: __("Send"),
			primary_action: (values) => {
				frappe.call({
					method: `${METHOD}.request_clarification`,
					args: { task: frm.doc.name, user: values.user, question: values.question },
					freeze: true,
					callback: () => {
						dialog.hide();
						frm.reload_doc();
						frappe.show_alert({ message: __("Sent for clarification"), indicator: "green" });
					},
				});
			},
		});
		dialog.show();
	};

	const show_reply_dialog = (frm) => {
		if (save_first(frm)) return;
		const dialog = new frappe.ui.Dialog({
			title: __("Reply to Clarification"),
			fields: [
				{
					fieldname: "question_display",
					fieldtype: "Small Text",
					label: __("Question"),
					read_only: 1,
					default: frm.doc.clarification_question || __("No question was added."),
				},
				{ fieldname: "reply", fieldtype: "Small Text", label: __("Your Reply"), reqd: 1 },
			],
			primary_action_label: __("Send Reply"),
			primary_action: (values) => {
				frappe.call({
					method: `${METHOD}.reply_clarification`,
					args: { task: frm.doc.name, reply: values.reply },
					freeze: true,
					callback: () => {
						dialog.hide();
						frm.reload_doc();
						frappe.show_alert({ message: __("Reply sent"), indicator: "green" });
					},
				});
			},
		});
		dialog.show();
	};

	frappe.ui.form.on("Task", {
		refresh(frm) {
			if (frm.is_new()) return;

			if (frm.doc.status === STATUS && frm.doc.clarification_requested_from) {
				const asked = frm.doc.clarification_requested_from;
				const question = frm.doc.clarification_question;
				const message = __("Waiting for clarification from {0}", [
					frappe.utils.escape_html(full_name(asked)),
				]);
				frm.set_intro(
					question
						? `${message}:<br>${frappe.utils.escape_html(question).replace(/\r?\n/g, "<br>")}`
						: message,
					"yellow"
				);
				if (asked === frappe.session.user) {
					frm.add_custom_button(__("Reply"), () => show_reply_dialog(frm));
				}
			} else if (frm.perm[0]?.write && !CANNOT_REQUEST.includes(frm.doc.status)) {
				frm.add_custom_button(__("Need Clarification"), () => show_request_dialog(frm));
			}
		},
	});
})();
