#
# Copyright 2024 Morse Micro
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=morse-led-rgb
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/morse-led-rgb
  SECTION:=utils
  CATEGORY:=Base system
  TITLE:=Morse Micro RGB LED Functionality
  MAINTAINER:=Morse Micro
endef

define Package/morse-led-rgb/description
  Override default LED state handler if you have a single
  RGB LED (with separate R/G/B in device tree).
endef

define Build/Compile

endef

define Package/morse-led-rgb/install
	$(INSTALL_DIR) $(1)/etc
	$(INSTALL_BIN) ./files/etc/diag_override.sh $(1)/etc/
endef

$(eval $(call BuildPackage,morse-led-rgb))
