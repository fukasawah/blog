---
title: "PostgreSQLのALTER DEFAULT PRIVILEGESのtarget_roleには指定したロール自身の操作しか反映されない"
date: "2022-04-20T03:50:57+09:00"
draft: false
toc: true
images:
tags: 
  - PostgreSQL
---


タイトル通り。ハマったのでメモ。

要約
--------

テーブル作成ができる `contributor`というロールがあり、`contributor`が付与されている`admin1`というユーザ(ログインできるロール)が居るとする。

読み取りのみできる`reader`というロールがあるとする。

そして、`admin1`でログインしてpublicスキーマへのテーブル作成で、デフォルトでreaderにSELECTの権限を与えたい場合、`SuperUser属性を持つユーザ`か`admin1`でログインして以下のSQLを実行する。

``` sql
ALTER DEFAULT PRIVILEGES FOR ROLE admin1 IN SCHEMA public GRANT SELECT ON TABLES TO reader;
```

` FOR ROLE admin1 `のように、実際にログインして作業できるロール(ユーザ)を指定するのが重要で、` FOR ROLE contributor `とするとダメ。
該当のロール(`contributor`)が付与されているユーザ(`admin1`)だからといって、このALTER DEFAULT PRIVILEGESは反映されない。そのため、`reader`権限が読み取れないテーブルになってしまう。

なお、`FOR ROLE`を指定するにはSuperUser属性を持つユーザか、スキーマ(上記の例だとpublic)にCREATEを持つユーザ(`admin1`)で実行する必要がある。


テーブルを作成できるユーザ==デフォルト権限を持つユーザ、であれば何の問題もないが、`テーブルを作成できるロールのメンバ`として管理している場合はこの動きに注意が必要かもしれない。
そうしないと「テーブルを作ったのに権限が付与されない。デフォルト権限はあるのに。なぜだ？」と混乱するだろう。

（DBの運用上、複数ユーザでテーブルを作ったりすることはほとんどないので、そういったロールをわざわざ作ってユーザに割り当てるようなことはしないか？）

参考
-----

https://www.postgresql.jp/document/11/html/sql-alterdefaultprivileges.html

`target_role`が今回ポイントの箇所だが、この件に触れられていない気がする。

メモ
------

`FOR ROLE xxx`は省略でき、省略した場合は現在作業しているユーザとなる。

`TO xxx`で指定できるロールは割り当て用のロール(`reader`)でも、そのロールが割り当てられているユーザでも機能する。

`psql`では`\ddp`でデフォルト権限の付与状況を確認できる。`\dp`でテーブルの権限の状況を確認できる。

検証コード
--------

TODO: 出来れば書く。
