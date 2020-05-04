---
title: "libgit2を使ってみる"
date: 2020-05-04T19:50:31+09:00
draft: false
toc: false
images:
tags: 
  - libgit2
---

https://github.com/libgit2/libgit2

WSL2 + Ubuntu 18.04 でどんな感じに使えるか試した。


### ビルド

```
sudo apt update
sudo apt install gcc cmake libssl-dev zlib1g-dev libssh2-1-dev pkg-copnfig

git clone https://github.com/libgit2/libgit2.git
cd libgit2
git checkout v1.0.0

mkdir build && cd build
cmake ..
make -j
```

ビルドはただの趣味でお遊びなのでインストールはしない。

pkg-copnfigを入れないとlibssh2を見つけてくれなかった。[関連コミット](https://github.com/libgit2/libgit2/commit/0f62e4c7393366acd8ab0887c069d9929c358d07)


## libgit2をC言語で使う

サンプルをコピペしたりして書いた。

- https://github.com/libgit2/libgit2/tree/master/examples
- https://libgit2.org/libgit2/#v1.0.0

サンプルの内容は、gitの良くあるコマンドをlibgi2を使って模倣するサンプルらしく、examples/lg2.cを起点にサブコマンドが実装されている（gitコマンドの細かい引数までサポートしているわけではない）。

- ` git_libgit2_init()` を最初に呼ぶ（忘れるとSegmentation Faultする）
- たいていの関数は戻り値が0未満ならエラーを表現しているので必要に応じてチェックする（`git_*_free`とか`git_oid_tostr`とか例外はある）
- `git_*_free`は対応する型で呼ぶ必要がある。それ以外は動きは`free`と一緒で、NULLポインタは安全、2重開放するとSegmentation Faultになる
- `git_oid_tostr_s`の戻り値はオブジェクトIDの文字列表現で、文字列のメモリ確保してるのか？となったがスレッドローカルで持ってるとドキュメントに書いてあった。

バインディング無いとしんどいですね


## cloneするだけ

実行するとcloneするだけの簡単なもの。

``` c
#include <stdio.h>

#include <git2.h>

int main(){
	git_repository *repo;
  git_libgit2_init();

  git_clone(&repo, "https://github.com/octocat/Hello-World.git", "hello-world", NULL);

  if(repo){
    git_repository_free(repo);
  }

  return 0;
}
```

buildディレクトリにあるlibgit2を使ってビルド＆実行

```
gcc main.c -I ../include -L./ -lgit2
LD_LIBRARY_PATH=./ ./a.out
```

`sudo apt install libgit2-dev` をしていれば...と思ったが、実際に試すとubuntu 18.04では`v0.26`の時点のlibgit2らしく、`git_error_last`が存在せずコンパイルできなかった。[該当のコミット](https://github.com/libgit2/libgit2/commit/f673e232afe22eb865cdc915e55a2df6493f0fbb)

なので`giterr_last`に書き換えたうえであればコンパイルできた。

```
gcc main.c -l git2
./a.out
```


## 空のコミットを重ねるだけ（リポジトリがあればそのまま使い、無ければ作る）

コミット後にログも出す。
変なマクロを書いたけど気にしない。

``` c
#include <stdio.h>

#include <git2.h>

#define ASSERT(expr) do { \
  int ret = (expr); \
  if (ret != 0) { \
    fprintf(stderr, "'" #expr "' was not return of zero (ret=%d).\n", ret); \
    const git_error *err = giterr_last(); \
		if (err) { \
      fprintf(stderr, "ERROR %d: %s\n", err->klass, err->message); \
    } \
    abort(); \
  } \
}while(0)


void print_commit(const git_commit *commit){
    char buf[GIT_OID_HEXSZ + 1];
    const git_signature *parent_sig = git_commit_author(commit);

    // buf == bufptr だが、空文字列のptrが返る場合がある
    const char *bufptr = git_oid_tostr(buf, sizeof(buf), git_commit_id(commit));
    const char *message = git_commit_message(commit);

    // 1行出力するため終端を探す
    const char *eos = message;
    for(; *eos != '\n' && *eos != '\0'; eos++);
    printf("%s (%s <%s>): %.*s\n",
      bufptr,
      parent_sig->name,
      parent_sig->email,
      (int)(eos - message),
      message
    );
}

int main(){
  const char *repodir = "hello-world";
	git_repository *repo = NULL;
  
  // libgit2の初期化
  git_libgit2_init();

  // "hello-world" リポジトリがあるかチェック
  if(git_repository_open_ext(&repo, repodir, 0, NULL) < 0){
    // 無い場合はhello-worldリポジトリをcloneして使う
    //ASSERT(git_clone(&repo, "https://github.com/octocat/Hello-World.git", repodir, NULL));

    // リポジトリを作成する
    ASSERT(git_repository_init(&repo, repodir, 0));
  }

  // コミット時の名前とEmailの情報を得る
	git_signature *sig = NULL;
  ASSERT(git_signature_default(&sig, repo));

  // インデックスを用意する
	git_index *index = NULL;
  ASSERT(git_repository_index(&index, repo));

  // インデックスにあるファイルの内容をツリーに書き込み、そのツリーオブジェクトを得る
  // （インデックスは変化していないので、空の状態）
	git_oid tree_id;
  ASSERT(git_index_write_tree(&tree_id, index));

  // インデックスを書き込む
  ASSERT(git_index_write(index));

  // ツリーオブジェクトからツリーを得る
	git_tree *tree = NULL;
  ASSERT(git_tree_lookup(&tree, repo, &tree_id));

  // "HEAD" の最新のコミットを得る
  // これを親のコミットに使う（もしコミットが無い状態であればparentはNULLのままになる）
	git_object *parent = NULL;
	git_reference *ref = NULL;
  git_revparse_ext(&parent, &ref, repo, "HEAD");

  // コミットオブジェクトを作成
  git_oid commit_id;
  ASSERT(git_commit_create_v(
			&commit_id, repo, "HEAD", sig, sig,
			NULL, "Create empty commit\n\nhello hello", tree,
      1, parent));

  // コミットログを全部辿る（もう少しいい感じのやり方はあるかもしれない）
  git_commit *commit;
  ASSERT(git_commit_lookup(&commit, repo, &commit_id));
  while(commit){
    git_commit *tmp = NULL;
    print_commit(commit);
    git_commit_parent(&tmp, commit, 0); // マージコミットを考慮していない
    git_commit_free(commit);
    commit = tmp;
  }

  // 後始末
  git_tree_free(tree);
	git_index_free(index);
	git_signature_free(sig);
  git_object_free(parent);
  git_reference_free(ref);
  
  git_repository_free(repo);

  return 0;
}
```

### ファイルをインデックスに追加する

see: https://github.com/libgit2/libgit2/blob/v1.0.0/examples/add.c#L46

(飽きた)



おわり
--------

これだけで6時間ぐらいかけた。Gitの内部知識はあったが、実際にlibgit2での操作がイメージできずに非常に時間がかかってる。結局サンプルをつぎはぎしただけ。あと久々のC言語がちょっと辛かった。バインディングを使おうと思った（小並感）


でも本当にやりたいのはこういうのではなくて、gitのデータの保存先にファイルシステム以外(DBとかクラウドストレージとか)が使えるかを知りたかった。
実際、gitlabやgithubはどうやってるんだろう。さすがにファイルシステム1個を共有してるとは思えないし。

調べた感じ、libgit2はバックエンド実装の差し替えができるらしく、以下にサンプルの実装がある。

- https://github.com/libgit2/libgit2-backends

ちなみにJava実装のJGitがあり、バックエンドにCassandraを使った物もあるようだが、分散ファイルシステムに乗り換えたらしい。

- https://www.eclipse.org/lists/jgit-dev/msg02818.html
  - > Keep in mind that Shawn Pearce reached the conclusion that a distributed key-value store is not the right solution and moved to a DFS implementation. 
- https://github.com/spearce/jgit_cassandra

以下は調べてみたいとこのメモ

- AWS S3を使ったODB実装の例があるか、その際RefDBをどうするか
- Azure Files（NFS）で実用性に耐えうるかどうか