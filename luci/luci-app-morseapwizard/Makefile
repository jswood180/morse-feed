include $(TOPDIR)/rules.mk

# Wizard designed for simple configuration of an end-user product focusing
# on AP side (i.e. router/AP) behaviour.
LUCI_TITLE:=LuCI Morse AP Wizard
LUCI_DEPENDS:=+luci-base +luci-app-morseconfig +netifd-morse +prplmesh +morse_mesh11sd

PKG_LICENSE:=Apache-2.0

# Because we're using newer CSS, csstidy makes a mess.
CONFIG_LUCI_CSSTIDY:=

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature