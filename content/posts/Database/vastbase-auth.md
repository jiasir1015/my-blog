+++
title = 'vastbase 身份认证'
date = '2025-02-17T14:43:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['Vastbase', '身份认证']
weight = 900
ShowToc = true
TocOpen = true
+++
# 国策用例

```bash

4、配置客户端认证方式
hostssl all all 0.0.0.0/0 cert

1、生成国密证书
创建 CA 目录 cadir 并进入
mkdir cadir
cd cadir
copy 配置文件 openssl.cnf 到当前目录（不同环境，配置文件路径可能不一样）
cp /etc/pki/tls/openssl.cnf .
开始搭建CA环境
mkdir ./demoCA ./demoCA/newcerts ./demoCA/private
chmod 777 ./demoCA/private
创建serial文件,写入01
echo '01'>./demoCA/serial
创建文件index.txt
touch ./demoCA/index.txt
修改openssl.cnf配置文件中CA_default的参数
dir = ./demoCA
default_md = sha256
至此CA环境搭建完成
生成CA私钥
openssl ecparam -out demoCA/private/cakey.pem -name SM2 -genkey
生成根证书请求文件
openssl req -config openssl.cnf -key demoCA/private/cakey.pem -new -out cacert.req -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=CLIENT
生成自签发根证书
生成根证书时，需要修改openssl.cnf文件，设置basicConstraints=CA:TRUE
vi openssl.cnf
生成CA自签发根证书
openssl ca -config openssl.cnf -in cacert.req -keyfile demoCA/private/cakey.pem -selfsign -out demoCA/cacert.pem
生成服务器私钥文件server.key
openssl ecparam -out server.key -name SM2 -genkey
生成服务器证书请求文件server.req
openssl req -config openssl.cnf -key server.key -new -out server.req -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=server
生成服务端/客户端证书时，修改openssl.cnf文件，设置basicConstraints=CA:FALSE
vi openssl.cnf
对生成的服务器证书请求文件进行签发，签发后将生成正式的服务器证书server.crt
openssl ca -config openssl.cnf -in server.req -out server.crt -days 3650
生成客户端私钥
openssl ecparam -out client.key -name SM2 -genkey
生成客户端证书请求文件
openssl req -config openssl.cnf -new -key client.key -out client.req -subj /C=CN/ST=BJ/L=HaiDian/O=VAST/OU=SEC/CN=client
对生成的客户端证书请求文件进行签发，签发后将生成正式的客户端证书client.crt
openssl ca -config openssl.cnf -in client.req -out client.crt -days 3650

注：中间会产生交互，按照以下内容进行填写（需注意每个交互的common name填不一样的内容，如分别写：test1,test2,test3）：
Country Name (2 letter code) [AU]:CN
State or Province Name (full name) [Some-State]:shanxi
Locality Name (eg, city) []:xian
Organization Name (eg, company) [Internet Widgits Pty Ltd]:Abc
Organizational Unit Name (eg, section) []:hello
--Common Name可以随意命名
Common Name (eg, YOUR name) []:world
--Email可以选择性填写
Email Address []:

Please enter the following 'extra' attributes
to be sent with your certificate request
A challenge password []: 1qaz!QAZ
An optional company name []:world

# ---------------------------------------
https://gitee.com/opengauss/openGauss-server/pulls/3254

mkdir certs
cp ../../tassl/tassl_demo/cert/openssl.cnf  certs/
cd certs
#CA
openssl ecparam -genkey -name SM2 -out CA.key
openssl req -config openssl.cnf -new -subj /C=CN/ST=BJ/L=HaiDian/O=YUNHEENMO/OU=MogDB/CN=FooCA -key CA.key -out CA.csr
openssl x509 -sm3 -req -days 1500 -in CA.csr -extfile openssl.cnf -extensions v3_ca -signkey CA.key -out CA.crt

#server
openssl ecparam -genkey -name SM2 -out server.key
openssl req -config openssl.cnf -new -subj /C=CN/ST=BJ/L=HaiDian/O=YUNHEENMO/OU=MogDB/CN=server -key server.key -out server.csr
openssl x509 -sm3 -req -days 1500 -in server.csr -CA CA.crt -CAkey CA.key -extfile openssl.cnf -out server.crt -CAcreateserial

#server_enc
openssl ecparam -genkey -name SM2 -out server_enc.key
openssl req -config openssl.cnf -new -subj /C=CN/ST=BJ/L=HaiDian/O=YUNHEENMO/OU=MogDB/CN=server -key server_enc.key -out server_enc.csr
openssl x509 -sm3 -req -days 1500 -in server_enc.csr -CA CA.crt -CAkey CA.key -extfile openssl.cnf -out server_enc.crt -CAcreateserial

#client
openssl ecparam -genkey -name SM2 -out client.key
openssl req -config openssl.cnf -new -subj /C=CN/ST=BJ/L=HaiDian/O=YUNHEENMO/OU=MogDB/CN=client -key client.key -out client.csr
openssl x509 -sm3 -req -days 1500 -in client.csr -CA CA.crt -CAkey CA.key -extfile openssl.cnf -out client.crt -CAcreateserial

#client_enc
openssl ecparam -genkey -name SM2 -out client_enc.key
openssl req -config openssl.cnf -new -subj /C=CN/ST=BJ/L=HaiDian/O=YUNHEENMO/OU=MogDB/CN=client -key client_enc.key -out client_enc.csr
openssl x509 -sm3 -req -days 1500 -in client_enc.csr -CA CA.crt -CAkey CA.key -extfile openssl.cnf -out client_enc.crt -CAcreateserial

#修改权限
chmod 0600 *

#增加密码保护

openssl ec -sm4 -in server.key  -out server.key  -passout pass:123qweQWE
gs_guc generate -S 123qweQWE -D ./  -o  server
openssl ec -sm4 -in server_enc.key  -out server_enc.key  -passout pass:234werWER
gs_guc generate -S 234werWER -D ./  -o server_enc
openssl ec -sm4 -in client.key  -out client.key  -passout pass:345ertERT
gs_guc generate -S 345ertERT -D ./  -o client
openssl ec -sm4 -in client_enc.key  -out client_enc.key  -passout pass:456rtyRTY
gs_guc generate -S 456rtyRTY -D ./  -o client_enc
chmod 0600 *

#客户端：
export CERT=`pwd`
echo '
export CERT=`pwd`
export PGSSLMODE=verify-ca
export PGSSLTLCP=1

export PGSSLROOTCERT=$CERT/CA.crt

export PGSSLKEY=$CERT/client.key
export PGSSLCERT=$CERT/client.crt
export PGSSLENCKEY=$CERT/client_enc.key
export PGSSLENCCERT=$CERT/client_enc.crt
' > client_env

source client_env

#服务器：

gs_guc set -D $GAUSSHOME/data -c "ssl=on"
gs_guc set -D $GAUSSHOME/data -c "ssl_ciphers = 'ALL'"
gs_guc set -D $GAUSSHOME/data -c "ssl_use_tlcp=on"
gs_guc set -D $GAUSSHOME/data -c "ssl_ca_file = '$CERT/CA.crt'"
gs_guc set -D $GAUSSHOME/data -c "ssl_key_file='$CERT/server.key'"
gs_guc set -D $GAUSSHOME/data -c "ssl_cert_file='$CERT/server.crt'"
gs_guc set -D $GAUSSHOME/data -c "ssl_enc_key_file='$CERT/server_enc.key'"
gs_guc set -D $GAUSSHOME/data -c "ssl_enc_cert_file='$CERT/server_enc.crt'"

1、生成国密证书
# 创建 CA 目录 cadir 并进入

# copy 配置文件 openssl.cnf 到当前目录（不同环境，配置文件路径可能不一样）
cp /etc/pki/tls/openssl.cnf .
# 开始搭建CA环境
mkdir ./demoCA ./demoCA/newcerts ./demoCA/private
chmod 777 ./demoCA/private
# 创建serial文件,写入01
echo '01'>./demoCA/serial
# 创建文件index.txt
touch ./demoCA/index.txt

# 至此CA环境搭建完成
# 生成CA私钥
openssl ecparam -out demoCA/private/cakey.pem -name SM2 -genkey
# 生成根证书请求文件
openssl req -config openssl.cnf -key demoCA/private/cakey.pem -new -out cacert.req
# 生成自签发根证书
# 生成根证书时，需要修改openssl.cnf文件，设置basicConstraints=CA:TRUE
vi openssl.cnf
# 生成CA自签发根证书
openssl ca -config openssl.cnf -in cacert.req -keyfile demoCA/private/cakey.pem -selfsign -out demoCA/cacert.pem

# 生成服务器私钥文件server.key
openssl ecparam -out server.key -name SM2 -genkey
# 生成服务器证书请求文件server.req
openssl req -config openssl.cnf -key server.key -new -out server.req
# 生成服务端/客户端证书时，修改openssl.cnf文件，设置basicConstraints=CA:FALSE
vi openssl.cnf
# 对生成的服务器证书请求文件进行签发，签发后将生成正式的服务器证书server.crt
openssl ca -config openssl.cnf -in server.req -out server.crt -days 3650

# 生成客户端私钥
openssl ecparam -out client.key -name SM2 -genkey
# 生成客户端证书请求文件
openssl req -config openssl.cnf -new -key client.key -out client.req
# 对生成的客户端证书请求文件进行签发，签发后将生成正式的客户端证书client.crt
openssl ca -config openssl.cnf -in client.req -out client.crt -days 3650

# 注：中间会产生交互，按照以下内容进行填写（需注意每个交互的common name填不一样的内容，如分别写：test1,test2,test3）：
Country Name (2 letter code) [AU]:CN
State or Province Name (full name) [Some-State]:shanxi
Locality Name (eg, city) []:xian
Organization Name (eg, company) [Internet Widgits Pty Ltd]:Abc
Organizational Unit Name (eg, section) []:hello
--Common Name可以随意命名
Common Name (eg, YOUR name) []:world
--Email可以选择性填写
Email Address []:

Please enter the following 'extra' attributes
to be sent with your certificate request
A challenge password []: 1qaz!QAZ
An optional company name []:world

2、配置客户端文件
chmod 600 client.key
chmod 600 client.crt
chmod 600 ./demoCA/cacert.pem
chmod 600 server.key
chmod 600 server.crt

3、配置服务器端参数
cp server.crt server.key ./demoCA/cacert.pem $PGDATA
cp client.crt client.key /home/vastbase/data/vastbase/

export PGSSLCERT="/home/vastbase/cadir/client.crt"
export PGSSLKEY="/home/vastbase/cadir/client.key"
export PGSSLMODE="verify-ca"
export PGSSLROOTCERT="/home/vastbase/data/vastbase/cacert.pem"

vi postgresql.conf
ssl = on
require_ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
ssl_ca_file = 'cacert.pem'
ssl_crl_file = ''

4、配置客户端认证方式
vi pg_hba.conf
hostssl all all 0.0.0.0/0 cert

5、重启数据库服务
vb_ctl restart
vsql - vastbase -r
--创建生成客户端证书时Common Name同名用户
create user test3 password'Test@123';

1、客户端vsql连接到服务端
vsql -dvastbase -r -h IP -U test3

--预期
连接成功，提示SSL connection
```

