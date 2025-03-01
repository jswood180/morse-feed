include $(TOPDIR)/rules.mk


PKG_NAME:=dpp-key-recovery
PKG_RELEASE=1

PKG_MAINTAINER:=Morse Micro

include $(INCLUDE_DIR)/package.mk

define Package/dpp-key-recovery
  SECTION:=Utilities
  CATEGORY:=Utilities
  TITLE:=Recovers the DPP private key (or creates one if doesn't exist)
  DEPENDS:= persistent-vars-storage +openssl-util +@BUSYBOX_CONFIG_XXD +@BUSYBOX_CONFIG_BASE64
endef

define Build/Compile

endef

define Package/dpp-key-recovery/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/dpp-key-recovery $(1)/etc/init.d/dpp-key-recovery
	$(INSTALL_DIR) $(1)/morse/scripts/
	$(INSTALL_BIN) ./files/morse/scripts/recover_dpp_key.sh $(1)/morse/scripts/recover_dpp_key.sh
endef

$(eval $(call BuildPackage,dpp-key-recovery))
