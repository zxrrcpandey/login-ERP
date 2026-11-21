app_name = "trustbit_theme"
app_title = "Trustbit Theme"
app_publisher = "Trustbit Technologies Pvt. Ltd."
app_description = "Trustbit branding and login theme"
app_email = "ra.pandey008@gmail.com"
app_license = "mit"

# Loaded on website (portal) pages, which includes /login.
# Both files no-op unless body[data-path="login"].
# ?v= is a cache-buster. nginx serves /assets with Cache-Control max-age=31536000,
# so without bumping this, browsers keep the old file for a year and never see edits.
# Desk-only: colours the left sidebar and the top bar. Never loads on
# website/portal pages, so the login theme below is unaffected.
app_include_css = "/assets/trustbit_theme/css/trustbit_desk.css?v=6"

# Trustbit View: Task board by Is Group folders, listed below Tree in the view menu.
app_include_js = "/assets/trustbit_theme/js/trustbit_view.js?v=4"

# Task quick-view popup: opened from task names in the Tree and from cards on the Kanban board.
doctype_tree_js = {"Task": ["public/js/task_quick_view.js", "public/js/task_tree.js"]}
doctype_kanban_js = {"Task": ["public/js/task_quick_view.js", "public/js/task_kanban.js"]}

# Task status "Need Clarification" (see task_clarification.py).
doctype_js = {"Task": "public/js/task_clarification.js"}
doctype_list_js = {"Task": "public/js/task_list.js"}
extend_doctype_class = {"Task": "trustbit_theme.task_clarification.TaskClarificationMixin"}
doc_events = {
	"Task": {
		"validate": "trustbit_theme.task_clarification.validate",
		"on_update": "trustbit_theme.task_clarification.on_update",
	}
}
after_migrate = ["trustbit_theme.task_clarification.setup"]

# Frappe 16.5x+ shows the app's logo (not the site logo) in the dock corner: rebrand ERPNext's.
extend_bootinfo = "trustbit_theme.boot.extend_bootinfo"

# Frappe core bug workarounds (see overrides.py). Drop each once Frappe ships the fix.
override_whitelisted_methods = {
	# 16.60.2: Link/Assign To dropdown crashes for select-only users (frappe#47979, unmerged)
	"frappe.desk.search.search_link": "trustbit_theme.overrides.search_link",
}

web_include_css = "/assets/trustbit_theme/css/trustbit_login.css?v=6"
web_include_js = "/assets/trustbit_theme/js/trustbit_login.js?v=6"

# Browsers request /favicon.ico at the site root regardless of the <link rel="icon">
# tags in the page (new-tab thumbnails, bookmarks, history entries, and as a general
# fallback). Frappe does not serve that path, so it returned 404 and browsers kept
# showing whatever stale icon they had cached. Point it at the configured favicon.
# Done here rather than in nginx because `bench setup nginx` regenerates that config.
website_redirects = [
	{"source": "/favicon.ico", "target": "/files/favicon.ico"},
]
