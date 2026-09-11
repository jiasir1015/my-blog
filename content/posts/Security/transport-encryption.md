+++
title = '数据库安全 传输加密'
date = '2025-05-21T09:37:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['安全']
tags = ['加密', 'SSL']
weight = 900
ShowToc = true
TocOpen = true
+++
# 非国密

1.  生成证书
2.  数据库服务端：配置证书、配置传输加密算法
3.  数据库客户端：配置证书

```bash
# 检查openssl版本
which openssl
    # 确保使用的是vastbase发布包中的openssl，而非操作系统中的openssl

cp $GAUSSHOME/share/sslcert/gsql/openssl.cnf ./
export OPENSSL_CONF=`pwd`/openssl.cnf

# 创建文件
mkdir cert
cd cert
mkdir ./demoCA ./demoCA/newcerts ./demoCA/private
chmod 700 ./demoCA/private
echo '01'>./demoCA/serial
touch ./demoCA/index.txt

# ca
openssl genrsa -out ./demoCA/private/cakey.pem 2048
openssl req -new -key ./demoCA/private/cakey.pem -out ./demoCA/private/ca_cert_req.pem -subj "/C=CN/ST=Beijing/O=huawei/OU=gauss/CN=root"
openssl x509 -req -in ./demoCA/private/ca_cert_req.pem -days 7300 -signkey ./demoCA/private/cakey.pem -out ./demoCA/cacert.pem

# server
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/C=CN/ST=Beijing/O=huawei/OU=gauss/CN=server"
openssl x509 -req -in server.csr -days 3650 -CA ./demoCA/cacert.pem -CAkey ./demoCA/private/cakey.pem -CAcreateserial -out server.crt

# client
openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr -subj "/C=CN/ST=Beijing/O=huawei/OU=gauss/CN=client"
openssl x509 -req -in client.csr -days 3650 -CA ./demoCA/cacert.pem -CAkey ./demoCA/private/cakey.pem -CAcreateserial -out client.crt

# 查看内容
openssl x509 -in client.crt -text

# 设置权限
chmod 600 client.key
chmod 600 client.crt
chmod 600 server.key
chmod 600 server.crt
chmod 600 ./demoCA/cacert.pem

export CERT=`pwd`
echo '
export CERT=`pwd`
export PGSSLMODE=verify-ca

export PGSSLROOTCERT=$CERT/demoCA/cacert.pem

export PGSSLKEY=$CERT/client.key
export PGSSLCERT=$CERT/client.crt
' > client_env

source client_env

# 设置服务端参数
gs_guc set -D $GAUSSHOME/data -c "ssl=on"
gs_guc set -D $GAUSSHOME/data -c "ssl_ciphers = 'ALL'"
gs_guc set -D $GAUSSHOME/data -c "ssl_ca_file = '$CERT/demoCA/cacert.pem'"
gs_guc set -D $GAUSSHOME/data -c "ssl_key_file='$CERT/server.key'"
gs_guc set -D $GAUSSHOME/data -c "ssl_cert_file='$CERT/server.crt'"

# 重启数据库

vsql -d postgres -c " CREATE USER u1 PASSWORD 'u1.password' "

# 连接数据库：需加-h参数
vsql -h localhost -d postgres -U u1 -W 'u1.password' -r
```

```bash
rm -f client.* server.*
gs_guc set -D $GAUSSHOME/data -c "ssl_ciphers = 'ECDHE-ECDSA-SM4-CBC-SM3'"

openssl ecparam -name SM2 -genkey -out ./demoCA/private/cakey.pem
openssl req -new -key ./demoCA/private/cakey.pem -out ./demoCA/private/ca_cert_req.pem -subj "/C=CN/ST=Beijing/O=huawei/OU=gauss/CN=root"
openssl x509 -req -in ./demoCA/private/ca_cert_req.pem -days 7300 -signkey ./demoCA/private/cakey.pem -out ./demoCA/cacert.pem

# server
openssl ecparam -name SM2 -genkey -out server.key
openssl req -new -key server.key -out server.csr -subj "/C=CN/ST=Beijing/O=huawei/OU=gauss/CN=server"
openssl x509 -req -in server.csr -days 3650 -CA ./demoCA/cacert.pem -CAkey ./demoCA/private/cakey.pem -CAcreateserial -out server.crt

# client
openssl ecparam -name SM2 -genkey -out client.key
openssl req -new -key client.key -out client.csr -subj "/C=CN/ST=Beijing/O=huawei/OU=gauss/CN=client"
openssl x509 -req -in client.csr -days 3650 -CA ./demoCA/cacert.pem -CAkey ./demoCA/private/cakey.pem -CAcreateserial -out client.crt

chmod 600 client.key client.crt server.key server.crt ./demoCA/cacert.pem

openssl x509 -in client.crt -text
```

# 国密

