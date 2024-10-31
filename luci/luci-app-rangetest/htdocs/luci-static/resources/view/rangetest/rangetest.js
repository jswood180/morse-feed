'use strict';

/* globals view */
'require view';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load() {
		return Promise.resolve();
	},

	render() {
		const body = E([], [
			E('h2', {}, _('Range Test')),
		]);
		return body;
	},
});
