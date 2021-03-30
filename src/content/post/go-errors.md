---
title: "go语言错误处理"
date: 2020-03-22T09:23:00+08:00
draft: false
---
## 前言
go的原生错误处理十分简略。

刚接触go时，我们对它的错误处理最直观的认识就是在调用函数方法时，常常会有多返回值，而最后一个值一般就是错误类型`error`；当接收它的变量值为**nil**时，表示函数正确执行；否则我们可以通过打印该变量的结果来获取错误信息——这个结果是一个字符串。

使用过其他现代高级语言(Java、Python、PHP等等)的人，都知道这些语言的错误是通过`try... catch...`的方式进行**抛出**和**捕获**。姑且不论哪种方式更好，是退步还是进步，对于程序调试来说，这些语言都提供了十分详细的可回溯信息，常用的有“文件名”、“函数名”、“代码行数”和“错误信息”，可以辅助快速定位错误的发生原因；此外我们还可以通过捕获不同类型的错误来有选择地后续处理的错误(比如捕获**FileNotFoundException**时选择创建文件而捕获**HttpException**时直接终止程序继续执行)。

go的原生错误看起来只提供了“错误信息”，我们只能知道错误发生了，以及文字提示，但无法立即定位到代码发生在哪一个文件，哪一个函数，第几行——就像开头所说，十分地简略。

## error类型到底是什么
我们对`error`类型进行追踪跳转，会发现这其实是一个内建接口类：
```go
type error interface {
	Error() string
}
```
任何结构只要实现了`Error() string`方法就可以作为错误类使用，而这个方法返回的就是提供错误信息提示的字符串。

### 创建一个错误
当我们需要创建一个错误时，可以选择创建一个实现了错误接口的结构体实例——这通常是一些包的做法；如果我们只是临时创建一个简单的错误，则可以通过**errors**包的`New(text string) error`快速实现。这个方法返回的是一个简陋的**errorString**类：
```go
type errorString struct {
	s string
}

func (e *errorString) Error() string {
	return e.s
}
```
那么go的错误真的只是一个错误字符串提示而已吗？其实不然，既然它是一个接口，借助一些手段，我们也可以制定出丰富的功能。

我们首先从这个标准库errors包着手研究。

## errors标准库

