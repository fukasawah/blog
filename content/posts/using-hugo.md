---
title: "Using HUGO"
date: 2018-12-24T04:48:16+09:00
draft: false
featuredImg: ""
tags: 
  - HUGO
---

HUGO
--------------

HUGO - https://gohugo.io/

静的サイトジェネレータ。Markdownを書けばHTMLを作ってくれる。

また、記事の公開には、[Github Pages](https://pages.github.com/)を使う。Netlifyも試したいが、こちらの方が手軽そうだったので。

導入のモチベーションとしては、簡単なBlogがほしい、広告嫌、という場合に、これならいい感じに公開できるかも、と思い使い始めた。

導入
--------------

### HUGOのダウンロード

Windowsの場合、[0.52でcachedir周りのバグがあるらしく使えない模様](https://discourse.gohugo.io/t/error-failed-to-create-file-caches-from-configuration-file-exists/15635/18)
そのため、0.51を使用した。

1個のバイナリファイルになっているのでそのまま扱う。
PATHは適当に通す。

### サイトを作る

```
hugo new site blog
```

以降は作成したサイトのディレクトリで作業をする

```
cd blog
```

### Gitで管理を始める

作ったサイトごとにGitリポジトリを作る。

```
git init
```

### テーマを決める

1から作るのは手間なので、 https://themes.gohugo.io/ を見ていい感じのを探す。今回は[hermit](https://themes.gohugo.io/hermit/)にした。

```
git submodule add -b v1.1.0 https://github.com/Track3/hermit.git themes/hermit
echo 'theme = "hermit"' >> config.toml
```

hermitはいくつか設定が必要なので、追記する。
[hermitのサンプルのconfig.toml](https://github.com/Track3/hermit/blob/master/exampleSite/config.toml)を参考に以下のようにした。

`dateform*`辺りは必須。`/posts/`のmenuもあったほうがよい。

```
cat << '__EOF__' >> config.toml
[Params]
  dateform        = "Jan 2, 2006"
  dateformShort   = "Jan 2"
  dateformNum     = "2006-01-02"
  dateformNumTime = "2006-01-02 15:04 -0700"

  homeSubtitle = "I feel like to be lazy"

  justifyContent = false

[menu]
  [[menu.main]]
    name = "Posts"
    url = "/posts/"
    weight = 10

__EOF__
```

テーマは色々設定がある場合があるため、テーマを使う場合はこの辺りを注意する（dateform当たりの設定がないせいで後述のローカル起動で失敗して困っていた）

下地はここまで。


GitHub Pages用のリポジトリを作る
-----------------

*.github.ioというリポジトリを作っておくと、[Github Pages](https://pages.github.com/)で見ることができるようになる。

このリポジトリにHTMLなどで作られたファイルを管理するだけで、Github Pagesの機能でホスティングされ、インターネット上に公開される。

今回はHUGOで出来た成果物を、このGitHub Pagesで公開するようにする。


### リポジトリを作成する

`ユーザ名.github.io`という形を取る必要がある。fukasawahというidなら`fukasawah.github.io`という感じ。

1個はcommitが無いとsubmodule登録できないので、index.html辺りを作っておく。

README.md でもよいが、その場合は後で削除する必要がある。github.ioはREADME.md > index.htmlの順でトップを表示するため。

README.mdかindex.htmlが作成できたら、`https://ユーザ名.github.io`という形でアクセスできるか一度ブラウザで確認する。

反映までタイムラグがあるので、1分ほど待って確認する。

### リポジトリをサブモジュールとして登録する

```
git submodule add https://github.com/fukasawah/ユーザ名.github.io.git public
```

### config.tomlのbaseURLを修正する

テーマによってはこの変数を元に作る場合があるので、直す。

```
baseURL = "https://ユーザ名.github.io/"
```



記事を作成
--------------

### 記事を作成

```
hugo new posts/using-hugo.md
```

`content/posts/using-hugo.md` が出来上がるので、MarkDowkで書いていく。


```
---
title: "Using HUGO"
date: 2018-12-24T04:48:16+09:00
draft: false
featuredImg: ""
tags:
  - HUGO
---

HUGO
--------------

HUGO - https://gohugo.io/

サイトジェネレータ。Markdownを書けばHTMLを作ってくれる。

```

というかんじで。最初の数行はメタ情報でなんとなく何を意味するかわかるはず。

- `draft`がtrueの場合、デフォルトだと対象にならない(HTMLが生成されない)なので、適宜手でfalseにする必要がありそう。


### 表示確認

`hugo server`により、手元で簡単に表示の確認を行える。

`http://localhost:1313/` にアクセスすると見れる。

`draft:true`の記事も含めたい場合は、`hugo server -D`という形に`-D`オプションを付け足す。

なお、デフォルトで保存を検知してブラウザ側で自動リロードをかけてくれる。

### ビルドを行う

```
hugo
```

`public`ディレクトリの下に生成されたファイルが並ぶ。


### ビルドを行い、github.ioのリモートリポジトリに反映する

`hugo`を実行すると、draftになっていないものを対象に、`public`ディレクトリの下にファイルが生成される。

後は生成されたpublicの中身をcommit&pushする。
submoduleとはいえ、中身はGitリポジトリなので、普通にGitの操作でよい。

```
(
  hugo && \
  cd public && \
  git add . && \
  git commit -m "Update" && \
  git push
)
```

反映までタイムラグがあるので、その時は少し待って確認する。

良く使うはずなので、`.bash_profile`等にaliasを作っておくと良い。

```
alias hugo-publish='(hugo && cd public && git add . && git commit -m "Update" && git push)'
```

### 元の記事もローカルリポジトリにコミットする

元のMarkdownや設定が管理されていないので、このタイミングで管理する。publicも含めてしまってよい。

```
git add .
git commit -m "Update"
```

（不明点: resources配下に生成されたファイルも含まれてしまうがこれは良いのか？）

後は、必要に応じてリモートリポジトリを作りPushしておくと、他の端末からでもHUGOがあれば同じ環境を使うことができるようになる。


### おわり

これでHUGO+GitHub Pagesで簡単なBlogを書くことができるようになった。

今回の成果物は以下。

- HUGO以外の完全なコード: https://github.com/fukasawah/blog
- GitHub Pages用リポジトリ: https://github.com/fukasawah/fukasawah.github.io
- GitHub Pages: https://fukasawah.github.io


おまけ
--------------------


### 投稿に画像の貼り付けを行いたい

hugoはデフォルトで`static`配下のディレクトリとファイルを、そのまま`public`に配置する模様。

なので、`static/foo/image.jpg`とおいておけば、`![](/foo/image.jpg)`で表示ができるようになる。



また、VSCode で [Paste Imageという拡張機能](https://marketplace.visualstudio.com/items?itemName=mushan.vscode-paste-image)を使っている場合、以下の設定を行っておくと、ファイルは`static/images/Postのファイル名/タイムスタンプ.png`、Markdownには`![](/images/ファイル名/タイムスタンプ.png)`が張り付けられるようになり、良い感じになる。（絶対パスになっているので、URLの構造に注意）

設定はWorkspace毎に設定できるので、hugoを使っている環境にだけ適用したい、という事もできる。（ディレクトリのルートの`.vscode/settings.json`に書くだけ）

```
{
    "pasteImage.path": "${projectRoot}/static/images/${currentFileNameWithoutExt}",
    "pasteImage.insertPattern": "${imageSyntaxPrefix}/images/${currentFileNameWithoutExt}/${imageFileName}${imageSyntaxSuffix}"
}
```

以下は画像。貼り付けのお試し。

![](/images/using-hugo/2018-12-25-16-45-13.png)


