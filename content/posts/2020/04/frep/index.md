---
title: "テンプレートエンジン frep"
date: 2020-04-08T01:41:16+09:00
draft: false
toc: false
images:
tags: 
  - Software
---

frepというGolang製のテンプレートエンジンを見つけた。

https://github.com/subchen/frep

環境変数や引数、設定ファイルを元にテンプレート処理を行うというもの。テンプレート処理にはGolangのtext/templateを採用しているので、仕様もわかりやすい。

Windows/Linuxで動作して一貫したテンプレートエンジンが欲しいなぁと思っていて、これは割といい感じがする。

単純な変数を定数に置き換えるぐらいならenvsubstでもよいのだけど、やっぱりif文ぐらいは書きたくなることが多い。