# 1 需求背景

## 1.2 Oracle Profile功能

### 一、查看profile信息

1.  设置sqlplus输出格式

    ```sql
    SET LINESIZE 200
    SET PAGESIZE 100
    SET COLSEP ' | '
    SET NUMWIDTH 15
    SET HEADING ON
    SET FEEDBACK OFF
    ```

2.  查看用户的profile

    ```sql
    SELECT username, profile FROM dba_users;

        USERNAME | PROFILE
        ---------+----------
        SYS      | DEFAULT
        SYSTEM   | DEFAULT
        ..       | ..
    ```

3.  查看所有profile配置项

    ```sql
    SELECT * FROM dba_profiles ORDER BY profile;

              PROFILE       |       RESOURCE_NAME       | RESOURCE |   LIMIT
      ----------------------+---------------------------+----------+-----------
        DEFAULT             | CONPOSITE_LIMIT           | KERNEL   | UNLIMITED
        DEFAULT             | PASSWORD_LOCK_TIME        | PASSWORD | 1
        DEFAULT             | PASSWORD_VERIFY_FUNCTION  | PASSWORD | NULL
        DEFAULT             | PASSWORD_REUSE_MAX        | PASSWORD | UNLIMITED
        DEFAULT             | PASSWORD_REUSE_TIME       | PASSWORD | UNLIMITED
        DEFAULT             | PASSWORD_LIFE_TIME        | PASSWORD | 180
        DEFAULT             | FAILED_LOGIN_ATTEMPTS     | PASSWORD | 10
        DEFAULT             | PRIVATE_SGA               | KERNEL   | UNLIMITED
        DEFAULT             | CONNECT_TIME              | KERNEL   | UNLIMITED
        DEFAULT             | IDLE_TIME                 | KERNEL   | UNLIMITED
        DEFAULT             | LOGICAL_READS_PER_CALL    | KERNEL   | UNLIMITED
        DEFAULT             | LOGICAL_READS_PER_SESSION | KERNEL   | UNLIMITED
        DEFAULT             | CPU_PER_CALL              | KERNEL   | UNLIMITED
        DEFAULT             | CPU_PER_SESSION           | KERNEL   | UNLIMITED
        DEFAULT             | SESSIONS_PER_USER         | KERNEL   | UNLIMITED
        DEFAULT             | PASSWORD_GRACE_TIME       | PASSWORD | 7
        MONITORING_PROFILE  | ..
        ...                 | ...
    ```