从[文档](https://pkg.go.dev/errors?tab=doc)上看，原生`errors`包只有四个方法，分别是：
```go
func As(err error, target interface{}) bool
func Is(err, target error) bool
func New(text string) error
func Unwrap(err error) error
```
其中**New**方法我们已经知道了。

从文档描述中可以看出前面两个**As**和**Is**方法是基于**Unwrap**方法实现的，因此我们先看Unwrap方法。

### Unwrap方法
从文档描述或源码看，可知这一方法判断如果错误类实现了`Unwrap() error`方法则调用该方法，否则返回nil：
```go
// GoSDK1.14/src/errors/wrap.go:line 14
// Unwrap returns the result of calling the Unwrap method on err, if err's
// type contains an Unwrap method returning error.
// Otherwise, Unwrap returns nil.
func Unwrap(err error) error {
	u, ok := err.(interface {
		Unwrap() error
	})
	if !ok {
		return nil
	}
	return u.Unwrap()
}
```
这个**Unwrap**又有什么作用？我们可以直接通过源码附带的测试文件找到参考：
```go
// GoSDK1.14/src/errors/wrap_test.go:
// line 219
type wrapped struct {
	msg string
	err error
}

func (e wrapped) Error() string { return e.msg }

func (e wrapped) Unwrap() error { return e.err }
// line 17
err1 := errors.New("1")
erra := wrapped{"wrap 2", err1}
```
从名字上就可以很直白地判断出来，这是对原有的错误具有包装作用，同时实现了错误类接口的一个结构体：我们可以用它来递归地记录错误信息，就像错误栈一样。**Error**负责输出本层错误类的文字信息，而**Unwrap**给出前一层的错误类。

从这里我们可以知道，根据errors标准库的思路，go的简略错误处理还可以递归地存储多级的错误信息。

### As方法
明白了**Unwrap**的用途，接下来可以继续了解基于此方法的**As**方法。

根据注释描述，可知该方法首先判断err的值是否可以赋给target，否则递归地调用**Unwrap**方法重复检查，直到得到**nil**或者可以赋值。赋值成功或者其中某一层的错误类实现了`As(interface{}) bool`且结果为true时返回true，否则false：
```go
// GoSDK1.14/src/errors/wrap.go:line90
func As(err error, target interface{}) bool {
	// 省略
	for err != nil {
		if reflectlite.TypeOf(err).AssignableTo(targetType) {
			val.Elem().Set(reflectlite.ValueOf(err))
			return true
		}
		if x, ok := err.(interface{ As(interface{}) bool }); ok && x.As(target) {
			return true
		}
		err = Unwrap(err)
	}
	return false
}
```

这个方法有什么用呢？前文中提到，在其他语言中可以通过捕获不同类型的错误来有选择地后续处理的错误，在理解了error本质是一个接口时，我们实际上也可以通过类型断言的方式(`pe, ok := err.(PathErr)`)来判断返回的错误是**PathErr**还是**SyscallError**。但是如果用到递归记录错误信息的结构时，就难以直接通过这种方式来判断某一层的错误类型。递归的错误需要递归地**Unwrap**判断——此时我们再回顾**As**这个方法便明白了它的用途：判断返回的错误中是否递归包含了某个类型的错误，并且在肯定的情况下获取那个错误的信息，相当于实现了：
```php
try {
  // ... something will cause FileNotFoundException
} catch (FileNotFoundException $e) {
  // ... then create the file
}
```
从测试代码中可以看出相同的意图。

### Is方法
如果说**As**方法判断的是递归中的错误类型，那么**Is**方法则是递归判断两个错误的类型和值是否完全相等，如果错误类型中实现了`Is(target error) bool`方法则会在无法比较(`isComparable=false`)或比较失败的情况下根据此方法再一次判断是否相等：
```go
// GoSDK1.14/src/errors/wrap.go:line45
func Is(err, target error) bool {
	// 省略
	for {
		if isComparable && err == target {
			return true
		}
		if x, ok := err.(interface{ Is(error) bool }); ok && x.Is(target) {
			return true
		}
		if err = Unwrap(err); err == nil {
			return false
		}
	}
}
```
同样在测试文件中可以看到一些类型的比较以及自定义Is方法的使用。

好了，简短地看完了errors标准库的内容，我们了解到了其实go的error并不像想象中那么简陋仅可以获得字符串信息，还可以通过实现包裹错误结构的方式来递归存储错误信息以及精确捕捉想要的错误类型和错误内容。

但是这依然无法完全满足我们的需要，除了判断错误的类型和内容，我们还想要知道发生错误的文件、行号和函数名，更方便快捷地定位错误——这样的需求可以通过go标准库实现吗？当然可以，但是在此之前，可以先了解一下一个十分好用且实现简洁的第三方库**github.com/pkg/errors**。

## pkg/errors第三方库
查看[文档](https://pkg.go.dev/github.com/pkg/errors?tab=doc)索引，比起errors标准库似乎方法更多了一些，实际上其中有4个是标准库的方法，这个第三方包其实是对标准库的一个补充。补充的内容主要包括四个方法和两个结构体：
```go
func Cause(err error) error
func WithMessage(err error, message string) error
func WithStack(err error) error
func Wrap(err error, message string) error
type Frame
  func (f Frame) Format(s fmt.State, verb rune)
  func (f Frame) MarshalText() ([]byte, error)
type StackTrace
  func (st StackTrace) Format(s fmt.State, verb rune)
```
### 重新实现的New方法
在阅读文档时候，我们发现pkg/errors也有一个自己的**New**方法，我们先使用它实例化一个错误变量，然后对其进行打印：
```go
package main

import (
  "fmt"
  "github.com/pkg/errors"
)

func main() {
  err := errors.New("an error")
  fmt.Println(err)
  // ouput: an error
}
```
一个字符串，似乎没什么不同？

继续看文档，发现在**Formatted printing of errors**即格式化打印错误的说明中，告知了结合fmt包的格式化打印会有一些新的特性支持：
```
%s    打印错误。如果错误实例包含了Cause方法则会递归地进行打印
%v    同%s
%+v   扩展格式。错误栈中的每一帧都会被详细地打印出来
```
前两个没什么特殊的，当我们使用`fmt.Printf("%+v\n", err)`进行打印时，发现除了字符串错误信息，“文件名”、“函数名”、“代码行数”也一并洋洋洒洒地输出在终端中！
```bash
an error
github.com/yuchanns/gobyexample/errors.TestPkgErrors
	/Users/yuchanns/Coding/golang/gobyexample/errors/pkg_errors_test.go:10
testing.tRunner
	/Users/yuchanns/go/go1.14/src/testing/testing.go:992
runtime.goexit
	/Users/yuchanns/go/go1.14/src/runtime/asm_amd64.s:1373
```
似乎有点神奇——
### 错误栈的使用
也许我们应该接着探究这个功能是怎么实现的，但是这涉及到另一个标准库，因此我决定暂且按下不表:smirk:。

前文我们提到标准库有一个**Unwrap**方法，用于递归读取错误信息，但是包裹错误需要由我们自行实现。而在这个第三方库中，提供了一个**WithWrap**方法来帮我们实现了包裹方法：
```go
package main

import (
  errors2 "errors"
  "fmt"
  "github.com/pkg/errors"
)

func main() {
  err := errors2.New("error a")
  err3 := errors.WithMessage(err, "error b")
  fmt.Printf("%+v\n", err3)
  err4 := errors.Cause(err3)
	fmt.Printf("%+v\n", err4)
  // output: 
  // error a
  // error b
  // error a
}
```
这样我们就免于自行构建包裹函数，十分方便，并且可以通过它提供的**Cause(err error)**函数回溯字符串错误栈。

同时我们注意到这个包中除了**WithMessage**和**Cause**，还拥有**Wrap**对应标准库的**Unwrap**，似乎功能重复了？实际不然，因为**Wrap**是用于包裹具有“文件名”、“函数名”、“代码行数”这些详细错误信息的错误类。

**WithStack**方法则是将标准库的错误实例包装成具备详细错误栈的实例，它和**Wrap**很相似，差别只在一个参数上，或者说，**WithMessage**加上**WithStack**就是**Wrap**。

总而言之，如果我们完全使用这个第三方库作为错误处理，那么大概的流程就是：
> 使用**errors.New**创建一个具备详细错误信息的错误类
>
> 使用**errors.Wrap**包裹上一个错误，形成具备详细错误信息的错误栈
>
> 通过**errors.Unwrap**获取上一个包括了详细错误信息的错误类
>
> 通过**errors.Cause**获取上一个错误类的字符串错误信息

而如果已有的错误使用的是标准库错误实例，那么通过**errors.WithStack**就可以将其转成具备详细错误信息的错误类，其他处理流程和上面的相同。结合自定义类，我们就可以轻松做到精确捕捉错误类型和定位错误发生点：
```go
package main

import (
	errors2 "errors"
	"fmt"
	"github.com/pkg/errors"
	"os"
)

func main() {
    err := virtualErr()
    var err2 *os.PathError
    var err3 *whateverErr
    if errors2.As(err, &err2) {
        fmt.Println("file not found")
        // write err stack into a log file in some way
        // such as fmt.Sprintf("%+v", err)...
    } else if errors2.As(err, &err3) {
        fmt.Println("custom diplay errors", err3.CustomError())
    }
}

type whateverErr struct {
	msg string
}

func (w *whateverErr) Error() string {
	return w.msg
}

func (w *whateverErr) CustomError() string {
	return "a text that tells file not found~"
}

func virtualErr() error {
	if _, err := os.Open("non-existing"); err != nil {
		return errors.WithStack(err)
	}
	return errors.WithStack(&whateverErr{msg: "this is a whatever error"})
}
```
---
未完待续
