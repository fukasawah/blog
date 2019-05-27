---
title: "VPS ServerのセットアップとLetsEncryptによる証明書取得と利用まで(Google Cloud DNS Service)"
date:  2019-03-25T02:16:16+09:00
draft: false
featuredImg: ""
tags: 
  - Server
  - LetsEncrypt
---


まずは入っているパッケージを適当に最新化

```
yum update
reboot
```

ユーザを作る

```
# ユーザ作成
useradd fukasawah
# パスワード設定
passwd fukasawah

# wheelを与えてsudoを使えるようにする
usermod -G wheel fukasawah
id fukasawah

# 作成したユーザに変更
su - fukasawah

# sudoが使えるか確認。パスワード設定した時のパスワードが必要
sudo ls -l /
```


### SSH鍵の生成

作成したユーザに対して行う。既に公開鍵の準備がある場合は、後述のauthorized_keysに追記する手順まで飛ばす。


```
$ ssh-keygen -t rsa -b 4096
Generating public/private rsa key pair.
Enter file in which to save the key (/home/fukasawah/.ssh/id_rsa):
Created directory '/home/fukasawah/.ssh'.
Enter passphrase (empty for no passphrase):
Enter same passphrase again:
Your identification has been saved in /home/fukasawah/.ssh/id_rsa.
Your public key has been saved in /home/fukasawah/.ssh/id_rsa.pub.
The key fingerprint is:
1c:03:30:bb:05:59:23:de:96:02:5a:5b:b2:48:c9:e9 fukasawah@ik1-309-14734.vs.sakura.ne.jp
The key's randomart image is:
+--[ RSA 4096]----+
|..* *++          |
|.B B.* +         |
|+ o + = o        |
| E   = . o       |
|    .   S        |
|                 |
|                 |
|                 |
|                 |
+-----------------+
```

信頼できる公開鍵として登録しておく

```
cat .ssh/id_rsa.pub >> .ssh/authorized_keys
chmod 0600 .ssh/authorized_keys
```

秘密鍵はSSH接続時に必要になるので内容をコピーして手元に持ってきておく

```
cat .ssh/id_rsa
```

表示された `-----BEGIN RSA PRIVATE KEY-----`から`-----END RSA PRIVATE KEY-----`までの間の内容が秘密鍵なので、これをSSH接続したい端末にコピーする。

以降は必要ないので削除しておく


### SSHサーバのセキュリティを高める

rootユーザで行う。

SSHサーバに以下の設定を施す。

- パスワード認証を無効（公開鍵認証）
- rootのログイン無効（作成したユーザからsuでログインする）
- 空のパスワードログインを無効（必ずパスワード設定しないとログインできないようにする）


```
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
vi /etc/ssh/sshd_config
```

diffでバックアップとの差分を出して以下のように変更されたことを確認

```
#diff /etc/ssh/sshd_config.bak /etc/ssh/sshd_config
55c55
< #PubkeyAuthentication yes
---
> PubkeyAuthentication yes
78,79c78,79
< #PermitEmptyPasswords no
< PasswordAuthentication yes
---
> PermitEmptyPasswords no
> PasswordAuthentication no
```

```
問題がなければsshdを再起動
systemctl restart sshd
```

以下を確認する

- root＋パスワード認証でログインできないこと
- 作成したユーザ＋パスワード認証でログインできないこと
- 作成したユーザ＋公開鍵認証でログインできること


### ロケールとタイムゾーンの変更

OS設定のロケールとタイムゾーンを日本に合わせる

```
# ロケールの確認
locale
# タイムゾーンの確認
date
```

以下のコマンドで変更する。

```
# ロケール変更
sudo localectl set-locale LANG=ja_JP.UTF-8

# タイムゾーン変更
sudo timedatectl set-timezone Asia/Tokyo
```

ロケールは再接続後に反映される。


```
# ロケールの確認
locale
# タイムゾーンの変更の確認
date
```

