---
title: "在Scheme中实现While"
date: 2020-06-26T09:11:00+08:00
draft: false
---
在ChezScheme中没有关于循环的语法。

最近在看数据结构和算法的东西，使用scheme来实现。打算使用单元测试+docker的方式进行，却发现无法使用死循环来维持容器生存。

没有的话，实现一个就好了，lisp的自由度很高，一个while自然不在话下。

## 定义语法
我们使用的是`define-syntax`关键字，来源于[R6RS标准](http://www.r6rs.org/final/html/r6rs/r6rs-Z-H-14.html#node_sec_11.2.2)。本质上是创建一个宏(Macro)，只不过lisp的宏比C系语言更强大一些。

```scheme
(define-syntax <keyword> <expression>)
```

这里需要注意下和`define`的区别。两者都可以创建一个函数，但是`define`使用的参数是形参，而`define-syntax`可以对参数进行修改影响到外部，这也是实现循环的一个必要条件。

```scheme
(library (libs customsyntax)
  (export while)
  (import (chezscheme))

  (define-syntax while
    (syntax-rules ()
      ((_ pred proc1 ...)
        (let loop () (when pred proc1 ... (loop))))))
)
```
while的内部的实现其实就是递归的自我调用，结合when对条件进行判断来决定什么时候结束递归。

下面是使用示范：

```scheme
(import (chezscheme)
        (libs customsyntax))

(let ((i 0)
      (a-second (make-time 'time-duration 0 1)))
  (while (> 5 i)
    (display (current-time 'time-utc))
    (newline)
    (sleep a-second)
    (set! i (+ i 1)))
)
```
每隔一秒输出一次utc时间，循环5次

