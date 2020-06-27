---
title: " Raspberry Pi + ffmpegでライブカメラ"
date: 2020-06-25T19:24:37+09:00
draft: false
toc: true
images:
tags: 
  - Raspberry Pi
---

2019年8月ぐらいに書いて埃をかぶってたが発掘したので。


------

Rasberry Piとカメラモジュール届いたので、くっつけて起動する。

作業まとめ
------------

### Rasberry Piの作業

- https://www.raspberrypi.org/documentation/linux/usage/users.md でユーザ名とパスワードを知る
- piユーザは消さないほうが良いらしい（先駆者からの助言、ソースは忘れた...）
- なるべく省力的に動かしたいので、 Raspbian Buster Lite にした。

以下、SSH接続するまでにやったセットアップ。viがうまく動かなかったのでnanoを使っている。以下を行った。

- パスワード変更
- キーボード設定
- 無線LAN接続
- 固定IPを割り当たるようにする
- SSHサーバの起動

```
# Password変更
passwd
# リポジトリを最新化し、パッケージも最新版を導入
sudo apt update
sudo apt upgrade

# ロケールを日本語にしたかったが、language-pack-jaが無いので、意味がなかった
# sudo localectl set-locale ja_JP.UTF-8
# キーボードについて日本語配列のキーマップを使うよう変更
sudo localectl set-keymap jp106
# 一旦再起動
sudo reboot

# 無線LAN接続
# refs: https://www.raspberrypi.org/documentation/configuration/wireless/wireless-cli.md
wpa_passphrase SSID名 | sed '/#psk=/d' | sudo tee -a /etc/wpa_supplicant/wpa_supplicant.conf
# > ここでパスワードを入力

# SSIDを隠している場合、追加したnetworkブロックへssid_scan=1を追加
sudo nano /etc/wpa_supplicant/wpa_supplicant.conf

# ダウンしているはずなので起動
sudo ip link set wlan0 up

# 固定IPで割り当たるよう修正
# https://wiki.debian.org/NetworkConfiguration#Configuring_the_interface_manually にて、/etc/network/interfacesを使って割り当てるやり方が書かれているが、
# /etc/network/interfaces に以下の記述があったので、dhcpcdで行う。
#  # Please note that this file is written to be used with dhcpcd
#  # For static IP, consult /etc/dhcpcd.conf and 'man dhcpcd.conf'
# refs: https://qiita.com/momotaro98/items/fa94c0ed6e9e727fe15e
sudo nano /etc/dhcpcd.conf

# /etc/dhcpcd.confファイルの末端に以下を追加（IPやデフォルトゲートウェイ、ネームサーバは適宜変える）
interface wlan0
static ip_address=192.168.0.252
static routers=192.168.1.254
static domain_name_servers=192.168.1.254

# 変更したら、dhcpcdを再起動（以降は固定IPになる）
sudo systemctl restart dhcpcd

# SSHサーバを自動起動設定、起動
sudo systemctl enable ssh
sudo systemctl start ssh
```

ちなみにSSHはClient側のkeep-alive設定を入れて使った方がよい。60秒ぐらいで切れるので。


### カメラモジュールの有効化と撮影テスト

```
# refs: https://www.raspberrypi.org/documentation/configuration/camera.md
sudo raspi-config
# Interfacing Options -> Camera を選んで有効か無効か選ぶ。もちろん有効を選ぶ
# その後、再起動する
```

カメラで撮影を試す。撮影したものはscpか何かで取得して眺める。

```

# 検出しているか確認する。「detected=1」となっていればOK。
vcgencmd get_camera

# 撮影確認（シャッターを切るまで5秒の待ち時間がある）
raspistill -o capture.jpg
```

デバイスを一応確認。ffmpegで入力デバイスの指定に使うので。

```
v4l2-ctl --list-devices
```

```
bcm2835-codec (platform:bcm2835-codec):
        /dev/video10
        /dev/video11
        /dev/video12

mmal service 16.1 (platform:bcm2835-v4l2):
        /dev/video0
```

### ffmpegのビルド（ハードウェアエンコードを使うため）

ffmpeg入れるがaptで配布されているものではハードウェアエンコードが使えない。なのでソースを取得して再ビルドする。

