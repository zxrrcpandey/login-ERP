"""Workarounds for Frappe core bugs, wired in hooks.py (override_whitelisted_methods).

Each one wraps the core function and changes as little as possible, so it can be dropped
as soon as Frappe ships the fix. Remove the hook entry first, then the function.
"""

import frappe
from frappe.desk import search as _search
from frappe.utils import sbool


@frappe.whitelist()
def search_link(
	doctype: str,
	txt: str,
	query: str | None = None,
	filters: str | dict | list | None = None,
	page_length: int = 10,
	searchfield: str | None = None,
	reference_doctype: str | None = None,
	ignore_user_permissions: bool = False,
	link_fieldname: str | None = None,
	start: int = 0,
	include_image: bool = False,
	keep_order: bool = False,
):
	"""frappe.desk.search.search_link, minus a crash in its image lookup (Frappe 16.60.2).

	The bug: for a user who only has *select* permission on the target DocType (e.g. a
	"Projects User" picking someone in Assign To, target "User"), `get_image_field` says the
	image column is readable (it only checks permlevel), but `frappe.get_list` drops that
	column for select-only users. `add_images` then does `dict()` over 1-tuples and raises
	"ValueError: dictionary update sequence element #0 has length 1; 2 is required", so the
	whole dropdown fails with a Server Error. Still present on version-16-hotfix 2026-11-20.

	Here: run the core search without images, then add them, and if that lookup hits this
	bug, return the rows without images, which is what the user's permission implies anyway.
	"""
	rows = _search.search_link(
		doctype,
		txt,
		query=query,
		filters=filters,
		page_length=page_length,
		searchfield=searchfield,
		reference_doctype=reference_doctype,
		ignore_user_permissions=ignore_user_permissions,
		link_fieldname=link_fieldname,
		start=start,
		include_image=False,
		keep_order=keep_order,
	)
	if sbool(include_image):
		try:
			_search.add_images(rows, doctype)
		except ValueError:
			pass
	return rows
