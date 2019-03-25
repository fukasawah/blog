---
title: "NginxのVirtualhost設定～WildcardSSL証明書を添えて～"
date: 2019-03-26T04:10:14+09:00
draft: false
featuredImg: ""
tags: 
  - Server
  - Nginx
---

以前の手順でWildcardなSSL証明書ができたので、これを使ってvirtualhost運用をしてみたい。

ただ、このとき、証明書の設定箇所は1か所にしたい（増やすときに面倒なので）

まさしくな手順はnginxのドキュメントにある。

https://nginx.org/en/docs/http/configuring_https_servers.html#certificate_with_several_names

### `/etc/nginx/nginx.conf`の修正

/etc/nginx/nginx.confのSSLの設定を、`server`ディレクティブではなく、**`http`ディレクティブに移動する。**

``` nginx
   # certs sent to the client in SERVER HELLO are concatenated in ssl_certificate
    ssl_certificate /etc/letsencrypt/live/fukasawah.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fukasawah.dev/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
        # modern configuration. tweak to your needs.
    ssl_protocols TLSv1.2;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA256';
    ssl_prefer_server_ciphers on;

    # HSTS (ngx_http_headers_module is required) (15768000 seconds = 6 months)
    add_header Strict-Transport-Security max-age=15768000;

    # OCSP Stapling ---
    # fetch OCSP records from URL in ssl_certificate and cache them
    ssl_stapling on;
    ssl_stapling_verify on;

    ## verify chain of trust of OCSP response using Root CA and Intermediate certs
    ssl_trusted_certificate /etc/letsencrypt/live/fukasawah.dev/chain.pem;
```

次にserver_nameをちゃんと与える。

```
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;

        server_name  fukasawah.dev; # <= ここ！
        root         /usr/share/nginx/html;

        # Load configuration files for the default server block.
        include /etc/nginx/default.d/*.conf;

        location / {
        }
    # 省略
```


### `/etc/nginx/conf.d/virtualhost-test.conf` を作成する

httpディレクティブにある`include /etc/nginx/conf.d/*.conf`の設定で読むだけなので、`.conf`で終われば何でも良い。`virtualhost-サブドメイン名.conf`がわかりやすいんじゃないでしょうか。

``` nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name test.fukasawah.dev; # server_nameをちゃんと変える

    root /usr/share/nginx/html/test; # 試しにテスト用のディレクトリをrootにする
    index index.html;
}
```

見ての通り、SSLの設定はないが、同じhttpディレクティブに存在するserverディレクティブなので、httpディレクティブで設定したSSL設定が引き継がれている。これで追加するときも楽になる。

動作確認用にテスト用のファイルを配置する。

``` bash
sudo mkdir -p /usr/share/nginx/html/test
sudo tee /usr/share/nginx/html/test/index.html << __EOF__
<!DOCTYPE html>
<body>
  <p>Hello World</p>
</body>
__EOF__
```


### サーバに設定を反映


```
sudo systemctl reload nginx
```


https://fukasawah.dev と http://test.fukasawah.dev で見え方が変わっていることを確認する。（同じHTMLが返ってきていないこと）

また証明書も確認して同じものを使っていることも確認しておく。

以上。

あと内々で公開するとき用に、Digest認証をかけたい所だが、標準ではないモジュールなのでちょっと手間そう。Basic認証で妥協しようかな。TLSの上で通信されてるから大丈夫だ！大丈夫！

どうでもよいが、SSL証明書はもはやTLS証明書である・・・。