- `h264_omx`は入っているが、依存が解決できず使えない。
- `--enable-omx-rpi` を付けて再ビルドする。see: https://github.com/FFmpeg/FFmpeg/blob/caabe1b4956d054bc3b077ae03a0d4205dbb843e/libavcodec/omx.c#L143

```
sudo sed -i.bak 's/#deb-src /deb-src /g' /etc/apt/sources.list
sudo apt update

sudo apt build-dep ffmpeg
apt source ffmpeg
cd ffmpeg-*
./configure --prefix=/usr --extra-version=1 --toolchain=hardened --libdir=/usr/lib/arm-linux-gnueabihf --incdir=/usr/include/arm-linux-gnueabihf --arch=arm --enable-gpl --disable-stripping --enable-avresample --disable-filter=resample --enable-avisynth --enable-gnutls --enable-ladspa --enable-libaom --enable-libass --enable-libbluray --enable-libbs2b --enable-libcaca --enable-libcdio --enable-libcodec2 --enable-libflite --enable-libfontconfig --enable-libfreetype --enable-libfribidi --enable-libgme --enable-libgsm --enable-libjack --enable-libmp3lame --enable-libmysofa --enable-libopenjpeg --enable-libopenmpt --enable-libopus --enable-libpulse --enable-librsvg --enable-librubberband --enable-libshine --enable-libsnappy --enable-libsoxr --enable-libspeex --enable-libssh --enable-libtheora --enable-libtwolame --enable-libvidstab --enable-libvorbis --enable-libvpx --enable-libwavpack --enable-libwebp --enable-libx265 --enable-libxml2 --enable-libxvid --enable-libzmq --enable-libzvbi --enable-lv2 --enable-omx --enable-openal --enable-opengl --enable-sdl2 --enable-libdc1394 --enable-libdrm --enable-libiec61883 --enable-chromaprint --enable-frei0r --enable-libx264 --enable-shared --enable-mmal --enable-omx-rpi
make -j5
sudo make install
```

バージョンを確認する

```
pi@raspberrypi:~ $ ffmpeg -version
ffmpeg version 4.1.3-1 Copyright (c) 2000-2019 the FFmpeg developers
built with gcc 8 (Raspbian 8.3.0-6+rpi1)
configuration: --prefix=/usr --extra-version=1 --toolchain=hardened --libdir=/usr/lib/arm-linux-gnueabihf --incdir=/usr/include/arm-linux-gnueabihf --arch=arm --enable-gpl --disable-stripping --enable-avresample --disable-filter=resample --enable-avisynth --enable-gnutls --enable-ladspa --enable-libaom --enable-libass --enable-libbluray --enable-libbs2b --enable-libcaca --enable-libcdio --enable-libcodec2 --enable-libflite --enable-libfontconfig --enable-libfreetype --enable-libfribidi --enable-libgme --enable-libgsm --enable-libjack --enable-libmp3lame --enable-libmysofa --enable-libopenjpeg --enable-libopenmpt --enable-libopus --enable-libpulse --enable-librsvg --enable-librubberband --enable-libshine --enable-libsnappy --enable-libsoxr --enable-libspeex --enable-libssh --enable-libtheora --enable-libtwolame --enable-libvidstab --enable-libvorbis --enable-libvpx --enable-libwavpack --enable-libwebp --enable-libx265 --enable-libxml2 --enable-libxvid --enable-libzmq --enable-libzvbi --enable-lv2 --enable-omx --enable-openal --enable-opengl --enable-sdl2 --enable-libdc1394 --enable-libdrm --enable-libiec61883 --enable-chromaprint --enable-frei0r --enable-libx264 --enable-shared --enable-mmal --enable-omx-rpi
libavutil      56. 22.100 / 56. 22.100
libavcodec     58. 35.100 / 58. 35.100
libavformat    58. 20.100 / 58. 20.100
libavdevice    58.  5.100 / 58.  5.100
libavfilter     7. 40.101 /  7. 40.101
libavresample   4.  0.  0 /  4.  0.  0
libswscale      5.  3.100 /  5.  3.100
libswresample   3.  3.100 /  3.  3.100
libpostproc    55.  3.100 / 55.  3.100
```

### Youtube Liveで配信を試す

（※2020/06/25: 最近はライブ配信の管理画面が変わったので若干違うかもしれない）

https://www.youtube.com/live_dashboard

エンコーダの設定にある`サーバー URL`と`ストリームキー`を控えておく。これは後で`サーバーURL/ストリームキー`とスラッシュで結合して使う。

