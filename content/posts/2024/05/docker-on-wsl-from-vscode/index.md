---
title: "VSCodeの機能拡張Dev ContainersからWSL上にDockerをインストールする"
date: "2024-05-13T07:09:06+09:00"
draft: false
toc: true
images:
tags:
  - Dev Containers
  - VSCode 
  - WSL
  - Docker
---

要約すると、VSCodeの機能拡張のDev ContainersでDockerをWSLにインストールできるのでお勧めという記事

背景
-------

VSCodeのdevcontainers、便利だけどそのためのDockerの環境をどう用意するかというのがちょっと面倒。



現時点では、公式のWindows向けのDockerインストールの手順ではDocker Desktopが案内される。WSLに向けた手順は書かれていない。

- https://docs.docker.com/desktop/install/windows-install/
- https://docs.docker.com/desktop/wsl/

しかし、ライセンスの兼ね合いもありちょっとなーという気持ちの人は多いと思う。

ある日、DevContainersを触っていたら、コマンドパレットに`Install Docker in WSL`という項目があるのを見かけた。

![VSCodeのコマンドパレットに出てきた Install Docker in WSL](images/index/2024-05-13-01-19-09.png)

もしかして導入が簡単になるのでは？　と思った。最近`Ubuntu-24.04`も出たし、WSLの環境を刷新するついでに試してみる。


過去に[WSL上にDockerを入れる手順は書いているが](/posts/2023/08/07/building-docker-on-wsl-environment-for-devcontainer/)、distroのアップデートもあり手順も簡単になっている。

前提
---------

- Windows 10/11のいずれか
- VSCodeを導入済み(1.88.1)
- VSCodeの機能拡張「[Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)」を導入済み
- WSLをインストール済み
- 充分なディスク容量


前準備:WSLのディストリビューションのインストール
--------



ここまでは前準備。

### 環境

```
> wsl --update
更新プログラムを確認しています。
Linux 用 Windows サブシステムの最新バージョンは既にインストールされています。

> wsl --version
WSL バージョン: 2.1.5.0
カーネル バージョン: 5.15.146.1-2
WSLg バージョン: 1.0.60
MSRDC バージョン: 1.2.5105
Direct3D バージョン: 1.611.1-81528511
DXCore バージョン: 10.0.25131.1002-220531-1700.rs-onecore-base2-hyp
Windows バージョン: 10.0.19045.4355
```


### （ホスト機）WSLのディストリビューション(distoro)のインストール

ホスト機はPowerShellかコマンドプロンプトなどで操作

```
# 使えるdistoroの確認
wsl -l --online

# インストール
wsl --install Ubuntu-24.04
```

ログインユーザとパスワードを設定したら完了。だいぶ前と変わってるなぁ。


### （任意）（ホスト機）distoroのExport/Importで同じdistoroを複数作れるようにする

インストールしたdistoroは1つしかない状態で、デフォルトで複製とかそういったことができない。例えば新しい別のUbuntu-24.04のイメージを真っ新にして作りたい、ということができない。

なので、一度Exportして、再度別名でimportし、その環境を使うことでいつでも真っ新な状態に戻せるようにする。

（これ、公式でなんか用意してほしいけどまだないのかな）


```bash
# 一度WSLを止める
wsl --shutdown

# ディレクトリ作成
mkdir D:\wsl\backup
mkdir D:\wsl\distoro

# 既存のdistroのExport
# デフォルトはtar形式で --vhd オプションでVHDX形式になる。
wsl --export "Ubuntu-24.04" "D:\wsl\backup\Ubuntu-24.04.vhdx" --vhd

# 別名(Ubuntu-24.04-1)でImport
wsl --import "Ubuntu-24.04-1" "D:\wsl\distoro\Ubuntu-24.04-1" "D:\wsl\backup\Ubuntu-24.04.vhdx" --vhd

```


### Ubuntu-24.04-1 をデフォルトのディストリビューションにする

```bash
# 上記で複製している場合は Ubuntu-24.04-1
# そうでない場合は Ubuntu-24.04 を指定する
wsl --set-default Ubuntu-24.04-1
```


### （WSL）起動時のユーザ名を指定する

上記でexport/importしてコピーした方法ではデフォルトrootユーザで起動してしまう。

やり方は2つあるらしい。

- `/etc/wsl.conf`に設定
- レジストリエディタで設定

