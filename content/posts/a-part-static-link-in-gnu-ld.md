---
title: "GNU ldで一部をスタティックリンクにする"
date: 2019-01-07T03:15:17+09:00
draft: false
---

tl;dr
-------------------

`gcc`なら`-Wl,...`でリンク時のオプション(==`ld`コマンドのオプション)を渡せる。オプションが複数ある場合はカンマで繋げる。

`ld`のオプションで動的(`-Bdynamic`)と静的(`-Bstatic`)を選ぶことができ、これは混在させることができる。

例: glibc以外をstatic linkしたい

```
g++ -o a.out main.o -static-libgcc -static-libstdc++ -Wl,-Bdynamic,-lc,-ldl,-lpthread,-Bstatic,-lboost_program_options,-lboost_filesystem,-lboost_system,-lssl,-lcrypto,-lz
```

`-lc,-ldl,-lpthread`あたりがglibcのライブラリ。


背景
--------------------

時代はコンテナや！シングルバイナリのほうが扱い楽やで！！「実行する環境によっては～」なんて考える必要なくなるで！！

という雑な認識で、static linkしていくぞという感じです。詳細は伏せますが、C++でBoost等を扱ってるネットワークアプリケーションです。

最初は軽くググって`-static`とか`-static-libgcc -static-libstdc++`辺りをつけておけばそうなるんでしょ？と思っていて、以下のようにやっていた。

```
# g++ -o a.out main.o -lboost_program_options -lboost_filesystem -lboost_system -lpthread -lssl -lcrypto -lz -ldl -static -static-libstdc

...中略
warning: Using 'getaddrinfo' in statically linked applications requires at runtime the shared libraries from the glibc version used for linking
warning: Using 'gethostbyname' in statically linked applications requires at runtime the shared libraries from the glibc version used for linking
...中略

# ldd a.out
        not a dynamic executable
```

警告が出ながらも実行ファイルが出来てしまう。私は愚かなので「これでうまく動くぞ！」と思った。
しかし、いざコンテナにコピーして実行してみると、通信時に名前解決が出来ずハマった。具体的には、docker-composeで実行した時にコンテナの名前解決ができなかった。
名前解決できていないようなので「/etc/resolve.confかなぁ？」とか「でも中に入ってcurlは実行できたから違いそうだし・・・」とか1日中悩んでた。警告嫁。

原因はglibcのNSS回りだった。


### glibcのNSSの壁

glibcをstatic linkすると、Name Service Switch(NSS)の都合で名前解決に支障が出るバイナリになる。

