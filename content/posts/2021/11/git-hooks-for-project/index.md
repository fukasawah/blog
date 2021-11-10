---
title: "Git Hooks for Project"
date: 2021-11-11T02:48:52+09:00
draft: true
toc: false
images:
tags: 
  - git
---


TODO: 
たぶん、完全にゼロコンフィグにすることはできなさそう。そうしないと、cloneした後add/commitで任意コマンド実行に繋がる何かになってしまう。
なので明示的に指定させるやり方を取っているんだと思うが、その辺りのソースをしらべる。
TODO: 

要約
--------

- やりたいこと: 記事作成完了からデプロイするまでの間に作成日時を設定したい
- やること
  - 1.
  - 2. git config の`core.hooksPath` の設定

```
git config core.hooksPath .config/git/hooks
```

参考
-------

https://git-scm.com/docs/githooks
https://git-scm.com/docs/git-config#FILES



### 背景

記事を書く時に日時情報を毎回コミット前に時計を見ながら合わせていた。これは記事の作成日時を設定するためだった。
ある日、ふとプログラマらしからぬ行動だなと思い、これを自動化する方法を考えた。

まずこの記事はhugoを使ってHTMLへ変換している。そしてHugoの機能で最終更新日時をGitのコミットログから取り出す機能があるので作成日時も取れるのではないかと考えたが、そのような機能は提供していなかった。

そもそも作成は最初の1度しか起きないのでコミット直前にsed等で置き換えればよい。しかしそれを実行し忘れそうだ。
コミット時に確実に実行させるにはフックを使うしかない。しかし、pre-commitフックは`.git/hooks/pre-commit`を作成しておく必要がある。
この設定自体はバージョン管理に含めることはできない。なので初回のセットアップで忘れずに`.git/hooks/pre-commit`を作成する作業が発生する。
今回は個人のBlogなので自分が忘れなければいいが、チームで開発する場合にこれはどうなんだろう。セットアップし忘れたまま作業する人が出るのでは？セットアップがちゃんとできているかチェックするプログラムを書くか？

Subversionには keyword substitution という機能がありenable-auto-propsを有効にした上でつかえば、`$Author$`や`$Author: foo$`と記述されているテキストファイルに私(fukasawah)がコミットを加えた場合に`$Author: fukasawah$`に置き換わるといったもの。ただドキュメント用の機能という感じで、結局この値をパースして使うようなことをしないといけない（はず）

もっといいアプローチはないだろうか？

### 要件

- コミット時にテキストファイル内に含まれるキーワードを実行時の値(dateコマンドの結果を使う等)で置き換えたい
- 同じリポジトリで管理し、使われるようにしたい（cloneしたら勝手に使われる）
- このためだけに余計なものは入れたくない
- 非可逆でよい（sedで置き換えるようなイメージで、SVNのKeyword Substitutionのような何度も実行できる形でなくてよい）
- 置き換えに必要なコマンドや環境は整っている前提でよい（git,date,sedコマンドは使えるという感じ）
- Git コマンド(CLI)のみを想定（GUIとかはもしかしたらバイパスするような気がする）


調査
-----

### Hookを使う

`.git/hooks/pre-commit` を定義しておくと、commitを作成する前にこのスクリプトを実行してくれる。
しかし、`.git`配下はバージョン管理できないので、git config で `core.hooksPath` を設定するのがよさそう。

``` bash
# フックスクリプトを作成(バージョン管理対象)
# .gitがあるディレクトリ(GIT_DIR)からの相対パスで作成する。名前はなんでも良い
# GIT_DIR
# - .git
# - .git_hooks
#    - pre-commit
mkdir .git_hooks
cat << 'EOF' > ".git_hooks/pre-commit"
#!/bin/bash
echo "pre-commit-hook"
printf "'%s', " "$0" "$@"

# exit 0以外を返すとcommitしない。
# exit 1を返しているこのコードだとcommitができなくなる
exit 1
EOF

# Linuxでは実行権限を与える必要がある
chmod +x ".git_hooks/pre-commit"
# フックスクリプトのホームを指定。.gitがあるディレクトリ(GIT_DIR)からの相対パス
git config --local core.hooksPath ".git_hooks"
```

ただ、ステージした内容を書き換える

``` sh
#!/bin/bash
echo "pre-commit-hook"
printf "'%s', " "$0" "$@"

_TIMESTAMP=$(date --iso-8601=s)

git diff --cached --name-only | while read filepath; do
  echo "$filepath"
  sed -i "s/\${_TIMESTAMP}/$_TIMESTAMP/" "$filepath"
  git add "$filepath"
done
```

hugoのMarkdownのテンプレートは以下のようにする。

``` yaml
---
title: "Git Hooks for Project"
date: ${_TIMESTAMP}
```

### キーワード展開

採用


https://git-scm.com/book/en/v2/Customizing-Git-Git-Attributes#_keyword_expansion


### サーバーサイドフック

- https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks#_server_side_hooks
- サーバ側で着信
- GitHubの場合Enterprise版で可能
  - https://docs.github.com/en/enterprise-server@3.2/admin/policies/enforcing-policy-with-pre-receive-hooks/creating-a-pre-receive-hook-script


