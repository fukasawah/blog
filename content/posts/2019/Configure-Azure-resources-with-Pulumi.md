---
title: "PulumiでAzureのリソースを構成する"
date: 2019-06-24T00:58:49+09:00
draft: false
tags:
  - Infrastracture as Code
  - Azure
---

[Pulumi](https://pulumi.io/)はIndrastracture as Codeを実現するソフトウェア。
Azure Resource Manager(Template)やTerraformで出来ることと同じだが、特定の言語(JavaScript,TypeScript,Python)で記述できるのが強み。

Azure Resource Manager Templateに嫌気がさしつつ、terraformでやろうかな、と思っていたらPulumi見かけたのでクイックスタートを走ってみた。

### Pulumiのインストール

以下でOS毎のインストール方法が書かれている。

https://pulumi.io/reference/install/

Azureを使う場合はAzure CLI 2.0.x以上を入れておく。

https://docs.microsoft.com/en-us/cli/azure/?view=azure-cli-latest

### ログイン

Pulumiは状態管理などをPulumiが提供しているサーバ上で行う。
terraformのようにS3ストレージにtfstateを上げて共有する代わりにこれらを使うが、ログインのためのアカウント作成が面倒なのと、状態ファイルを握られるのが何か嫌なので、今回は使わない事にする。

ローカルに用意することもできるので、今回はこれを使う。


```
mkdir ~/quickstart
cd ~/quickstart
pulumi login "file://~/quickstart"
```

### プロジェクトを作る

AzureのQuickStartを読みながら進める

https://pulumi.io/quickstart/azure/install-pulumi/

プロバイダはAzure、言語はTypeScriptでプロジェクトを作成する。
ローカルにログインしての作成なので、少し表示が違う。

```
$ pulumi new azure-typescript
Created project 'quickstart'

Enter your passphrase to protect config/secrets: ********
Re-enter your passphrase to confirm: ********
Created stack 'dev'

Enter your passphrase to unlock config/secrets
    (set PULUMI_CONFIG_PASSPHRASE to remember): ********
Saved config

Installing dependencies...

...

added 163 packages from 190 contributors and audited 510 packages in 35.953s
found 0 vulnerabilities

Finished installing dependencies

Your new project is ready to go!

To perform an initial deployment, run 'pulumi up'
```

ローカルの場合はパスフレーズを使い暗号化を行う。これはプロジェクト毎に設定するようだ。
次に、プロジェクトを作成した後、`dev`というstackが作られる。stackというのは環境みたいなもので、しばしば開発者が確認で使う「Development(開発環境)」や、お客様が遊んで使う「staging(検証環境)」ユーザが実際に使う「production(本番環境)」と呼んだりするが、Pulumiではこれらを1つ1つを**stack**と呼んで分けている。
なので、プロジェクトの中には複数のstackがあり、stack毎に反映していくことになる。今回はデフォルトのstackとしてdevが作られたが、stackの操作はサブコマンドの`pulumi stack`で一通り操作できる。([doc](https://pulumi.io/reference/stack/))

### Pulumiのプログラムを書く

`index.ts`が実際のコードになる。デフォルトでリソースグループとストレージアカウントを作成するコードが用意されている。

少し改変する。


``` ts
import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";

const PROJECT_NAME = 'pulumi'

// Create an Azure Resource Group
const resourceGroup = new azure.core.ResourceGroup(`rg-${PROJECT_NAME}`, {
    location: "JapanEast",
});

// Create an Azure resource (Storage Account)
const account = new azure.storage.Account(`storage${PROJECT_NAME}`, {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    accountTier: "Standard",
    accountReplicationType: "LRS",
});

// Export the connection string for the storage account
export const connectionString = account.primaryConnectionString;
```

### Pulumi upで反映する

```
$ pulumi up
Enter your passphrase to unlock config/secrets
    (set PULUMI_CONFIG_PASSPHRASE to remember): ********
Previewing update (dev):

 +  pulumi:pulumi:Stack quickstart-dev create
 +  azure:core:ResourceGroup rg-pulumi create
 +  azure:storage:Account storagepulumi create

Resources:
    + 3 to create

Updating (dev):

 +  pulumi:pulumi:Stack quickstart-dev creating
 +  azure:core:ResourceGroup rg-pulumi creating
 +  azure:core:ResourceGroup rg-pulumi created
 +  azure:storage:Account storagepulumi creating
@ updating....
 +  azure:storage:Account storagepulumi created

Outputs:
    connectionString: "DefaultEndpointsProtocol=https;AccountName=storagepulumi516909b7;AccountKey=********************/********************==;EndpointSuffix=core.windows.net"

Resources:
    + 3 created

Duration: 29s

Permalink: file:///C:/Users/fukasawah/quickstart/.pulumi/stacks/dev.json
```

出来上がったが、実際に作られたリソース名は`rg-pulumided110d7`や`storagepulumi516909b7`という感じで後ろに8文字のサフィックスがくっつく形となった。これはPulumiが勝手につけているようだ。

storageはともかく、リソースグループは付けたくないと思うので、明示的に指定する方法を探る。

### リソース名を明示して変更を反映する

用意されているリソースには大抵nameプロパティがあり、これを明示的に設定すればよいらしい。

``` ts
// Create an Azure Resource Group
const resourceGroup = new azure.core.ResourceGroup(`rg-${PROJECT_NAME}`, {
    name: `rg-${PROJECT_NAME}`, // この行を追記
    location: "JapanEast",
});
```

Azureのリソースグループは通常名前変更ができないし、そもそも前のリソースの名前(`rg-pulumided110d7`)がわからなくなる。

しかしpulumiは前回実行後の状態を(現在は)ローカルで管理している。

今回は、使われなくなったリソースは削除し、再度新規作成する形で置き換わる。（この挙動は「IaCあるある」で既存のデータが吹っ飛ぶので注意が必要。）
また、リソースグループに紐づくストレージアカウントも作り直しになっている。（リソースグループの移動は出来るはずだが、Pulumiはそこまで面倒見てないらしい。）

```
$ pulumi up
Previewing update (dev):

     Type                         Name            Plan        Info
     pulumi:pulumi:Stack          quickstart-dev
 +-   azure:core:ResourceGroup  rg-pulumi       replace     [diff: ~name]
 +-   azure:storage:Account     storagepulumi   replace     [diff: ~location,name,resourceGroupName]

Resources:
    +-2 to replace
    1 unchanged

Do you want to perform this update? yes
Updating (dev):

     Type                         Name            Status       Info
     pulumi:pulumi:Stack          quickstart-dev
 +-   azure:core:ResourceGroup  rg-pulumi       replaced     [diff: ~name]
 +-   azure:storage:Account     storagepulumi   replaced     [diff: ~name,resourceGroupName]

Outputs:
  ~ connectionString: "DefaultEndpointsProtocol=https;AccountName=storagepulumi516909b7;AccountKey=********************/********************==;EndpointSuffix=core.windows.net" => "DefaultEndpointsProtocol=https;AccountName=storagepulumi77efe7b5;AccountKey=********************/********************==;EndpointSuffix=core.windows.net"

Resources:
    +-2 replaced
    1 unchanged

Duration: 1m14s

Permalink: file:///C:/Users/fukasawah/quickstart/.pulumi/stacks/dev.json
```

## ACIでnginxコンテナを立てる

チュートリアルでは、ストレージアカウントを削除し、nginxのACI(Azure Container Instances)を立てる例に書き換えているので習う。

https://pulumi.io/quickstart/azure/modify-program/

``` ts
import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";

const PROJECT_NAME = 'pulumi'

// Create an Azure Resource Group
const resourceGroup = new azure.core.ResourceGroup(`rg-${PROJECT_NAME}`, {
    name: `rg-${PROJECT_NAME}`,
    location: "JapanEast",
});

// Create an Azure Container Group
const container = new azure.containerservice.Group("aci-nginx", {
    containers: [{
        name: "nginx",
        image: "nginx",
        memory: 1,
        cpu: 1,
        ports: [{
            port: 80,
            protocol: "TCP"
        }],
    }],
    osType: "Linux",
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
});

// Export the public IP of the container
export const ip = container.ipAddress;
```

その後、`pulumi up`すると、ストレージアカウントが消えて、ACIが作成されたことが分かる。

作成後、nginxにアクセスする。接続先のIPは以下のようにして取れる。

``` bash
curl $(pulumi stack output ip)
```

`pulumi stack output ip`の`ip`はindex.tsでexportしている変数`ip`のことで、これを参照することが出来るらしい。便利。


### リソースの削除

```
pulumi destroy
```

### 次のステップ

ドキュメントにはgithubのサンプルコードを案内している。

https://pulumi.io/quickstart/azure/next-steps/

https://github.com/pulumi/examples

他のクラウドと比べると少し少ないが、Azureのサンプルがいくつか載っている。書き方の参考になるかもしれない。

感想
-----------------

TypeScriptとVSCodeの書き味が最高だった。TypeScriptのモジュールシステムを使えるはずなので、共通化もしやすそう。

欠点は後発なのでまだまだプラクティスが少ないこと。公式がサポートに入っていないのでリソースの追加・修正があった時に追従するのが遅いだろう、という所かな。

ただ後者は[TemplateDeployment](https://pulumi.io/reference/pkg/nodejs/pulumi/azure/core/#TemplateDeployment)リソースがあるので、部分的にARM Templateでカバーできそうだ。ちゃんとoutputも扱える。

その他
-----------------

### バックエンドは他にないのか？

ローカルは何かイマイチ（git反映忘れそう）だし、PulumiのWebサーバに依存したくないなぁ、と思っていた。
そこで他のバックエンドを使えないか調べたところ、一応AWS,GCP,Azureをサポートしているようだ。

内部的にはgo-cloudで抽象化しているので、[go-cloudのopenBucketのドキュメント](https://gocloud.dev/howto/blob/open-bucket/)を見ると、どのような環境変数が必要かは分かる。

細かいところは「[Qiita - Pulumiの状態管理にクラウドストレージバックエンドを使う](https://qiita.com/fukasawah/items/7c793ab8b08d19cd9376)」に書いた。