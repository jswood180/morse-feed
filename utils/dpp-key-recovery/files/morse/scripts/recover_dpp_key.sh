#!/bin/sh
#
# Copyright (C) 2023 MorseMicro
#

dpp_key_tmp_file=$1

ubenv_key=$(persistent_vars_storage.sh READ dpp_priv_key)

# logger is not available at START=11, which is when this is
# used by /etc/init.d/dpp-key-recovery

if [ -z "$ubenv_key" ]; then
    echo "dpp-key-recovery: DPP private key isn't found in persistent storage. Generating new key." > /dev/kmsg
    ubenv_key=$(openssl ecparam -genkey -name prime256v1 -noout -outform DER | base64 -w0)
    /sbin/persistent_vars_storage.sh WRITE dpp_priv_key "$ubenv_key"
fi

echo "-----BEGIN EC PRIVATE KEY-----" > "$dpp_key_tmp_file"
echo "$ubenv_key"                     >> "$dpp_key_tmp_file"
echo "-----END EC PRIVATE KEY-----"  >> "$dpp_key_tmp_file"