### 二、管理profile

1.  创建profile

    ```sql
    CREATE PROFILE pro1 LIMIT
        CPU_PER_SESSION 60000
        PASSWORD_LIFE_TIME 90
        FAILED_LOGIN_ATTEMPTS 3;

    SELECT * FROM dba_profiles WHERE profile = 'PRO1';

              PROFILE    |       RESOURCE_NAME       | RESOURCE |   LIMIT
      -------------------+---------------------------+----------+-----------
        PRO1             | CONPOSITE_LIMIT           | KERNEL   | DEFAULT
        PRO1             | PASSWORD_LOCK_TIME        | PASSWORD | DEFAULT
        PRO1             | PASSWORD_VERIFY_FUNCTION  | PASSWORD | DEFAULT
        PRO1             | PASSWORD_REUSE_MAX        | PASSWORD | DEFAULT
        PRO1             | PASSWORD_REUSE_TIME       | PASSWORD | DEFAULT
        PRO1             | PASSWORD_LIFE_TIME        | PASSWORD | 90
        PRO1             | FAILED_LOGIN_ATTEMPTS     | PASSWORD | 3
        PRO1             | PRIVATE_SGA               | KERNEL   | DEFAULT
        PRO1             | CONNECT_TIME              | KERNEL   | DEFAULT
        PRO1             | IDLE_TIME                 | KERNEL   | DEFAULT
        PRO1             | LOGICAL_READS_PER_CALL    | KERNEL   | DEFAULT
        PRO1             | LOGICAL_READS_PER_SESSION | KERNEL   | DEFAULT
        PRO1             | CPU_PER_CALL              | KERNEL   | DEFAULT
        PRO1             | CPU_PER_SESSION           | KERNEL   | 6000
        PRO1             | SESSIONS_PER_USER         | KERNEL   | DEFAULT
        PRO1             | PASSWORD_GRACE_TIME       | PASSWORD | DEFAULT
    ```

