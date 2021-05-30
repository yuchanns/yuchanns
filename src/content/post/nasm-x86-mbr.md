---
title: "NASM编写x86的MBR引导"
date: 2021-05-30T22:51:10+08:00
draft: false
---
> 相关：[【x86汇编学习】编写主引导扇区](https://www.yuchanns.xyz/2020/09/06/study-of-x86-mbr/)。

TLDR; 本文作为笔者研究使用 Rust 编写玩具性质操作系统的第一篇文章，学习过程中参考了大量网络搜索资料，实现上则参考了[Redox](https://gitlab.redox-os.org/redox-os/redox)。

本文为笔记性质，仅对部分知识点做归纳总结，没有用于指导他人意图，因此暂不考虑阅读友善度，但是欢迎读者勘误。

相关代码库：[yuchanns/x86-asm](https://github.com/yuchanns/x86-asm)

## 启动顺序
![](/images/Flow-diagram-computer-booting-sequences.svg.png)

* 8086开机时，CPU 处于实模式，这时候内存的计算方式是 段基址 << 4 + 段内偏移
* CPU 的第一条指令是通过 `[cs:ip]` 来取得，而此时 CS=0xFFFF ，IP=0x0000 。这是硬件设定好的。
* 所以最开始执行的指令地址就是 0xFFFF0，这个内存地址映射在主板的 BIOS ROM（只读存储区）中。
* ROM 中的程序会检测 RAM、键盘、显示器、软硬磁盘是否正确工作。同时会从地址0开始设置 BIOS 的中断向量表。
* ROM 中的程序继续执行，将启动设备磁盘0磁道0扇区，一个512字节的扇区读到内存 0x07c00 处。
* 设置 cs=0x07c0，ip=0x0000 。
* ROM中的程序执行结束，转到 0x07c00 处开始执行。

参考资料：
* [Boot sequence - Booting](https://en.wikipedia.org/wiki/Booting)
* [Hardware reset](https://en.wikipedia.org/wiki/Hardware_reset)



## 代码片段
> bootloader.s
```
ORG 0x7c00 ; 伪指令，指示编译器对下面的代码片段做内存地址偏移处理。0x7c00 为第一个扇区被载入的物理内存地址
SECTION .text ; 表示下面为代码文本片段
USE16 ; 在实模式下面使用16位

boot:
  xor ax, ax ; 累加器
  mov ds, ax ; 数据段寄存器
  mov es, ax ; 附加段寄存器
  mov ss, ax ; 堆栈寄存器
  ; 上面为初始化各寄存器

  mov sp, 0x7c00 ; 初始化栈，将栈顶指针指向 0x7c00

  push ax ; 将 ax 寄存器的值压入栈中
  push word .greet ; 将标号为 .greet 的汇编地址值以字的形式压入栈中
  retf ; 将栈顶数据弹出放入 ip 寄存器，然后继续弹出栈顶数据放入 cs 寄存器，接着 cpu 读取 cs:ip 寄存器内容执行指令

.greet:
  mov si, msg ; 把标号为 msg 的汇编地址储存到源变址寄存器
  call print ; 调用打印函数读取 si 寄存器内容打印
  call print_line ; 调用打印换行函数
  hlt ; 暂停指令，避免 cpu 空转100%占用

%include "print.s" ; 引入打印源码

msg: db "Hello Yuchanns!", 0 ; 标号文字段，用0表示结束

times 510 - ($-$$) db 0 ; 使用0填充不足的数据直到大小为510字节，用于形成第一个扇区

dw 0xaa55 ; 魔法数，BIOS 在读取硬盘第一个扇区时会检测最后两个字节是否为固定的魔法数，如果有则尝试将第一个扇区作为引导启动

```
* 初始化栈，用于保存各种寄存器的在其他上下文中的值以及恢复，也可以作为高级语言的运行环境
* 源变址寄存器(`si`, **Source Index**)可以用于保存标号数据的起始内存地址，并且通过地址偏移（指针）的方式遍历出整个标号数据的内容。参考资料 [Index register](https://en.wikipedia.org/wiki/Index_register)
* `db`指令声明字节变量(**Declare Byte**)
* `hlt`指令可以防止 cpu 忙空转，进入暂停状态，直到下一个外部中断触发（如时间中断）。参考资料 [HLT (x86 instruction)](https://en.wikipedia.org/wiki/HLT_(x86_instruction))
* `times`前缀指示编译器重复指令直到填充满指定长度的空间。参考资料 [Pseudo-Instructions - NASM Manual](https://www.csie.ntu.edu.tw/~comp03/nasm/nasmdoc3.html#section-3.2)
* `$`指令表示当前指令开始的位置，`$$`指令指令表示当前 section 的起始位置，可以通过`$$-$`获取目前的数据长度。参考资料 [Expressions - NASM Manual](https://www.csie.ntu.edu.tw/~comp03/nasm/nasmdoc3.html#section-3.5)
* 每个扇区为512字节，且第一个扇区的末尾两个字节固定为`0xaa55`用于表示可作为操作系统引导，在代码编写上也可以使用`dd 0xaa dd 0x55`表示。参考资料 [Master boot record](https://en.wikipedia.org/wiki/Master_boot_record)

> print.s
```
SECTION .text
USE16

print_line:
  mov al, 13 ; 对应 ASCII 表上的 \r
  call print_char
  mov al, 10 ; 对应 ASCII 表上的 \n
  jmp print_char

print:
  pushf ; 将状态寄存器的数据压入栈，因为接下来的操作会覆盖上下文的状态寄存器的值，需要保存，使用完之后进行恢复
  cld ; 清零方向标志位，为后面递增地址读取 si 寄存器的内容做准备
.loop:
  lodsb ; 读取 si 寄存器保存的地址指向的字节内容到 al 寄存器，并把 si 寄存器保存的地址移动一位
  cmp al, 0 ; 对比 al 寄存器和0是否一致
  je .done ; 如果一致，说明打印结束，跳转到结束标号
  call print_char ; 否则进行打印 al 寄存器的内容
  jmp .loop ; 循环读取 si 寄存器保存的地址指向的内容
.done:
  popf ; 将压入栈的状态值恢复到状态寄存器里
  ret ; 返回

print_char:
  pusha ; 将通用寄存器的值全部压入栈中，保存上下文，避免下面的覆盖使用造成丢失
  mov bx, 7 ; 闪烁终端窗口，对应 ASCII 中的 BEL
  mov ah, 0x0e ; 使用 teletype 模式
  int 0x10 ; 使用中断打印 al 寄存器中的内容
  popa ; 恢复通用寄存器的上下文
  ret
  
```
* `int 0x10`是 BIOS 中断调用，根据 ah 寄存器上的值决定不同的中断模式；其中`0x0e`是 teltype 模式，打印字符到屏幕；BIOS 中断打印的方式性能比较差，且只能在实模式使用。参考资料[INT_10H](https://en.wikipedia.org/wiki/INT_10H)
* `lodsb`指令从`[ds:si]`加载一个字节到 al 寄存器，并根据方向标志位递增或递减内存地址（清零则递增）。参考资料[Load from String](https://www.csie.ntu.edu.tw/~comp03/nasm/nasmdocb.html#section-B.4.141) 
* `cmp`指令比较两个值并把结果放入状态寄存器

## 总结
通过魔法数和重复填充指令可以使用 NASM 汇编写出 MBR 引导扇区程序，并使用虚拟机或者实机启动。

过程中可以体会到在裸机上（实模式下）栈的实际用途，在编写函数过程中需要时刻注意保存寄存器的上下文状态到栈中，避免丢失。

另外高级语言的执行也依赖栈的初始化，无法直接操作硬件，只有汇编在没有栈的情况下可以按照编写的指令顺序、跳转执行，并实现栈的初始化。这也是为什么编写操作系统时通常需要使用汇编作为开始的原因。