Let's EncryptでSSL証明書を作る
-------------------------------


ドメインは Google Domainsで管理しており、ワイルドカード証明書を発行したい。

ワイルドカード証明書の場合、DNS-01認証が必須でありDNSサーバに対してTXTレコードを書き込む必要がある。
一般的なドメインレジストリ（お名前.com、Value-Domain等）でも手動で行えば可能ではあるが、90日の有効期間しかないため、この作業は自動化したい。

もちろん、スクレイピングなどを駆使すれば出来なくはないがデザイン変更などでスクレイピングプログラムが動かなくなるリスクも考えられる。そのあたりを考えると大変。
そこで、DNSをAPIで操作できるサービスを利用する。こちらならAPIが変わらない限り動かなくなることもなく、失敗時の動作もわかりやすい。

ただ、そのためには、ドメインレジストリで管理しているネームサーバではなく、サービス提供のネームサーバに転送し、解決させるようにする必要がある

今回はCoocle Cloud Platformで提供されているGoogle Cloud DNS Serviceを使う。ちなみに、Azure DNSでも同じ要領で出来る。
LetsEncryptによる証明書の作成・更新を行うためのプログラムには、certbot+certbot-dns-google プラグインを使う。

- Google Cloud DNS Serviceへゾーンを作成する
- ネームサーバを変更(Google domains -> Google Cloud DNS Service)
- Google Cloud DNS Serviceの認可情報を作る



### Google Cloud DNS Serviceへゾーンを作成する

https://cloud.google.com/dns/

ゾーンはドメインに対してDNSレコードを管理する単位で、1ドメインにつき1ゾーンを作ることになる。

以下を進めて、Google Cloud DNS Serviceを有効化にする。

https://console.cloud.google.com/net-services/dns/zones

ゾーンを作成する。

- ゾーンタイプ: 公開
- ゾーン名: 自由
- DNS名: 取得したドメイン名
- DNSSEC: オン

![](/images/vps-server-setup-with-letsencrypt/2019-03-16-21-14-23.png)

作成出来たらゾーンについてネームサーバが割り当たる。ゾーンで登録したレコードの情報はこのネームサーバに設定される。


### ネームサーバを変更(Google domains -> Google Cloud DNS Service)

Google Cloud DNS Serviceでゾーンを作成した時に得られたネームサーバをGoogle Domainsに登録する。