2.  修改profile

    ```sql
    ALTER PROFILE pro1 LIMIT
        CPU_PER_SESSION 10000
        PASSWORD_LIFE_TIME 80;

    SELECT * FROM dba_profiles WHERE profile = 'PRO1';
    ```

3.  删除profile

    ```sql
    DROP PROFILE pro1 CASCADE;
    ```

### 三、管理用户profile

1.  创建用户

    ```sql
    CREATE USER u1 IDENTIFIED BY "u1@1234" PROFILE default;
    ```

2.  为用户分配profile

    ```sql
    ALTER USER u1 PROFILE pro1;

    SELECT username, profile FROM dba_users WHERE username = 'U1';
    ```

# 2 需求设计

## 2.1 需求目标

1.  语法

    ```sql
    CREATE PROFILE pro1 LIMIT CPU_PER_SESSION 60000;
    ALTER USER u1 PROFILE pro1;
    DROP PROFILE pro1 CASCADE;
    ```

2.  系统表名、系统表字段

    ```sql
    SELECT * FROM dba_profiles WHERE profile = 'PRO1';

            PROFILE  |       RESOURCE_NAME       | RESOURCE |   LIMIT
    -----------------+---------------------------+----------+-----------
    PRO1             | CONPOSITE_LIMIT           | KERNEL   | DEFAULT
    ```