https://superuser.com/questions/1566022/how-to-set-default-user-for-manually-installed-wsl-distro

`/etc/wsl.conf`は前にやっているので、レジストリエディタを試してみる。

まずログインしたいユーザのuidを調べる

```bash
$ id fukasawah
uid=1002(fukasawah) 
```

1002ということが分かる。distroインストール時に作るユーザのuidは1002になるのかも。

次にレジストリエディタ(regedit)を開き、`HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Lxss`の下にUUIDが並んでいるので、そこからお目当てのDistroを探り当てる。

探り当てたら `DefaultUid` を16進数で`3ea`(10進数:1002) に設定する。

![regeditで編集した様子](images/index/2024-05-13-02-52-54.png)

これでdistroを起動してみると、ログインユーザが変わる。

```bash
# 起動
D:\wsl>wsl --distribution Ubuntu-24.04-1

# promptで分かっているが一応確認
fukasawah@DESKTOP-XXXXXX:/mnt/d/wsl$ id
uid=1002(fukasawah) ...
```

### その他

特にないが、 `sudo apt update && sudo apt upgrade` など。

Systemdは既に有効化されていた。


VSCodeのDevContainersの`Install Docker in WSL`を試す
------

VSCode上で `Install Docker in WSL`を実行する

これを実行すると以下が行われる模様

- デフォルトのdistroをrootユーザで起動
- インストール済みか確認する
- dockerのインストール
- デフォルトユーザをdockerグループに所属させる


<details>
<summary>実行時のログ全文は折りたたんでおきます</summary>

