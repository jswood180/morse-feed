#!/bin/sh
# Copyright (C) 2006-2019 OpenWrt.org
# Copyright 2024 Morse Micro

# This is a rewritten version of /etc/diag.sh from base-files which
# adds more possible states. It also simplifies things by disabling
# all LEDs on every call (so we don't have to test what to disable)
# and passing by argument rather than via setting status_led.

. /lib/functions.sh
. /lib/functions/leds.sh

red=$(get_dt_led status-red)
green=$(get_dt_led status-green)
blue=$(get_dt_led status-blue)

disable_all_leds() {
	led_off "$red"
	led_off "$green"
	led_off "$blue"
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
		led_blink_fast "$green"
		;;
	failsafe)
		led_blink_veryfast "$red"
		;;
	preinit_regular)
		led_blink "$green"
		;;
	upgrade)
		led_blink "$blue"
		;;
	dpp_started)
		# purple
		led_blink_slow "$red"
		led_blink_slow "$blue"
		;;
	dpp_failed)
		# purple
		led_blink_fast "$red"
		led_blink_fast "$blue"
		;;
	rebooting)
		# Because rebooting and factory_reset are triggered
		# by the same button on the EKH03/4, and we start flashing
		# as soon as the function has changed, it's useful to
		# have both a colour difference and a timing difference
		# (for colour blindness, and to make it clear that
		# a different state has been reached).
		led_blink "$green"
		;;
	factory_reset)
		# This is intentionally the same colour as the uboot: the
		# idea is that the flashing yellow transition to solid yellow
		# which shows you that the reset has completed, just as the
		# flashing green transitions to solid green on boot.
		# yellow
		led_blink_fast "$green"
		led_blink_fast "$red"
		;;
	done)
		# Restore the LEDs default triggers since we might
		# have finished messing with it.
		status_led_restore_trigger green
		status_led_restore_trigger blue
		status_led_restore_trigger red

		led_on "$green"
		# Now force OpenWrt's normal LED management
		# to re-apply.
		/etc/init.d/led restart
		;;
	esac
}
