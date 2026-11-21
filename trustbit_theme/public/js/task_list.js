// Task list: colour for the Need Clarification status, which ERPNext's list doesn't know.
(() => {
	const settings = frappe.listview_settings && frappe.listview_settings["Task"];
	if (!settings || settings.trustbit_extended) return;
	settings.trustbit_extended = true;

	const base_get_indicator = settings.get_indicator;
	settings.get_indicator = function (doc) {
		if (doc.status === "Need Clarification") {
			return [__(doc.status), "yellow", "status,=," + doc.status];
		}
		return base_get_indicator && base_get_indicator.call(this, doc);
	};
})();
