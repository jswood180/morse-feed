'use strict';

/* globals baseclass rpc */
'require baseclass';
'require rpc';

var remoteRequest = rpc.declare({
	object: 'rangetest-rpc',
	method: 'request',
	params: ['uri', 'body'],
});

var RemoteRpcClass = rpc.constructor.extend({
	remoteRpcRequestId: 1,
	remoteRpcBaseUrl: null,
	remoteRpcSessionId: '00000000000000000000000000000000',

	expires: 0,
	message: {
		jsonrpc: '2.0',
		id: 0,
		method: 'call',
		params: [
			'00000000000000000000000000000000',
			'session',
			'login',
			{
				username: 'root',
				password: '',
			},
		],
	},

	__currentTime: () => Math.floor(Date.now() / 1000),

	__login: function () {
		return remoteRequest(this.remoteRpcBaseUrl, this.message);
	},

	__checkLogin: function () {
		if (this.__currentTime() > this.expires) {
			return this.__login()
				.then((response) => {
					// With certain errors, the response variable is an integer i.e. 2
					// and the actual http response body is an array [{"jsonrpc":"2.0","id":4,"result":[2]}]
					if (Number.isInteger(response)) {
						return this.__handleUbusError(response, `Remote login to ${this.remoteRpcBaseUrl} failed with UBUS error`, true);
					} else if (response.result && (response.result[0] !== 0 || response.result.length !== 2)) {
						return this.__handleUbusError(response.result[0], `Remote login to ${this.remoteRpcBaseUrl} failed with UBUS error`, true);
					}

					this.remoteRpcSessionId = response.result[1].ubus_rpc_session;
					this.expires = this.__currentTime() + response.result[1].expires;
				});
		}
		return Promise.resolve();
	},

	__call: function (req) {
		if (this.remoteRpcBaseUrl === undefined) {
			return Promise.reject(new Error('No URL set for remote RPC call!'));
		}

		return this.__checkLogin()
			.then(() => {
				req.params[0] = this.remoteRpcSessionId;
				req.id = this.remoteRpcRequestId++;
				return remoteRequest(this.remoteRpcBaseUrl, req);
			});
	},

	__parseCallReply: function (response) {
		// With incorrect certain errors, the response variable is an integer i.e. 2
		// and the actual http response body is an array [{"jsonrpc":"2.0","id":4,"result":[2]}]
		if (Number.isInteger(response)) {
			return this.__handleUbusError(response, `RPC call to ${this.remoteRpcBaseUrl} failed with UBUS error`);
		} else if (response.result && (response.result[0] !== 0 || response.result.length !== 2)) {
			return this.__handleUbusError(response.result[0], `RPC call to ${this.remoteRpcBaseUrl} failed with UBUS error`);
		}

		// dongle rpcd plugin errors i.e. 404
		if (response.error || !response.result) {
			const errorCode = response.error ? response.error.code : 'Unknown';
			const errorMessage = response.error ? response.error.message : 'Unknown error';

			return Promise.reject(
				new Error(`RPC call to ${this.remoteRpcBaseUrl} failed with HTTP error: ${errorMessage} (${errorCode})`),
			);
		}

		return Promise.resolve(response.result[1]);
	},

	__handleUbusError: function (code, message, isAuthCheck = false) {
		if (isAuthCheck && code === 6) {
			return Promise.reject(new Error('Please try a different password.'));
		}
		const ubusErrorMessage = rpc.getStatusText(code) || 'Unknown UBUS error';
		return Promise.reject(new Error(`${message}: ${ubusErrorMessage}`));
	},

	/**
	 * Call the exec endpoint in the file RPCD plugin.
	 */
	exec: function (command, params) {
		const req = {
			jsonrpc: '2.0',
			method: 'call',
			params: [
				null,
				'file',
				'exec',
				{
					command: command,
					params: params,
					timeout: 2,
				},
			],
		};

		return this.__call(req)
			.then(res => this.__parseCallReply(res));
	},

	/**
	 * Returns the current RPC session id.
	 *
	 * @returns {string}
	 * Returns the 32 byte session ID string used for authenticating remote
	 * requests.
	 */
	getSessionID: function () {
		return this.remoteRpcSessionId;
	},

	/**
	 * Set the RPC session id to use.
	 *
	 * @param {string} sid
	 * Sets the 32 byte session ID string used for authenticating remote
	 * requests.
	 */
	setSessionID: function (sid) {
		this.remoteRpcSessionId = sid;
	},

	/**
	 * Returns the current RPC base URL.
	 *
	 * @returns {string}
	 * Returns the RPC URL endpoint to issue requests against.
	 */
	getBaseURL: function () {
		return this.remoteRpcBaseUrl;
	},

	/**
	 * Set the RPC base URL to use.
	 *
	 * @param {string} sid
	 * Sets the RPC URL endpoint to issue requests against.
	 */
	setBaseURL: function (url) {
		this.remoteRpcBaseUrl = url;
	},

	/**
	 * Set the RPC password to use.
	 *
	 * @param {string} password
	 * Sets the plaintext password to use for session auth, only setting
	 * it if it isn't empty.
	 */
	setPassword: function (password) {
		if (password) {
			this.message.params[3].password = password;
		}
	},
});

var remoteRpc = new RemoteRpcClass();

var Remote = baseclass.extend({
	remoteUrl: null,
	remoteRpc: remoteRpc,
	__init__: function (url, password) {
		this.remoteUrl = 'http://' + url + '/ubus/';
		remoteRpc.setBaseURL(this.remoteUrl);
		remoteRpc.setPassword(password);
	},
});

var RemoteDeviceFactory = baseclass.extend({
	load: (url, password) => new Remote(url, password),
});

return RemoteDeviceFactory;
