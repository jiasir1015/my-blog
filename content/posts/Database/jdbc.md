+++
title = 'jdbc'
date = '2025-07-24T19:03:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['数据库']
tags = ['数据库']
weight = 900
ShowToc = true
TocOpen = true
+++
# 1 使用JDBC的流程

1.  准备java环境
2.  准备jdbc驱动
3.  编写java代码
4.  执行java代码

# 2 使用JDBC

## 2.1 准备java环境

1.  安装java工具包

    ```bash
    sudo yum install -y java-1.8.0-openjdk java-1.8.0-openjdk-devel
    ```

2.  验证java安装成功

    ```bash
    java -version
    # openjdk version "1.8.0_382" : 8表示java 8
    ```

3.  执行java demo

    ```bash
    # 编写代码
    echo '
    public class Demo {
        public static void main(String[] args) {
            System.out.println("Hello World");
        }
    }
    ' >> Demo.java
    # 编译代码
    javac Demo.java
    # 执行
    java Demo
    ```

## 2.2 准备jdbc驱动

```bash
touch jdbc
cd jdbc
mkdir jars
cd jars
wget https://jdbc.postgresql.org/download/postgresql-42.7.7.jar

目录架构：
|-- jdbc
    |-- jars
        |-- postgresql-42.7.7.jar
```

[https://polydistortion.net/bc/index.html](https://polydistortion.net/bc/index.html)

## 2.3 准备数据库

```sql
CREATE USER u1 PASSWORD 'u1.password';
```

## 2.3 编写java代码

```java
import java.sql.*;

public class Pg {
    public static void main(String[] args) {
        try {
            Class.forName("org.postgresql.Driver");

            Connection conn = DriverManager.getConnection(
                "jdbc:postgresql://127.0.0.1:5432/postgres", "u1", "u1.password");

            Statement stmt = conn.createStatement();

            int ru = stmt.executeUpdate("CREATE TABLE t1(c1 INT, c2 TEXT)");

            ru = stmt.executeUpdate("INSERT INTO t1 VALUES (1, 'data1')");

            ResultSet rq = stmt.executeQuery("SELECT * FROM t1");

            stmt.close();
            conn.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

## 2.4 执行java代码

```bash
# 1 编译
javac -cp ./jars/postgresql-42.7.7.jar Pg.java

# 2 运行
java -cp ./:./jars/postgresql-42.7.7.jar Pg
```
