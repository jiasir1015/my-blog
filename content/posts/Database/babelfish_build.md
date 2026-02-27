+++
title = 'Babelfish搭建指南'
date = 2026-02-27T14:30:01+08:00
draft = false

# 核心魔法：自动提取路径中的文件夹名作为分类
# 逻辑：如果路径是 posts/Database/xxx.md，提取 "Database"# 如果提取到了子目录，就作为分类；否则默认归为 "Tech"
categories = ["Database"]

tags = []

[cover]
    image = ""
    alt = ""
    caption = ""

ShowToc = true
TocOpen = true
+++

# Babelfish 编译环境搭建指南

> 适用环境：CentOS 7，离线环境，vastbase-server + sqlserver-extensions

---

## 一、创建用户

```bash
# 创建用户并设置密码
useradd vast
echo "vast:gauss@123" | chpasswd

# 授予 sudo 权限（加入 wheel 组）
usermod -aG wheel vast

# 验证
id vast
```

---

## 二、配置环境变量

将以下内容写入 `~/.bash_profile`，**每次登录自动生效**：

```bash
cat >> ~/.bash_profile << 'EOF'
# Babelfish 基础路径
export BABELFISH_HOME=~/vastbase-server/install
export BINARYLIBS=~/vastbase-server/binarylibs
export GCC_PATH=$BINARYLIBS/buildtools/gcc7.3

# 编译器
export CC=$GCC_PATH/gcc/bin/gcc
export CXX=$GCC_PATH/gcc/bin/g++

# cmake（优先使用项目自带版本，放在 PATH 最前面）
export PATH=$BINARYLIBS/buildtools/cmake/bin:$GCC_PATH/gcc/bin:$BABELFISH_HOME/bin:$PATH

# 动态库路径
export LD_LIBRARY_PATH=$GCC_PATH/gcc/lib64:$BABELFISH_HOME/lib:$BINARYLIBS/kernel/dependency/openssl/comm/lib:$LD_LIBRARY_PATH

# cmake 变量（防止 Makefile 调用系统旧版本）
export cmake=$(which cmake)

# PG 相关
export PG_CONFIG=$BABELFISH_HOME/bin/pg_config
export PG_SRC=`pwd`
EOF

source ~/.bash_profile
```

验证工具版本：
```bash
cmake --version   # 应为 3.21.x
gcc --version     # 应为 7.3.x
```

---

## 三、配置系统动态库（需 root）

### 3.1 添加 OpenSSL 库路径

```bash
sudo bash -c 'echo "/home/binarylibs/kernel/dependency/openssl/comm/lib" > /etc/ld.so.conf.d/vastbase-openssl.conf'
sudo bash -c 'echo "/home/vast/vastbase-server/binarylibs/buildtools/gcc7.3/gcc/lib64" >> /etc/ld.so.conf.d/vastbase-openssl.conf'
sudo ldconfig
```

验证：
```bash
ldconfig -p | grep libcrypto
ldconfig -p | grep libstdc++
```

### 3.2 创建 antlr4 软链接

```bash
ln -s $BABELFISH_HOME/lib/libantlr4-runtime.so.4.13.2 $BABELFISH_HOME/lib/libantlr4-runtime.so
```

### 3.3 将 antlr4 头文件拷贝到系统目录（需 root）

```bash
# 找到头文件位置
find ~/vastbase-server -path "*/antlr4*/*.h" 2>/dev/null | head -5

# 拷贝到系统 include
sudo mkdir -p /usr/local/include/antlr4-runtime
sudo cp -r /path/to/antlr4-runtime/include/* /usr/local/include/antlr4-runtime/

# 验证
ls /usr/local/include/antlr4-runtime/
```

---

## 四、编译 vastbase-server（内核）

```bash
cd ~/vastbase-server

./configure \
  CFLAGS="-ggdb" \
  --prefix=$BABELFISH_HOME \
  --enable-debug \
  --with-ldap \
  --with-libxml \
  --with-pam \
  --with-uuid=ossp \
  --enable-nls \
  --with-libxslt \
  --with-icu \
  CC=$CC \
  CXX=$CXX

make -j$(nproc)
make install
```

---

## 五、编译 sqlserver-extensions（Babelfish 扩展）

### 5.1 编译顺序

必须按以下顺序编译安装：

```
1. babelfishpg_money
2. babelfishpg_common
3. babelfishpg_tsql
4. babelfishpg_tds
```

### 5.2 通用编译命令