3.  参数

# 1 身份认证概述

## 1.1 身份认证基本概念

本文涉及3个基本概念：

-   用户
-   角色
-   配置参数

### 一、用户

存储用户的系统表pg_authid

```sql
\d pg_authid;
        Column   |           Type           | Modifiers
-----------------+--------------------------+-----------
rolname          | name                     | not null
rolsuper         | boolean                  | not null
rolinherit       | boolean                  | not null
rolcreaterole    | boolean                  | not null
rolcreatedb      | boolean                  | not null
rolcatupdate     | boolean                  | not null
rolcanlogin      | boolean                  | not null
rolreplication   | boolean                  | not null
rolauditadmin    | boolean                  | not null
rolsystemadmin   | boolean                  | not null
rolconnlimit     | integer                  | not null
rolpassword      | text                     |
rolvalidbegin    | timestamp with time zone |
rolvaliduntil    | timestamp with time zone |
rolrespool       | name                     |
roluseft         | boolean                  |
rolparentid      | oid                      |
roltabspace      | text                     |
rolkind          | "char"                   |
rolnodegroup     | oid                      |
roltempspace     | text                     |
rolspillspace    | text                     |
rolexcpdata      | text                     |
rolmonitoradmin  | boolean                  |
roloperatoradmin | boolean                  |
rolpolicyadmin   | boolean                  |
rolpasswordext   | text                     |
```

查看全部用户

```sql
SELECT rolname,oid,rolparentid,rolkind,rolvalidbegin FROM pg_authid;
        rolname          |  oid  | rolparentid | rolkind | rolvalidbegin
-------------------------+-------+-------------+---------+---------------
gs_role_copy_files       |  1044 |           0 | n       |
gs_role_signal_backend   |  1045 |           0 | n       |
gs_role_tablespace       |  1046 |           0 | n       |
gs_role_replication      |  1047 |           0 | n       |
gs_role_account_lock     |  1048 |           0 | n       |
gs_role_pldebugger       |  1055 |           0 | n       |
gs_role_directory_create |  1056 |           0 | n       |
gs_role_directory_drop   |  1059 |           0 | n       |
shenkun                  |    10 |           0 | n       |
u1                       | 24576 |           0 | n       |
(10 rows)
```

### 二、角色

### 三、配置参数

存储GUC参数的系统试图pg_settings

```sql
\d pg_settings;
    Column  |  Type   | Modifiers
-----------+---------+-----------
name       | text    |
setting    | text    |
unit       | text    |
category   | text    |
short_desc | text    |
extra_desc | text    |
context    | text    |
vartype    | text    |
source     | text    |
min_val    | text    |
max_val    | text    |
enumvals   | text[]  |
boot_val   | text    |
reset_val  | text    |
sourcefile | text    |
sourceline | integer |

CREATE VIEW pg_settings AS
    SELECT * FROM pg_catalog.pg_show_all_settings() AS A;

-- 调用 show_all_settings()
```

