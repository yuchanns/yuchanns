---
title: "操作系统概论-内存管理"
date: 2021-04-07T00:22:41+08:00
draft: false
---
![](/images/operating-system-04.jpeg)
## 存储器的层次结构
![](/images/memory-system-structure.jpeg)

L0 ~ L2 在 CPU 中。

每一层级的存储器保存来自下一层级的存储器信息。

> 局部性原理
> 
> 在一段较短时间内，程序的执行仅限于某个部分，相应地，它锁访问的存储空间也局限于某个区域。
> * 时间局部性
> * 空间局部性