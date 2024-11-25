/**
 * A user-centric range testing application with exportable test output.
 */

'use strict';

/* globals view ui form rpc fs remoteDevice progressBar */
'require view';
'require ui';
'require form';
'require rpc';
'require fs';
'require tools.morse.rangetest.remote as remoteDevice';
'require tools.morse.rangetest.progressbar as progressBar';

document.querySelector('head').appendChild(E('link', {
	rel: 'stylesheet',
	type: 'text/css',
	href: L.resourceCacheBusted('view/rangetest/css/rangetest.css'),
}));

const umdnsUpdate = rpc.declare({
	object: 'umdns',
	method: 'update',
	params: [],
});

const umdnsBrowse = rpc.declare({
	object: 'umdns',
	method: 'browse',
	params: ['array'],
	expect: { '_http._tcp': {} },
});

const backgroundIperf3Client = rpc.declare({
	object: 'rangetest',
	method: 'background_iperf3_client',
	params: ['target', 'udp', 'reverse', 'time'],
});

const getBackground = rpc.declare({
	object: 'rangetest',
	method: 'get_background',
	params: ['id'],
});

let availableRemoteDevices = {};

/**
 * Validate GPS or manually entered coordinate input.
 */
function validateDecimalDegrees(sectionId, value) {
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

async function runRangetest(cancelPromise, config, testProgressBar) {
	const {
		advanced: {
			protocol: protocols,
			direction: directions,
		},
		basic: {
			remoteDeviceInfo: { ipv4: [remoteIp] },
			remoteDevicePassword: remotePassword,
		},
	} = config;
	let remoteRangetestDevice = remoteDevice.load(remoteIp, remotePassword);

	const iperf3TestTime = 10;
	const iperf3PollInterval = 2;

	const nSubtests = protocols.length * directions.length;
	const progressIncrement = (iperf3PollInterval / (iperf3TestTime * nSubtests)) * 100;
	testProgressBar.show();
	testProgressBar.reset('Beginning...');

	try {
		for (const protocol of protocols) {
			for (const direction of directions) {
				testProgressBar.text = `${protocol} ${direction}`;
				const iperf3ServerResponse = await remoteRangetestDevice.remoteRpc.backgroundIperf3Server();
				const iperf3ClientResponse = await backgroundIperf3Client(remoteIp, (protocol.toLowerCase() === 'udp'), (direction.toLowerCase() === 'receive'), iperf3TestTime);
				const iperf3ClientResults = await waitForIperf3Results(iperf3ClientResponse.id, iperf3TestTime, iperf3PollInterval, progressIncrement, testProgressBar, cancelPromise);
				const iperf3ServerResults = await remoteRangetestDevice.remoteRpc.getBackground(iperf3ServerResponse.id);

				console.log(`DEBUG: iperf3 ${protocol} ${direction} client results`, iperf3ClientResults);
				console.log(`DEBUG: iperf3 ${protocol} ${direction} server results`, iperf3ServerResults);
			}
		}

		testProgressBar.complete('Test Complete');
		// TODO: save results to file and show in table
	} catch (error) {
		testProgressBar.reset('Test Failed');
		console.error(error);
		ui.addNotification(_('Error'), E('pre', {}, `${error.message}`), 'error');
	}
}

async function waitForIperf3Results(iperf3ClientId, duration, pollInterval, progressIncrement, testProgressBar, cancelPromise) {
	// 30% margin of safety
	const timeout = (duration * 1300);
	const startTime = Date.now();
	let clientPollResponse, completed = false;

	while (!completed) {
		if (Date.now() - startTime > timeout) {
			throw new Error(`Range test client has timed out`);
		}
		await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
		clientPollResponse = await Promise.race([cancelPromise, getBackground(iperf3ClientId)]);
		if (clientPollResponse === ui.CANCEL) {
			testProgressBar.reset('Test Cancelled');
			throw new Error('Test Cancelled');
		} else if (Number.isInteger(clientPollResponse) && clientPollResponse !== 0) {
			throw new Error(`Request to local device failed with UBUS code: ${clientPollResponse}`);
		} else if (Object.keys(clientPollResponse).length > 0) {
			completed = true;
		} else {
			testProgressBar.increment(progressIncrement);
		}
	}

	return clientPollResponse;
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
				direction: ['Send', 'Receive'],
				logfileDirectory: '/tmp/rangetest',
			},
		};
	},

	async handleStartTest(ev, cancelPromise, basicTestConfigurationForm) {
		try {
			await basicTestConfigurationForm.parse();
			const hostname = this.rangetestConfiguration.basic.remoteDeviceHostname;
			this.rangetestConfiguration.basic.remoteDeviceInfo = availableRemoteDevices[hostname];
			await runRangetest(cancelPromise, this.rangetestConfiguration, this.testProgressBar);
		} catch (error) {
			console.error(error);
			ui.addNotification(_('Rangetest error'), E('pre', {}, error.message), 'error');
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

		const remoteDeviceSelect = s.option(form.ListValue, 'remoteDeviceHostname', _('Remote device'), _('The remote device which this test will be conducted against'));
		remoteDeviceSelect.readonly = true;

		const updateRemoteDeviceSelectOptions = async (remoteDeviceSelect, sectionId) => {
			remoteDeviceSelect.clear();
			// Fully restarting the service clears the cache of old advertisements. TODO: APP-3717.
			fs.exec_direct('/etc/init.d/umdns', ['restart']);
			await umdnsUpdate();
			// Similar issue to above, docs indicate we should "wait a couple of seconds"
			// after running umdns update. umdns update doesn't seem to wait for us,
			// instead it returns after sending mdns queries, but before receiving the responses.
			// Similar cache updating issue to above. TODO: APP-3717.
			await new Promise(resolveFn => window.setTimeout(resolveFn, 2000));
			let report = await umdnsBrowse(true);

			if (!report || Object.keys(report).length == 0) {
				remoteDeviceSelect.readonly = true;
				remoteDeviceSelect.renderUpdate(sectionId);
				ui.addNotification(_('Discovery error'), E('pre', {}, _('No compatible remote devices found!')), 'error');
				return;
			}

			for (const [hostname, deviceInfo] of Object.entries(report)) {
				const ipv4 = deviceInfo.ipv4;
				availableRemoteDevices[hostname] = deviceInfo;

				const optionName = `${hostname} (${ipv4})`;
				remoteDeviceSelect.value(hostname, optionName);
			}
			remoteDeviceSelect.readonly = false;
			remoteDeviceSelect.renderUpdate(sectionId);
		};

		// Extend the select element to also render a discover button
		const renderWidget = remoteDeviceSelect.renderWidget;
		remoteDeviceSelect.renderWidget = function (sectionId, option_index, cfgvalue) {
			const dropdown = renderWidget.call(this, sectionId, option_index, cfgvalue);
			const button = E('button', {
				id: 'discover-button',
				class: 'cbi-button cbi-button-action',
				click: ui.createHandlerFn(this, async () => {
					await updateRemoteDeviceSelectOptions(remoteDeviceSelect, sectionId);
				}),
			}, [_('Discover')]);
			return E('div', { style: 'display: flex; align-items: flex-start; gap: 1em;' }, [
				dropdown,
				button,
			]);
		};

		o = s.option(form.Value, 'remoteDevicePassword', _('Password'), _('Remote device password'));
		o.datatype = 'string';
		o.password = true;
		o.optional = true;

		o = s.option(form.Value, 'description', _('Description'), _('Optional: short description of the test conditions'));
		o.datatype = 'string';
		o.placeholder = _('NLOS, elephant in the way...');
		o.optional = true;

		o = s.option(form.Value, 'local_device_coordinates', _('Local device coordinates'), _('Optional: Must be provided in Decimal Degrees (DD) format, used by Google Maps'));
		o.validate = validateDecimalDegrees;
		o.placeholder = '-33.885553, 151.211138';	// MM Sydney office
		o.optional = true;

		o = s.option(form.Value, 'remote_device_coordinates', _('Remote device coordinates'), _('Optional: Must be provided in Decimal Degrees (DD) format, used by Google Maps'));
		o.validate = validateDecimalDegrees;
		o.placeholder = '-34.168550, 150.611910';	// MM Picton office
		o.optional = true;

		o = s.option(form.Value, 'range', _('Range (m)'), _('The distance between devices under test'));
		o.datatype = 'and(min(1), uinteger)';
		o.placeholder = _('500');
		o.rmempty = false;
		o.optional = false;

		let progressBarContainer, progressBarElement;
		progressBarContainer = E('div', { class: 'cbi-progressbar', style: 'margin: 0 2em 0 2em; visibility: hidden;' }, progressBarElement = E('div', { style: 'width: 0%' }));
		this.testProgressBar = progressBar.new(progressBarContainer, progressBarElement);

		return E([], [
			await m.render(),
			E('div', { class: 'cbi-page-actions', style: 'display: flex; align-items: center;' }, [
				E('button', { class: 'cbi-button cbi-button-action', click: ui.createCancellableHandlerFn(this, this.handleStartTest, _('Stop'), m) }, [_('Start Test')]),
				progressBarContainer,
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
		o.rmempty = false;
		o.optional = false;

		o = s.option(form.MultiValue, 'direction', _('Data Direction'));
		o.value('Send', _('Send'));
		o.value('Receive', _('Receive'));
		o.rmempty = false;
		o.optional = false;

		// This requires special validation and will be hardcoded for now
		// o = s.option(form.Value, 'logfileDirectory', _('Logfile Directory'), _('All data inside /tmp/ will be erased on reboot'));
		// o.datatype = 'directory';
		// o.readonly = true;
		// o.placeholder = '/tmp/rangetest';

		const save = async () => {
			await m.save();
			ui.hideModal();
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

		o = s.option(form.Value, 'udp_throughput', _('UDP Throughput (Mbps) (Send/Receive)'));
		o.datatype = 'string';
		o.readonly = true;

		o = s.option(form.Value, 'tcp_throughput', _('TCP Throughput (Mbps) (Send/Receive)'));
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

		const titleSection = E('section', { class: 'cbi-section' }, [
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
		]);
		const configurationSection = E('section', { class: 'cbi-section' }, [
			E('h3', {}, [
				_('Test Configuration'),
				E('button', {
					title: 'Advanced Configuration',
					class: 'icon-button icon-button-settings-cog pull-right',
					click: ui.createHandlerFn(this, this.renderAdvancedTestConfigurationForm),
				}),
			]),
			basicTestConfigurationForm,
		]);
		const resultsSummarySection = E('section', { class: 'cbi-section' }, [
			E('h3', {}, _('Results Summary')),
			resultsSummaryTable,
		]);

		const res = [
			titleSection,
			configurationSection,
			resultsSummarySection,
		];

		configurationSection.querySelector('#discover-button').click();
		return res;
	},
});
