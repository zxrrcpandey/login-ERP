"""Task status "Need Clarification": send a task to someone with a question, and let them reply.

The selected person (the task's creator by default) is added to the assignees. Their reply is
saved as a comment, notifies the sender, and returns the task to the status it had before.
Moving a task to this status any other way (Kanban, status field) asks the creator.
"""

import frappe
from frappe import _
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.custom.doctype.property_setter.property_setter import make_property_setter
from frappe.desk.doctype.notification_log.notification_log import enqueue_create_notification
from frappe.desk.form import assign_to
from frappe.utils import escape_html, get_fullname

CLARIFICATION_STATUS = "Need Clarification"
# A task can't go back to these once it has been reopened for a question.
NOT_RESTORABLE = {"Completed", "Cancelled", "Template", CLARIFICATION_STATUS}
TRACKING_FIELDS = (
	"clarification_requested_from",
	"clarification_requested_by",
	"clarification_question",
	"clarification_previous_status",
)


class TaskClarificationMixin:
	def update_status(self):
		# ERPNext's daily job would otherwise turn a waiting task into Overdue.
		if self.status == CLARIFICATION_STATUS:
			return
		super().update_status()


def setup():
	"""Create the status, tracking fields and Kanban column. Safe to run repeatedly."""
	if not frappe.db.exists("DocType", "Task"):
		return

	hidden = {"hidden": 1, "read_only": 1, "no_copy": 1, "print_hide": 1, "report_hide": 1}
	create_custom_fields(
		{
			"Task": [
				{
					"fieldname": "clarification_requested_from",
					"label": "Clarification Requested From",
					"fieldtype": "Link",
					"options": "User",
					"insert_after": "status",
					**hidden,
				},
				{
					"fieldname": "clarification_requested_by",
					"label": "Clarification Requested By",
					"fieldtype": "Link",
					"options": "User",
					"insert_after": "clarification_requested_from",
					**hidden,
				},
				{
					"fieldname": "clarification_question",
					"label": "Clarification Question",
					"fieldtype": "Small Text",
					"insert_after": "clarification_requested_by",
					**hidden,
				},
				{
					"fieldname": "clarification_previous_status",
					"label": "Status Before Clarification",
					"fieldtype": "Data",
					"insert_after": "clarification_question",
					**hidden,
				},
			]
		},
		update=True,
	)

	options = (frappe.get_meta("Task").get_field("status").options or "").split("\n")
	if CLARIFICATION_STATUS not in options:
		position = options.index("Pending Review") + 1 if "Pending Review" in options else len(options)
		options.insert(position, CLARIFICATION_STATUS)
		make_property_setter(
			"Task",
			"status",
			"options",
			"\n".join(options),
			"Text",
			validate_fields_for_doctype=False,
		)
		frappe.clear_cache(doctype="Task")

	_add_kanban_column()


def _add_kanban_column():
	if not frappe.db.exists("Kanban Board", "Task Status"):
		return
	board = frappe.get_doc("Kanban Board", "Task Status")
	# Frappe only allows changes to standard boards in developer mode.
	if board.is_standard == "Yes":
		return
	if any(column.column_name == CLARIFICATION_STATUS for column in board.columns):
		return

	column = board.append(
		"columns",
		{"column_name": CLARIFICATION_STATUS, "status": "Active", "indicator": "Yellow"},
	)
	board.columns.remove(column)
	names = [row.column_name for row in board.columns]
	position = names.index("Pending Review") + 1 if "Pending Review" in names else len(names)
	board.columns.insert(position, column)
	for index, row in enumerate(board.columns, start=1):
		row.idx = index
	board.save(ignore_permissions=True)


def validate(doc, method=None):
	"""Keep the tracking fields server-controlled, whichever way the status was changed."""
	before = doc.get_doc_before_save()
	old_status = before.status if before else None

	if doc.status == CLARIFICATION_STATUS and old_status != CLARIFICATION_STATUS:
		_start_clarification(doc, old_status)
	elif doc.status == CLARIFICATION_STATUS:
		for fieldname in TRACKING_FIELDS:
			doc.set(fieldname, before.get(fieldname))
	else:
		for fieldname in TRACKING_FIELDS:
			doc.set(fieldname, None)


