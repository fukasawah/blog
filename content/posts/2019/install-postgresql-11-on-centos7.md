---
title: "Install PostgreSQL 11 on CentOS 7"
date: 2019-03-26T03:53:23+09:00
draft: true
featuredImg: ""
tags: 
  - Server
  - PostgreSQL
---


- PostgreSQL 11の導入
- pg_bigmの導入

最新版はPostgreSQLのページから得られるリポジトリからインストールできる。

https://yum.postgresql.org/repopackages.php#pg11

PostgreSQL 11の導入
--------------------------

### リポジトリの登録とインストール

```
# リポジトリ追加
sudo yum install https://download.postgresql.org/pub/repos/yum/11/redhat/rhel-7-x86_64/pgdg-centos11-11-2.noarch.rpm

# クライアントとサーバと拡張機能のインストール
sudo yum install -y postgresql11 postgresql11-server postgresql11-contrib 
```

`/usr/pgsql-11`辺りに色々導入される


### データベースの領域作成

```
sudo /usr/pgsql-11/bin/initdb --encoding=UTF-8 --no-locale -D /var/lib/pgsql/11/data
```


### サーバ起動

```
# 起動
sudo systemctl start postgresql-11

# 自動起動の有効化
sudo systemctl enable postgresql-11

# 確認
sudo systemctl status postgresql-11
```

statusで確認すると、`active (running) `になっていたり、`/var/lib/pgsql/11/data/`を使っていることが確認できる。

```
● postgresql-11.service - PostgreSQL 11 database server
   Loaded: loaded (/usr/lib/systemd/system/postgresql-11.service; enabled; vendor preset: disabled)
   Active: active (running) since 火 2019-03-26 02:29:53 JST; 41s ago
     Docs: https://www.postgresql.org/docs/11/static/
 Main PID: 30183 (postmaster)
   CGroup: /system.slice/postgresql-11.service
           ├─30183 /usr/pgsql-11/bin/postmaster -D /var/lib/pgsql/11/data/
           ...
```


pg_bigmの導入
----------------------

1~2文字に強い全文検索の機能拡張。

http://pgbigm.osdn.jp/

CentOS7 + PostgreSQL 11向けのバイナリは配布されていないので、ソースコードからビルドして導入する。

### 依存ソフトウェアのインストール

postgresqlのソースコードやビルド・インストール時に必要な依存を入手する

``` bash
# ビルドに必要
sudo yum install -y postgresql11-devel

# llvm-toolset-7のパッケージがあるリポジトリ
sudo yum install -y centos-release-scl
# ビルドに必要(llvm)
sudo yum install -y llvm-toolset-7 llvm5.0
```

llvm-toolset-7はビルド時に`/opt/rh/llvm-toolset-7/root/usr/bin/clang`を使うため、llvm5.0はinstall時に`/usr/lib64/llvm5.0/bin/llvm-lto`を使うため。


### ソースコードの入手

ソースコードをダウンロードして展開。
URLが存在しない場合、公式のダウンロードから適宜置き換える。

```
mkdir src
cd src
curl -LO http://iij.dl.osdn.jp/pgbigm/66565/pg_bigm-1.2-20161011.tar.gz
tar xzvf pg_bigm-1.2-20161011.tar.gz
cd pg_bigm-1.2-20161011
```

### ビルドとインストール

この辺りは[pg_bigmのドキュメント](http://pgbigm.osdn.jp/pg_bigm-1-2.html)に書かれている。

``` bash
# ビルド
make USE_PGXS=1 PG_CONFIG=/usr/pgsql-11/bin/pg_config

# install
sudo make USE_PGXS=1 PG_CONFIG=/usr/pgsql-11/bin/pg_config install
```


### postgresql.confの修正

```
sudo vi /var/lib/pgsql/11/data/postgresql.conf

# 以下を足す
shared_preload_libraries = 'pg_bigm'
```

再起動

``` bash
sudo systemctl restart postgresql-11
```


### DBの作成とpsqlによるDBアクセス

``` bash
sudo -u postgres createdb --locale=C --encoding=UTF8 testdb
sudo -u postgres psql -d testdb
```

### 拡張機能の有効化

**`CREATE EXTENSION pg_bigm;`はDatabase毎に行う必要がある点に注意**。

``` 
testdb=# CREATE EXTENSION pg_bigm;
CREATE EXTENSION

testdb=# \dx pg_bigm
                                 List of installed extensions
  Name   | Version | Schema |                           Description
---------+---------+--------+------------------------------------------------------------------
 pg_bigm | 1.2     | public | text similarity measurement and index searching based on bigrams
(1 row)
```

### テスト実行

``` sql

-- テーブル作成
CREATE TABLE pg_tools (tool text, description text);

-- レコード作成
INSERT INTO pg_tools VALUES ('pg_hint_plan', 'PostgreSQLでHINT句を使えるようにするツール');
INSERT INTO pg_tools VALUES ('pg_dbms_stats', 'PostgreSQLの統計情報を固定化するツール');
INSERT INTO pg_tools VALUES ('pg_bigm', 'PostgreSQLで2-gramの全文検索を使えるようにするツール');
INSERT INTO pg_tools VALUES ('pg_trgm', 'PostgreSQLで3-gramの全文検索を使えるようにするツール');

-- インデックス作成
CREATE INDEX pg_tools_idx ON pg_tools USING gin (description gin_bigm_ops);

-- 全文検索 => 2件ヒットすること
SELECT * FROM pg_tools WHERE description LIKE '%全文検索%';

-- テーブル削除
DROP TABLE pg_tools;
```

