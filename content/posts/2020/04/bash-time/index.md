---
title: "Bashのtimeは複合コマンドにも使える"
date: 2020-04-14T17:03:33+09:00
draft: false
toc: false
images:
tags: 
  - Bash
---


bashのtimeは実行に要した時間がわかる。

``` bash
$ time seq 1 100
1
...
100

real    0m0.045s
user    0m0.000s
sys     0m0.015s
```

で、これはコマンドでもビルトインコマンドでもなく、パイプラインで使う「予約語」であるらしく、timeの後ろには任意の**bashのコマンド**が書ける。

https://linuxjm.osdn.jp/html/GNU_bash/man1/bash.1.html#lbAM


例えば２つ以上のコマンドの実行にかかった時間が知りたいときを考える。

timeがもし「普通のコマンド」であれば多分こうするしかない。

``` bash
time bash -c 'seq 1 100 | sed "s#\(.*\)#\1.dat#"'
# もしくは１回ファイルに書き出してから測る
echo 'seq 1 100 | sed "s#\(.*\)#\1.dat#"' > test.sh
time bash test.sh
```

しかし、timeの後ろにはbashの複合コマンドも使えるのでこう書ける。

``` bash
# サブシェルで実行
time (seq 1 100 | sed "s#\(.*\)#\1.dat#")

# 同シェルで実行（末尾のセミコロンの付け忘れに注意）
time { seq 1 100 | sed "s#\(.*\)#\1.dat#"; }

# forで
time for i in `seq 1 100`; do
  echo "$i.dat"
done

# whileも
time while read line ; do
  echo "$line.dat"
done < <(seq 1 100)

```

これで思いつきでたくさんコマンドを組み合わせた場合でも簡単に時間が測れる。

bashの予約語のtimeの話なので、`/usr/bin/time` を使う方法では当然ダメ。