def _start_clarification(doc, old_status):
	request = frappe.flags.trustbit_clarification or {}
	if request.get("task") != doc.name:
		request = {}

	requested_from = request.get("user") or doc.owner or frappe.session.user
	_validate_user(requested_from)

	doc.clarification_requested_from = requested_from
	doc.clarification_requested_by = frappe.session.user
	doc.clarification_question = request.get("question")
	doc.clarification_previous_status = (
		old_status if old_status and old_status not in NOT_RESTORABLE else "Open"
	)


def _validate_user(user):
	if not frappe.db.get_value("User", user, "enabled"):
		frappe.throw(
			_("{0} is not an active user. Use the Need Clarification button to choose someone else.").format(
				frappe.bold(user)
			)
		)


def on_update(doc, method=None):
	if doc.status != CLARIFICATION_STATUS:
		return
	before = doc.get_doc_before_save()
	if before and before.status == CLARIFICATION_STATUS:
		return

	user = doc.clarification_requested_from
	question = doc.clarification_question or ""
	comment = _("Clarification requested from {0}").format(frappe.bold(escape_html(get_fullname(user))))
	if question:
		comment += "<br>" + escape_html(question)
	doc.add_comment("Comment", text=comment)

	if user == frappe.session.user:
		return

	already_assigned = frappe.db.exists(
		"ToDo",
		{"reference_type": "Task", "reference_name": doc.name, "status": "Open", "allocated_to": user},
	)
	if already_assigned:
		_notify(user, doc, _("{0} needs clarification on {1}"), question)
	else:
		# Frappe sends the assignment notification, with the question as its description.
		assign_to.add(
			{
				"assign_to": [user],
				"doctype": "Task",
				"name": doc.name,
				"description": escape_html(question) or _("Clarification needed on {0}").format(doc.name),
			}
		)


def _notify(user, doc, subject, content=""):
	enqueue_create_notification(
		user,
		{
			"type": "Alert",
			"document_type": "Task",
			"document_name": doc.name,
			"subject": subject.format(
				frappe.bold(escape_html(get_fullname(frappe.session.user))),
				frappe.bold(escape_html(doc.subject or doc.name)),
			),
			"from_user": frappe.session.user,
			"email_content": escape_html(content),
		},
	)


@frappe.whitelist(methods=["POST"])
def request_clarification(task: str, user: str, question: str):
	doc = frappe.get_doc("Task", task)
	doc.check_permission("write")

	question = (question or "").strip()
	if not question:
		frappe.throw(_("Please enter what needs clarification."))
	if user == frappe.session.user:
		frappe.throw(_("Please select someone other than yourself."))
	if doc.status == CLARIFICATION_STATUS:
		frappe.throw(_("This task is already waiting for clarification."))
	if doc.status in NOT_RESTORABLE:
		frappe.throw(_("A {0} task can't be sent for clarification.").format(_(doc.status)))
	_validate_user(user)

	frappe.flags.trustbit_clarification = {"task": doc.name, "user": user, "question": question}
	try:
		doc.status = CLARIFICATION_STATUS
		doc.save()
	finally:
		frappe.flags.trustbit_clarification = None


@frappe.whitelist(methods=["POST"])
def reply_clarification(task: str, reply: str):
	doc = frappe.get_doc("Task", task)
	if doc.status != CLARIFICATION_STATUS:
		frappe.throw(_("This task is no longer waiting for clarification."))
	# The person asked may only have read access through the assignment.
	if doc.clarification_requested_from != frappe.session.user:
		frappe.throw(_("Only the person asked can reply."), frappe.PermissionError)

	reply = (reply or "").strip()
	if not reply:
		frappe.throw(_("Please enter your reply."))

	requested_by = doc.clarification_requested_by
	doc.status = doc.clarification_previous_status or "Open"
	doc.flags.ignore_permissions = True
	doc.save()

	doc.add_comment(
		"Comment",
		text=_("Clarification reply") + "<br>" + escape_html(reply),
	)
	if requested_by and requested_by != frappe.session.user:
		_notify(requested_by, doc, _("{0} replied to your clarification on {1}"), reply)