とりあえず動いた感じの設定。


### GPUに割り当てるメモリサイズを変更

```
sudo nano /boot/config.txt
```

この`[all]セクションのgpu_mem`の値を256になるように書き換える

```
[all]
#dtoverlay=vc4-fkms-v3d
start_x=1
#gpu_mem=128
gpu_mem=256
```

### 起動時にモジュールを指定したオプションで読ませる

起動時にカメラのモジュールを指定したオプションで読ませるよう、所定のファイルを用意する。

`max_video_width=2592 max_video_height=1944` の部分は適宜書き換える。設定の仕方は後述。

```
echo "bcm2835-v4l2" | sudo tee /etc/modules-load.d/rpi-camera.conf
echo "options bcm2835-v4l2 max_video_width=2592 max_video_height=1944" | sudo tee /etc/modprobe.d/rpi-camera.conf
```

### ffmpegコマンド

```
ffmpeg -f v4l2 -s 1920x1080 -framerate 30 -i /dev/video0 -ar 44100 -ac 2 -acodec pcm_s16le -f s16le -ac 2 -i /dev/zero -acodec aac -ab 16k -vcodec h264_omx -preset baseline -pix_fmt yuv420p -s 1920x1080 -b:v 3000k -threads 0 -f flv "サーバーURL/ストリームキー"
```

Youtube Liveでは無音でも/dev/zeroを指定しないとダメだった。省略できなさそう。


トラブルシューティング
-------------------------


### 配信のFPSを上がらない問題


最初、適当にffmpegを実行しただけでは、FPSが出ない状態でカクカクになってしまった。
入力が1920x1080だと5fpsと低い値に、1280x720は22fpsでちょっとマシになったがこれ以上でない状態だった。


この現象で調べてみると以下のフォーラムを見つける。

https://www.raspberrypi.org/forums/viewtopic.php?t=190220

使えるフォーマットでベンチマークを取れるようなのでそれで見てみる。

```
# オプションなしでモジュール読み込み
sudo modprobe -r bcm2835-v4l2
sudo modprobe bcm2835-v4l2

# フォーマットの一覧
v4l2-ctl --list-formats

# 各フォーマットのベンチマーク
for i in `seq  0 $(($(v4l2-ctl --list-formats | wc -l) - 4 ))`; do
  echo ""
  echo "--- $i ---";
  v4l2-ctl -v width=1920,height=1080,pixelformat=$i;
  timeout 5 v4l2-ctl --stream-mmap=3 --stream-to=/dev/null --stream-count=100;
done
```

他は5fps程度だが、MJPGやH264を使うときだけ確かに30fps出ることがわかった。これをそのまま取り込めないかな？と設定をいじる。

input_formatをmjpegにしたら配信は出来たけど、FPSが3でCPU使用率が25%でちょっと使い物にならない。（4CPUと認識しているので1CPUを使い切っている感じ）

```
ffmpeg -f v4l2 -input_format mjpeg -s 1920x1080 -framerate 30 -i /dev/video0 -ar 44100 -ac 2 -acodec pcm_s16le -f s16le -ac 2 -i /dev/zero -acodec aac -ab 16k -vcodec h264_omx -preset baseline -pix_fmt yuv420p -s 1920x1080 -b:v 3000k -threads 0 -f flv "サーバー URL/ストリームキー"
```

入力をh264にしてみる。30fpsだとプログラムが死んだので15fpsに。配信できなくはないがCPU使用率が90%になってしまい非常に辛い様子だった。

```
ffmpeg -f v4l2 -input_format h264 -s 1920x1080 -framerate 15 -i /dev/video0 -ar 44100 -ac 2 -acodec pcm_s16le -f s16le -ac 2 -i /dev/zero -acodec aac -ab 16k -vcodec h264_omx -preset baseline -pix_fmt yuv420p -s 1920x1080 -b:v 3000k -threads 0 -f flv "サーバー URL/ストリームキー"
```

他の方法を探ると以下のような情報を見つける。

https://wiki.archlinux.jp/index.php/Raspberry_Pi#Raspberry_Pi_%E3%82%AB%E3%83%A1%E3%83%A9%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB

> デフォルトでは V4L2 ドライバーを使って録画できる動画の解像度は 1280x720 が最大です。それ以上にしようとすると動画が 4 fps 以下にまで落ち込みます。

