---
title: "操作系统豆知识"
date: 2021-05-22T14:15:27+08:00
draft: false
---
> 记录一些暂未被笔者归档的、零散的知识点

## Protection Ring

参考资料：[Protection ring - Wikipedia](https://en.wikipedia.org/wiki/Protection_ring)。

计算机操作系统对资源的访问划分了不同的层级，这种层级被称为**保护环**。

环从里到外通过编号0开始标记，编号越小特权越高。

大多数操作系统中，ring-0 权限最高，与物理硬件互动最直接。

附参考：[gopher-os/gopher-os](https://github.com/gopher-os/gopher-os) 被用于证明 Go 语言可以运行在 ring-0 层。