調べてみると、[glibcはNSSの都合上、static linkは推奨していないようだ。](https://sourceware.org/glibc/wiki/FAQ#Even_statically_linked_programs_need_some_shared_libraries_which_is_not_acceptable_for_me.__What_can_I_do.3F)
（glibcはNSSはリンク時ではなく実行時に解決できるほうが良いとしている。ただ、これでstatic linkは事実上出来ないようなものなので、static linkしようとしたら警告じゃなくてエラーにしてほしい・・・）

NSSをstatic linkで扱う機能はオプショナルで、Fedoraのyumで入れられるglibcパッケージは対応していない。

なので、取れる手は以下の3つらしい。

1. glibcを動的リンクして使う（従来通り）
2. glibcを`--enable-static-nss`をつけてrebuildし、必要なサービスを静的リンクする
3. glibcを辞めてlibc互換ライブラリに置き換える（musl等）

今回は(1)の方法を取った。

でも、それだけなら`-ldl -static -static-libstdc`を外して動的リンクすればよい。

これでは何も新しい事をしていない。なので、glibc以外をstatic linkにしようと考えた。

本来の目的のシングルバイナリ化をするなら(2)と(3)なので、そのうち試したい所...


### リンカーとは

ふわっと理解しているつもりで説明すると、C言語、C++ではコンパイル→リンクという流れで成果物（実行ファイル・ライブラリ等）が出来上がる。

例えば「ライブラリの関数を呼ぼうとしたときに、その関数がどこにあるのか？」というのを、コンパイル後に行っている「リンク」のタイミングで解決している。
具体例で言えば、printfはおまじない的に`#include <stdio.h>`と書いていると使えるが、じゃあ実際にprintfに該当する処理はどこにあるんだ？というのを「リンク」のタイミングで解決する。

「リンク」の作業を行うのが「リンカー」でリンクのやり方は大きく分けてDynamic LinkとStatic Linkがある。

Dynamic Linkなら、ライブラリが実在すればそれでよしとして、成果物に含まれている「実行時に読み込むライブラリ一覧」みたいなものにライブラリ名を記録しておき、実行時に読みに行くような形を取る。成果物には実行時に読むという処理は含まれておらず、`ld.so`等の「プログラム実行時にライブラリを探すプログラム（動的リンカー）」の力を借りる必要がある。（ちなみにどの動的リンカーを使うかは成果物に含まれている情報から読み取る）

Static Linkなら、ライブラリが持つ実際の処理(関数等)を探して成果物に含める。

実際はもっと複雑な事をやってると思いますが、多分あってるんじゃないかな・・・


### リンカーのオプション

`gcc`はコンパイルのあと、必要であればリンクも（`ld`コマンドを呼び出して）行う。
この時に`ld`コマンドのオプションを`-Wl,[OPTION],[OPTION],...`という感じに渡せる。オプションが複数ある場合はカンマ(`,`)で繋げる。

`ld`のオプションで動的(`-Bdynamic`)と静的(`-Bstatic`)を選ぶことができ、混在させることができる。

`ld`の実行内容が気になる場合、`-v,--verbose`辺りをつけると少し見えます。どうやってライブラリを探しているのか等が気になる場合につける。

例: glibc以外をstatic linkしたい

```
g++ -o a.out main.o -static-libgcc -static-libstdc++ -Wl,-Bdynamic,-lc,-ldl,-lpthread,-Bstatic,-lboost_program_options,-lboost_filesystem,-lboost_system,-lssl,-lcrypto,-lz
```

`-lc,-ldl,-lpthread`辺りはglibcに含まれるライブラリでべったり依存しているので、ここら辺は動的リンクにします。


### 成果


通常時

```
# g++ -o a.out main.o -Wl,-lpthread,-lboost_program_options,-lboost_filesystem,-lboost_system,-lssl,-lcrypto,-lz
# ldd a.out | sort
        /lib64/ld-linux-x86-64.so.2 (0x00007f9f7d619000)
        libboost_filesystem.so.1.66.0 => /lib64/libboost_filesystem.so.1.66.0 (0x00007f9f7d54d000)
        libboost_program_options.so.1.66.0 => /lib64/libboost_program_options.so.1.66.0 (0x00007f9f7d56a000)
        libboost_system.so.1.66.0 => /lib64/libboost_system.so.1.66.0 (0x00007f9f7d546000)
        libcrypto.so.1.1 => /lib64/libcrypto.so.1.1 (0x00007f9f7d1d6000)
        libc.so.6 => /lib64/libc.so.6 (0x00007f9f7ccbd000)
        libdl.so.2 => /lib64/libdl.so.2 (0x00007f9f7ccab000)
        libgcc_s.so.1 => /lib64/libgcc_s.so.1 (0x00007f9f7ce83000)
        libm.so.6 => /lib64/libm.so.6 (0x00007f9f7ce9e000)
        libpthread.so.0 => /lib64/libpthread.so.0 (0x00007f9f7d5ed000)
        librt.so.1 => /lib64/librt.so.1 (0x00007f9f7ccb3000)
        libssl.so.1.1 => /lib64/libssl.so.1.1 (0x00007f9f7d4b0000)
        libstdc++.so.6 => /lib64/libstdc++.so.6 (0x00007f9f7d022000)
        libz.so.1 => /lib64/libz.so.1 (0x00007f9f7d1ba000)
        linux-vdso.so.1 (0x00007ffdf87b5000)
```

一部を静的リンク

```
# g++ -o a.out main.o -static-libgcc -static-libstdc++ -Wl,-Bdynamic,-lc,-ldl,-lpthread,-Bstatic,-lboost_program_options,-lboost_filesystem,-lboost_system,-lssl,-lcrypto,-lz
# ldd a.out | sort
        /lib64/ld-linux-x86-64.so.2 (0x00007fa5d1ed4000)
        libc.so.6 => /lib64/libc.so.6 (0x00007fa5d1d04000)
        libdl.so.2 => /lib64/libdl.so.2 (0x00007fa5d1cfe000)
        libm.so.6 => /lib64/libm.so.6 (0x00007fa5d1b58000)
        libpthread.so.0 => /lib64/libpthread.so.0 (0x00007fa5d1cdc000)
        linux-vdso.so.1 (0x00007ffcf53cd000)
```

boost等が消えて、4つのライブラリにしか依存していないように見える。良いですね。

### （おまけ）NSSを考慮する

が、glibcのNSSの都合で、一部はリンク時ではなく実行時に解決される。実行時のものはlddでも表示されない。

ソースコードを[`nss/nsswitch.c`のこの辺り](https://sourceware.org/git/?p=glibc.git;a=blob;f=nss/nsswitch.c;h=ee46f24424bc1ca2085f4fd7f1060ae330ee5bae;hb=437faa9675dd916ac7b239d4584b932a11fbb984#l363)で`/etc/nsswitch.conf`に書かれたサービス名(dns等)を使って、ライブラリ名を構築して、ライブラリを読みに行こうとしているのがわかる。

なので、もし、`/etc/nsswitch.conf`の内容が以下の場合、

```
hosts: files dns
```

さらに以下を加える必要がある。

- /lib64/libnss_files-2.28.so 
- /lib64/libnss_dns-2.28.so
- /lib64/libresolv-2.28.so (dnsの依存)

もちろん、libresolvといった依存ライブラリがあるモノは一緒に含めないといけない。
あと、ファイルパスは実行環境やglibcのバージョンなどで変わるはずなので、`ldd /lib64/libnss_dns-2.28.so`等で、いい感じに見極めてください。

依存ライブラリも洗い出せたのでコンテナに持ち込むぞー！となったが、これもまた苦労した。


### （おまけ）コンテナを作る

単純にライブラリをコピーしてお終いというわけにはいかなかった。

持ち込み先のコンテナに動的リンカーがない。そんな事があるのか？と思ったらコンテナ界隈では良く知られているらしい。

busyboxはそもそも`ld.so`が無い。(これは動的リンクが必要なプログラムは実行できない・・・ということ？)

alpineはmuslベースなので`ld-musl-x86_64.so.1`で`ld-linux-x86-64.so.2`が無い。

alpineで`apk add libc6-compat` すればよい、という記事をいくつか見かけて試したが、
これはただ`ld-musl-x86_64.so.1`へのシンボリックリンクを作るだけであり、私の環境では実行時に以下のようなエラーになってしまう。

```
/ # /path/to/a.out
Error relocating /path/to/a.out: __fprintf_chk: symbol not found
Error relocating /path/to/a.out: makecontext: symbol not found
Error relocating /path/to/a.out: setcontext: symbol not found
Error relocating /path/to/a.out: __register_atfork: symbol not found
Error relocating /path/to/a.out: __memcpy_chk: symbol not found
Error relocating /path/to/a.out: __strcat_chk: symbol not found
Error relocating /path/to/a.out: secure_getenv: symbol not found
Error relocating /path/to/a.out: __vfprintf_chk: symbol not found
Error relocating /path/to/a.out: __memset_chk: symbol not found
Error relocating /path/to/a.out: getcontext: symbol not found
Error relocating /path/to/a.out: __sprintf_chk: symbol not found
```

`__memset_chk`辺りはglibc固有の実装なので、そんなものは当然muslにはない。

[alpine-glibc](https://hub.docker.com/r/frolvlad/alpine-glibc/)というイメージを使う手もあるが、オフィシャルではないので使用は避けたい。


色々悩んだけど、そもそもビルド環境からコピーすれば良いよね、という考えに至った。

ということで、dockerfileはこんな感じ。

``` dockerfile
FROM mydev:latest as build

# ... プログラムのビルドを行う

FROM busybox
# nsswitch.confを作る(glibcがこれを読みに来る)
RUN echo 'hosts: files dns' >> /etc/nsswitch.conf

# ld-linux-x86-64.so.2とプログラムの依存ライブラリ
COPY --from=build /lib64/ld-linux-x86-64.so.2 /lib64/libc.so.6 /lib64/libdl.so.2 /lib64/libm.so.6 /lib64/libpthread.so.0 /lib64

# glibcが/etc/nsswitch.confを参照して利用する依存ライブラリ
COPY --from=build /lib64/libresolv-2.28.so /lib64/lib/libresolv.so.2
COPY --from=build /lib64/libnss_dns-2.28.so /lib64/libnss_dns.so.2
COPY --from=build /lib64/libnss_files-2.28.so /lib64/libnss_files.so.2

# プログラム
COPY --from=build /usr/local/src/a.out /usr/local/bin/a.out

CMD ["/usr/local/bin/a.out"]
```

蛇足だが、プログラム内部で`ld.so`の場所を持っているので、コマンドを実行するとちゃんと`ld.so`を使って動的リンクを行ってくれる。(lddで`/lib64/ld-linux-x86-64.so.2`と出るなら、これを動的リンカーに使おうとする。この場所に動的リンカーが無い場合はエラーになる)
また、今回のように目的の場所に無い場合は、直接`ld.so`からプログラムを実行することもできます。もし`/lib64`ではなく、`/usr/local/lib`に全部配置した場合はこんな感じ。

```
CMD ["/usr/local/lib/ld-linux-x86-64.so.2", "--inhibit-cache", "--library-path", "/usr/local/lib", "/usr/local/bin/a.out"]
```



### 一部とか中途半端

はい・・・

`--enable-static-nss`を入れたglibcでstatic linkしたりmuslの置き換えもやってみたい・・・特にmuslはlibstdc++のリビルドが必要そうなのでしんどそう。

glibcはLGPLなので、Static Linkすると都合悪い場合もあるはずなので、使えるのではないかなと思う。



static化で遭遇したエラーたち
----------------------------

### `cannot find -lgcc_s`

```
/usr/bin/ld: cannot find -lgcc_s
/usr/bin/ld: cannot find -lgcc_s
```

g++オプションに`-static-libgcc`をつける。

### `undefined reference to symbol '__tls_get_addr@@GLIBC_2.3'`

```
/usr/bin/ld: /usr/lib/gcc/x86_64-redhat-linux/8/libstdc++.a(eh_globals.o): undefined reference to symbol '__tls_get_addr@@GLIBC_2.3'
/usr/bin/ld: //lib64/ld-linux-x86-64.so.2: error adding symbols: DSO missing from command line
collect2: error: ld returned 1 exit status
```

g++オプションに`-static-libstdc++`をつける。

### `undefined reference to 'dlopen'`

```
/usr/bin/ld: /usr/lib/gcc/x86_64-redhat-linux/8/../../../../lib64/libcrypto.a(fips.o): in function `verify_checksums':
(.text+0x524): undefined reference to `dlopen'
/usr/bin/ld: (.text+0x53f): undefined reference to `dlsym'
/usr/bin/ld: (.text+0x553): undefined reference to `dladdr'
/usr/bin/ld: (.text+0x562): undefined reference to `dlclose'
/usr/bin/ld: (.text+0x5b2): undefined reference to `dlclose'
/usr/bin/ld: (.text+0x62c): undefined reference to `dlclose'

```
dlopen等はライブラリを実行時に読み込む仕組み。
リンカーオプションに`-ldl`をつける。これは動的リンクにしないといけない。静的リンクしようとすると、以下のようになりうまくいかない。

```

/usr/bin/ld: /usr/lib/gcc/x86_64-redhat-linux/8/../../../../lib64/libcrypto.a(fips.o): in function `verify_checksums':
(.text+0x524): warning: Using 'dlopen' in statically linked applications requires at runtime the shared libraries from the glibc version used for linking
/usr/bin/ld: /usr/lib/gcc/x86_64-redhat-linux/8/../../../../lib64/libdl.a(dlopen.o): in function `dlopen':
(.text+0x9): undefined reference to `__dlopen'
/usr/bin/ld: /usr/lib/gcc/x86_64-redhat-linux/8/../../../../lib64/libdl.a(dlclose.o): in function `dlclose':
(.text+0x5): undefined reference to `__dlclose'
/usr/bin/ld: /usr/lib/gcc/x86_64-redhat-linux/8/../../../../lib64/libdl.a(dlsym.o): in function `dlsym':
(.text+0x9): undefined reference to `__dlsym'
/usr/bin/ld: /usr/lib/gcc/x86_64-redhat-linux/8/../../../../lib64/libdl.a(dlerror.o): in function `dlerror':
(.text+0x5): undefined reference to `__dlerror'
/usr/bin/ld: /usr/lib/gcc/x86_64-redhat-linux/8/../../../../lib64/libdl.a(dladdr.o): in function `dladdr':
(.text+0x5): undefined reference to `__dladdr'
```

`libdl.a`ではdlopenなどは定義されているが、内部で使われている`__dlopen`などはglibcに依存している。
なので、glibcをstatic linkするか、同バージョンのglibcライブラリを合わせて持ち込む必要がある。


ここらでglibcがLGPLと知ったり、NSS周りの扱いを知ったり、muslの置き換えがうまくいかなかったり、等々を理由に「めんどくさそう」と判断して、一部static linkを目指すことにした。