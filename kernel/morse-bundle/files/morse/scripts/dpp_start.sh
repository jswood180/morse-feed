#!/bin/sh

# This script is called by the button handler when the DPP button is pressed.
# The button can be pressed physically or via luci.

. /lib/functions.sh
. /lib/functions/leds.sh

# This file is removed upon DPP timeout/Success in wpa_s1g_dpp_action.sh script
dpp_start_time=/tmp/dpp_start_time

start_wpa_event_listener() {
	# Start the wpa_event_listener to listen for DPP events. The
	# wpa_event_listener will write the config on the STA side and control the
	# blinking led. On the STA side of DPP QR code, wpa_event_listener is
	# started by netifd.
	killall wpa_event_listener
	wpa_event_listener "$@" -a /lib/netifd/morse/wpa_s1g_dpp_action.sh -B
}

_maybe_press_dpp_button() {
	# For a morse, not disabled, AP or STA, send the button press to hostap
	local section_name="$1"
	config_get device "$section_name" device
	if [ "$(uci -q get "wireless.$device.type")" != "morse" ]; then
		return
	fi
	config_get disabled "$section_name" disabled 0
	if [ "$disabled" != 0 ]; then
		return
	fi
	config_get mode "$section_name" mode
	case "$mode" in
		"ap")
			echo "starting dpp due to button press"
			start_wpa_event_listener -p /var/run/hostapd_s1g/
			hostapd_cli_s1g dpp_push_button
			if [ $? -eq 0 ]; then
				# Update the dpp start time
				echo "$current_uptime" > "$dpp_start_time"
			fi
		;;
		"sta")
			echo "starting dpp due to button press"
			start_wpa_event_listener
			wpa_cli_s1g dpp_push_button
			if [ $? -eq 0 ]; then
				# Update the dpp start time
				echo "$current_uptime" > "$dpp_start_time"
			fi
		;;
	esac 2>&1 | logger -t button -p daemon.notice
}

# Check that the device is in a DPP mode (AP or STA) and tell hostap that the
# button is pressed if so.
maybe_press_dpp_button() {
	config_load wireless
	config_foreach _maybe_press_dpp_button wifi-iface
}

# Create a DPP timestamp file with the current uptime after the initial button press.
# For subsequent button presses, check the timestamp to ensure at least 120 seconds have passed,
# preventing rapid consecutive DPP events.
current_uptime=$(awk '{print int($1)}' /proc/uptime)

if [ -f $dpp_start_time ]; then
	stored_uptime=$(cat "$dpp_start_time")
	uptime_diff=$((current_uptime - stored_uptime))
	if [ "$uptime_diff" -lt 120 ]; then
		logger -t button -p daemon.notice "DPP button already pressed. Please wait for 2 minutes after the initial press."
		return
	fi
fi

maybe_press_dpp_button