この現象が本質っぽい。以下のようにしてオプションを与えてモジュールを有効化しなおす。

カーネルのモジュールのオプションはこのコマンドで再起動なしで変更できるのでこれで試行錯誤できる。（が、起動時はオプション無しで起動するようなので後述）

```
sudo modprobe -r bcm2835-v4l2
sudo modprobe bcm2835-v4l2 max_video_width=2592 max_video_height=1944
```

なぜこれが影響するのかわからないがとりあえず設定してみる。設定をするとGPUメモリが少なすぎることで以下のようなエラーが出て使えなくなる。

```
[video4linux2,v4l2 @ 0x1fd5400] ioctl(VIDIOC_STREAMON): Operation not permitted
/dev/video0: Operation not permitted
```

```
[h264_omx @ 0x17345b0] Using OMX.broadcom.video_encode
[h264_omx @ 0x17345b0] OMX error 80001000
[h264_omx @ 0x17345b0] err 80001000 (-2147479552) on line 561
Error initializing output stream 0:0 -- Error while opening encoder for output stream #0:0 - maybe incorrect parameters such as bit_rate, rate, width or height
```

なので、gpu_memを256MBぐらい割り当てる。

```
sudo nano /boot/config.txt
```

`[all]セクションのgpu_mem`の値を256に書き換える。再起動しないと反映されない。

```
[all]
#dtoverlay=vc4-fkms-v3d
start_x=1
#gpu_mem=128
gpu_mem=256
```


起動時にカーネルモジュールを指定したオプションで実行するよう、所定のファイルを用意する。

```
echo "bcm2835-v4l2" | sudo tee /etc/modules-load.d/rpi-camera.conf
echo "options bcm2835-v4l2 max_video_width=2592 max_video_height=1944" | sudo tee /etc/modprobe.d/rpi-camera.conf
```

再起動し確かめてみる。

```
ffmpeg -f v4l2 -input_format yuv444p -s 1920x1080 -framerate 30 -i /dev/video0 \
  -ar 44100 -ac 2 -acodec pcm_s16le -f s16le -ac 2 -i /dev/zero \
  -acodec aac -ab 16k -vcodec h264_omx -preset baseline -pix_fmt yuv420p -s 1920x1080 -b:v 4000k -threads 0 -f flv "サーバー URL/ストリームキー"
```

これで28fps付近で安定するようになったし、CPU使用率も5%ぐらいととても余裕ができた。

### カメラモジュールのオプションについて

入力に合わせればいいじゃん、と`max_video_width=1920 max_video_height=1080`にすると性能が落ち込んだり、一部フォーマットが実行できなくなったりした。どうやら単純に取り込みたいサイズを指定するのではなく、カメラによって設定を合わせる必要があるらしい。

参考にしたWikiでは`max_video_width=3240 max_video_height=2464`となっているが、これは800万画素(3240x2464)の設定なので、ここはカメラによって変わる。

分からない場合は`ffmpeg -f video4linux2 -list_formats all -i /dev/video0`等から見ることができる模様。

```
[video4linux2,v4l2 @ 0x1cdb1c0] Raw       :     yuv420p :     Planar YUV 4:2:0 : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Raw       :     yuyv422 :           YUYV 4:2:2 : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Raw       :       rgb24 :     24-bit RGB 8-8-8 : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Compressed:       mjpeg :            JFIF JPEG : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Compressed:        h264 :                H.264 : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Compressed:       mjpeg :          Motion-JPEG : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Raw       : Unsupported :           YVYU 4:2:2 : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Raw       : Unsupported :           VYUY 4:2:2 : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Raw       :     uyvy422 :           UYVY 4:2:2 : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Raw       :        nv12 :         Y/CbCr 4:2:0 : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Raw       :       bgr24 :     24-bit BGR 8-8-8 : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Raw       :     yuv420p :     Planar YVU 4:2:0 : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Raw       : Unsupported :         Y/CrCb 4:2:0 : {32-2592, 2}x{32-1944, 2}
[video4linux2,v4l2 @ 0x1cdb1c0] Raw       :        bgr0 : 32-bit BGRA/X 8-8-8-8 : {32-2592, 2}x{32-1944, 2}

```

`{32-2592, 2}x{32-1944, 2}` とあるので、最大2592x1944となる。