```bash
mkdir cert
cd cert

openssl version
# OpenSSL 1.1.1s  Tassl 2.1.2 1 Nov 2022

cp ../tassl/install/openssl.cnf ./
chmod +w ./openssl.cnf

echo '
[ gm_ca_cert ]
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid:always,issuer
basicConstraints = critical,CA:true
keyUsage = critical, cRLSign, keyCertSign

[ gm_sign_cert ]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, nonRepudiation

[ gm_enc_cert ]
basicConstraints = CA:FALSE
keyUsage = critical, keyEncipherment, dataEncipherment, keyAgreement' >> ./openssl.cnf

mkdir ./demoCA ./demoCA/newcerts ./demoCA/private
chmod 700 ./demoCA/private
echo '01'>./demoCA/serial
touch ./demoCA/index.txt

# ca
openssl ecparam -name SM2 -genkey -out ./demoCA/private/cakey.pem
openssl req -config openssl.cnf -new -key ./demoCA/private/cakey.pem -sm3 -out ./demoCA/private/ca_cert_req.pem -subj "/C=CN/ST=Beijing/O=huawei/OU=gauss/CN=root"
openssl x509 -req -extfile openssl.cnf -extensions gm_ca_cert -in ./demoCA/private/ca_cert_req.pem -sm3 -days 7300 -signkey ./demoCA/private/cakey.pem -out ./demoCA/cacert.pem

# server
openssl ecparam -name SM2 -genkey -out server.key
openssl ec -in server.key -passout pass:gauss@123 -sm4 -out server.key
openssl req -config openssl.cnf -new -key server.key -passin pass:gauss@123 -sm3 -out server.csr -subj "/C=CN/ST=Beijing/O=huawei/OU=gauss/CN=server"
openssl x509 -req -extfile openssl.cnf -extensions gm_sign_cert -in server.csr -sm3 -days 3650 -CA ./demoCA/cacert.pem -CAkey ./demoCA/private/cakey.pem -passin pass:gauss@123 -CAcreateserial -out server.crt

# server.enc
openssl ecparam -name SM2 -genkey -out server_enc.key
openssl ec -in server_enc.key -passout pass:gauss@123 -sm4 -out server_enc.key
openssl req -config openssl.cnf -new -key server_enc.key -passin pass:gauss@123 -sm3 -out server_enc.csr -subj "/C=CN/ST=Beijing/O=huawei/OU=gauss/CN=server"
openssl x509 -req -extfile openssl.cnf -extensions gm_enc_cert -in server_enc.csr -sm3 -days 3650 -CA ./demoCA/cacert.pem -CAkey ./demoCA/private/cakey.pem -passin pass:gauss@123 -CAcreateserial -out server_enc.crt

gs_guc encrypt -M server -D ./ -K gauss@123

# client
openssl ecparam -name SM2 -genkey -out client.key
openssl ec -in client.key -passout pass:gauss@123 -sm4 -out client.key
openssl req -config openssl.cnf -new -key client.key -passin pass:gauss@123 -sm3 -out client.csr -subj "/C=CN/ST=Beijing/O=huawei/OU=gauss/CN=client"
openssl x509 -req -extfile openssl.cnf -extensions gm_sign_cert -in client.csr -sm3 -days 3650 -CA ./demoCA/cacert.pem -CAkey ./demoCA/private/cakey.pem -passin pass:gauss@123 -CAcreateserial -out client.crt

# client.enc
openssl ecparam -name SM2 -genkey -out client_enc.key
openssl ec -in client_enc.key -passout pass:gauss@123 -sm4 -out client_enc.key
openssl req -config openssl.cnf -new -key client_enc.key -passin pass:gauss@123 -sm3 -out client_enc.csr -subj "/C=CN/ST=Beijing/O=huawei/OU=gauss/CN=client"
openssl x509 -req -extfile openssl.cnf -extensions gm_enc_cert -in client_enc.csr -sm3 -days 3650 -CA ./demoCA/cacert.pem -CAkey ./demoCA/private/cakey.pem -passin pass:gauss@123 -CAcreateserial -out client_enc.crt

gs_guc encrypt -M client -D ./ -K gauss@123

# openssl x509 -in client.crt -text

export CERT=`pwd`
echo '
export CERT=`pwd`
export PGSSLMODE=verify-ca
export PGSSLTLCP=1

export PGSSLROOTCERT=$CERT/demoCA/cacert.pem

export PGSSLKEY=$CERT/client.key
export PGSSLCERT=$CERT/client.crt
export PGSSLENCKEY=$CERT/client_enc.key
export PGSSLENCCERT=$CERT/client_enc.crt
' > client_env

source client_env

# 设置服务端参数
gs_guc set -D $GAUSSHOME/data/single_node -c "ssl=on"
gs_guc set -D $GAUSSHOME/data/single_node -c "ssl_ciphers = 'ALL'"
gs_guc set -D $GAUSSHOME/data/single_node -c "ssl_use_tlcp=on"
gs_guc set -D $GAUSSHOME/data/single_node -c "ssl_ca_file = '$CERT/demoCA/cacert.pem'"
gs_guc set -D $GAUSSHOME/data/single_node -c "ssl_key_file='$CERT/server.key'"
gs_guc set -D $GAUSSHOME/data/single_node -c "ssl_cert_file='$CERT/server.crt'"
gs_guc set -D $GAUSSHOME/data/single_node -c "ssl_enc_key_file='$CERT/server_enc.key'"
gs_guc set -D $GAUSSHOME/data/single_node -c "ssl_enc_cert_file='$CERT/server_enc.crt'"

# 重启数据库
```
