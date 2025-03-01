#!/bin/sh
#
# Copyright (C) 2023 MorseMicro
#


dpp_key_tmp_file=$1

get_key_from_persistent_storage()
{
    local ubenv_key=
    [ -f "/sbin/persistent_vars_storage.sh" ] && ubenv_key=$(/sbin/persistent_vars_storage.sh READ dpp_priv_key)
    echo "$ubenv_key"
}

create_persistent_private_key()
{
    logger "Generating a new private key and saving it to the persistent storage."    
    local priv_key=$(openssl ecparam -genkey -name prime256v1 -noout -outform DER | hexdump -e '16/1 "%02x " "\n"'| xxd -r -p | base64 -w 0)
    
    /sbin/persistent_vars_storage.sh WRITE dpp_priv_key "$priv_key"
    
    echo "$priv_key"
}

save_private_key_file()
{
    echo "-----BEGIN EC PRIVATE KEY-----" > $2
    echo "$1"                            >> $2
    echo "-----END EC PRIVATE KEY-----"  >> $2
}


#1-check if the /sbin/persistent_vars_storage.sh scripts exist.
[ ! -f "/sbin/persistent_vars_storage.sh" ] && exit 0


#2-get the private key from uboot_env
ubenv_key=$(get_key_from_persistent_storage)

#3-is private key empty?
if [ -z "$ubenv_key" ]; then
    #23-yes: we don't have dpp private key.
    logger "DPP private key isn't found in u-boot-env."    
    ubenv_key=$(create_persistent_private_key)
fi

#create /tmp/dpp_key.pem with the result.
save_private_key_file $ubenv_key $dpp_key_tmp_file

#is the private key valid?
if openssl ec -in $dpp_key_tmp_file -check 1>/dev/null 2>/dev/null ; then 
    #yes: done.
    exit 0
else 
    #no
    logger "persistent storage contains an incorrect DPP private key." 
    ubenv_key=$(create_persistent_private_key) 
    save_private_key_file $ubenv_key $dpp_key_tmp_file
    exit 0
fi






