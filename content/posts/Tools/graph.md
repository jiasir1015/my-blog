+++
title = 'flamegraph 火焰图'
date = '2025-06-09T11:54:00+08:00'
lastmod = '2026-08-14T17:47:31+08:00'
draft = false
categories = ['工具']
tags = ['性能优化']
weight = 900
ShowToc = true
TocOpen = true
+++
```bash
yum install perf
git clone https://github.com/brendangregg/FlameGraph.git

touch perf.sh

pids=$(pgrep $1 | head -n 4)
rm -rf ./tmp_graph
mkdir ./tmp_graph
for pid in $pids; do
    echo "-- collecting data for $pid"
    perf record -F 600 -p $pid -g -- sleep 5
    perf script -i perf.data > ./tmp_graph/perf.unfold.$pid
    ./flame/stackcollapse-perf.pl ./tmp_graph/perf.unfold.$pid > ./tmp_graph/perf.folded.$pid
done
cat ./tmp_graph/perf.folded.* > ./tmp_graph/all.folded
./flame/flamegraph.pl ./tmp_graph/all.folded > ./all.svg

sh perf.sh 进程名
```

```bash
rm -rf ./tmp_graph
mkdir ./tmp_graph
pid=$1
echo "-- collecting data for $pid"
perf record -F 600 -p $pid -g -- sleep 5
perf script -i perf.data > ./tmp_graph/perf.unfold.$pid
./flame/stackcollapse-perf.pl ./tmp_graph/perf.unfold.$pid > ./tmp_graph/perf.folded.$pid
done
cat ./tmp_graph/perf.folded.* > ./tmp_graph/all.folded
./flame/flamegraph.pl ./tmp_graph/all.folded > ./all.svg
```
