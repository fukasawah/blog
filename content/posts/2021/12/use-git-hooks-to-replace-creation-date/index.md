---
title: "Gitのクライアントフックを使いHugoの記事の作成日時を忘れずに置き換える"
date: "2021-12-05T12:16:24+09:00"
draft: git
toc: false
images:
tags: 
  - git
---

要約
--------

Hugoの記事データに埋め込む作成日時をコミット時の日時にしたく、Gitのフック(pre-commit)とGitattributesのフィルタを試して、フックを採用した。

セットアップを楽にしたくcloneしたらすぐ機能する状態にしたかったが、完全に手順を無くすことはできなさそう。というのも、そうしないと、cloneした後add/commitで任意コマンド実行といった脆弱性に繋がる。なので明示的に指定させるやり方を取っているんだと思う。そのため、必ずconfigに1行書き足すコマンドを実行する必要があるが、それは許容する事にした。README.mdとかに書いておけばよいでしょう。


参考
-------

- https://git-scm.com/docs/githooks
- https://git-scm.com/docs/git-config#FILES
- https://git-scm.com/book/ja/v2/Git-%E3%81%AE%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%9E%E3%82%A4%E3%82%BA-Git-%E3%83%95%E3%83%83%E3%82%AF
- https://git-scm.com/book/ja/v2/Git-%E3%81%AE%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%9E%E3%82%A4%E3%82%BA-Git-%E3%81%AE%E5%B1%9E%E6%80%A7#r_keyword_expansion

背景
--------

ここの記事を書く時に作成日時を毎回コミット前に時計を見ながらだいたいの日時に合わせていた。
ある日、ふとプログラマらしからぬ行動だなと思い、これを自動化する方法を考えた。

