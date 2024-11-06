'use strict';

/* globals view ui form */
'require view';
'require ui';
'require form';

document.querySelector('head').appendChild(E('link', {
	rel: 'stylesheet',
	type: 'text/css',
	href: L.resourceCacheBusted('view/rangetest/css/rangetest.css'),
}));

/* Provide a custom validation function for the GPS coordinate input
*/
function validateDecimalDegrees(section_id, value) {
	if (!value) {
		return true;
	}

	const coordinates = value.split(',');

	if (coordinates.length !== 2) {
		return _('Expecting: \'latitude, longitude\' format.');
	}
	const latitude = parseFloat(coordinates[0].trim());
	const longitude = parseFloat(coordinates[1].trim());

	if (isNaN(latitude) || isNaN(longitude)) {
		return _('Expecting: Coordinates must be numeric values.');
	}

	if (latitude < -90 || latitude > 90) {
		return _('Expecting: Latitude must be between -90 and 90.');
	}

	if (longitude < -180 || longitude > 180) {
		return _('Expecting: Longitude must be between -180 and 180.');
	}

	return true;
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load() {
		this.rangetestConfiguration = {
			basic: {},
			advanced: {
				protocol: ['UDP', 'TCP'],
				direction: ['Uplink', 'Downlink'],
				directory: '/tmp/rangetest/data',
			},
		};
	},

	async handleStartTest(basicTestConfigurationForm) {
		try {
			await basicTestConfigurationForm.parse();
			ui.addNotification(null, E('p', {}, _('DEBUG: starting test')));
		} catch (e) {
			ui.addNotification(_('Configuration error'), E('pre', {}, e.message), 'error');
		}
	},

	handleExportAllTestData() {
		ui.addNotification(null, E('p', {}, _('DEBUG: export all')));
	},

	handleDeleteAllTestData() {
		ui.addNotification(null, E('p', {}, _('DEBUG: delete all')));
	},

	async renderBasicTestConfigurationForm() {
		const m = new form.JSONMap(this.rangetestConfiguration);
		const s = m.section(form.NamedSection, 'basic');
		let o;

		// Extend the select element to also render a discover button
		const remoteDeviceSelect = s.option(form.ListValue, 'remote', _('Remote Device'), _('The remote device which this test will be conducted against'));
		remoteDeviceSelect.readonly = true;
		const renderWidget = remoteDeviceSelect.renderWidget;
		remoteDeviceSelect.renderWidget = function (section_id, option_index, cfgvalue) {
			const dropdown = renderWidget.call(this, section_id, option_index, cfgvalue);
			const button = E('button', {
				class: 'cbi-button cbi-button-action',
				click: ui.createHandlerFn(this, async () => {
					await new Promise(resolve => setTimeout(resolve, 1000));
					remoteDeviceSelect.clear();
					remoteDeviceSelect.value('TEST', 'test');
					remoteDeviceSelect.readonly = false;
					remoteDeviceSelect.renderUpdate(section_id);
				}),
			}, [_('Discover')]);
			return E('div', { style: 'display: flex; align-items: flex-start; gap: 1em;' }, [
				dropdown,
				button,
			]);
		};

		o = s.option(form.Value, 'description', _('Description'), _('An optional, short description of the test conditions'));
		o.datatype = 'string';
		o.placeholder = _('NLOS, elephant in the way...');
		o.optional = true;

		o = s.option(form.Value, 'local_device_coordinates', _('This Device Position Coordinates'), _('Must be provided in Decimal Degrees (DD) format, used by Google Maps'));
		o.validate = validateDecimalDegrees;
		o.placeholder = '-33.885553, 151.211138';	// MM Sydney office
		o.optional = true;

		o = s.option(form.Value, 'remote_device_coordinates', _('Remote Device Position Coordinates'), _('Must be provided in Decimal Degrees (DD) format, used by Google Maps'));
		o.validate = validateDecimalDegrees;
		o.placeholder = '-34.168550, 150.611910';	// MM Picton office
		o.optional = true;

		o = s.option(form.Value, 'range', _('Range (m)'), _('The distance between devices under test'));
		o.datatype = 'and(min(1), uinteger)';
		o.placeholder = _('500');
		o.rmempty = false;
		o.optional = false;

		return E([], [
			await m.render(),
			E('div', { class: 'cbi-section-create cbi-tblsection-create' }, [
				E('button', { class: 'cbi-button cbi-button-action', click: ui.createHandlerFn(this, this.handleStartTest, m) }, [_('Start Test')]),
			]),
		]);
	},

	async renderAdvancedTestConfigurationForm() {
		const m = new form.JSONMap(this.rangetestConfiguration);
		const s = m.section(form.NamedSection, 'advanced');
		let o;

		o = s.option(form.MultiValue, 'protocol', _('Protocol'));
		o.value('UDP', _('UDP'));
		o.value('TCP', _('TCP'));

		o = s.option(form.MultiValue, 'direction', _('Direction'));
		o.value('Uplink', _('Uplink'));
		o.value('Downlink', _('Downlink'));

		o = s.option(form.Value, 'directory', _('Results Directory'), _('All data inside /tmp/ will be erased on reboot'));
		o.datatype = 'directory';
		o.readonly = true;
		o.placeholder = '/tmp/rangetest';

		const save = async () => {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, _('DEBUG: advanced test configuration changes saved!')));
		};

		ui.showModal(_('Advanced Configuration'), [
			await m.render(),
			E('div', { class: 'right' }, [
				E('button', { class: 'cbi-button', click: ui.hideModal }, _('Dismiss')), ' ',
				E('button', { class: 'cbi-button cbi-button-positive', click: save }, _('Save')), ' ',
			]),
		]);
	},

	async renderResultsSummaryTable() {
		const m = new form.JSONMap(null);
		const s = m.section(form.GridSection, 'basic');
		s.anonymous = true;
		s.nodescriptions = true;

		let o;

		o = s.option(form.Value, 'id', _('ID'));
		o.datatype = 'string';
		o.readonly = true;

		o = s.option(form.Value, 'timestamp', _('Timestamp'));
		o.datatype = 'string';
		o.readonly = true;

		o = s.option(form.Value, 'remote_hostname', _('Remote Hostname'));
		o.datatype = 'string';
		o.readonly = true;

		o = s.option(form.Value, 'description', _('Description'));
		o.datatype = 'string';

		o = s.option(form.Value, 'status', _('Status'));
		o.datatype = 'string';
		o.readonly = true;

		o = s.option(form.Value, 'distance', _('Distance (m)'));
		o.datatype = 'uinteger';
		o.readonly = true;

		o = s.option(form.Value, 'location', _('Location'));
		o.datatype = 'string';
		o.readonly = true;

		o = s.option(form.Value, 'bandwidth', _('Bandwidth (MHz)'));
		o.datatype = 'uinteger';
		o.readonly = true;

		o = s.option(form.Value, 'channel', _('Channel'));
		o.datatype = 'uinteger';
		o.readonly = true;

		o = s.option(form.Value, 'udp_throughput', _('UDP Throughput (Mbps) (Uplink/Downlink)'));
		o.datatype = 'string';
		o.readonly = true;

		o = s.option(form.Value, 'tcp_throughput', _('TCP Throughput (Mbps) (Uplink/Downlink)'));
		o.datatype = 'string';
		o.readonly = true;

		o = s.option(form.Value, 'signal_strength', _('Signal Strength (dBm)'));
		o.datatype = 'integer';
		o.readonly = true;

		return E([], [
			await m.render(),
			E('div', { class: 'cbi-section-create cbi-tblsection-create' }, [
				E('button', { class: 'cbi-button cbi-button-action', click: ui.createHandlerFn(this, this.handleExportAllTestData) }, [_('Export All')]),
				E('button', { class: 'cbi-button cbi-button-remove', click: ui.createHandlerFn(this, this.handleDeleteAllTestData) }, [_('Delete All')]),
			]),
		]);
	},

	async render() {
		const [basicTestConfigurationForm, resultsSummaryTable] = await Promise.all([
			this.renderBasicTestConfigurationForm(),
			this.renderResultsSummaryTable(),
		]);

		const res = [
			E('section', { class: 'cbi-section' }, [
				E('h2', {}, _('Range Test')),
				E('div', { class: 'cbi-map-descr' }, _('This is a network utility to perform static range tests.')),
				E('div', { class: 'cbi-map-descr' }, [
					E('span', {}, _('How to use:')),
					E('div', { class: 'cbi-value cbi-message-value' }, [
						E('ol', {}, [
							E('li', { style: 'list-style-type: inherit' }, _('Associate this device with another remote device which you want to test against.')),
							E('li', { style: 'list-style-type: inherit' }, _('Choose that remote device from the dropdown list and select your desired test settings.')),
							E('li', { style: 'list-style-type: inherit' }, _('Click \'Start Test\' to begin.')),
						]),
					]),
				]),
			]),
			E('section', { class: 'cbi-section' }, [
				E('h3', {}, [
					_('Test Configuration'),
					E('button', {
						title: 'Advanced Configuration',
						class: 'icon-button icon-button-settings-cog pull-right',
						click: ui.createHandlerFn(this, this.renderAdvancedTestConfigurationForm),
					}),
				]),
				basicTestConfigurationForm,
			]),
			E('section', { class: 'cbi-section' }, [
				E('h3', {}, _('Results Summary')),
				resultsSummaryTable,
			]),
		];

		return res;
	},
});