```
[586 ms] Dev Containers 0.362.0 in VS Code 1.88.1 (e170252f762678dec6ca2cc69aba1570769a5d39).
[586 ms] Initializing configuration support...
[586 ms] Internal initialization of dev container support package...
[6024380 ms] Windows build number: 19045
[6024381 ms] WSL feature installed: true (dll path: C:\WINDOWS\System32\lxss\LxssManager.dll)
[6024382 ms] Start: Run: wsl --version
[6024621 ms] WSL �0�0�0�0�0: 2.1.5.0
�0�0�0�0 �0�0�0�0�0: 5.15.146.1-2
WSLg �0�0�0�0�0: 1.0.60
MSRDC �0�0�0�0�0: 1.2.5105
Direct3D �0�0�0�0�0: 1.611.1-81528511
DXCore �0�0�0�0�0: 10.0.25131.1002-220531-1700.rs-onecore-base2-hyp
Windows �0�0�0�0�0: 10.0.19045.4355

[6024631 ms] Start: Run: wsl -l -v
[6024882 ms]   NAME                  STATE           VERSION
* Ubuntu-24.04-1        Running         2
  Ubuntu-2              Stopped         2
  Ubuntu                Stopped         2
  Ubuntu-22.04-1-tar    Stopped         2
  Ubuntu-1              Stopped         2
  Ubuntu20.04LTS        Stopped         2
  Ubuntu-22.04-1        Stopped         2
  Ubuntu-24.04          Stopped         2
  Ubuntu-22.04          Stopped         2

[6024889 ms] Start: Run: wsl -u root -e /bin/sh
[6025060 ms] Start: Run in host: cat /etc/os-release || cat /usr/lib/os-release || true
[6025264 ms] PRETTY_NAME="Ubuntu 24.04 LTS"
NAME="Ubuntu"
VERSION_ID="24.04"
VERSION="24.04 LTS (Noble Numbat)"
VERSION_CODENAME=noble
ID=ubuntu
ID_LIKE=debian
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy"
UBUNTU_CODENAME=noble
LOGO=ubuntu-logo
[6025264 ms] 
[6025265 ms] Start: Run: wsl -e /bin/sh
[6025309 ms] Start: Run in host: id -un
[6025528 ms] fukasawah
[6025528 ms] 
[6025528 ms] Start: Run in host: command -v docker
[6025593 ms] 
[6025593 ms] 
[6025594 ms] Exit code 127
[6025594 ms] Start: Run in host: command -v docker
[6025645 ms] 
[6025645 ms] 
[6025646 ms] Exit code 127
[6025646 ms] Start: Run in host: command -v dockerd
[6025698 ms] 
[6025699 ms] 
[6025699 ms] Exit code 127
[6025699 ms] Start: Run in host: export DEBIAN_FRONTEND=noninteractive
[6025700 ms] 
[6025700 ms] 
[6025700 ms] Start: Run in host: apt update && apt -y install --no-install-recommends apt-transport-https ca-certificates curl gnupg2
[6041485 ms] Get:1 http://security.ubuntu.com/ubuntu noble-security InRelease [89.7 kB]
Get:2 http://archive.ubuntu.com/ubuntu noble InRelease [256 kB]
Get:3 http://security.ubuntu.com/ubuntu noble-security/main amd64 Packages [26.7 kB]
Get:4 http://security.ubuntu.com/ubuntu noble-security/main Translation-en [8124 B]
Get:5 http://security.ubuntu.com/ubuntu noble-security/universe amd64 Packages [10.6 kB]
Get:6 http://security.ubuntu.com/ubuntu noble-security/universe Translation-en [4596 B]
Get:7 http://security.ubuntu.com/ubuntu noble-security/universe amd64 c-n-f Metadata [112 B]
Get:8 http://security.ubuntu.com/ubuntu noble-security/multiverse amd64 c-n-f Metadata [116 B]
Get:9 http://archive.ubuntu.com/ubuntu noble-updates InRelease [89.7 kB]
Get:10 http://archive.ubuntu.com/ubuntu noble-backports InRelease [89.7 kB]
Get:11 http://archive.ubuntu.com/ubuntu noble/main amd64 Packages [1401 kB]
Get:12 http://archive.ubuntu.com/ubuntu noble/main Translation-en [513 kB]
Get:13 http://archive.ubuntu.com/ubuntu noble/universe amd64 Packages [15.0 MB]
Get:14 http://archive.ubuntu.com/ubuntu noble/universe Translation-en [5982 kB]
Get:15 http://archive.ubuntu.com/ubuntu noble/universe amd64 Components [3871 kB]
Get:16 http://archive.ubuntu.com/ubuntu noble/universe amd64 c-n-f Metadata [301 kB]
Get:17 http://archive.ubuntu.com/ubuntu noble/restricted amd64 Packages [93.9 kB]
Get:18 http://archive.ubuntu.com/ubuntu noble/restricted Translation-en [18.7 kB]
Get:19 http://archive.ubuntu.com/ubuntu noble/multiverse amd64 Packages [269 kB]
Get:20 http://archive.ubuntu.com/ubuntu noble/multiverse Translation-en [118 kB]
Get:21 http://archive.ubuntu.com/ubuntu noble/multiverse amd64 Components [35.0 kB]
Get:22 http://archive.ubuntu.com/ubuntu noble/multiverse amd64 c-n-f Metadata [8328 B]
Get:23 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 Packages [28.4 kB]
Get:24 http://archive.ubuntu.com/ubuntu noble-updates/main Translation-en [8996 B]
Get:25 http://archive.ubuntu.com/ubuntu noble-updates/universe amd64 Packages [17.6 kB]
Get:26 http://archive.ubuntu.com/ubuntu noble-updates/universe Translation-en [6096 B]
Get:27 http://archive.ubuntu.com/ubuntu noble-updates/universe amd64 c-n-f Metadata [112 B]
Get:28 http://archive.ubuntu.com/ubuntu noble-updates/multiverse amd64 c-n-f Metadata [116 B]
Get:29 http://archive.ubuntu.com/ubuntu noble-backports/main amd64 c-n-f Metadata [112 B]
Get:30 http://archive.ubuntu.com/ubuntu noble-backports/universe amd64 Packages [3936 B]
Get:31 http://archive.ubuntu.com/ubuntu noble-backports/universe Translation-en [1392 B]
Get:32 http://archive.ubuntu.com/ubuntu noble-backports/universe amd64 c-n-f Metadata [116 B]
Get:33 http://archive.ubuntu.com/ubuntu noble-backports/restricted amd64 c-n-f Metadata [116 B]
Get:34 http://archive.ubuntu.com/ubuntu noble-backports/multiverse amd64 c-n-f Metadata [116 B]
Fetched 28.3 MB in 9s (3325 kB/s)
Reading package lists...
Building dependency tree...
Reading state information...
18 packages can be upgraded. Run 'apt list --upgradable' to see them.
Reading package lists...
Building dependency tree...
Reading state information...
ca-certificates is already the newest version (20240203).
ca-certificates set to manually installed.
The following additional packages will be installed:
  libcurl3t64-gnutls libcurl4t64
The following NEW packages will be installed:
  apt-transport-https gnupg2
The following packages will be upgraded:
  curl libcurl3t64-gnutls libcurl4t64
3 upgraded, 2 newly installed, 0 to remove and 15 not upgraded.
Need to get 909 kB of archives.
After this operation, 68.6 kB of additional disk space will be used.
Get:1 http://archive.ubuntu.com/ubuntu noble/universe amd64 apt-transport-https all 2.7.14build2 [3974 B]
Get:2 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 curl amd64 8.5.0-2ubuntu10.1 [227 kB]
Get:3 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 libcurl4t64 amd64 8.5.0-2ubuntu10.1 [341 kB]
Get:4 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 libcurl3t64-gnutls amd64 8.5.0-2ubuntu10.1 [333 kB]
Get:5 http://archive.ubuntu.com/ubuntu noble/universe amd64 gnupg2 all 2.4.4-2ubuntu17 [4748 B]
Fetched 909 kB in 2s (415 kB/s)
Selecting previously unselected package apt-transport-https.
(Reading database ... 40663 files and directories currently installed.)
Preparing to unpack .../apt-transport-https_2.7.14build2_all.deb ...
Unpacking apt-transport-https (2.7.14build2) ...
Preparing to unpack .../curl_8.5.0-2ubuntu10.1_amd64.deb ...
Unpacking curl (8.5.0-2ubuntu10.1) over (8.5.0-2ubuntu10) ...
Preparing to unpack .../libcurl4t64_8.5.0-2ubuntu10.1_amd64.deb ...
Unpacking libcurl4t64:amd64 (8.5.0-2ubuntu10.1) over (8.5.0-2ubuntu10) ...
Preparing to unpack .../libcurl3t64-gnutls_8.5.0-2ubuntu10.1_amd64.deb ...
Unpacking libcurl3t64-gnutls:amd64 (8.5.0-2ubuntu10.1) over (8.5.0-2ubuntu10) ...
Selecting previously unselected package gnupg2.
Preparing to unpack .../gnupg2_2.4.4-2ubuntu17_all.deb ...
Unpacking gnupg2 (2.4.4-2ubuntu17) ...
Setting up gnupg2 (2.4.4-2ubuntu17) ...
Setting up apt-transport-https (2.7.14build2) ...
Setting up libcurl4t64:amd64 (8.5.0-2ubuntu10.1) ...
Setting up libcurl3t64-gnutls:amd64 (8.5.0-2ubuntu10.1) ...
Setting up curl (8.5.0-2ubuntu10.1) ...
Processing triggers for man-db (2.12.0-4build2) ...
Processing triggers for libc-bin (2.39-0ubuntu8) ...
/sbin/ldconfig.real: /usr/lib/wsl/lib/libcuda.so.1 is not a symbolic link

[6041486 ms] 
WARNING: apt does not have a stable CLI interface. Use with caution in scripts.


WARNING: apt does not have a stable CLI interface. Use with caution in scripts.

debconf: unable to initialize frontend: Dialog
debconf: (Dialog frontend requires a screen at least 13 lines tall and 31 columns wide.)
debconf: falling back to frontend: Readline
[6041486 ms] Start: Run in host: curl -fsSL https://download.docker.com/linux/ubuntu/gpg | tee /etc/apt/trusted.gpg.d/docker.asc
[6041564 ms] -----BEGIN PGP PUBLIC KEY BLOCK-----

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
YT90qFF93M3v01BbxP+EIY2/9tiIPbrd
=0YYh
-----END PGP PUBLIC KEY BLOCK-----
[6041564 ms] 
[6041565 ms] Start: Run in host: echo "deb [arch=$(dpkg --print-architecture)] https://download.docker.com/linux/ubuntu noble stable" | tee /etc/apt/sources.list.d/docker.list
[6041567 ms] deb [arch=amd64] https://download.docker.com/linux/ubuntu noble stable
[6041567 ms] 
[6041567 ms] Start: Run in host: apt update && apt -y install --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
[6056653 ms] Get:1 https://download.docker.com/linux/ubuntu noble InRelease [48.8 kB]
Get:2 https://download.docker.com/linux/ubuntu noble/stable amd64 Packages [6337 B]
Hit:3 http://security.ubuntu.com/ubuntu noble-security InRelease
Hit:4 http://archive.ubuntu.com/ubuntu noble InRelease
Hit:5 http://archive.ubuntu.com/ubuntu noble-updates InRelease
Hit:6 http://archive.ubuntu.com/ubuntu noble-backports InRelease
Fetched 55.2 kB in 1s (57.7 kB/s)
Reading package lists...
Building dependency tree...
Reading state information...
15 packages can be upgraded. Run 'apt list --upgradable' to see them.
Reading package lists...
Building dependency tree...
Reading state information...
The following additional packages will be installed:
  iptables libip4tc2 libip6tc2 libnetfilter-conntrack3 libnfnetlink0
  libnftnl11
Suggested packages:
  aufs-tools cgroupfs-mount | cgroup-lite firewalld
Recommended packages:
  docker-ce-rootless-extras libltdl7 pigz nftables
The following NEW packages will be installed:
  containerd.io docker-buildx-plugin docker-ce docker-ce-cli
  docker-compose-plugin iptables libip4tc2 libip6tc2 libnetfilter-conntrack3
  libnfnetlink0 libnftnl11
0 upgraded, 11 newly installed, 0 to remove and 15 not upgraded.
Need to get 112 MB of archives.
After this operation, 416 MB of additional disk space will be used.
Get:1 https://download.docker.com/linux/ubuntu noble/stable amd64 containerd.io amd64 1.6.31-1 [29.8 MB]
Get:2 https://download.docker.com/linux/ubuntu noble/stable amd64 docker-buildx-plugin amd64 0.14.0-1~ubuntu.24.04~noble [29.7 MB]
Get:3 http://archive.ubuntu.com/ubuntu noble/main amd64 libip4tc2 amd64 1.8.10-3ubuntu2 [23.3 kB]
Get:4 https://download.docker.com/linux/ubuntu noble/stable amd64 docker-ce-cli amd64 5:26.1.2-1~ubuntu.24.04~noble [14.6 MB]
Get:5 https://download.docker.com/linux/ubuntu noble/stable amd64 docker-ce amd64 5:26.1.2-1~ubuntu.24.04~noble [25.3 MB]
Get:6 https://download.docker.com/linux/ubuntu noble/stable amd64 docker-compose-plugin amd64 2.27.0-1~ubuntu.24.04~noble [12.5 MB]
Get:7 http://archive.ubuntu.com/ubuntu noble/main amd64 libip6tc2 amd64 1.8.10-3ubuntu2 [23.7 kB]
Get:8 http://archive.ubuntu.com/ubuntu noble/main amd64 libnfnetlink0 amd64 1.0.2-2build1 [14.8 kB]
Get:9 http://archive.ubuntu.com/ubuntu noble/main amd64 libnetfilter-conntrack3 amd64 1.0.9-6build1 [45.2 kB]
Get:10 http://archive.ubuntu.com/ubuntu noble/main amd64 libnftnl11 amd64 1.2.6-2build1 [66.0 kB]
Get:11 http://archive.ubuntu.com/ubuntu noble/main amd64 iptables amd64 1.8.10-3ubuntu2 [381 kB]
Fetched 112 MB in 2s (48.6 MB/s)
Selecting previously unselected package libip4tc2:amd64.
(Reading database ... 40673 files and directories currently installed.)
Preparing to unpack .../00-libip4tc2_1.8.10-3ubuntu2_amd64.deb ...
Unpacking libip4tc2:amd64 (1.8.10-3ubuntu2) ...
Selecting previously unselected package libip6tc2:amd64.
Preparing to unpack .../01-libip6tc2_1.8.10-3ubuntu2_amd64.deb ...
Unpacking libip6tc2:amd64 (1.8.10-3ubuntu2) ...
Selecting previously unselected package libnfnetlink0:amd64.
Preparing to unpack .../02-libnfnetlink0_1.0.2-2build1_amd64.deb ...
Unpacking libnfnetlink0:amd64 (1.0.2-2build1) ...
Selecting previously unselected package libnetfilter-conntrack3:amd64.
Preparing to unpack .../03-libnetfilter-conntrack3_1.0.9-6build1_amd64.deb ...
Unpacking libnetfilter-conntrack3:amd64 (1.0.9-6build1) ...
Selecting previously unselected package libnftnl11:amd64.
Preparing to unpack .../04-libnftnl11_1.2.6-2build1_amd64.deb ...
Unpacking libnftnl11:amd64 (1.2.6-2build1) ...
Selecting previously unselected package iptables.
Preparing to unpack .../05-iptables_1.8.10-3ubuntu2_amd64.deb ...
Unpacking iptables (1.8.10-3ubuntu2) ...
Selecting previously unselected package containerd.io.
Preparing to unpack .../06-containerd.io_1.6.31-1_amd64.deb ...
Unpacking containerd.io (1.6.31-1) ...
Selecting previously unselected package docker-buildx-plugin.
Preparing to unpack .../07-docker-buildx-plugin_0.14.0-1~ubuntu.24.04~noble_amd64.deb ...
Unpacking docker-buildx-plugin (0.14.0-1~ubuntu.24.04~noble) ...
Selecting previously unselected package docker-ce-cli.
Preparing to unpack .../08-docker-ce-cli_5%3a26.1.2-1~ubuntu.24.04~noble_amd64.deb ...
Unpacking docker-ce-cli (5:26.1.2-1~ubuntu.24.04~noble) ...
Selecting previously unselected package docker-ce.
Preparing to unpack .../09-docker-ce_5%3a26.1.2-1~ubuntu.24.04~noble_amd64.deb ...
Unpacking docker-ce (5:26.1.2-1~ubuntu.24.04~noble) ...
Selecting previously unselected package docker-compose-plugin.
Preparing to unpack .../10-docker-compose-plugin_2.27.0-1~ubuntu.24.04~noble_amd64.deb ...
Unpacking docker-compose-plugin (2.27.0-1~ubuntu.24.04~noble) ...
Setting up libip4tc2:amd64 (1.8.10-3ubuntu2) ...
Setting up libip6tc2:amd64 (1.8.10-3ubuntu2) ...
Setting up libnftnl11:amd64 (1.2.6-2build1) ...
Setting up docker-buildx-plugin (0.14.0-1~ubuntu.24.04~noble) ...
Setting up containerd.io (1.6.31-1) ...
Created symlink /etc/systemd/system/multi-user.target.wants/containerd.service → /usr/lib/systemd/system/containerd.service.
Setting up docker-compose-plugin (2.27.0-1~ubuntu.24.04~noble) ...
Setting up docker-ce-cli (5:26.1.2-1~ubuntu.24.04~noble) ...
Setting up libnfnetlink0:amd64 (1.0.2-2build1) ...
Setting up libnetfilter-conntrack3:amd64 (1.0.9-6build1) ...
Setting up iptables (1.8.10-3ubuntu2) ...
update-alternatives: using /usr/sbin/iptables-legacy to provide /usr/sbin/iptables (iptables) in auto mode
update-alternatives: using /usr/sbin/ip6tables-legacy to provide /usr/sbin/ip6tables (ip6tables) in auto mode
update-alternatives: using /usr/sbin/iptables-nft to provide /usr/sbin/iptables (iptables) in auto mode
update-alternatives: using /usr/sbin/ip6tables-nft to provide /usr/sbin/ip6tables (ip6tables) in auto mode
update-alternatives: using /usr/sbin/arptables-nft to provide /usr/sbin/arptables (arptables) in auto mode
update-alternatives: using /usr/sbin/ebtables-nft to provide /usr/sbin/ebtables (ebtables) in auto mode
Setting up docker-ce (5:26.1.2-1~ubuntu.24.04~noble) ...
Created symlink /etc/systemd/system/multi-user.target.wants/docker.service → /usr/lib/systemd/system/docker.service.
Created symlink /etc/systemd/system/sockets.target.wants/docker.socket → /usr/lib/systemd/system/docker.socket.
Processing triggers for man-db (2.12.0-4build2) ...
Processing triggers for libc-bin (2.39-0ubuntu8) ...
/sbin/ldconfig.real: /usr/lib/wsl/lib/libcuda.so.1 is not a symbolic link

[6056653 ms] 
WARNING: apt does not have a stable CLI interface. Use with caution in scripts.


WARNING: apt does not have a stable CLI interface. Use with caution in scripts.

debconf: unable to initialize frontend: Dialog
debconf: (Dialog frontend requires a screen at least 13 lines tall and 31 columns wide.)
debconf: falling back to frontend: Readline
[6056653 ms] Start: Run in host: usermod -aG docker fukasawah
[6056725 ms] 
[6056726 ms] 
```

