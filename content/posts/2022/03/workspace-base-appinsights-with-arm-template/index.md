---
title: "ワークスペースベースの Application Insights の移行をARM Templateで試した"
date: "2022-03-02T02:04:25+09:00"
draft: false
toc: true
images:
tags: 
  - Azure
  - Application Insights
  - ARM Template
---

ワークスペースベースの Application Insightsの移行についてARM Templateで試した。

ちなみに、Azure Functionなどを画面でポチポチ作るときに作られるApplication Insightsはワークスペースベースになっていないです。

やるだけなので難しいことはないです。画面からやるのが一番簡単です。

ARM Template(bicep)でどう書けばいいか、と、画面で行った場合はデータも移行されるが、ARM Templateでは移行されるかを調べたので書いた次第。

参考
---------

- [ワークスペース ベースの Application Insights リソース - Microsoft docs](https://docs.microsoft.com/ja-jp/azure/azure-monitor/app/create-workspace-resource)
- [既存の Application Insights を Workspace ベースに移行した - しばやん雑記](https://blog.shibayan.jp/entry/20200928/1601229167)

きっかけ
------------

細かいことはドキュメントに書いてある通りで、ワークスペースを用意する必要がある以外のデメリットはあまりなさそうです。メリットもいくらかはあるようですが、大半はどうでもよかったです。

ただ、Application Insightsに反映されるまでに5分ぐらい時間がかかる問題があり、これがだいぶストレスでした。shibayan先生のblogを眺めていたところ、ここが改善されたというので試しました。

結果としては2分弱ぐらいで反映されるようになりだいぶ良くなりました。

ARM Templateで定義する場合
------------

移行前後でApplication Insights周りのリソースの変化を調べた。

`microsoft.insights/components`(Application Insightsリソース)のpropertiesの設定で

```json
    "IngestionMode": "ApplicationInsights"
```

これが以下のようになった。

```json
    "WorkspaceResourceId": "LogAnalytics WorkspaceのリソースID", // 追加
    "IngestionMode": "LogAnalytics", // 変更
```

この内容を基にBicepで書き直して、既存のリソースに対して適用してみた。
（LogAnalytics Workspaceのリソースは別途、新規で作成。）

```bicep
param serviceName string = "foo"
param environmentName string = "prd"
param location string = resourceGroup().location

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2021-06-01' = {
  name: 'lg-${serviceName}-${environmentName}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 90
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: 1
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource appinsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appinsight-${serviceName}-${environmentName}'
  location: location
  kind: 'web'
  properties: {
    WorkspaceResourceId: logAnalytics.id // 追加
    IngestionMode: 'LogAnalytics'        // 変更
    Application_Type: 'web'
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
  }
}
```

既存のデータも用意したLogAnalyticsへと移行されました。（ただ２～３日程度のログなので長期間の場合はよくわからない）