查看有关的参数

```sql
SELECT name,setting,vartype,context  FROM pg_settings WHERE name like '%pass%';
            name           | setting | vartype | context
-------------------------+---------+---------+---------
bypass_dram              | 0.01    | real    | sighup
bypass_nvm               | 0.5     | real    | sighup
modify_initial_password  | off     | bool    | sighup
password_effect_time     | 90      | real    | sighup
password_encryption_type | 2       | integer | sighup
password_lock_time       | 1       | real    | sighup
password_max_length      | 32      | integer | sighup
password_min_digital     | 0       | integer | sighup
password_min_length      | 8       | integer | sighup
password_min_lowercase   | 0       | integer | sighup
password_min_special     | 0       | integer | sighup
password_min_uppercase   | 0       | integer | sighup
password_notify_time     | 7       | integer | sighup
password_policy          | 1       | integer | sighup
password_reuse_max       | 0       | integer | sighup
password_reuse_time      | 60      | real    | sighup
(16 rows)

SELECT name,setting,vartype,context FROM pg_settings WHERE name like '%login%';
        name          | setting | vartype |  context
----------------------+---------+---------+------------
audit_login_logout    | 7       | integer | sighup
failed_login_attempts | 10      | integer | sighup
xloginsert_locks      | 8       | integer | postmaster
(3 rows)

SELECT name,setting,vartype,context FROM pg_settings WHERE name like '%session%';
                name                 |   setting    | vartype |  context
------------------------------------+--------------+---------+-----------
idle_in_transaction_session_timeout | 0            | integer | user
session_history_memory              | 10240        | integer | sighup
session_replication_role            | origin       | enum    | superuser
session_respool                     | invalid_pool | string  | user
session_statistics_memory           | 5120         | integer | sighup
session_timeout                     | 600          | integer | user
track_stmt_session_slot             | 1000         | integer | sighup
(7 rows)

SELECT name,setting,vartype,context FROM pg_settings WHERE name like '%statement%';
        name               | setting | vartype |  context
---------------------------+---------+---------+-----------
log_min_duration_statement | 1800000 | integer | superuser
log_min_error_statement    | error   | enum    | superuser
log_statement              | none    | enum    | superuser
log_statement_stats        | off     | bool    | superuser
statement_timeout          | 0       | integer | user
(5 rows)

SELECT name,setting,vartype,context FROM pg_settings WHERE name like '%connection%';
            name              | setting | vartype |  context
------------------------------+---------+---------+------------
cache_connection              | on      | bool    | sighup
character_set_connection      | UTF8    | string  | user
collation_connection          |         | string  | user
connection_alarm_rate         | 0.9     | real    | sighup
log_connections               | off     | bool    | backend
log_disconnections            | off     | bool    | backend
max_connections               | 200     | integer | postmaster
max_inner_tool_connections    | 50      | integer | postmaster
sysadmin_reserved_connections | 3       | integer | postmaster
connection_info               | {"driver_name":"libpq","driver_version" ....} | string  | user
(10 rows)
```

设置参数的语法

