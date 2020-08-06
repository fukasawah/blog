---
title: "GitHub Actionsを使ってHugoのコンテンツをデプロイ"
date: 2020-04-02T09:34:44+09:00
draft: false
toc: false
images:
tags: 
  - Hugo
---

GitHub Actionsを使ってHugoをデプロイするのは以下を行えば簡単にできる。

https://github.com/peaceiris/actions-hugo

外部リポジトリにPushするためのデプロイキーの設定をした。この手順もドキュメントにちゃんと書いてあった。

- https://github.com/peaceiris/actions-gh-pages#%EF%B8%8F-deploy_key
- https://github.com/peaceiris/actions-gh-pages#%EF%B8%8F-create-ssh-deploy-key

というわけで、ワークフローはこんな感じになった。

https://github.com/fukasawah/blog/blob/master/.github/workflows/gh-pages.yml

以下、ハマったところ。

### タイムゾーンが違う

Actionsでデプロイされた内容を見てみたら表示されてる日時のタイムゾーンがUTCになってた。

原因はGitHub Actionsで動いているコンテナが日本のタイムゾーンではないため。考えてみれば当たり前という感じだった。

以下を参考に `TZ` 環境変数を設定して実行するようにした。

https://discourse.gohugo.io/t/dateformat-force-a-specific-timezone/9860/2

``` yml
      - name: Build
        run: TZ=Asia/Tokyo hugo --minify
```

### action@checkoutが `--depth 1` を使っている

enableGitInfoでコミット時の情報を使う機能が機能しなかった。

原因はaction@checkoutが `--depth 1` を使ってfetchしていたため。Hugoから見たら最新のコミットの日時しかないように見えてしまう。

対応としては、`fetch-depth: 0` で全部のコミットをとる必要があった。

``` yml
      - uses: actions/checkout@v2
        with:
          submodules: true
          fetch-depth: 0 # for enableGitInfo
```

これ、チューニングオプションなんだから、デフォルトにするのやめてほしい。

追記: 気づいたらactions-hugoのREADME.mdに書かれてた([commit](https://github.com/peaceiris/actions-hugo/commit/c55729fbd130889796da92d7859188dbbad0e32a))。これで詰まる人が減りますねえ。