```bash
cd ~/sqlserver-extensions/contrib/<插件名>

make \
  CFLAGS="-I$BINARYLIBS/kernel/dependency/openssl/comm/include" \
  PG_CFLAGS="-I$BINARYLIBS/kernel/dependency/openssl/comm/include" \
  PG_CXXFLAGS="-I$BINARYLIBS/kernel/dependency/openssl/comm/include" \
  LDFLAGS="-L$BINARYLIBS/kernel/dependency/openssl/comm/lib" \
  CC=$CC

make install
```

### 5.3 babelfishpg_tsql 特殊处理

编译前需确保 antlr4 库和头文件就位：

```bash
cd ~/sqlserver-extensions/contrib/babelfishpg_tsql

# antlr4 runtime 软链接（如未创建）
ls $BABELFISH_HOME/lib/libantlr4-runtime.so || \
  ln -s $BABELFISH_HOME/lib/libantlr4-runtime.so.4.13.2 $BABELFISH_HOME/lib/libantlr4-runtime.so

make \
  CFLAGS="-I$BINARYLIBS/kernel/dependency/openssl/comm/include" \
  PG_CXXFLAGS="-I$BINARYLIBS/kernel/dependency/openssl/comm/include" \
  LDFLAGS="-L$BINARYLIBS/kernel/dependency/openssl/comm/lib -L$BABELFISH_HOME/lib" \
  CC=$CC

make install
```

---

## 六、初始化 Babelfish 数据库

### 6.1 初始化数据目录

```bash
initdb -D $PGDATA
```

### 6.2 启动数据库

```bash
pg_ctl start -D $PGDATA
```

### 6.3 执行初始化脚本

```bash
./psql postgres << 'EOF'
CREATE USER babelfish_user WITH SUPERUSER CREATEDB CREATEROLE PASSWORD '12345678' INHERIT;
DROP DATABASE IF EXISTS babelfish_db;
CREATE DATABASE babelfish_db OWNER babelfish_user;
\c babelfish_db;
CREATE EXTENSION IF NOT EXISTS "babelfishpg_tds" CASCADE;
GRANT ALL ON SCHEMA sys TO babelfish_user;
ALTER USER babelfish_user CREATEDB;
ALTER SYSTEM SET babelfishpg_tsql.database_name = 'babelfish_db';
ALTER SYSTEM SET babelfishpg_tsql.migration_mode = 'multi-db';
SELECT pg_reload_conf();
CALL sys.initialize_babelfish('babelfish_user');
EOF
```

提示符变为 `babelfish_db=>` 表示初始化成功。

---

## 七、安装 mssql-tools（用于 1433 端口测试）

离线环境需提前准备以下 rpm 包：
- `msodbcsql17-*.rpm`
- `mssql-tools-*.rpm`

```bash
# 需要 root 安装
su - root
rpm -ivh msodbcsql17-17.10.6.1-1.x86_64.rpm
rpm -ivh mssql-tools-17.9.1.1-1.x86_64.rpm
```

安装后测试连接：
```bash
export PATH=$PATH:/opt/mssql-tools/bin
sqlcmd -S 127.0.0.1,1433 -U babelfish_user -P 12345678
```

---

## 八、常见问题排查

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `cannot find -lantlr4-runtime` | antlr4 库未找到 | 创建软链接，添加 LD_LIBRARY_PATH |
| `libcrypto.so.1.1: No such file` | OpenSSL 库路径未配置 | 添加到 /etc/ld.so.conf.d 并 ldconfig |
| `GLIBCXX_3.4.21 not found` | 系统 libstdc++ 版本过低 | 将 gcc7.3/lib64 加入 LD_LIBRARY_PATH |
| `CMake 3.7 or higher required` | 使用了系统旧版 cmake | `export cmake=$(which cmake)`，确保 PATH 中项目 cmake 在前 |
| `openssl/sha.h: No such file` | OpenSSL 头文件路径未指定 | 添加 CFLAGS/PG_CFLAGS |
| `Permission denied` (cmake) | 用户无权访问 root 目录下的工具 | `chmod 755 /root` 或将工具迁移到 vast 用户目录 |
| `schema "sys" does not exist` | babelfishpg_tsql 加载失败 | 先解决库依赖问题，重新执行初始化脚本 |
| `cannot drop active babelfish database` | 重复执行初始化脚本 | 先断开所有连接再执行，或忽略（不影响结果） |

---

## 九、SSH Key 配置（用于 Git）

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
# 一路回车使用默认路径

# 查看公钥，添加到 Git 平台
cat ~/.ssh/id_rsa.pub
```
