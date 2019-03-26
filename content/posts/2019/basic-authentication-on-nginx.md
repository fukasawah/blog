---
title: "Basic Authentication on Nginx"
date: 2019-03-27T02:08:03+09:00
draft: false
featuredImg: ""
tags: 
  - Server
  - Nginx
---


Apache Httpdのツールとして提供されている`htpasswd`コマンドを使うのが良い。
（最初はpythonで自前で計算しようとしたが、[思っていた以上に面倒だった](https://svn.apache.org/viewvc/apr/apr/trunk/crypto/)ので諦めた...）

```
yum install httpd-tools
```

`htpasswd`の利用法は以下のドキュメント。

https://httpd.apache.org/docs/2.4/misc/password_encryptions.html


こんな感じに作る。新規作成時は`-c`をつける

```
$ sudo htpasswd -c -m /etc/nginx/.htpasswd testuser
New password:
Re-type new password:
Adding password for user testuser
```

ただ、出来上がるファイルは誰でも読める状態になっており、nginxユーザ(グループ)から読める必要があるため、`644`から`640`に変え、グループを`nginx`に変更する。

```
sudo chmod 0640 /etc/nginx/.htpasswd
sudo chown :nginx /etc/nginx/.htpasswd
```


最後にnginx.confの設定を変える。設定のドキュメントは以下。

https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html

以下をhttp,server,locationのいずれかのディレクティブに追加する。
locationなら特定のpathなら認証不要といった事ができる。


```
    auth_basic           "need authenticate";
    auth_basic_user_file /etc/nginx/.htpasswd;
```

後はnginxをreloadして反映。