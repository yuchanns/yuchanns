---
title: "pprof的使用"
date: 2020-09-25T10:41:06+08:00
draft: false
---
前些天进行面试的时候，面试官问了我pprof的使用问题。我才意识到，虽然使用次数颇为不少，但并没有详细探究pprof的用法并总结成文章，以至于被询问“你常用的命令是哪几个？”时，只来得及想起`top`和`list`两个命令。

这篇文章对pprof的使用进行一个总结，内容将会包括“pprof是什么”、“`runtime/pprof`和`net/http/pprof`有什么关系”、“如何生成报告”、“分析报告有哪几种方式”以及“结合实际案例进行一些分析”。

## pprof简述
[**pprof**](https://github.com/google/pprof)是一个用于分析数据的可视化和分析工具，由谷歌公司的开发团队使用go语言编写成的。它通过一些手段收集进程在运行中调用堆栈等信息，按照一定格式保存到一个proto协议的结果文件中，然后对这个文件生成多种维度的可视化分析结果，用于对进程运行过程状况的分析。

要使用完整的pprof工具，可以使用`go get`工具进行获取和安装：
```
go get -u github.com/google/pprof
```

不过平常情况下，我们可以直接使用go标准库的`runtime/pprof`以及`net/http/pprof`生成报告，并使用`go tool pprof`进行结果分析。

## runtime/pprof的使用
如果你在搜索引擎上直接搜“pprof的使用”，结果十有八九千篇一律，并且大部分抄袭了[《Golang 大杀器之性能剖析 PProf》](https://segmentfault.com/a/1190000016412013)一文。

大部分文章基于web开发前提来说明，直接让你使用`import _ "net/http/pprof"`，然后访问`localhost:port/debug/pprof`生成报告等等。

说实话我第一次进行搜索的时候对此一脸懵逼，甚至分不清pprof本身、`runtime/pprof`以及`net/http/pprof`之间的关系。

结合[标准库文档](https://pkg.go.dev/runtime/pprof/)，我们先对`runtime/pprof`进行分析。

对于一个独立的go程序，要记录其运行过程，需要较为hack的手段对源码进行一些修改，使用`pprof.StartCPUProfile`和`pprof.StopCPUProfile`进行cpu的信息收集（或者`pprof.WriteHeapProfile`对内存堆调用的记录）。以一个尾递归斐波那契函数为例：
```
package main

import (
	"fmt"
	"log"
	"os"
	"runtime/pprof"
)

func fibIter(a, b, n int) int {
	if n == 0 {
		return b
	}

	return fibIter(a+b, a, n-1)
}

func fib(n int) int {
	return fibIter(1, 0, n)
}

func main() {
	f, err := os.Create("cpu.out")
	if err != nil {
		log.Fatal("failed to create cpu profile:", err)
	}
	defer f.Close()
	if err := pprof.StartCPUProfile(f); err != nil {
		log.Fatal("failed to start cpu profile:", err)
	}
	defer pprof.StopCPUProfile()
	result := fib(999999)
	fmt.Println(result)
}
```
上面的代码片段的主要工作就是创建一个`cpu.out`文件，然后在正文代码逻辑执行过程中对其进行cpu使用的记录，并保存到这个文件中。

将其进行编译并运行后，得到`cpu.out`文件，我们可以使用`go tool pprof cpu.out`的方式读取这个文件进行后续操作。

> 注：在上面那段代码中，如果斐波那契的数字太小了，可能会出现读取不到样本的情况(**Unable to get data from CPU profiling**)。这是因为`pprof.StartCPUProfile`中cpu采样率为100HZ(并且建议最佳使用500HZ)，而[案例函数运算太快了](https://stackoverflow.com/questions/58296808/unable-to-get-data-from-cpu-profiling)，所以样本不足。调大数字即可解决。

使用pprof工具读取这个文件后，进入交互模式，键入`top`命令，可以看到按到使用热度排序的前10个函数的调用列表：
```
❯ go tool pprof cpu.out
Type: cpu
Time: Sep 26, 2020 at 8:28pm (CST)
Duration: 409.04ms, Total samples = 190ms (46.45%)
Entering interactive mode (type "help" for commands, "o" for options)
(pprof) top
Showing nodes accounting for 190ms, 100% of 190ms total
      flat  flat%   sum%        cum   cum%
      50ms 26.32% 26.32%      100ms 52.63%  runtime.gentraceback
      50ms 26.32% 52.63%       50ms 26.32%  runtime.memmove
      40ms 21.05% 73.68%      190ms   100%  main.fibIter
      10ms  5.26% 78.95%       30ms 15.79%  runtime.adjustframe
      10ms  5.26% 84.21%       20ms 10.53%  runtime.findfunc
      10ms  5.26% 89.47%       10ms  5.26%  runtime.findmoduledatap
      10ms  5.26% 94.74%       20ms 10.53%  runtime.getStackMap
      10ms  5.26%   100%       10ms  5.26%  runtime.pcdatavalue
         0     0%   100%      150ms 78.95%  runtime.copystack
         0     0%   100%      150ms 78.95%  runtime.newstack
(pprof) 
```
当然你也可以使用`top5`来指定只输出排名前5，或者其他数字。

列表项的各自意义：

|名字|含义|
|---|---|
|flat|此函数使用cpu耗时，不包括它调用别的函数的耗时|
|flat%|flat在总耗时里的占比|
|sum%|此行的flat%加上上一行的sum%，如果是第一行就等于本行flat%|
|cum|此函数内部总运行耗时，包括自身的耗时以及调用其他函数的耗时|
|cum%|cum在总耗时里的占比|

其中`cum`是`cumulative`的缩写，即累积的意思。

为了更好的理解，这里有一个reddit上的[例子](https://www.reddit.com/r/golang/comments/7ony5f/what_is_the_meaning_of_flat_and_cum_in_golang/)：

> a内部调用b，而b内部调用了c和d，其中c执行1s，d执行2s。而b除了调用c和d，自身逻辑执行了3s，如下：
>
> ```
> b() {
>    c()  // 1s
>    // do something directly 3s
>    d()  // 2s
> }
> ```
>
> 那么b的flat是3s，而cum是1+3+2=6s

现在，在理解的基础上再去看上面的top输出。由于fibIter内部的逻辑分为条件选择判断和自我调用两部分代码，所以它的条件选择判断总共耗时为flat=40ms，而加上自我调用的耗时，就是cum为190ms。换言之，排除内部的条件判断，递归调用自身使用了150ms。

## pprof工具的参数命令
上面笔者提到了`top`命令，也许引起了读者的好奇心：这些命令是从哪里来的？都有哪些？

在pprof交互模式中，可以使用help来得到使用帮助：
```
(pprof) help
  Commands:
    callgrind        Outputs a graph in callgrind format
    comments         Output all profile comments
    disasm           Output assembly listings annotated with samples
    dot              Outputs a graph in DOT format
    eog              Visualize graph through eog
    evince           Visualize graph through evince
    gif              Outputs a graph image in GIF format
    gv               Visualize graph through gv
    kcachegrind      Visualize report in KCachegrind
    list             Output annotated source for functions matching regexp
    pdf              Outputs a graph in PDF format
    peek             Output callers/callees of functions matching regexp
    png              Outputs a graph image in PNG format
    proto            Outputs the profile in compressed protobuf format
    ps               Outputs a graph in PS format
    raw              Outputs a text representation of the raw profile
    svg              Outputs a graph in SVG format
    tags             Outputs all tags in the profile
    text             Outputs top entries in text form
    top              Outputs top entries in text form
    topproto         Outputs top entries in compressed protobuf format
    traces           Outputs all profile samples in text form
    tree             Outputs a text rendering of call graph
    web              Visualize graph through web browser
    weblist          Display annotated source in a web browser
    o/options        List options and their current values
    quit/exit/^D     Exit pprof

  Options:
    call_tree        Create a context-sensitive call tree
    compact_labels   Show minimal headers
    divide_by        Ratio to divide all samples before visualization
    drop_negative    Ignore negative differences
    edgefraction     Hide edges below <f>*total
    focus            Restricts to samples going through a node matching regexp
    hide             Skips nodes matching regexp
    ignore           Skips paths going through any nodes matching regexp
    mean             Average sample value over first value (count)
    nodecount        Max number of nodes to show
    nodefraction     Hide nodes below <f>*total
    noinlines        Ignore inlines.
    normalize        Scales profile based on the base profile.
    output           Output filename for file-based outputs
    prune_from       Drops any functions below the matched frame.
    relative_percentages Show percentages relative to focused subgraph
    sample_index     Sample value to report (0-based index or name)
    show             Only show nodes matching regexp
    show_from        Drops functions above the highest matched frame.
    source_path      Search path for source files
    tagfocus         Restricts to samples with tags in range or matched by regexp
    taghide          Skip tags matching this regexp
    tagignore        Discard samples with tags in range or matched by regexp
    tagshow          Only consider tags matching this regexp
    trim             Honor nodefraction/edgefraction/nodecount defaults
    trim_path        Path to trim from source paths before search
    unit             Measurement units to display

  Option groups (only set one per group):
    cumulative       
      cum              Sort entries based on cumulative weight
      flat             Sort entries based on own weight
    granularity      
      addresses        Aggregate at the address level.
      filefunctions    Aggregate at the function level.
      files            Aggregate at the file level.
      functions        Aggregate at the function level.
      lines            Aggregate at the source code line level.
  :   Clear focus/ignore/hide/tagfocus/tagignore

  type "help <cmd|option>" for more information
(pprof) 
```
键入`help <command>`可以获得对应命令的详细使用方法。

这里简单说明一下`top`、`list`、`peek`、`traces`、`web`和`tree`。

* top：以文本形式输出默认按flat排序的函数调用条目，可以使用-cum来更改为以cum排序，也可以加数字来更改显示条数。
* list：以文本形式输出正则匹配指定名称的函数源码，带注释。
* peek：展示匹配正则名称的函数调用和被调用的信息。
* traces：以文本形式输出采样中所有函数的调用顺序。
* web：通过浏览器输出可视化的调用关系，可以正则匹配或正则忽略关键字。
* tree：和peek类似，但是输出全部的信息。

键入`list fibIter`，得到：
```
(pprof) list fibIter
Total: 190ms
ROUTINE ======================== main.fibIter in /Users/yuchanns/Coding/golang/gobyexample/pprof/main.go
      40ms      320ms (flat, cum) 168.42% of Total
         .          .      5:   "log"
         .          .      6:   "os"
         .          .      7:   "runtime/pprof"
         .          .      8:)
         .          .      9:
         .      150ms     10:func fibIter(a, b, n int) int {
         .          .     11:   if n == 0 {
         .          .     12:           return b
         .          .     13:   }
         .          .     14:
      40ms      190ms     15:   return fibIter(a+b, a, n-1) // annotation
         .          .     16:}
         .          .     17:
         .          .     18:func fib(n int) int {
         .          .     19:   return fibIter(1, 0, n)
         .          .     20:}
```
同样可以得出：递归调用自身用了150ms，总共190ms，自身执行40ms。

> 注：这里读者可能得出和笔者不一样的结果，这是因为每次执行程序的结果有一定的随机性，比如说总共耗时190ms，但是fibIter只执行了180ms，另外10ms是打印耗时等情况。

键入`traces`，可以看到大部分为fibIter的递归调用，截取部分输出结果：
```
-----------+-------------------------------------------------------
             main.fibIter
             main.fibIter
             main.fibIter
             main.fibIter
             main.fibIter
             main.fibIter
             main.fibIter
             main.fibIter
             main.fibIter
             main.fibIter
             main.fibIter
-----------+-------------------------------------------------------
      10ms   runtime.getStackMap
             runtime.adjustframe
             runtime.gentraceback
             runtime.copystack
             runtime.newstack
             main.fibIter
             main.fibIter
             main.fibIter
             main.fibIter
```
可以清楚地看到尾递归过程中，运行时对栈的扩增过程。

而键入`web`可以获得一个svg图片，描述调用关系和耗时：

![](/images/fib-pprof-cpu.svg)

## 通过编写测试用例
前面我们提到，通过直接引用`runtime/pprof`的方式，需要对源码进行修改，是一种比较hack的方式——其实我只是想要测试一下fib函数，却需要在main中添加一大堆函数，真是太麻烦了！

聪明的读者也许立刻想到，可以结合单元测试来编写。将这些`pprof.StartCPUProfile`、`pprof.StopCPUProfile`等函数的调用写在测试用例中。

确实可以结合测试函数编写，而且有更为简单的方法——借助`go help testflag`得到（节选）：

```
The following flags are recognized by the 'go test' command and
control the execution of any test:

        -bench regexp
            Run only those benchmarks matching a regular expression.
            By default, no benchmarks are run.
            To run all benchmarks, use '-bench .' or '-bench=.'.
            The regular expression is split by unbracketed slash (/)
            characters into a sequence of regular expressions, and each
            part of a benchmark's identifier must match the corresponding
            element in the sequence, if any. Possible parents of matches
            are run with b.N=1 to identify sub-benchmarks. For example,
            given -bench=X/Y, top-level benchmarks matching X are run
            with b.N=1 to find any sub-benchmarks matching Y, which are
            then run in full.

The following flags are also recognized by 'go test' and can be used to
profile the tests during execution:

        -benchmem
            Print memory allocation statistics for benchmarks.

        -cpuprofile cpu.out
            Write a CPU profile to the specified file before exiting.
            Writes test binary as -c would.

        -memprofile mem.out
            Write an allocation profile to the file after all tests have passed.
            Writes test binary as -c would.


```
简单来说，在使用`go test`的过程中，添加对应的flag就可以生成cpu或者内存的使用报告，测试包中内置了pprof的引用。

执行`go test -bench=BenchmarkFib -benchtime=1x -cpuprofile cpu2.out`，指定只运行一次；笔者写了一个名为`BenchmarkFib`的测试用例：
```
package main

import "testing"

func BenchmarkFib(b *testing.B) {
	b.StopTimer()
	b.StartTimer()
	_ = fib(999999)
}
```
生成报告之后，就可以使用同样的方式来分析报告结果了。

## 分析报告文件的多种方法
这里请允许我直接引用煎鱼大佬的文章内容：
* 方法一：`$ go tool pprof -http=:8080 cpu2.out`
* 方法二：`$ go tool pprof cpu2.out`

## 分析一个内存泄露的案例
这是一段现实中一般不存在的代码，假设有一天你写了出来，并上线了：
```
package main

var leakSlice []int

func memoryLeak() {
	slc := make([]int, 1000000000)
	leakSlice = slc[:100000]
	leakSlice = append(leakSlice, 1)
}
```
然后线上紧急告警，内存占用高达7GB左右——

使用`go test -bench=BenchmarkMemoryLeak -benchtime=1x -memprofile mem.out`生成内存使用报告，然后键入下列命令分别开启交互模式：

> 观察累计分配内存模式(type=alloc_space)的结果报告：

```
❯ go tool pprof -sample_index=1 mem.out
Type: alloc_space
Time: Sep 27, 2020 at 1:39am (CST)
Entering interactive mode (type "help" for commands, "o" for options)
(pprof) top
Showing nodes accounting for 14.90GB, 100% of 14.90GB total
Dropped 21 nodes (cum <= 0.07GB)
      flat  flat%   sum%        cum   cum%
   14.90GB   100%   100%    14.90GB   100%  github.com/yuchanns/gobyexample/pprof.memoryLeak (inline)
         0     0%   100%    14.90GB   100%  github.com/yuchanns/gobyexample/pprof.BenchmarkMemoryLeak
         0     0%   100%     7.45GB 50.00%  testing.(*B).launch
         0     0%   100%     7.45GB 50.00%  testing.(*B).run1.func1
         0     0%   100%    14.90GB   100%  testing.(*B).runN
```
可以看到整个过程中分配了14.9GB的内存，所以我说一般不存在这种代码（如果有，写的人应该走得很安详~）。

> 然后观察常驻分配内存模式(type=inuse_space)的结果报告：

```
❯ go tool pprof -sample_index=3 mem.out
Type: inuse_space
Time: Sep 27, 2020 at 1:39am (CST)
Entering interactive mode (type "help" for commands, "o" for options)
(pprof) top
Showing nodes accounting for 7.45GB, 100% of 7.45GB total
      flat  flat%   sum%        cum   cum%
    7.45GB   100%   100%     7.45GB   100%  github.com/yuchanns/gobyexample/pprof.memoryLeak (inline)
         0     0%   100%     7.45GB   100%  github.com/yuchanns/gobyexample/pprof.BenchmarkMemoryLeak
         0     0%   100%     7.45GB   100%  testing.(*B).launch
         0     0%   100%     7.45GB   100%  testing.(*B).runN
```
在源码中，全局变量的切片只需要用到这个内存泄露函数切片中的前100000个成员，理论上也就1MB左右的内存，结果却常驻了7.45GB这么多！

而上面通过pprof工具，我们快速定位到了内存泄露发生的的地点在`memoryLeak`函数。仔细观察，发现是因为经验尚浅，对切片的特性不够了解导致的内存泄露：
> 把一个切片赋值给另一个切片，在底层是共享同一个数组的，所以即使第二个切片只用到了其中一部分成员，但是两个切片的cap还是一样的大小。函数结束后，函数内部的切片占用的内存得到了释放，但是全局切片依然引用着那个大数组，所以cap还是那么大，内存只有一半得到了释放，所以常驻了7.45GB的内存。

对源码中的切片赋值片段稍作修改：
```
package main

var leakSlice []int

func memoryLeak() {
	slc := make([]int, 1000000000)
	leakSlice = slc[:100000:100000]
	leakSlice = append(leakSlice, 1)
}
```
再次重复上述操作，首先观察累计分配内存模式(type=alloc_space)的结果，依然临时分配了14.9GB的内存，接着再看常驻分配内存模式(type=inuse_space)的结果，发现：
```
❯ go tool pprof -sample_index=3 mem.out
Type: inuse_space
Time: Sep 27, 2020 at 2:02am (CST)
Entering interactive mode (type "help" for commands, "o" for options)
(pprof) top
Showing nodes accounting for 1.13MB, 100% of 1.13MB total
      flat  flat%   sum%        cum   cum%
    1.13MB   100%   100%     1.13MB   100%  github.com/yuchanns/gobyexample/pprof.memoryLeak (inline)
         0     0%   100%     1.13MB   100%  github.com/yuchanns/gobyexample/pprof.BenchmarkMemoryLeak
         0     0%   100%     1.13MB   100%  testing.(*B).launch
         0     0%   100%     1.13MB   100%  testing.(*B).runN
```
常驻内存已经降低到1.13MB那么少。

细心的读者应该注意到了笔者在开启pprof交互的时候添加了一个`-sample_index`的flag，这是用于切换采样类型的标签，可选项有`[alloc_objects alloc_space inuse_objects inuse_space]`，按顺序对应0123，分别表示`[分配对象 分配内存 常驻对象 常驻内存]`。

这是笔者在实际工作中遇到过的泄露问题，为了方便读者理解，所以使用了夸张的数据来体现这一点。

## 关于net/http/pprof
现在我们对pprof的用法有了一定的认识，不至于上手一头雾水不知所措，于是开始好奇`net/http/pprof`又是什么？

首先从名字上看，这应该是和`net/http`库有关的pprof工具，也就是用于常驻web服务生成诊断报告的工具。

在标准库文档中，示例的用法很简单，直接`import _ "net/http/pprof"`，然后访问`localhost:port/debug/pprof`下载报告就可以，在代码中也不需要做什么hack的变更。

按照语法常识，只引用，而不使用，说明操作全在这个库的`init`函数中完成了，所以我们追踪源码一探究竟：
```
func init() {
	http.HandleFunc("/debug/pprof/", Index)
	http.HandleFunc("/debug/pprof/cmdline", Cmdline)
	http.HandleFunc("/debug/pprof/profile", Profile)
	http.HandleFunc("/debug/pprof/symbol", Symbol)
	http.HandleFunc("/debug/pprof/trace", Trace)
}
```
果然，在引入后就往http库注入了几个生成报告用的路由。

如果进一步查看这些路由的内容，就会发现是对`runtime/pprof`的引用，和我们上面做的工作差不多——也就是说，`net/http/pprof`是对`runtime/pprof`的一种包装，方便用户在web服务中使用。

## 结尾
经过冗长的文章，笔者认为读者应该对pprof这个工具建立了一定的认识。像往常一样的总结内容笔者就不再重复（写完已经精疲力尽）。相关的代码一样可以从[yuchanns/gobyexample](https://github.com/yuchanns/gobyexample/tree/master/pprof)获取。
