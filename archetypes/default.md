+++
title = '{{ replace .Name "-" " " | title }}'
date = {{ .Date }}
draft = false

# 核心魔法：自动提取路径中的文件夹名作为分类
# 逻辑：如果路径是 posts/Database/xxx.md，提取 "Database"
{{- $pathParts := split .File.Dir "/" -}}
{{- $category := "" -}}
{{- if ge (len $pathParts) 2 -}}
    {{- $category = index $pathParts 1 -}}
{{- end -}}

# 如果提取到了子目录，就作为分类；否则默认归为 "Tech"
categories = ["{{ if ne $category "" }}{{ $category }}{{ else }}Tech{{ end }}"]

tags = []

[cover]
    image = ""
    alt = ""
    caption = ""

ShowToc = true
TocOpen = true
+++