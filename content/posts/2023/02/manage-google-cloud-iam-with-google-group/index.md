---
title: "Google CloudのIAM管理にGoogle Groupを使う"
date: "2023-02-12T20:31:29+09:00"
draft: false
toc: true
images:
tags: 
  - GCP
---


要約
-----------

Google CloudのIAMの管理には昔からある「[Googleグループ](https://groups.google.com/)」というGoogleアカウント用のメーリングリストっぽいサービスのようなものが使えます。これはCloud identityやGoogle Workspaceの組織のグループとは別ですが、検索結果にはこっちのグループが出がちなので非常に検索しづらいので注意です。

これは[ちゃんとドキュメントに書いてある](https://cloud.google.com/iam/docs/overview?hl=ja#google_group)のですが、私は普通に気付かなかった。なんで見落としてしまうのか…


次の記事に救われました。ありがとう、ありがとう。

[【Google Cloud IAM】少人数チームでメンバーの権限を管理する](https://zenn.dev/catnose99/articles/a128e22a3e4467)



背景
----------

先日Cloud Identityを試したが、やはり大げさすぎると感じました。わざわざCloud identityのドメインのユーザを払い出し管理してもらうのはやっぱり微妙に感じました。

各GoogleアカウントをIAM管理もできるが、それだとプロジェクトに参画するタイミングでちゃんとリソースのIAMを更新して、ということをやらないといけない。誰がその権限をもっているんだっけ？　と探すことになるかもしれない。

terraformなどのコード化でメンバーの増減でIAM権限を更新する方法もありますが、メンバーの管理をterraformでやってるような感じになりイマイチ。

ということで、組織という規模ではないが2～5人ぐらいの規模で開発して、途中で増えたり減ったりすることも想定した程よい感じで始めたいことだってあるでしょう。

対応
-----------

「[Googleグループ](https://groups.google.com/)」で作成したグループのメールアドレスを使いIAM管理することで、Googleグループのメンバーにも権限が与えられます。

- GoogleグループにGoogle Cloudを管理するグループを作る（リソース管理する）
- Googleグループのオーナーorマネージャーを１～２人ほど立てて、その人にメンバー管理してもらう
- 「Google Cloudを管理するグループ」にプロジェクトの権限を与える（所有者（`roles/owner`）など）。

後はGoogleグループのメンバー追加だけちゃんと行えば勝手にリソースのアクセス管理ができるって寸法です。Googleグループのメンバーの棚卸も定期的にやりましょう。

terraformでIAM権限を管理するのは結構しんどいので、メンバーの参入のライフサイクルに合わせた権限管理が出来るようになり良いかもしれません。

作るグループは他にもあって良くて、例えば以下のようなものがあります。

- 開発者のグループを作る（Google CloudのSource Repository等にアクセスを管理するため。ただGitHub等の別のサービスを使う場合は不要かも）
- 運用者のグループを作る（Cloud Monitorとか見たり、VMの停止起動の権限をもつグループとか）


しかし、検索の仕方が悪いのか事例が全く出てきません・・・さほど悪くない気がするんですが・・・

欠点
----------------

組織を持たないため特有の欠点は残ります。

- 特定のGoogleアカウントがSPOFとなります
  - プロジェクトが最上位のリソースになる（フォルダーや組織が使えない）
  - プロジェクトの作成は特定のGoogleアカウントで行う必要がある
- Googleグループの管理が増える



その他
------------

### Googleグループとは、Google WorkspaceやGoogle Cloud Identityの組織のグループとは違うのか？

違います。別モノです。

### Googleグループとは、ビジネス向け Googleグループとは違うのか？

違います。

「ビジネス向けGoogleグループ」はGoogleグループのアプリ（画面）で組織のグループを管理することを呼んでいるようです。

<https://support.google.com/a/answer/10308022>

「ビジネス向けGoogleグループ」の有効・無効もありますが、無効なら「Googleグループ」というわけではなく、無効だった場合にUIでできることの機能が変わるだけのようです（使ったことが無いのでわかりません）

### Googleグループは無料なのか？ 制限は？

無料です。

制限についてはヘルプをお読みください。

<https://support.google.com/a/answer/6099642#zippy=%2C%E3%82%B0%E3%83%AB%E3%83%BC%E3%83%97%E3%81%AE%E4%BD%9C%E6%88%90%E5%8F%82%E5%8A%A0%E3%83%AA%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E6%8B%9B%E5%BE%85>

1日の生成数が30個、オーナーになれるグループ数には1000個という上限があるので注意してください。

### Cloud identityに引っ越すタイミングがでてくるのでは？

まだそこまでの経験がないので、どういうタイミングになるかはまだ勝手はわかりません。あるとすればプロジェクトが事業として波に乗って組織を立ち上げるとかでしょうか。

「[組織リソースのないプロジェクトを移行する](https://cloud.google.com/resource-manager/docs/project-migration?hl=ja#migrating_projects_no_org)」といったドキュメントもあり、実際は権限のつけなおしなども起きるでしょうが、できる範囲に思えます。

なお、Googleグループの制限はありますが、適切な委譲を行っていれば引っかかりそうに無いように思います（あるんでしょうか？）

### Googleアカウントをどう用意するのか？

適当なメールアドレスがあればGoogleアカウントを発行できます。
普段使っている組織のメールアドレスがあればそれを使ってGoogleアカウントを作るといいでしょう。

### Googleアカウントは2段階認証を強制できない

Cloud identity等であれば2段階認証を強制できますが、GoogleアカウントやGoogleグループの場合は強制できません。
なので信頼できるメンバーに2段階認証の設定をしてもらいましょう（2段階認証しないのは今の時代ありえないので設定しましょう）

### Google Cloudの最上位のリソースはプロジェクトになるので、プロジェクトを作るのはオーナーアカウントが必要

上記の通り。プロジェクトを作り、Googleグループの権限をプロジェクトに与えるのもオーナーアカウントの仕事。そこだけ最初やりましょう。

terraformを扱うときも、プロジェクトを作るリポジトリと、プロジェクトを使うリポジトリを分けておくとよいでしょう。

### Terraformで扱う場合、memberにはどのように指定すればよいか？

`member: "group:グループメール@googlegroups.com"` というようにすればGoogleグループに与えられます。所属しているGroupのユーザもその権限に倣うようになります。

### Terraformで扱う場合、所有者(`roles/owner`)を指定するとエラーになる

仕様です。管理コンソール上から行う必要があります（サービスアカウントはこの制限はないので指定はできる）

<https://cloud.google.com/resource-manager/reference/rest/v1beta1/projects/setIamPolicy>

> Service accounts can be made owners of a project directly without any restrictions. However, to be added as an owner, a user must be invited via Cloud Platform console and must accept the invitation.

なお、編集者(`roles/editor`)は指定できますが、IAM操作の権限がなかったり、一部のリソースの作成権限がなかったりと地味にできないことがあるので、意外と権限が足りません。ですがオートメーションには使えるかもしれません。運用と相談しながら必要に応じて使い分けましょう。

