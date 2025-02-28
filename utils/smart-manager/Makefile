#
# Copyright (C) 2023 Morse Microi
#
# This is free software, licensed under the Apache License, Version 2.0
#


include $(TOPDIR)/rules.mk

PKG_NAME:=smart_manager
PKG_RELEASE:=1
PKG_VERSION:=rel_1_12_4_2024_Jun_11
PKG_SOURCE:=$(PKG_NAME)_$(PKG_VERSION).tar.xz
PKG_SOURCE_URL:=https://github.com/MorseMicro/smart-manager/releases/download/1.12.4/
PKG_HASH:=a47268778460242cf7d67c9e6959d2945e43f9afac0204a5b870b237958be018
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)_$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/smart_manager
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=WirelessAPD
  TITLE:=Morse Micro HaLow DCS Smart Manager
  DEPENDS:= +kmod-morse +libnl +libpthread +libconfig +hostapd_s1g
  USERID:=network=101:network=101
endef

define Package/smart_manager/description

endef

define Build/Compile
endef

define Package/smart_manager/install
	$(INSTALL_DIR) $(1)/etc
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_DIR) $(1)/sbin
	install -m 755 $(PKG_BUILD_DIR)/$(CONFIG_TARGET_ARCH_PACKAGES)/etc/init.d/smart_manager $(1)/etc/init.d/smart_manager
	install -m 755 $(PKG_BUILD_DIR)/$(CONFIG_TARGET_ARCH_PACKAGES)/sbin/smart_manager $(1)/sbin/smart_manager
endef

$(eval $(call BuildPackage,smart_manager))
