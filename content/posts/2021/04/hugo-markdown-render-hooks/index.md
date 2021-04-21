---
title: "Hugoのmarkdown-render-hooksのメモ"
date: 2021-04-22T08:35:00+09:00
draft: false
toc: false
images:
tags: 
  - Hugo
---

HugoはMarkdownをHTMLに変換してくれるが、このときのHookを提供してくれている

https://gohugo.io/getting-started/configuration-markup#markdown-render-hooks

例えばmarkdownでは画像を埋め込むことができるが、画像のサムネイルも作りつつそれに合ったHTMLを出したい、`loading="lazy"`をつけたい、といった場合、`layouts\_default\_markup\render-image.html`を用意することでできるようになる。


``` go
{{ .Destination | safeURL }}
{{- $res := .Page.Resources.GetMatch .Destination }}
{{- if $res }}
    {{- $image := $res.Fit "300x300 jpg q50" }}
    {{- $imageUrl := $image.RelPermalink }}
    <figure>
    <a href="{{ .Destination | safeURL }}" target="_blank">
        <img src="{{ $imageUrl | safeURL }}" {{ with .Text}} alt="{{ . }}"{{ end }} {{ with .Title}} title="{{ . }}"{{ end }} loading="lazy"/>
    </a>
    {{- with .Text }}
        <figcaption>{{ . }}</figcaption>
    {{- end }}
    </figure>
{{- else }}
    <img src="{{ .Destination | safeURL }}" {{ with .Text}} alt="{{ . }}"{{ end }} {{ with .Title}} title="{{ . }}"{{ end }} loading="lazy"/>
{{- end}}
```

（直リンク画像などはelseに該当するはずだが、あまり動作確認してない）

結果サンプル。markdown viewerでもみれていて、HTMLではfigureタグで囲まれているはず。

![test](images/index/2021-04-22-06-01-22.png)

hugoのshortcodeと同じ要領なので全く同じことはshortcodeでもできるのだが、shortcodeはmarkdown viewerと相性が悪いのでこういうカスタマイズができるのはうれしい。