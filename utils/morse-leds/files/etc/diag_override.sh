#!/bin/sh
# Copyright (C) 2006-2019 OpenWrt.org
# Copyright 2024 Morse Micro

# This is a rewritten version of /etc/diag.sh from base-files which
# adds more possible states. It also simplifies things by disabling
# all LEDs on every call (so we don't have to test what to disable)
# and passing by argument rather than via setting status_led.

. /lib/functions.sh
. /lib/functions/leds.sh

# This lets us have a different basic LED colour depending
# on the mode of the device.
_mm_mode="$(persistent_vars_storage.sh READ mm_mode 2> /dev/null)"
if [ -z "$_mm_mode" ]; then
	# Sadly, fw_*.config files are populated by uci-defaults, and when we're
	# early in the boot process we don't have it. But we really want to
	# show the mode colour early in the boot process to avoid confusion.
	# Board_name is also not available, so...
	board_name="$(strings /proc/device-tree/compatible | head -1)"
	case "$board_name" in
	morse,artini)
		echo '/dev/mtd1 0x0 0x1000 0x1000' > /tmp/artini_preinit_fw_sys.config
		_mm_mode="$(fw_printenv -n -c /tmp/artini_preinit_fw_sys.config mm_mode 2> /dev/null)"
		rm /tmp/artini_preinit_fw_sys.config
		;;
	esac
fi

boot="$(get_dt_led boot)"
failsafe="$(get_dt_led failsafe)"
running="$(get_dt_led running)"
runningsta="$(get_dt_led runningsta)"
upgrade="$(get_dt_led upgrade)"
dpp="$(get_dt_led dpp)"

disable_all_leds() {
	led_off "$boot"
	led_off "$failsafe"
	led_off "$running"
	led_off "$upgrade"
	led_off "$dpp"
}

led_blink_slow() {
	led_timer "$1" 1000 1000
}

led_blink() {
	led_timer "$1" 300 300
}

led_blink_fast() {
	led_timer "$1" 100 100
}

led_blink_veryfast() {
	led_timer "$1" 50 50
}

set_state() {
	disable_all_leds

	case "$1" in
	preinit)
		led_blink_fast "$running"
		if [ "$_mm_mode" = sta ]; then
			led_blink_fast "$runningsta"
		fi
		;;
	failsafe)
		led_blink_veryfast "$failsafe"
		;;
	preinit_regular)
		led_blink_fast "$running"
		if [ "$_mm_mode" = sta ]; then
			led_blink_fast "$runningsta"
		fi
		;;
	upgrade)
		led_blink "$upgrade"
		;;
	dpp_started)
		led_blink_slow "$dpp"
		;;
	dpp_failed)
		led_blink_fast "$dpp"
		;;
	factory_reset)
		# On Morse RGB LED devices, this usually produces a yellow
		# (which is the same as the uboot colour).
		led_blink "$failsafe"
		led_blink "$running"
		;;
	ap_change)
		# Changing to AP mode.
		led_blink "$running"
		;;
	sta_change)
		# Changing to STA mode.
		led_blink_fast "$running"
		led_blink_fast "$runningsta"
		;;
	done)
		# Restore the boot LEDs default trigger since we might
		# have finished messing with it.
		status_led_restore_trigger boot

		led_on "$running"
		if [ "$_mm_mode" = sta ]; then
			led_on "$runningsta"
		fi
		;;
	esac
}