</details>


実行後、再度 `wsl -d` でdistroを起動しなおすとdockerグループに属した状態となっているはず。

楽ちん。Docker desktopを使っているわけでもないので、ライセンス周りは気にしなくてよさそう。


おまけ: HTTP Proxy
-------

### Docker install時

上記の手順で導入する場合、Dockerのインストールを行う都合上、aptのリポジトリの設定やダウンロードでインターネットへのアクセスが発生する。

これはWSL上で実行され、実行時は必ずシェルを経由するが、上記の通りrootで作業を行う。

なのでDockerをインストールする手順を踏む前に、プロキシを設定する必要があるのだが、幸いログインシェルを介するので、WSLに`/etc/profile.d/proxy.sh`に環境変数設定されるようスクリプトを書いてあげる手がある（aptのプロキシ設定をしてもよいがどうせプロキシを介する環境はプロキシを介さないと何もできないので設定してしまっても良いと思う）

```bash
# プロキシ用変数
PROXY=http://proxy.url:8080

# シェルログイン時に環境変数設定されるようにする
cat << __EOF__ | sudo tee /etc/profile.d/proxy.sh
export HTTPS_PROXY=$PROXY
export HTTP_PROXY=$PROXY
__EOF__
```

### Docker pull時

まずDockerに関するProxyに関する次の記事が詳しい。

