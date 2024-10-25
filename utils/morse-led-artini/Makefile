#
# Copyright 2024 Morse Micro
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=morse-led-artini
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/morse-led-artini
  SECTION:=utils
  CATEGORY:=Base system
  TITLE:=Morse Micro HaLowLink1 LED Functionality
  MAINTAINER:=Morse Micro
endef

define Package/morse-led-artini/description
  Override default LED status handler for Artini (HaLowLink1)
  to handle the PWM LEDs (both for the status, and to set
  the colour of the other LEDs since the OpenWrt LED
  configurator doesn't know how to set the colour).
endef

define Build/Compile

endef

define Package/morse-led-artini/install
	$(INSTALL_DIR) $(1)/etc
	$(INSTALL_BIN) ./files/etc/diag_override.sh $(1)/etc/
endef

$(eval $(call BuildPackage,morse-led-artini))
