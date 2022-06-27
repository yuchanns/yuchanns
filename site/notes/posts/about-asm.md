---
title: asm 知识碎片
---
[[文章索引|posts]] [[操作系统系列|os]]

**Flat-Form Binary Output**

[参考链接](https://www.nasm.us/xdoc/2.09.10/html/nasmdoc7.html)

平坦模式二进制输出。

纯粹的二进制文件，只包含编写的代码指令，可用于操作系统开发和启动加载器。

该文件会丢弃所有的`section`信息，用**objdump**反汇编可发现统一归纳到`section .data`下。

```
# cat test.asm
section .data align=16
    dd 0

section .text align=16
    mov ax, 0x10
    mov es, ax
# nasm -f bin test.asm -o test.bin
# objdump -b binary -h test.bin

test.bin:     file format binary

Sections:
Idx Name          Size      VMA       LMA       File off  Algn
  0 .data         00000014  00000000  00000000  00000000  2**0
                  CONTENTS, ALLOC, LOAD, DATA
```
**Multisection Support for the bin Format**

[参考链接](https://www.nasm.us/xdoc/2.09.10/html/nasmdoc7.html#section-7.1.3)

在使用 nasm 编写二进制文件时，支持多种自定义的 section 。

实际上这些自定义 section 主要是用于编译时计算内存引用`vstart=`、和作为起始标号`section.<secname>.start`使用以及用于对其等`align=`。

如上所说这些自定义 section 在编译为 bin 时都会被丢弃。

同时在编译成 ELF 格式时，`vstart`和`section.<secname>.start`都不被支持，前者被忽略，后者报错。

尽管这些信息在编译为 bin 时会被忽略，但是在开发操作系统时对定位数据还是较为方便。