https://qiita.com/dkoide/items/ca1f4549dc426eaf3735


Docker imageを実行しようとしたりビルドしようとしたりすると、イメージのpullが行われる。この時インターネットへのアクセスが発生する。

これはdocker engine(daemon)で行われる。対処の仕方としては2つある。

- Systemdのdocker.serviceの環境変数に設定
  - システムで共通
- Dockerクライアントの設定
  - ユーザ毎に設定、他のコマンドにも影響
  - 参考: https://docs.docker.com/network/proxy/#configure-the-docker-client

どっちも一長一短だが、後述する点もあるので、Dockerクライアントの設定で行うことを推奨する


```bash
# プロキシ用変数
PROXY=http://proxy.url:8080

# ユーザのDockerクライアントの設定を書く
sudo mkdir ~/.docker/
cat << __EOF__ >> ~/.docker/config.json
{
 "proxies": {
   "default": {
     "httpProxy": "$PROXY",
     "httpsProxy": "$PROXY",
     "noProxy": ""
   }
 }
}
__EOF__
```

### Docker build時（コンテナイメージのビルド時）

ビルド時も `RUN apt install ...` といったインターネットアクセスを伴う操作をする。

最新のDockerクライアントであれば上記のユーザのDockerクライアントの設定に基づいて、HTTPS_PROXYの環境変数を渡してくれるようになっている。