-   opengauss中SET语法链接：[https://docs.opengauss.org/zh/docs/latest/docs/SQLReference/SET.html](https://docs.opengauss.org/zh/docs/latest/docs/SQLReference/SET.html)  
    本文主要关注以下语法：
-   设置自定义变量

    ```sql
    SET @var_name := expr [, @var_name := expr] ...
    SET @var_name = expr [, @var_name = expr] ...
    ```

# 2 特性分析

## 特性设计

1.  语法支持

    ```sql
    SET @var_name := expr [, @var_name := expr] ... [FOR USER username]

    SET @var_name := expr [, @var_name := expr] ... [FOR ROLE username]
    ```

2.  ```sql
    VariableMultiSetStmt:
        SET VariableSetElemsList
    VariableSetElemsList:
        VariableSetElem
        | VariableSetElemsList ',' VariableSetElem
    VariableSetElem
        user_defined_single
    ```

```c
ExecSetVariableStmt
```

## 特性流程

1.  新增系统表vb_role_settings  
    新增系统表vb_role_settings，存储用户级GUC参数。原有的pg_settings存储实例级GUC参数
2.  设置用户级GUC参数  
    使用`SET name=setting FOR USER username`语法设置用户级GUC参数
3.  解析用户级GUC参数  
    检查name是否在白名单内，检查setting的取值是否满足实例级GUC的约束，检查username是否存在
4.  存储用户级GUC参数  
    将name, setting, useroid存入vb_role_settings
5.  使用用户级GUC参数  
    在原使用示例级GUC参数的地方，先检查是否存在用户级GUC参数，如果存在用户级GUC参数，则使用用户级GUC参数，否则，使用实例级GUC参数

# 3 特性设计

## 主成功场景

### （一） 设置、查看、删除用户级GUC参数

1.  配置用户级参数

    ```sql
    SET password_effect_time = 90 FOR USER 'shenkun';
    ```

    由于开发周期短，当前版本中，支持的功能较少，但符合客户需求：
    -   参数列表：暂时支持10多个用户级GUC参数，具体参数列表请参考产品文档。
    -   作用范围：每个用户级参数，可对单个用户生效，也可对一组用户(role)生效
    -   设置方式：只支持通过`SET`和`RESET`设置参数值，暂不支持通过配置文件设置参数值。
2.  查看所有用户级参数  
    新增系统表vb_role_settings，记录所有用户级GUC参数。有实例级GUC参数值不等于用户级GUC参数值时，该系统表中才记录用户级GUC参数的值

    ```sql
    SELECT * FROM vb_role_settings;
        profileoid  |  profilename  |      setting                | rolid | 2025-02-18 11:00:00
        ------------+---------------+-----------------------------
            1               file1        password_effect_time
            1               file1        password_max_length

        SELECT * FROM vb_role_settings WHERE profilename = 'file1';

        rolid | setid |     setname           | setval | setvartype |     change          |
        ------+-------+-----------------------+--------+------------+---------------------+
          10  |   1   | password_effect_time  |   90   |    int     | 2025-02-18 11:00:00 |
          10  |   2   | password_max_length   |   10   |    int     | 2025-02-18 11:11:00 |
    ```

3.  查看当前用户的用户级参数

    ```sql
    SELECT * FROM vb_role_settings WHERE rolid = (SELECT oid FROM pg_roles WHERE rolname = CURRENT_USER);

        rolid | setid |     setname           | setval | setvartype |     change          |
        ------+-------+-----------------------+--------+------------+---------------------+
          10  |   1   | password_effect_time  |   90   |    int     | 2025-02-18 11:00:00 |
          10  |   2   | password_max_length   |   10   |    int     | 2025-02-18 11:11:00 |
    ```

4.  配置用户级参数为默认值

    ```sql
    -- 如果实例级GUC参数的值也是default，则会删除vb_role_settings中相关的记录值，即不重复记录
    SET password_effect_time = default FOR USER 'shenkun';
    ```

5.  删除用户级参数

    ```sql
    -- 系统表中，password_effect_time这条记录将被删除
    RESET password_effect_time FOR USER 'shenkun';
    ```

### （二）验证用户级GUC参数

内核中，在使用GUC参数的地方，先获取当前登录系统的用户，再检查是否存在该用户对应的用户级GUC参数，如果存在，则直接使用用户级GUC参数，如果不存在，则使用实例级GUC参数。

### （三）级联删除用户级GUC参数

1.  级联删除用户级参数

    ```sql
    SELECT oid FROM pg_roles WHERE rolname = 'shenkun'

    DROP USER 'shenkun';

    -- 系统表中所有'shenkun'相关的记录将被删除
    SELECT * FROM vb_role_settings;
    ```

### （四）主备用户级GUC参数同步