まず、ここの記事はhugoを使ってHTMLへ変換している。そしてHugoの機能で最終更新日時をGitのコミットログから取り出す機能があるので作成日時も取れるのではないかと考えたが、そのような機能は提供していなかった。一応、hugoの機能で[テンプレートから記事を作成する機能](https://gohugo.io/content-management/archetypes/)があり、その際に現在日時を埋め込むテンプレートを書くことができるが、記事を書き終えた日時ではないので若干ずれるし、書き始めたのはいいものの書ききれず翌日に持ち越しになることもある（そのまま日の目を見ないまま朽ちる方が多い）

なので、どうにかしてコミット時の日時になるように置き換えたい。具体的には・・・

``` yaml
---
title: "タイトル"
date: "2021-12-05T12:16:24+09:00"
```

こんなかんじで書き、コミットするときにdateの箇所がコミット時の日時になるように置き換えたい。

``` yaml
---
title: "タイトル"
date: "2021-11-11T02:44:50+09:00"
```

もっと単純にすると「該当ファイルの特定キーワードを見つけたらコミット時の日時に置き換えたい」

なお`date: .*`にマッチする行を見つけたら`date: "2021-01-23T01:23:45Z"`に置き換えるように書いてもよいが、`date: .*`だと次回もコミットするたびに上書きされてしまう。更新日時であればそれでも良いが、今回は作成日時なので作成した時の1回だけ置き換えるように`date: ""`を置き換える形とする。これなら2回目はマッチせず置き換わらない。


調査
-----

### Hookを使う（クライアントサイドフック）

<https://git-scm.com/book/ja/v2/Git-%E3%81%AE%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%9E%E3%82%A4%E3%82%BA-Git-%E3%83%95%E3%83%83%E3%82%AF>

`.git/hooks/pre-commit` を定義しておくと、commitを作成する前にこのスクリプトを実行してくれる。
しかし、`.git`配下はバージョン管理できないためここに置く運用は少しコストがある。
なので、適当に`.git_hooks`などのディレクトリを作り、git config で `core.hooksPath .git_hooks` と設定するのがよさそう。（シンボリックリンクでもいいかもしれないがWindowsではジャンクションとかになるので手順が変わってしまう）

これを利用してコミットしたファイルの内容に含まれる作成日時を書き換えたい。

手順。

``` bash
# フックスクリプトを作成。バージョン管理対象。
# .gitがあるディレクトリ(GIT_DIR)からの相対パスで作成する。core.hooksPathで指定できるパスであればなんでも良い
# GIT_DIR
# - .git
# - .git_hooks
#    - pre-commit
mkdir .git_hooks
cat << 'EOF' > ".git_hooks/pre-commit"
#!/bin/bash

TIMESTAMP=$(date --iso-8601=s)

git diff --cached --name-only | grep '^content/.*\.md$' | while read filepath; do
  if [ -f "$filepath" ] && sed -i "s/^date: \"\"/date: \"$TIMESTAMP\"/g" "$filepath"; then
    echo "(filter) rewrited $filepath"
    git add "$filepath"
  fi
done
EOF

# Linuxでは実行権限を与える必要がある
chmod +x ".git_hooks/pre-commit"

```

次にデフォルトのフックではなく、作成したフックがあるディレクトリを参照するようにする。このリポジトリにだけ効けばよいので`--local`をつける。この作業はclone後などにリポジトリ毎に最初に1回だけ行う。

``` sh
# フックスクリプトのホームを指定。.gitがあるディレクトリ(GIT_DIR)からの相対パス
# これはclone直後などに1回だけセットアップする
git config --local core.hooksPath ".git_hooks"
```

今回は、ステージした`.md`に含まれる一部の文字列を書き換えたいので、コミット対象ファイルパスを取得し、`^content/.*\.md$`にマッチするものでフィルタし、sedで書き換え、該当ファイルを編集後に再度 `git add` する。

ただし、このやり方は`git add -p`で部分的な編集を無視してしまうことになるので注意。

動作確認。

``` bash
# テストファイル作成
echo 'date: ""' > content/posts/test.md
# ステージに反映し、コミット対象に含める
git add content/posts/test.md

# ワーキングディレクトリの内容が置き換わっていないことを確認
cat "content/posts/test.md"
# コミット
git commit -m "お試し"

# ワーキングディレクトリの内容が置き換わったことを確認
cat "content/posts/test.md"
# コミットに反映されたのをログの差分から確認
git log -p HEAD

# 確認が終わったので、コミットを取り消して、addやコミット前の状態に戻す
git reset HEAD^
```

管理面では、commit作業する前に`core.hooksPath`を忘れずに設定しておく必要がある。

### gitattributesとフィルタを使う

<https://git-scm.com/book/ja/v2/Git-%E3%81%AE%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%9E%E3%82%A4%E3%82%BA-Git-%E3%81%AE%E5%B1%9E%E6%80%A7#r_keyword_expansion>

上記のリファレンスでは「キーワード展開」と目次があるがそのような機能ではなく、ファイルの内容を書き換えるフィルタを「キーワード展開」として使っている。
なお、キーワード展開はSubversionにあった「[キーワード置換](https://svnbook.red-bean.com/en/1.7/svn.advanced.props.special.keywords.html)」のようなもので、`$Author$`とあったら`$Author: fukasawah$`と置き換える。リファレンスではこれをこのフィルタの機能で行えることを示す内容にもなっている。

ステージングエリアとワーキングディレクトリを行き来するときのフィルタを書くことができる。

- git checkout (ステージングエリア→ワーキングディレクトリ、チェックアウトの直前)の時は`sumdge`フィルタを実行
- git add (ワーキングディレクトリ→ステージングエリア、ステージングの直前)の時は`clean`フィルタを実行

フィルタは、コマンド実行する形で、標準入力でデータを読み標準出力で書き出す、という形を守れば何でもよいらしい。

これが使えないか検討したが、今回は見送った。後述。

手順。

フィルタをgitのconfigとして書く。`filter.フィルタ名.clean`という形式で書いていく。 このリポジトリにだけ効けばよいので`--local`をつける。この作業はclone後などにリポジトリ毎に最初に1回だけ行う。

``` bash
git config --local filter.dater.clean 'sed "s/^date: \"\"/date: \"$(date --iso-8601=s)\"/g"'
```

.gitattributes でどのファイルがどのフィルタを使うか定義する。daterという名前を付けたのでそれを使うようにする。

``` bash
echo 'content/**/*.md filter=dater' > .gitattributes
```

動作確認。

``` bash
echo 'date: ""' >> content/posts/test.md
git add content/posts/test.md

# ステージとの差分を確認し、置き換わっているものがステージされていることを確認
git diff --cached
# ワーキングディレクトリの内容は **置き換わっていない** 事を確認
cat content/posts/test.md
```

ワーキングディレクトリの内容が置き換わっていないので、この後、修正し再度addしてしまうとまたその時の日時になってしまう。ちゃんとステージにある内容をチェックアウトすればいいのだが、忘れそうだ。
これは本意ではないので今回は採用しなかった。

### サーバーサイドフック

今回の用途には使えない気がするので詳しく調べていない。

やりたいことがファイルの中身を書き換える性質上、仮にできたとしてもサーバサイドでやってしまうとコミットIDが変わってしまい、ローカルとリモートリポジトリで差ができてしまう。
なのでそれ以外の処理に使うものだと思う。特定ブランチのPushを拒否したり、CIを回すトリガーとかに使うとか。

- <https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks#_server_side_hooks>
- GitHubの場合Enterprise版で可能
  - <https://docs.github.com/en/enterprise-server@3.2/admin/policies/enforcing-policy-with-pre-receive-hooks/creating-a-pre-receive-hook-script>