まず、[Google Domains](https://domains.google.com/)を開き、ネームサーバを変更する。

![](/images/vps-server-setup-with-letsencrypt/2019-03-16-21-20-14.png)

この変更は最長1日ぐらいかかる。結構時間がかかった。


### Google Cloud DNS Serviceの認可情報を作る

次にGoogle DNSでDNS登録をプログラムが行えるようにOAuth2認証の準備をする

https://developers.google.com/identity/protocols/OAuth2ServiceAccount#creatinganaccount


- プロジェクトを作る(fukasawah-devとした)
- サービスアカウントを作る（certbotとした）
- サービスアカウントの権限を設定する（DNS管理者とした。おそらくこれが必要最小限の権限）
- キーの作成を行い、JSONファイルで出力する。これがクレデンシャル情報となる。

ここで生成したJSONファイルはこの後使う。

クレデンシャル情報は自分の代わりに操作を許すための認証情報という扱いなので、絶対に人に見せてはいけない。
また、もし漏れた場合でも影響を抑えるため、権限は必要最小限に設定する。


### certbotでSSL証明書を発行する


https://docs.docker.com/install/linux/docker-ce/centos/

今回はdockerとcertbotを使う。dockerのほうが環境が汚れなくて精神衛生上よいため。

```
yum install -y yum-utils device-mapper-persistent-data lvm2
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
yum install docker-ce docker-ce-cli containerd.io

systemctl start docker
systemctl enable docker
```



dockerのインストールが終わったら作業ディレクトリを用意する


```
groupadd letsencrypt
mkdir -p /etc/letsencrypt /var/lib/letsencrypt /var/log/letsencrypt
chmod 0770 /etc/letsencrypt /var/lib/letsencrypt /var/log/letsencrypt
chown root:letsencrypt /etc/letsencrypt /var/lib/letsencrypt /var/log/letsencrypt
```

実行前にGoogle Cloud DNSを操作するための認証情報をJSONファイルで与える必要があるので、先ほどダウンロードしたJSONファイルを送る。

```
vi /etc/letsencrypt/google.json
chmod 0600 /etc/letsencrypt/google.json
```

ドメインはよしなに置き換える

```
sudo docker run -it --rm --name certbot \
            -v "/etc/letsencrypt:/etc/letsencrypt" \
            -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
            -v "/var/log/letsencrypt:/var/log/letsencrypt" \
            certbot/dns-google certonly \
  --dns-google \
  --dns-google-credentials /etc/letsencrypt/google.json \
  --dns-google-propagation-seconds 120 \
  -d fukasawah.dev \
  -d *.fukasawah.dev
```

実行すると3つほど尋ねられる。

- 再発行やセキュリティの通知先のEmail
- 利用規約とその同意
- 非営利組織Electronic Frontier Foundationの活動を伝えるため、メールアドレスを共有してよいか？（Noでよい）

```
Enter email address (used for urgent renewal and security notices) (Enter 'c' to
cancel): メールアドレスを入力

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Please read the Terms of Service at
https://letsencrypt.org/documents/LE-SA-v1.2-November-15-2017.pdf. You must
agree in order to register with the ACME server at
https://acme-v02.api.letsencrypt.org/directory
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
(A)gree/(C)ancel: A

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Would you be willing to share your email address with the Electronic Frontier
Foundation, a founding partner of the Let's Encrypt project and the non-profit
organization that develops Certbot? We'd like to send you email about our work
encrypting the web, EFF news, campaigns, and ways to support digital freedom.
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
(Y)es/(N)o: N

```

実行後、Cloud DNS上をみると、以下のようにレコードを登録していることが分かる。
![](/images/vps-server-setup-with-letsencrypt/2019-03-17-22-59-38.png)

うまくいくと以下のような形になる。

```
IMPORTANT NOTES:
 - Congratulations! Your certificate and chain have been saved at:
   /etc/letsencrypt/live/fukasawah.dev/fullchain.pem
   Your key file has been saved at:
   /etc/letsencrypt/live/fukasawah.dev/privkey.pem
   Your cert will expire on 2019-06-15. To obtain a new or tweaked
   version of this certificate in the future, simply run certbot
   again. To non-interactively renew *all* of your certificates, run
   "certbot renew"
 - If you like Certbot, please consider supporting our work by:

   Donating to ISRG / Let's Encrypt:   https://letsencrypt.org/donate
   Donating to EFF:                    https://eff.org/donate-le

```

以下の場所に生成される。`fukasawah.dev`はドメイン名なので実行する環境で変わる。

- 証明書（CAのみ）: `/etc/letsencrypt/live/fukasawah.dev/chain.pem`
- 証明書（ドメインのみ）: `/etc/letsencrypt/live/fukasawah.dev/cert.pem`
- 証明書（CA+ドメイン）: `/etc/letsencrypt/live/fukasawah.dev/fullchain.pem`
- 秘密鍵: `/etc/letsencrypt/live/fukasawah.dev/privkey.pem`

fullchainとprivkeyを良く使うことになるはず。


opensslコマンドで証明書の内容を覗くことができる。

```
openssl x509 -text /etc/letsencrypt/live/fukasawah.dev/fullchain.pem
```

なお、ファイルパスはシンボリックリンクされており、再発行(renew)してもファイルパスが変わらないように配慮されている。



ちなみに`certbot`実行時、TXTレコードが反映されるまでデフォルト60秒待つのだけど、それが間に合わなかったのか以下のように失敗することがあった。
なので、`--dns-google-propagation-seconds 120`オプションを足している。

```
IMPORTANT NOTES:
 - The following errors were reported by the server:

   Domain: fukasawah.dev
   Type:   unauthorized
   Detail: No TXT record found at _acme-challenge.fukasawah.dev

   To fix these errors, please make sure that your domain name was
   entered correctly and the DNS A/AAAA record(s) for that domain
   contain(s) the right IP address.
 - Your account credentials have been saved in your Certbot
   configuration directory at /etc/letsencrypt. You should make a
   secure backup of this folder now. This configuration directory will
   also contain certificates and private keys obtained by Certbot so
   making regular backups of this folder is ideal.

```


### 再発行を試す

期限が近付いてきたときにちゃんと証明書が更新されるか確認する。

通常はLetsEncryptのAPIのリミットにかからないように、手元の証明書が本当に更新が必要かどうか検証してから行うようになっている。
ただ、それだと再試行まで時間がかかってしまうので、`--force-renew`オプションで無理やり再発行する。

```
sudo docker run -it --rm --name certbot \
            -v "/etc/letsencrypt:/etc/letsencrypt" \
            -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
            -v "/var/log/letsencrypt:/var/log/letsencrypt" \
            certbot/dns-google renew --force-renew
```

うまくいけば、`ls -l /etc/letsencrypt/archive/*`で証明書と秘密鍵が増えているはず。


### cronで自動実行する

自動化するまでがお仕事です。今回はCronを使う。

cronでrootユーザでrenewを定期的に実行する

```
sudo crontab -e
```

毎日午前3時12分に実行する。（時間はずらす）

```
12 3 * * * docker run --rm --name certbot -v "/etc/letsencrypt:/etc/letsencrypt" -v "/var/lib/letsencrypt:/var/lib/letsencrypt" -v "/var/log/letsencrypt:/var/log/letsencrypt" certbot/dns-google renew 
```



nginxの導入とSSL証明書の利用
---------------------

nginxの導入は手抜き

```
sudo yum install nginx
```


`sudo vi /etc/nginx/nginx.conf`

HTTP(tcp/80)は使わないので、この部分を上書きしていく。「

```
    server {
        listen       80 default_server;
        listen       [::]:80 default_server;

        ...
    }
```

以下のように置き換える。

```
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;

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

        server_name  _;
        root         /usr/share/nginx/html;

        # Load configuration files for the default server block.
        include /etc/nginx/default.d/*.conf;

        location / {
        }

        error_page 404 /404.html;
            location = /40x.html {
        }

        error_page 500 502 503 504 /50x.html;
            location = /50x.html {
        }
    }
```

なお、この元ネタは以下から生成している。
https://mozilla.github.io/server-side-tls/ssl-config-generator/

以下の行が違うだけで、`fukasawah.dev`を自ドメインに置き換えればよい。

- `ssl_certificate`
- `ssl_certificate_key`
- `ssl_trusted_certificate`



設定が終わったら、サーバの起動・自動起動

```
systemctl start nginx
systemctl enable nginx

systemctl status nginx
```

https(tcp/443)のポートはファイアウォールで塞がれているので、firewalldの設定を変更し、https(tcp/443)からのアクセスを許可する

```
firewall-cmd --add-service=https --zone=public 
firewall-cmd --add-service=https --zone=public --permanent
```


Chrome等のブラウザでアクセスして表示されればOK

![](/images/vps-server-setup-with-letsencrypt/2019-03-17-23-35-31.png)

SSLの妥当性もテストしてくれるサービスがあるので、これも試す。
https://www.ssllabs.com/ssltest/

![](/images/vps-server-setup-with-letsencrypt/20  19-03-17-23-40-44.png)

いいですね。


ちなみに、証明書を更新し終わったらnginxもreloadを行わないと反映されない。ので、`systemctl reload nginx`をcronに入れておくなりすると良いでしょう。