昔は`docker build --build-arg HTTPS_PROXY=...` とすることもあったが、これはビルドのメタデータに記録されてしまうため、通常はNG。プロキシに関する設定が漏れてもいいなら別。

決してDockerfileに書かないこと。

### Docker run時（コンテナ内）

コンテナ実行中もプロキシを使わないと外にアクセスできない場合がある。こちらも同様に以下のようにする必要がある。

-  `docker run -e HTTPS_PROXY=...` と環境変数で渡す
- ユーザのDockerクライアントの設定

手元で動かすならユーザのDockerクライアントの設定が効くので意識する。

また通常は動作環境ではプロキシを設定してはダメなことが多いのであまり意識はしないかもしれないが、必要な場合は環境変数で渡すことを考える。

### sudoでProxyの設定(dockerと関係なし)

これはdockerとはあまり関係ないが、sudoを使った操作はしばしば行う。しかしsudoではログインシェルは起動されないので、上記の`/etc/profile.d/proxy.sh`は読み込まれず、環境変数HTTPS_PROXYが未設定になる。

sudoに渡される環境変数は決められているので現在のシェルで持っている環境変数を渡せるようにする（WSL環境なのでHTTPS_PROXYぐらいは設定できてもいいよねという理由なので、通常はsudoの設定を闇雲に緩和してはいけない）。


設定としては `env_keep` へ環境変数名を足していけばよい。

```bash

# 設定前確認
$ HTTP_PROXY=hoge sudo env | grep HTTP
(出力無し)

# sudoの設定にプロキシに関する設定を足す
sudo tee /etc/sudoers.d/80-proxy << __EOF__
Defaults env_keep += HTTP_PROXY
Defaults env_keep += HTTPS_PROXY
__EOF__

# 設定後
$ HTTP_PROXY=hoge sudo env | grep HTTP
HTTP_PROXY=hoge
```
