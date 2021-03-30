---
title: "go编译工具的使用之汇编"
date: 2020-01-31T07:50:59+08:00
draft: false
---
有时候我们想要知道写出来的代码是怎么编译执行的，这时候`go tool compile`就是一个很好用的工具。

本文相关代码[yuchanns/gobyexample](https://github.com/yuchanns/gobyexample/tree/master/assembly)

## 如何输出汇编代码
有三种方法可以输出go代码的汇编代码：
* `go tool compile` 生成obj文件
* `go build -gcflags` 生成最终二进制文件
* 先`go build`然后在`go tool objdump` 对二进制文件进行反汇编

当然，具体行为还需要在这些命令后面加上具体的*flag*。flag的内容可以通过查阅[官方文档](https://godoc.org/cmd/compile#hdr-Command_Line "command line")获得。
> 本文涉及Flags说明
>
> -N 禁止优化
>
> -S 输出汇编代码
>
> -l 禁止内联

### 什么是内联
如果学过*c/c++*就知道，通过`inline`关键字修饰的函数叫做内联函数。内联函数的优势是在编译过程中直接展开函数中的代码，将其替换到源码的函数调用位置，这样可以节省函数调用的消耗，提高运行速度。适用于函数体短小且频繁调用的函数，如果函数体太大了，会增大目标代码。是一种**空间换时间**的做法。

go编译器会智能判断对代码进行优化和使用汇编。而我们在分析学习代码调用情况的时候需要禁止掉这些优化，避免混淆理解。

以下我们使用`go build -gcflags="-N -l -S" file`来获得汇编代码。

### 获取一份简单的汇编代码
现在手上有一份关于`range`的代码，但是我们运行之后出现了一些问题[^1][^2]：
```go
package assembly

import "fmt"

func RangeClause() {
	arr := []int{1, 2, 3}
	var newArr []*int
	for _, v := range arr {
		newArr = append(newArr, &v)
	}
	for _, v := range newArr {
		fmt.Println(*v)
	}
}
```
结果输出了三个3。

也许我们在学习过程中见过类似的错误，然后设法(或者别人告诉我们怎么)避免错误，但是仍然百思不得其解，知其然不知其所以然。

<details>
<summary>避免错误的写法</summary>

将`&v`替换成`&arr[i]`
```go
package assembly

import "fmt"

func RangeClause() {
	arr := []int{1, 2, 3}
	var newArr []*int
	for i := range arr {
		newArr = append(newArr, &arr[i])
	}
	for _, v := range newArr {
		fmt.Println(*v)
	}
}
```
</details>

这时候获取汇编代码就可以排上用场了。

执行`go build -gcflags="-N -l -S" range_clause.go`，得到下面这份输出结果：
<details>
<summary>汇编结果</summary>

```go
"".RangeClause STEXT size=842 args=0x0 locals=0x158
        0x0000 00000 (range_clause.go:5)     TEXT    "".RangeClause(SB), ABIInternal, $344-0
        0x0000 00000 (range_clause.go:5)     MOVQ    (TLS), CX
        0x0009 00009 (range_clause.go:5)     LEAQ    -216(SP), AX
        0x0011 00017 (range_clause.go:5)     CMPQ    AX, 16(CX)
        0x0015 00021 (range_clause.go:5)     JLS     832
        0x001b 00027 (range_clause.go:5)     SUBQ    $344, SP
        0x0022 00034 (range_clause.go:5)     MOVQ    BP, 336(SP)
        0x002a 00042 (range_clause.go:5)     LEAQ    336(SP), BP
        0x0032 00050 (range_clause.go:5)     FUNCDATA        $0, gclocals·f0a67958015464e4cc8847ce0df60843(SB)
        0x0032 00050 (range_clause.go:5)     FUNCDATA        $1, gclocals·1be50b3ff1c6bce621b19ced5cafc212(SB)
        0x0032 00050 (range_clause.go:5)     FUNCDATA        $2, gclocals·160a1dd0c9595e8bcf8efc4c6b948d91(SB)
        0x0032 00050 (range_clause.go:5)     FUNCDATA        $3, "".RangeClause.stkobj(SB)
        0x0032 00050 (range_clause.go:6)     PCDATA  $0, $1
        0x0032 00050 (range_clause.go:6)     PCDATA  $1, $0
        0x0032 00050 (range_clause.go:6)     LEAQ    ""..autotmp_9+120(SP), AX
        0x0037 00055 (range_clause.go:6)     PCDATA  $1, $1
        0x0037 00055 (range_clause.go:6)     MOVQ    AX, ""..autotmp_8+152(SP)
        0x003f 00063 (range_clause.go:6)     PCDATA  $0, $0
        0x003f 00063 (range_clause.go:6)     TESTB   AL, (AX)
        0x0041 00065 (range_clause.go:6)     MOVQ    ""..stmp_0(SB), AX
        0x0048 00072 (range_clause.go:6)     MOVQ    AX, ""..autotmp_9+120(SP)
        0x004d 00077 (range_clause.go:6)     MOVUPS  ""..stmp_0+8(SB), X0
        0x0054 00084 (range_clause.go:6)     MOVUPS  X0, ""..autotmp_9+128(SP)
        0x005c 00092 (range_clause.go:6)     PCDATA  $0, $1
        0x005c 00092 (range_clause.go:6)     PCDATA  $1, $0
        0x005c 00092 (range_clause.go:6)     MOVQ    ""..autotmp_8+152(SP), AX
        0x0064 00100 (range_clause.go:6)     TESTB   AL, (AX)
        0x0066 00102 (range_clause.go:6)     JMP     104
        0x0068 00104 (range_clause.go:6)     PCDATA  $0, $0
        0x0068 00104 (range_clause.go:6)     PCDATA  $1, $2
        0x0068 00104 (range_clause.go:6)     MOVQ    AX, "".arr+240(SP)
        0x0070 00112 (range_clause.go:6)     MOVQ    $3, "".arr+248(SP)
        0x007c 00124 (range_clause.go:6)     MOVQ    $3, "".arr+256(SP)
        0x0088 00136 (range_clause.go:7)     PCDATA  $1, $3
        0x0088 00136 (range_clause.go:7)     MOVQ    $0, "".newArr+216(SP)
        0x0094 00148 (range_clause.go:7)     XORPS   X0, X0
        0x0097 00151 (range_clause.go:7)     MOVUPS  X0, "".newArr+224(SP)
        0x009f 00159 (range_clause.go:8)     PCDATA  $0, $1
        0x009f 00159 (range_clause.go:8)     LEAQ    type.int(SB), AX
        0x00a6 00166 (range_clause.go:8)     PCDATA  $0, $0
        0x00a6 00166 (range_clause.go:8)     MOVQ    AX, (SP)
        0x00aa 00170 (range_clause.go:8)     CALL    runtime.newobject(SB)
        0x00af 00175 (range_clause.go:8)     PCDATA  $0, $1
        0x00af 00175 (range_clause.go:8)     MOVQ    8(SP), AX
        0x00b4 00180 (range_clause.go:8)     PCDATA  $0, $0
        0x00b4 00180 (range_clause.go:8)     PCDATA  $1, $4
        0x00b4 00180 (range_clause.go:8)     MOVQ    AX, "".&v+192(SP)
        0x00bc 00188 (range_clause.go:8)     MOVQ    "".arr+256(SP), AX
        0x00c4 00196 (range_clause.go:8)     MOVQ    "".arr+248(SP), CX
        0x00cc 00204 (range_clause.go:8)     PCDATA  $0, $2
        0x00cc 00204 (range_clause.go:8)     PCDATA  $1, $5
        0x00cc 00204 (range_clause.go:8)     MOVQ    "".arr+240(SP), DX
        0x00d4 00212 (range_clause.go:8)     PCDATA  $0, $0
        0x00d4 00212 (range_clause.go:8)     PCDATA  $1, $6
        0x00d4 00212 (range_clause.go:8)     MOVQ    DX, ""..autotmp_5+288(SP)
        0x00dc 00220 (range_clause.go:8)     MOVQ    CX, ""..autotmp_5+296(SP)
        0x00e4 00228 (range_clause.go:8)     MOVQ    AX, ""..autotmp_5+304(SP)
        0x00ec 00236 (range_clause.go:8)     MOVQ    $0, ""..autotmp_10+112(SP)
        0x00f5 00245 (range_clause.go:8)     MOVQ    ""..autotmp_5+296(SP), AX
        0x00fd 00253 (range_clause.go:8)     MOVQ    AX, ""..autotmp_11+104(SP)
        0x0102 00258 (range_clause.go:8)     JMP     260
        0x0104 00260 (range_clause.go:8)     MOVQ    ""..autotmp_11+104(SP), CX
        0x0109 00265 (range_clause.go:8)     CMPQ    ""..autotmp_10+112(SP), CX
        0x010e 00270 (range_clause.go:8)     JLT     277
        0x0110 00272 (range_clause.go:8)     JMP     516
        0x0115 00277 (range_clause.go:8)     MOVQ    ""..autotmp_10+112(SP), CX
        0x011a 00282 (range_clause.go:8)     SHLQ    $3, CX
        0x011e 00286 (range_clause.go:8)     PCDATA  $0, $3
        0x011e 00286 (range_clause.go:8)     ADDQ    ""..autotmp_5+288(SP), CX
        0x0126 00294 (range_clause.go:8)     PCDATA  $0, $0
        0x0126 00294 (range_clause.go:8)     MOVQ    (CX), CX
        0x0129 00297 (range_clause.go:8)     MOVQ    CX, ""..autotmp_12+96(SP)
        0x012e 00302 (range_clause.go:8)     PCDATA  $0, $2
        0x012e 00302 (range_clause.go:8)     MOVQ    "".&v+192(SP), DX
        0x0136 00310 (range_clause.go:8)     PCDATA  $0, $0
        0x0136 00310 (range_clause.go:8)     MOVQ    CX, (DX)
        0x0139 00313 (range_clause.go:9)     PCDATA  $0, $3
        0x0139 00313 (range_clause.go:9)     MOVQ    "".&v+192(SP), CX
        0x0141 00321 (range_clause.go:9)     PCDATA  $0, $0
        0x0141 00321 (range_clause.go:9)     PCDATA  $1, $7
        0x0141 00321 (range_clause.go:9)     MOVQ    CX, ""..autotmp_13+184(SP)
        0x0149 00329 (range_clause.go:9)     MOVQ    "".newArr+232(SP), CX
        0x0151 00337 (range_clause.go:9)     MOVQ    "".newArr+224(SP), DX
        0x0159 00345 (range_clause.go:9)     PCDATA  $0, $4
        0x0159 00345 (range_clause.go:9)     PCDATA  $1, $8
        0x0159 00345 (range_clause.go:9)     MOVQ    "".newArr+216(SP), BX
        0x0161 00353 (range_clause.go:9)     LEAQ    1(DX), SI
        0x0165 00357 (range_clause.go:9)     CMPQ    SI, CX
        0x0168 00360 (range_clause.go:9)     JLS     364
        0x016a 00362 (range_clause.go:9)     JMP     446
        0x016c 00364 (range_clause.go:9)     PCDATA  $0, $-2
        0x016c 00364 (range_clause.go:9)     PCDATA  $1, $-2
        0x016c 00364 (range_clause.go:9)     JMP     366
        0x016e 00366 (range_clause.go:9)     PCDATA  $0, $5
        0x016e 00366 (range_clause.go:9)     PCDATA  $1, $9
        0x016e 00366 (range_clause.go:9)     MOVQ    ""..autotmp_13+184(SP), AX
        0x0176 00374 (range_clause.go:9)     PCDATA  $0, $6
        0x0176 00374 (range_clause.go:9)     LEAQ    (BX)(DX*8), DI
        0x017a 00378 (range_clause.go:9)     PCDATA  $0, $-2
        0x017a 00378 (range_clause.go:9)     PCDATA  $1, $-2
        0x017a 00378 (range_clause.go:9)     CMPL    runtime.writeBarrier(SB), $0
        0x0181 00385 (range_clause.go:9)     JEQ     389
        0x0183 00387 (range_clause.go:9)     JMP     439
        0x0185 00389 (range_clause.go:9)     MOVQ    AX, (BX)(DX*8)
        0x0189 00393 (range_clause.go:9)     JMP     395
        0x018b 00395 (range_clause.go:9)     PCDATA  $0, $0
        0x018b 00395 (range_clause.go:9)     PCDATA  $1, $6
        0x018b 00395 (range_clause.go:9)     MOVQ    BX, "".newArr+216(SP)
        0x0193 00403 (range_clause.go:9)     MOVQ    SI, "".newArr+224(SP)
        0x019b 00411 (range_clause.go:9)     MOVQ    CX, "".newArr+232(SP)
        0x01a3 00419 (range_clause.go:9)     JMP     421
        0x01a5 00421 (range_clause.go:8)     MOVQ    ""..autotmp_10+112(SP), CX
        0x01aa 00426 (range_clause.go:8)     INCQ    CX
        0x01ad 00429 (range_clause.go:8)     MOVQ    CX, ""..autotmp_10+112(SP)
        0x01b2 00434 (range_clause.go:8)     JMP     260
        0x01b7 00439 (range_clause.go:9)     PCDATA  $0, $-2
        0x01b7 00439 (range_clause.go:9)     PCDATA  $1, $-2
        0x01b7 00439 (range_clause.go:9)     CALL    runtime.gcWriteBarrier(SB)
        0x01bc 00444 (range_clause.go:9)     JMP     395
        0x01be 00446 (range_clause.go:9)     PCDATA  $0, $4
        0x01be 00446 (range_clause.go:9)     PCDATA  $1, $8
        0x01be 00446 (range_clause.go:9)     MOVQ    DX, ""..autotmp_21+64(SP)
        0x01c3 00451 (range_clause.go:9)     PCDATA  $0, $5
        0x01c3 00451 (range_clause.go:9)     LEAQ    type.*int(SB), AX
        0x01ca 00458 (range_clause.go:9)     PCDATA  $0, $4
        0x01ca 00458 (range_clause.go:9)     MOVQ    AX, (SP)
        0x01ce 00462 (range_clause.go:9)     PCDATA  $0, $0
        0x01ce 00462 (range_clause.go:9)     MOVQ    BX, 8(SP)
        0x01d3 00467 (range_clause.go:9)     MOVQ    DX, 16(SP)
        0x01d8 00472 (range_clause.go:9)     MOVQ    CX, 24(SP)
        0x01dd 00477 (range_clause.go:9)     MOVQ    SI, 32(SP)
        0x01e2 00482 (range_clause.go:9)     CALL    runtime.growslice(SB)
        0x01e7 00487 (range_clause.go:9)     PCDATA  $0, $4
        0x01e7 00487 (range_clause.go:9)     MOVQ    40(SP), BX
        0x01ec 00492 (range_clause.go:9)     MOVQ    48(SP), AX
        0x01f1 00497 (range_clause.go:9)     MOVQ    56(SP), CX
        0x01f6 00502 (range_clause.go:9)     LEAQ    1(AX), SI
        0x01fa 00506 (range_clause.go:9)     MOVQ    ""..autotmp_21+64(SP), DX
        0x01ff 00511 (range_clause.go:9)     JMP     366
        0x0204 00516 (range_clause.go:11)    PCDATA  $0, $0
        0x0204 00516 (range_clause.go:11)    PCDATA  $1, $10
        0x0204 00516 (range_clause.go:11)    MOVQ    "".newArr+232(SP), AX
        0x020c 00524 (range_clause.go:11)    MOVQ    "".newArr+224(SP), CX
        0x0214 00532 (range_clause.go:11)    PCDATA  $0, $2
        0x0214 00532 (range_clause.go:11)    PCDATA  $1, $0
        0x0214 00532 (range_clause.go:11)    MOVQ    "".newArr+216(SP), DX
        0x021c 00540 (range_clause.go:11)    PCDATA  $0, $0
        0x021c 00540 (range_clause.go:11)    PCDATA  $1, $11
        0x021c 00540 (range_clause.go:11)    MOVQ    DX, ""..autotmp_6+264(SP)
        0x0224 00548 (range_clause.go:11)    MOVQ    CX, ""..autotmp_6+272(SP)
        0x022c 00556 (range_clause.go:11)    MOVQ    AX, ""..autotmp_6+280(SP)
        0x0234 00564 (range_clause.go:11)    MOVQ    $0, ""..autotmp_14+88(SP)
        0x023d 00573 (range_clause.go:11)    MOVQ    ""..autotmp_6+272(SP), AX
        0x0245 00581 (range_clause.go:11)    MOVQ    AX, ""..autotmp_15+80(SP)
        0x024a 00586 (range_clause.go:11)    JMP     588
        0x024c 00588 (range_clause.go:11)    MOVQ    ""..autotmp_15+80(SP), AX
        0x0251 00593 (range_clause.go:11)    CMPQ    ""..autotmp_14+88(SP), AX
        0x0256 00598 (range_clause.go:11)    JLT     605
        0x0258 00600 (range_clause.go:11)    JMP     816
        0x025d 00605 (range_clause.go:11)    MOVQ    ""..autotmp_14+88(SP), AX
        0x0262 00610 (range_clause.go:11)    SHLQ    $3, AX
        0x0266 00614 (range_clause.go:11)    PCDATA  $0, $1
        0x0266 00614 (range_clause.go:11)    ADDQ    ""..autotmp_6+264(SP), AX
        0x026e 00622 (range_clause.go:11)    MOVQ    (AX), AX
        0x0271 00625 (range_clause.go:11)    MOVQ    AX, ""..autotmp_16+176(SP)
        0x0279 00633 (range_clause.go:11)    MOVQ    AX, "".v+144(SP)
        0x0281 00641 (range_clause.go:12)    TESTB   AL, (AX)
        0x0283 00643 (range_clause.go:12)    PCDATA  $0, $0
        0x0283 00643 (range_clause.go:12)    MOVQ    (AX), AX
        0x0286 00646 (range_clause.go:12)    MOVQ    AX, ""..autotmp_17+72(SP)
        0x028b 00651 (range_clause.go:12)    MOVQ    AX, (SP)
        0x028f 00655 (range_clause.go:12)    CALL    runtime.convT64(SB)
        0x0294 00660 (range_clause.go:12)    PCDATA  $0, $1
        0x0294 00660 (range_clause.go:12)    MOVQ    8(SP), AX
        0x0299 00665 (range_clause.go:12)    PCDATA  $0, $0
        0x0299 00665 (range_clause.go:12)    PCDATA  $1, $12
        0x0299 00665 (range_clause.go:12)    MOVQ    AX, ""..autotmp_18+168(SP)
        0x02a1 00673 (range_clause.go:12)    PCDATA  $1, $13
        0x02a1 00673 (range_clause.go:12)    XORPS   X0, X0
        0x02a4 00676 (range_clause.go:12)    MOVUPS  X0, ""..autotmp_7+200(SP)
        0x02ac 00684 (range_clause.go:12)    PCDATA  $0, $1
        0x02ac 00684 (range_clause.go:12)    PCDATA  $1, $12
        0x02ac 00684 (range_clause.go:12)    LEAQ    ""..autotmp_7+200(SP), AX
        0x02b4 00692 (range_clause.go:12)    MOVQ    AX, ""..autotmp_20+160(SP)
        0x02bc 00700 (range_clause.go:12)    TESTB   AL, (AX)
        0x02be 00702 (range_clause.go:12)    PCDATA  $0, $7
        0x02be 00702 (range_clause.go:12)    PCDATA  $1, $11
        0x02be 00702 (range_clause.go:12)    MOVQ    ""..autotmp_18+168(SP), CX
        0x02c6 00710 (range_clause.go:12)    PCDATA  $0, $8
        0x02c6 00710 (range_clause.go:12)    LEAQ    type.int(SB), DX
        0x02cd 00717 (range_clause.go:12)    PCDATA  $0, $7
        0x02cd 00717 (range_clause.go:12)    MOVQ    DX, ""..autotmp_7+200(SP)
        0x02d5 00725 (range_clause.go:12)    PCDATA  $0, $1
        0x02d5 00725 (range_clause.go:12)    MOVQ    CX, ""..autotmp_7+208(SP)
        0x02dd 00733 (range_clause.go:12)    TESTB   AL, (AX)
        0x02df 00735 (range_clause.go:12)    JMP     737
        0x02e1 00737 (range_clause.go:12)    MOVQ    AX, ""..autotmp_19+312(SP)
        0x02e9 00745 (range_clause.go:12)    MOVQ    $1, ""..autotmp_19+320(SP)
        0x02f5 00757 (range_clause.go:12)    MOVQ    $1, ""..autotmp_19+328(SP)
        0x0301 00769 (range_clause.go:12)    PCDATA  $0, $0
        0x0301 00769 (range_clause.go:12)    MOVQ    AX, (SP)
        0x0305 00773 (range_clause.go:12)    MOVQ    $1, 8(SP)
        0x030e 00782 (range_clause.go:12)    MOVQ    $1, 16(SP)
        0x0317 00791 (range_clause.go:12)    CALL    fmt.Println(SB)
        0x031c 00796 (range_clause.go:12)    JMP     798
        0x031e 00798 (range_clause.go:11)    MOVQ    ""..autotmp_14+88(SP), AX
        0x0323 00803 (range_clause.go:11)    INCQ    AX
        0x0326 00806 (range_clause.go:11)    MOVQ    AX, ""..autotmp_14+88(SP)
        0x032b 00811 (range_clause.go:11)    JMP     588
        0x0330 00816 (<unknown line number>)    PCDATA  $1, $0
        0x0330 00816 (<unknown line number>)    MOVQ    336(SP), BP
        0x0338 00824 (<unknown line number>)    ADDQ    $344, SP
        0x033f 00831 (<unknown line number>)    RET
        0x0340 00832 (<unknown line number>)    NOP
        0x0340 00832 (range_clause.go:5)     PCDATA  $1, $-1
        0x0340 00832 (range_clause.go:5)     PCDATA  $0, $-1
        0x0340 00832 (range_clause.go:5)     CALL    runtime.morestack_noctxt(SB)
        0x0345 00837 (range_clause.go:5)     JMP     0
```
</details>
看着输出结果，很cool~~~但是看不懂:(

## 汇编的简单知识
go使用的汇编叫做`plan9汇编`。最初go是在plan9系统上开发的，后来才在Linux和Mac上实现。

关于plan9汇编的入门，推荐看这个视频[^3]：

[plan9汇编入门|go夜读](//player.bilibili.com/player.html?aid=46494102&cid=81455226&page=1)

其中一些汇编知识是通用的[^4]，**GoDoc**也提供了go汇编的快速引导[^5]，另外也有一部分可以参考plan9汇编手册[^6]。
### 寄存器
寄存器是CPU内部用来存放数据的一些小型存储区域，用来暂时存放参与运算的数据和运算结果。

> 分类
>
> 这里提及的寄存器可以分为三类：
>
> * 后缀Register的寄存器属于数据类寄存器
> * 后缀为Pointer的寄存器属于指针类寄存器
> * 后缀为Index的寄存器属于索引类寄存器

|助记符|名字|用途|
|:---|:---:|---:|
|AX|累加寄存器(AccumulatorRegister)|用于存放数据，包括算术、操作数、结果和临时存放地址|
|BX|基址寄存器(BaseRegister)|用于存放访问存储器时的地址|
|CX|计数寄存器(CountRegister)|用于保存计算值，用作计数器|
|DX|数据寄存器(DataRegister)|用于数据传递，在寄存器间接寻址中的I/O指令中存放I/O端口的地址|
|SP|堆栈顶指针(StackPointer)|如果是`symbol+offset(SP)`的形式表示go汇编的伪寄存器；如果是`offset(SP)`的形式表示硬件寄存器|
|BP|堆栈基指针(BasePointer)|保存在进入函数前的栈顶基址|
|SB|静态基指针(StaticBasePointer)|go汇编的伪寄存器。`foo(SB)`用于表示变量在内存中的地址，`foo+4(SB)`表示foo起始地址往后偏移四字节。一般用来声明函数或全局变量|
|FP|栈帧指针(FramePointer)|go汇编的伪寄存器。引用函数的输入参数，形式是`symbol+offset(FP)`，例如`arg0+0(FP)`|
|SI|源变址寄存器(SourceIndex)|用于存放源操作数的偏移地址|
|DI|目的寄存器(DestinationIndex)|用于存放目的操作数的偏移地址|
### 操作指令
用于指导汇编如何进行。以下指令后缀*Q*说明是64位上的汇编指令。

|助记符|指令种类|用途|示例|
|:---|---|---|---:|
|MOVQ|传送|数据传送|`MOVQ 48, AX`表示把48传送AX中|
|LEAQ|传送|地址传送|`LEAQ AX, BX`表示把AX有效地址传送到BX中|
|~~PUSHQ~~|~~传送~~|~~栈压入~~|~~`PUSHQ AX`表示先修改栈顶指针，将AX内容送入新的栈顶位置~~在go汇编中使用`SUBQ`代替|
|~~POPQ~~|~~传送~~|~~栈弹出~~|~~`POPQ AX`表示先弹出栈顶的数据，然后修改栈顶指针~~在go汇编中使用`ADDQ`代替|
|ADDQ|运算|相加并赋值|`ADDQ BX, AX`表示BX和AX的值相加并赋值给AX|
|SUBQ|运算|相减并赋值|略，同上|
|IMULQ|运算|无符号乘法|略，同上|
|IDIVQ|运算|无符号除法|`IDIVQ CX`除数是CX，被除数是AX，结果存储到AX中|
|CMPQ|运算|对两数相减，比较大小|`CMPQ SI CX`表示比较SI和CX的大小。与SUBQ类似，只是不返回相减的结果|
|CALL|转移|调用函数|`CALL runtime.printnl(SB)`表示通过*printnl*函数的内存地址发起调用|
|JMP|转移|无条件转移指令|`JMP 389`无条件转至`0x0185`地址处(十进制389转换成十六进制0x0185)|
|JLS|转移|条件转移指令|`JLS 389`上一行的比较结果，左边小于右边则执行跳到`0x0185`地址处(十进制389转换成十六进制0x0185)|
可以看到，表中的`PUSHQ`和`POPQ`被去掉了，这是因为在go汇编中，对栈的操作并不是出栈入栈，而是通过对SP进行运算来实现的[^7]。
### 标志位
|助记符|名字|用途|
|---|---|---|
|OF|溢出|0为无溢出 1为溢出|
|CF|进位|0为最高位无进位或错位 1为有|
|PF|奇偶|0表示数据最低8位中1的个数为奇数，1则表示1的个数为偶数|
|AF|辅助进位||
|ZF|零|0表示结果不为0 1表示结果为0|
|SF|符号|0表示最高位为0 1表示最高位为1|

这么一通信息轰炸下来，作为初学者可能已经头晕脑胀记不住了，其实是否记住这并不重要——后面分析用到了再回来查阅意思即可。
### 函数的栈结构
```                                                                                
-----------------                                           
current func arg0                                           
----------------- <----------- FP(pseudo FP)                
caller ret addr                                            
+---------------+                                           
| caller BP(*)  |                                           
----------------- <----------- SP(pseudo SP，实际上是当前栈帧的 BP 位置)
|   Local Var0  |                                           
-----------------                                           
|   Local Var1  |                                           
-----------------                                           
|   Local Var2  |                                           
-----------------                -                          
|   ........    |                                           
-----------------                                           
|   Local VarN  |                                           
-----------------                                           
|               |                                           
|               |                                           
|  temporarily  |                                           
|  unused space |                                           
|               |                                           
|               |                                           
-----------------                                           
|  call retn    |                                           
-----------------                                           
|  call ret(n-1)|                                           
-----------------                                           
|  ..........   |                                           
-----------------                                           
|  call ret1    |                                           
-----------------                                           
|  call argn    |                                           
-----------------                                           
|   .....       |                                           
-----------------                                           
|  call arg3    |                                           
-----------------                                           
|  call arg2    |                                           
|---------------|                                           
|  call arg1    |                                           
-----------------   <------------  hardware SP 位置           
| return addr   |                                           
+---------------+             
```
来源于**No Headback**[^7]

## 分析汇编代码
### 从1+1开始
> “好了，现在我们已经学会了加减乘除四则运算，接下来我们来解答一下这道微积分的题目”XD

我们先从一个简单的范例`1+1`来实践一下对汇编代码的分析：
```go
package assembly

func Add() {
	a := 1 + 1
	println(a)
}
```
汇编结果：
```go
"".Add STEXT nosplit size=32 args=0x0 locals=0x18
        0x0000 00000 (add.go:3)      TEXT    "".Add(SB), ABIInternal, $24-0
        0x0000 00000 (add.go:3)      MOVQ    (TLS), CX
        0x0009 00009 (add.go:3)      CMPQ    SP, 16(CX)
        0x000d 00013 (add.go:3)      JLS     77
        0x000f 00015 (add.go:3)      SUBQ    $24, SP
        0x0013 00019 (add.go:3)      MOVQ    BP, 16(SP)
        0x0018 00024 (add.go:3)      LEAQ    16(SP), BP
        0x001d 00029 (add.go:3)      FUNCDATA        $0, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
        0x001d 00029 (add.go:3)      FUNCDATA        $1, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
        0x001d 00029 (add.go:3)      FUNCDATA        $2, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
        0x001d 00029 (add.go:4)      PCDATA  $0, $0
        0x001d 00029 (add.go:4)      PCDATA  $1, $0
        0x001d 00029 (add.go:4)      MOVQ    $2, "".a+8(SP)
        0x0026 00038 (add.go:5)      CALL    runtime.printlock(SB)
        0x002b 00043 (add.go:5)      MOVQ    "".a+8(SP), AX
        0x0030 00048 (add.go:5)      MOVQ    AX, (SP)
        0x0034 00052 (add.go:5)      CALL    runtime.printint(SB)
        0x0039 00057 (add.go:5)      CALL    runtime.printnl(SB)
        0x003e 00062 (add.go:5)      CALL    runtime.printunlock(SB)
        0x0043 00067 (add.go:6)      MOVQ    16(SP), BP
        0x0048 00072 (add.go:6)      ADDQ    $24, SP
        0x004c 00076 (add.go:6)      RET
        0x004d 00077 (add.go:6)      NOP
        0x004d 00077 (add.go:3)      PCDATA  $1, $-1
        0x004d 00077 (add.go:3)      PCDATA  $0, $-1
        0x004d 00077 (add.go:3)      CALL    runtime.morestack_noctxt(SB)
        0x0052 00082 (add.go:3)      JMP     0
```
第一行是go汇编的固定开头，指定过程名字为`"".Add`，`args=0x0 locals=0x18`则对应第二行的`$24-0`是十六进制和十进制的转化。

第二行是一个声明函数的过程。`TEXT`是一个伪操作符，以过程名的内存地址(`"".Add(SB)`)为定义过程的参数(回想一下`foo(SB)`是什么意思？)，然后在栈上为过程分配内存。`$24-0`其中`24`表示栈帧的大小为24字节(跟函数内部变量数据类型以及个数有关，例如这里是两个整型变量，就是2x8=16字节，然后还有一个8字节的整型用来存储BP值，所以一共24个字节)，`0`则表示调用方传入的参数大小。`ABIInternal`应该是**应用程序二进制接口内部**(Application Binary Interface Internal)的意思，不重要。

第三行的`MOVQ (TLS), CX`，我们现在可以回头查阅一下MOVQ是干什么用的——用于数据传送。可以看出来是把一个*(TLS)*赋值给CX(计数寄存器)。但是这个(TLS)是什么呢？它实际上也是一个伪寄存器，保存了指向当前G(保存`goroutine`的一种数据结构)的指针[^8]。

第四行则是比较当前栈顶指针和G指针正偏移16字节的地址大小。

如果左边小于右边就跳到`0x004d`(从十进制77转换为十六进制后的值)这个地址。我们先看看这个地址有什么内容：`NOP`意思是**No Operation**，无操作数。看了下这里是运行到了`add.go`文件的第六行，也就是一个`}`，所以是没有任何操作的。往下又回到了第三行，先不管。

回到第五行，如果没有达成上面的条件判断，就不会进行内存地址跳转，而是继续执行第六行的代码。

这一行代码是将栈顶地址减去**24**字节的内存容量，并把结果存到SP中。根据上边的表格我们可以知道，这其实是通过对sp的运算进行栈移动操作。类似于进行了入栈(栈未动，而指向栈内存地址的指针发生了移动)。

第七行把`BP`的值赋予了`16(SP)`，意思是从栈顶开始第十六个字节位置开始的那个整型变量。接着第八行把16(SP)的地址赋给了BP。

第九到十三行`FUNCDATA`和`PCDATA`是由编译器生成的，作用是告诉*GC*(**GarbageCollection**)区分堆栈中变量的类型。`$数字`表示变量属于什么类型(参数？本地？)，而后面的`gclocals·xxxxx(SB)`则是引用了一个隐藏的包含了GC标记的变量。注意这一行用到了`·`(middle dot)，用来代替go源文件中的`.`，因为在汇编中此符号已经被作为标点符号来解析。这属于gc的部分，具体用途我们不清楚，但现在可以不用关注。

第十四行，把结果2赋给变量a。这里有两个点需要注意：首先`$2`并不是表示上面那个`FUNCDATA`创建的变量，而是`1+1`的结果值，表示常数2(在plan9汇编里常数用`$数字`来表示)。如果上面的代码改成了`1+2`那么此处会变成`$3`；`"".a+8(SP)`并不是一个加法运算，而是表示距离栈顶8字节位置的那个变量a，这只是一种go汇编语法的强制规定，必须把变量名和内存地址使用`+`连起来表示而已，对机器来说没有实际意义，但是方便人类阅读理解。

第十五行，源码来到了第六行，调用了`runtime`包的*printlock*方法，根据名字可以看出这是打印前进行加锁的。

第十六和十七行的效果是把变量a放到AX寄存器中，然后把寄存器的地址赋给栈顶指针。

第十八行、十九和二十行则是打印栈顶指针的内容、打印换行符和解锁。

第二十一行把函数栈上记录的BP值还给BP，而二十二行将栈顶指针指向函数末尾。最后函数退出。

这样我们就成功分析完了一个函数方法的汇编代码。

### 继续a+b分析
上面我们发现两个数字相加，其实在汇编代码中直接体现为相加的结果了。所以我们把函数改成两个传入参数变量相加，看看有什么变化：
```go
package assembly

func VariableAdd(a, b int) {
	c := a + b
	println(c)
}
```
汇编结果：
```go
"".VariableAdd STEXT size=90 args=0x10 locals=0x18
        0x0000 00000 (variable_add.go:3)     TEXT    "".VariableAdd(SB), ABIInternal, $24-16
        0x0000 00000 (variable_add.go:3)     MOVQ    (TLS), CX
        0x0009 00009 (variable_add.go:3)     CMPQ    SP, 16(CX)
        0x000d 00013 (variable_add.go:3)     JLS     83
        0x000f 00015 (variable_add.go:3)     SUBQ    $24, SP
        0x0013 00019 (variable_add.go:3)     MOVQ    BP, 16(SP)
        0x0018 00024 (variable_add.go:3)     LEAQ    16(SP), BP
        0x001d 00029 (variable_add.go:3)     FUNCDATA        $0, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
        0x001d 00029 (variable_add.go:3)     FUNCDATA        $1, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
        0x001d 00029 (variable_add.go:3)     FUNCDATA        $2, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
        0x001d 00029 (variable_add.go:4)     PCDATA  $0, $0
        0x001d 00029 (variable_add.go:4)     PCDATA  $1, $0
        0x001d 00029 (variable_add.go:4)     MOVQ    "".a+32(SP), AX
        0x0022 00034 (variable_add.go:4)     ADDQ    "".b+40(SP), AX
        0x0027 00039 (variable_add.go:4)     MOVQ    AX, "".c+8(SP)
        0x002c 00044 (variable_add.go:5)     CALL    runtime.printlock(SB)
        0x0031 00049 (variable_add.go:5)     MOVQ    "".c+8(SP), AX
        0x0036 00054 (variable_add.go:5)     MOVQ    AX, (SP)
        0x003a 00058 (variable_add.go:5)     CALL    runtime.printint(SB)
        0x003f 00063 (variable_add.go:5)     CALL    runtime.printnl(SB)
        0x0044 00068 (variable_add.go:5)     CALL    runtime.printunlock(SB)
        0x0049 00073 (variable_add.go:6)     MOVQ    16(SP), BP
        0x004e 00078 (variable_add.go:6)     ADDQ    $24, SP
        0x0052 00082 (variable_add.go:6)     RET
        0x0053 00083 (variable_add.go:6)     NOP
        0x0053 00083 (variable_add.go:3)     PCDATA  $1, $-1
        0x0053 00083 (variable_add.go:3)     PCDATA  $0, $-1
        0x0053 00083 (variable_add.go:3)     CALL    runtime.morestack_noctxt(SB)
        0x0058 00088 (variable_add.go:3)     JMP     0
```
可以看到主要的变化就是第14行到16行。

`MOVQ "".a+32(SP), AX`这段代码的意思就是，把从`32(SP)`那个位置开始的名为`a`的变量放到AX寄存器里。下一行则对寄存器和变量`b`进行相加运算并把值放到寄存器中。

另外也可以看到，相较于1+1，整个函数栈的大小从`$24-0`变化为`$24-16`。因为函数内部容量并未发生变化，只是添加了两个8字节整型的传入参数，因此增加了16字节的大小。

更进一步的尝试，比如把加法改成乘法、除法等，这里就不展开讨论了。读者可以自行尝试。本文并未列出全部的助记符，但是见到新出现的助记符也没什么好迷惑的，可以借助本文下方列出的参考链接以及搜索引擎来自行查明含义。

### 分析range
那么，经过对go汇编知识的简单了解和初步练习，现在我们可以回到对range的分析上了。
```go
// 源码第八行
for _, v := range arr {
// 汇编结果
...
0x00af 00175 (range_clause.go:8)     MOVQ    8(SP), AX
0x00b4 00180 (range_clause.go:8)     MOVQ    AX, "".&v+192(SP)
...
0x0104 00260 (range_clause.go:8)     MOVQ    ""..autotmp_11+104(SP), CX
0x0109 00265 (range_clause.go:8)     CMPQ    ""..autotmp_10+112(SP), CX
0x010e 00270 (range_clause.go:8)     JLT     277  // 如果.autotmp_10小于CX跳转到0x0115
0x0110 00272 (range_clause.go:8)     JMP     516  // 无条件跳转到0x0204
0x0115 00277 (range_clause.go:8)     MOVQ    ""..autotmp_10+112(SP), CX
0x011a 00282 (range_clause.go:8)     SHLQ    $3, CX
0x011e 00286 (range_clause.go:8)     ADDQ    ""..autotmp_5+288(SP), CX
0x0126 00294 (range_clause.go:8)     MOVQ    (CX), CX
0x0129 00297 (range_clause.go:8)     MOVQ    CX, ""..autotmp_12+96(SP)
0x012e 00302 (range_clause.go:8)     MOVQ    "".&v+192(SP), DX
0x0136 00310 (range_clause.go:8)     MOVQ    CX, (DX)
// 源码第九行
	newArr = append(newArr, &v)
// 汇编结果
0x0139 00313 (range_clause.go:9)     MOVQ    "".&v+192(SP), CX
0x0141 00321 (range_clause.go:9)     MOVQ    CX, ""..autotmp_13+184(SP)
0x0149 00329 (range_clause.go:9)     MOVQ    "".newArr+232(SP), CX
0x0151 00337 (range_clause.go:9)     MOVQ    "".newArr+224(SP), DX
0x0159 00345 (range_clause.go:9)     MOVQ    "".newArr+216(SP), BX
0x0161 00353 (range_clause.go:9)     LEAQ    1(DX), SI
0x0165 00357 (range_clause.go:9)     CMPQ    SI, CX
0x0168 00360 (range_clause.go:9)     JLS     364  // 如果SI < CX跳转到0x016c
0x016a 00362 (range_clause.go:9)     JMP     446  // 否则跳转到0x01be
0x016c 00364 (range_clause.go:9)     JMP     366  // 无条件跳转到0x016e
0x016e 00366 (range_clause.go:9)     MOVQ    ""..autotmp_13+184(SP), AX
0x0176 00374 (range_clause.go:9)     LEAQ    (BX)(DX*8), DI
0x017a 00378 (range_clause.go:9)     CMPL    runtime.writeBarrier(SB), $0
0x0181 00385 (range_clause.go:9)     JEQ     389  // 如果等于0就跳转到0x0185
0x0183 00387 (range_clause.go:9)     JMP     439  // 否则无条件跳转到0x01b7
0x0185 00389 (range_clause.go:9)     MOVQ    AX, (BX)(DX*8)
0x0189 00393 (range_clause.go:9)     JMP     395  // 无条件跳转到0x018b
0x018b 00395 (range_clause.go:9)     MOVQ    BX, "".newArr+216(SP)
0x0193 00403 (range_clause.go:9)     MOVQ    SI, "".newArr+224(SP)
0x019b 00411 (range_clause.go:9)     MOVQ    CX, "".newArr+232(SP)
0x01a3 00419 (range_clause.go:9)     JMP     421  // 无条件跳转到0x01a5
0x01a5 00421 (range_clause.go:8)     MOVQ    ""..autotmp_10+112(SP), CX
0x01aa 00426 (range_clause.go:8)     INCQ    CX
0x01ad 00429 (range_clause.go:8)     MOVQ    CX, ""..autotmp_10+112(SP)
0x01b2 00434 (range_clause.go:8)     JMP     260  // 无条件跳转到0x0104
0x01b7 00439 (range_clause.go:9)     CALL    runtime.gcWriteBarrier(SB)
0x01bc 00444 (range_clause.go:9)     JMP     395  // 无条件跳转到0x018b
0x01be 00446 (range_clause.go:9)     MOVQ    DX, ""..autotmp_21+64(SP)
0x01c3 00451 (range_clause.go:9)     LEAQ    type.*int(SB), AX
0x01ca 00458 (range_clause.go:9)     MOVQ    AX, (SP)
0x01ce 00462 (range_clause.go:9)     MOVQ    BX, 8(SP)
0x01d3 00467 (range_clause.go:9)     MOVQ    DX, 16(SP)
0x01d8 00472 (range_clause.go:9)     MOVQ    CX, 24(SP)
0x01dd 00477 (range_clause.go:9)     MOVQ    SI, 32(SP)
0x01e2 00482 (range_clause.go:9)     CALL    runtime.growslice(SB)
0x01e7 00487 (range_clause.go:9)     MOVQ    40(SP), BX
0x01ec 00492 (range_clause.go:9)     MOVQ    48(SP), AX
0x01f1 00497 (range_clause.go:9)     MOVQ    56(SP), CX
0x01f6 00502 (range_clause.go:9)     LEAQ    1(AX), SI
0x01fa 00506 (range_clause.go:9)     MOVQ    ""..autotmp_21+64(SP), DX
0x01ff 00511 (range_clause.go:9)     JMP     366  // 无条件跳转到0x016e
```
由于汇编结果上标注了对应源码文件的行数，所以我们分析的时候可以逐行分析。

问题出现在第九行，直接从第九行开始分析。第九行汇编代码做了很多跳转，这里标注了一下跳转的对应行数。

在`range`未结束前，第九行代码执行完毕之后必然会跳转回第八行，执行下一轮的循环。可以看到`0x01b2`这一行就是这个作用。从这里着手分析。其上两行，用到了`CX`寄存器，这个寄存器通常是用来计数的，也就是说它对循环次数进行了计数。每一轮循环使用`INCQ`加一，然后赋值给`.autotmp_10`这个变量，也就是说保存循环次数的是`.autotmp_10`。

然后我们跳回源码第八行，现在寻找对`.autotmp_10`变量进行比较的代码，于是找到了`0x0109`。如果循环次数大于CX，就跳转到`0x0204`，也就是源码第11行，开始了另一个循环，这里暂不管。可以看到CX在上一行由`.autotmp_11`赋值，可知这个变量存储了数组的长度。

接下来，我们看到汇编代码对寄存器的操作有些令人迷惑的地方，`(CX)`和`CX`、`(DX)`等等：加了括号表示取CX的内存地址，不加则表示取值。

`0x012e`一行，将`"".&v+192(SP)`赋值给了`DX`。往上寻找，我们可以看到`0x00b4`行该变量产生的过程：`8(SP)`这个变量的内存地址赋值给了`"".&v+192(SP)`，而往下进行循环的过程中`"".&v+192(SP)`这个变量没有再被赋值的操作，因此我们得出结论，每次循环过程中`"".&v+192(SP)`一直都是同一个值，也就是说，在源码第九行中`&v`一直指向同一个地址，即`8(SP)`。

事情逐渐明了，因为`&v`一直指向同一个地址，所以源码中的`newArr`三个值都记录了同一个地址。

接下来我们可以继续追踪`8(SP)`的最终值，但是这样下去太过复杂艰深(~~我不想写了，头疼~~)。我们已经知道原因，并且我们也知道v的最后一次值就是数组的最后一个数字，因此`newArr`打印出来的自然就是三个3。

这样的研究并非没有意义：go的`for _, v := range arr`写法容易让人误以为每次的v都是一个全新变量(因为`if err := somefunc(); err == nil`就是这样的)，而我们通过查看汇编代码得知了实际上v这一变量的值实际上是通过`&v`指向的地址获取的，真正被重新赋值的变量另有其物(就是`8(SP)`)。

### 扩展
在上面这段源码中，其实还有其他地方可以关注，比如`arr := []int{1, 2, 3}`这个切片声明的实现过程。

从`0x0032`到`0x007c`正好对应源码第六行。

我们知道，一个切片实际上是由一个指针、两个整型组成的结构体[^9]：
```go
type slice struct {
    array unsafe.Pointer
    len   int 
    cap   int 
}
```
那么在声明的时候需要赋予`slice.len`和`slice.cap`值——对应于在`0x0070`和`0x007c`，而它的底层指向数组指针`slice.array`则是`0x0068`完成。但是这段汇编中，匿名数组是怎么生成的我们并不知道，所以我们再写一段源码，内容是生成一个数组，然后对其进行切片操作：
```go
package assembly

func ArraySlice() {
	arr := [3]int{1, 2, 4}
	sl := arr[:]
	_ = sl
}
```
输出汇编为：
```go
"".ArraySlice STEXT nosplit size=97 args=0x0 locals=0x38
        0x0000 00000 (arr_slice.go:3)        TEXT    "".ArraySlice(SB), NOSPLIT|ABIInternal, $56-0
        0x0000 00000 (arr_slice.go:3)        SUBQ    $56, SP
        0x0004 00004 (arr_slice.go:3)        MOVQ    BP, 48(SP)
        0x0009 00009 (arr_slice.go:3)        LEAQ    48(SP), BP
        0x000e 00014 (arr_slice.go:3)        FUNCDATA        $0, gclocals·33cdeccccebe80329f1fdbee7f5874cb(SB)
        0x000e 00014 (arr_slice.go:3)        FUNCDATA        $1, gclocals·54241e171da8af6ae173d69da0236748(SB)
        0x000e 00014 (arr_slice.go:3)        FUNCDATA        $2, gclocals·9fb7f0986f647f17cb53dda1484e0f7a(SB)
        0x000e 00014 (arr_slice.go:4)        PCDATA  $0, $0
        0x000e 00014 (arr_slice.go:4)        PCDATA  $1, $0
        0x000e 00014 (arr_slice.go:4)        MOVQ    $0, "".arr(SP)
        0x0016 00022 (arr_slice.go:4)        XORPS   X0, X0
        0x0019 00025 (arr_slice.go:4)        MOVUPS  X0, "".arr+8(SP)
        0x001e 00030 (arr_slice.go:4)        MOVQ    $1, "".arr(SP)
        0x0026 00038 (arr_slice.go:4)        MOVQ    $2, "".arr+8(SP)
        0x002f 00047 (arr_slice.go:4)        MOVQ    $4, "".arr+16(SP)
        0x0038 00056 (arr_slice.go:5)        PCDATA  $0, $1
        0x0038 00056 (arr_slice.go:5)        LEAQ    "".arr(SP), AX
        0x003c 00060 (arr_slice.go:5)        TESTB   AL, (AX)
        0x003e 00062 (arr_slice.go:5)        JMP     64
        0x0040 00064 (arr_slice.go:5)        PCDATA  $0, $0
        0x0040 00064 (arr_slice.go:5)        MOVQ    AX, "".sl+24(SP)
        0x0045 00069 (arr_slice.go:5)        MOVQ    $3, "".sl+32(SP)
        0x004e 00078 (arr_slice.go:5)        MOVQ    $3, "".sl+40(SP)
        0x0057 00087 (arr_slice.go:7)        MOVQ    48(SP), BP
        0x005c 00092 (arr_slice.go:7)        ADDQ    $56, SP
        0x0060 00096 (arr_slice.go:7)        RET
```
从下往上看，先看到`"".sl`这段内存的三个变量被赋予了值(`0x0040`~`0x004e`)。而`AX`由`"".arr(SP)`赋值(`0x0038`)，值为arr所在的内存地址。

如果我们再添加一个`sl2 = sl[:]`则可以看到底层数组指针依旧是由`AX`赋值而成的，印证了网上所说的切片共享数组的说法(当然，通过查看源码也是可以知道的)。

[^1]: [for和range的实现|Go语言的设计和实现](https://draveness.me/golang/docs/part2-foundation/ch05-keyword/golang-for-range/)
[^2]: [Common Mistakes|Go](https://github.com/golang/go/wiki/CommonMistakes)
[^3]: [plan9汇编入门|go夜读](https://www.bilibili.com/video/av46494102)
[^4]: [Assembly Programming|Tutorialspoint](https://www.tutorialspoint.com/assembly_programming/index.htm)
[^5]: [A Quick Guide to Go's Assembler](https://golang.org/doc/asm#introduction)
[^6]: [A Manual for the Plan 9 assembler](https://9p.io/sys/doc/asm.html)
[^7]: [plan9 汇编入门|No Headback](https://xargin.com/plan9-assembly/)
[^8]: [teh-cmc/go-internals](https://github.com/teh-cmc/go-internals/blob/master/chapter1_assembly_primer/README.md#splits)
[^9]: [golang/go](https://github.com/golang/go/blob/master/src/runtime/slice.go#L13-L17)
