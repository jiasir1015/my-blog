+++
title = '工具 git'
date = '2025-09-24T16:35:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['工具']
tags = ['工具']
weight = 900
ShowToc = true
TocOpen = true
+++
```bash
git log --author=shenkun --oneline
```

-   x86

    ```bash
    git status -uno | awk '{if (NR>1) print $3}' | grep src | xargs -I {} git add {}
    ```

-   arm

    ```bash
    git status -uno | grep modified | awk '{if (NR>1) print $2}' | xargs -I {} git add {}
    ```

```bash
git tag -l

git ls-remote --tags origin

git fetch --tags

```
