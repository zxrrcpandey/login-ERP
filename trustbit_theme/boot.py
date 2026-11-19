"""Additions to what the desk is told when a page loads (hooks.py: extend_bootinfo).

Frappe 16.5x+ moved the desk's top-left mark into the "dock" and fills it with the *app's*
logo (`app_data[].app_logo_url`, from erpnext/hooks.py), not Navbar Settings' site logo. So
after the 2026-11-19 update the corner showed ERPNext's blue "E". Point ERPNext's logo at the
Trustbit mark instead; the dock, the apps screen and the app switcher all read this.

Only what the desk displays changes; the app is still "erpnext".
"""

TRUSTBIT_TITLE = "Trustbit ERP"
# Transparent 256x256 PNG uploaded to the site's public files.
TRUSTBIT_MARK = "/files/trustbit-mark.png"


def extend_bootinfo(bootinfo):
	# Runs on every desk page load for every user: never let a branding tweak break the desk.
	try:
		for app in bootinfo.get("app_data") or []:
			if app.get("app_name") == "erpnext":
				app["app_title"] = TRUSTBIT_TITLE
				app["app_logo_url"] = TRUSTBIT_MARK
			elif app.get("app_name") == "frappe":
				# Framework pages (Build, Navbar Settings, ...) showed Frappe's grey cube on the
				# navy dock: hard to see, and not our brand. Title stays "Framework".
				app["app_logo_url"] = TRUSTBIT_MARK
	except Exception:
		pass
