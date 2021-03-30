---
title: "go内存泄露"
date: 2020-11-03T14:48:45+08:00
draft: false
---
今天同事遇到一个问题，是关于goroutine的泄露。

## 问题和分析

代码简化后如下：
```go
package main

import (
	"errors"
	"fmt"
	"github.com/gin-contrib/pprof"
	"github.com/gin-gonic/gin"
	"log"
	"net/http"
)

func leakGrs() error {
	s := []int{1, 2, 3, 4, 5, 6, 7, 8, 9}
	ch := make(chan error)

	for i := range s {
		go func(i int) {
			var err error
			if i == 3 {
				err = errors.New("something wrong")
			}
			ch <- err
		}(i)
	}

	for range s {
		err := <-ch
		if err != nil {
			return err
		}
	}

	return nil
}

func handlerLeakGrs(c *gin.Context) {
	err := leakGrs()
	c.JSON(http.StatusOK, gin.H{
		"err": fmt.Sprintf("%+v", err),
	})
}

func main() {
	engine := gin.Default()
	pprof.Register(engine)
	engine.GET("/", handlerLeakGrs)
	server := http.Server{
		Addr:    ":8080",
		Handler: engine,
	}
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("cannot start server: %+v", err)
	}
}
```
由于引入了pprof，所以我们可以通过`http://localhost:8080/debug/pprof/goroutine?debug=1`访问到goroutine状况——

在一开始，一共有三个goroutine，分别是一个主G和两个net/http的G：
```bash
goroutine profile: total 3
1 @ 0x1038170 0x103178a 0x1030d55 0x10ca245 0x10cb141 0x10cb123 0x11a389f 0x11b684e 0x12c9a88 0x10677b1
#	0x1030d54	internal/poll.runtime_pollWait+0x54		/Users/yuchanns/go/go1.14/src/runtime/netpoll.go:203
#	0x10ca244	internal/poll.(*pollDesc).wait+0x44		/Users/yuchanns/go/go1.14/src/internal/poll/fd_poll_runtime.go:87
#	0x10cb140	internal/poll.(*pollDesc).waitRead+0x200	/Users/yuchanns/go/go1.14/src/internal/poll/fd_poll_runtime.go:92
#	0x10cb122	internal/poll.(*FD).Read+0x1e2			/Users/yuchanns/go/go1.14/src/internal/poll/fd_unix.go:169
#	0x11a389e	net.(*netFD).Read+0x4e				/Users/yuchanns/go/go1.14/src/net/fd_unix.go:202
#	0x11b684d	net.(*conn).Read+0x8d				/Users/yuchanns/go/go1.14/src/net/net.go:184
#	0x12c9a87	net/http.(*connReader).backgroundRead+0x57	/Users/yuchanns/go/go1.14/src/net/http/server.go:678

1 @ 0x1038170 0x103178a 0x1030d55 0x10ca245 0x10ccaa4 0x10cca86 0x11a4152 0x11bf2a2 0x11be0e4 0x12d42dd 0x12d4027 0x15882d9 0x1037d92 0x10677b1
#	0x1030d54	internal/poll.runtime_pollWait+0x54		/Users/yuchanns/go/go1.14/src/runtime/netpoll.go:203
#	0x10ca244	internal/poll.(*pollDesc).wait+0x44		/Users/yuchanns/go/go1.14/src/internal/poll/fd_poll_runtime.go:87
#	0x10ccaa3	internal/poll.(*pollDesc).waitRead+0x1d3	/Users/yuchanns/go/go1.14/src/internal/poll/fd_poll_runtime.go:92
#	0x10cca85	internal/poll.(*FD).Accept+0x1b5		/Users/yuchanns/go/go1.14/src/internal/poll/fd_unix.go:384
#	0x11a4151	net.(*netFD).accept+0x41			/Users/yuchanns/go/go1.14/src/net/fd_unix.go:238
#	0x11bf2a1	net.(*TCPListener).accept+0x31			/Users/yuchanns/go/go1.14/src/net/tcpsock_posix.go:139
#	0x11be0e3	net.(*TCPListener).Accept+0x63			/Users/yuchanns/go/go1.14/src/net/tcpsock.go:261
#	0x12d42dc	net/http.(*Server).Serve+0x25c			/Users/yuchanns/go/go1.14/src/net/http/server.go:2901
#	0x12d4026	net/http.(*Server).ListenAndServe+0xb6		/Users/yuchanns/go/go1.14/src/net/http/server.go:2830
#	0x15882d8	main.main+0x138					/Users/yuchanns/Coding/golang/gobyexample/main.go:51
#	0x1037d91	runtime.main+0x211				/Users/yuchanns/go/go1.14/src/runtime/proc.go:203

1 @ 0x13603a5 0x13601c0 0x135cf8a 0x136a3aa 0x1587ef8 0x1587ea7 0x157245b 0x1585cb0 0x157245b 0x1584de1 0x157245b 0x157c346 0x157ba1e 0x12d3f33 0x12cf8ac 0x10677b1
#	0x13603a4	runtime/pprof.writeRuntimeProfile+0x94				/Users/yuchanns/go/go1.14/src/runtime/pprof/pprof.go:694
#	0x13601bf	runtime/pprof.writeGoroutine+0x9f				/Users/yuchanns/go/go1.14/src/runtime/pprof/pprof.go:656
#	0x135cf89	runtime/pprof.(*Profile).WriteTo+0x3d9				/Users/yuchanns/go/go1.14/src/runtime/pprof/pprof.go:329
#	0x136a3a9	net/http/pprof.handler.ServeHTTP+0x339				/Users/yuchanns/go/go1.14/src/net/http/pprof/pprof.go:248
#	0x1587ef7	net/http.HandlerFunc.ServeHTTP+0x77				/Users/yuchanns/go/go1.14/src/net/http/server.go:2012
#	0x1587ea6	github.com/gin-contrib/pprof.pprofHandler.func1+0x26		/Users/yuchanns/go/pkg/mod/github.com/gin-contrib/pprof@v1.3.0/pprof.go:56
#	0x157245a	github.com/gin-gonic/gin.(*Context).Next+0x3a			/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/context.go:156
#	0x1585caf	github.com/gin-gonic/gin.RecoveryWithWriter.func1+0x5f		/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/recovery.go:83
#	0x157245a	github.com/gin-gonic/gin.(*Context).Next+0x3a			/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/context.go:156
#	0x1584de0	github.com/gin-gonic/gin.LoggerWithConfig.func1+0xe0		/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/logger.go:241
#	0x157245a	github.com/gin-gonic/gin.(*Context).Next+0x3a			/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/context.go:156
#	0x157c345	github.com/gin-gonic/gin.(*Engine).handleHTTPRequest+0x665	/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/gin.go:409
#	0x157ba1d	github.com/gin-gonic/gin.(*Engine).ServeHTTP+0x17d		/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/gin.go:367
#	0x12d3f32	net/http.serverHandler.ServeHTTP+0xa2				/Users/yuchanns/go/go1.14/src/net/http/server.go:2807
#	0x12cf8ab	net/http.(*conn).serve+0x86b					/Users/yuchanns/go/go1.14/src/net/http/server.go:1895
```
然后对`http://localhost:8080/debug/pprof/goroutine?debug=1`进行多次访问，再次查看goroutine状态，发现G的数量多达153，其中150个全是`main.leakGrs`这个方法的：
```bash
goroutine profile: total 153
150 @ 0x1038170 0x1006dfd 0x1006bc5 0x15883ee 0x10677b1
#	0x15883ed	main.leakGrs.func1+0x4d	/Users/yuchanns/Coding/golang/gobyexample/main.go:22

1 @ 0x1038170 0x103178a 0x1030d55 0x10ca245 0x10ccaa4 0x10cca86 0x11a4152 0x11bf2a2 0x11be0e4 0x12d42dd 0x12d4027 0x15882d9 0x1037d92 0x10677b1
#	0x1030d54	internal/poll.runtime_pollWait+0x54		/Users/yuchanns/go/go1.14/src/runtime/netpoll.go:203
#	0x10ca244	internal/poll.(*pollDesc).wait+0x44		/Users/yuchanns/go/go1.14/src/internal/poll/fd_poll_runtime.go:87
#	0x10ccaa3	internal/poll.(*pollDesc).waitRead+0x1d3	/Users/yuchanns/go/go1.14/src/internal/poll/fd_poll_runtime.go:92
#	0x10cca85	internal/poll.(*FD).Accept+0x1b5		/Users/yuchanns/go/go1.14/src/internal/poll/fd_unix.go:384
#	0x11a4151	net.(*netFD).accept+0x41			/Users/yuchanns/go/go1.14/src/net/fd_unix.go:238
#	0x11bf2a1	net.(*TCPListener).accept+0x31			/Users/yuchanns/go/go1.14/src/net/tcpsock_posix.go:139
#	0x11be0e3	net.(*TCPListener).Accept+0x63			/Users/yuchanns/go/go1.14/src/net/tcpsock.go:261
#	0x12d42dc	net/http.(*Server).Serve+0x25c			/Users/yuchanns/go/go1.14/src/net/http/server.go:2901
#	0x12d4026	net/http.(*Server).ListenAndServe+0xb6		/Users/yuchanns/go/go1.14/src/net/http/server.go:2830
#	0x15882d8	main.main+0x138					/Users/yuchanns/Coding/golang/gobyexample/main.go:51
#	0x1037d91	runtime.main+0x211				/Users/yuchanns/go/go1.14/src/runtime/proc.go:203

1 @ 0x1054a5e 0x10b3ee6 0x10cb071 0x10cb03a 0x11a389f 0x11b684e 0x12c9a88 0x10677b1
#	0x1054a5d	syscall.syscall+0x2d				/Users/yuchanns/go/go1.14/src/runtime/sys_darwin.go:63
#	0x10b3ee5	syscall.read+0x65				/Users/yuchanns/go/go1.14/src/syscall/zsyscall_darwin_amd64.go:1242
#	0x10cb070	syscall.Read+0x130				/Users/yuchanns/go/go1.14/src/syscall/syscall_unix.go:189
#	0x10cb039	internal/poll.(*FD).Read+0xf9			/Users/yuchanns/go/go1.14/src/internal/poll/fd_unix.go:165
#	0x11a389e	net.(*netFD).Read+0x4e				/Users/yuchanns/go/go1.14/src/net/fd_unix.go:202
#	0x11b684d	net.(*conn).Read+0x8d				/Users/yuchanns/go/go1.14/src/net/net.go:184
#	0x12c9a87	net/http.(*connReader).backgroundRead+0x57	/Users/yuchanns/go/go1.14/src/net/http/server.go:678

1 @ 0x13603a5 0x13601c0 0x135cf8a 0x136a3aa 0x1587ef8 0x1587ea7 0x157245b 0x1585cb0 0x157245b 0x1584de1 0x157245b 0x157c346 0x157ba1e 0x12d3f33 0x12cf8ac 0x10677b1
#	0x13603a4	runtime/pprof.writeRuntimeProfile+0x94				/Users/yuchanns/go/go1.14/src/runtime/pprof/pprof.go:694
#	0x13601bf	runtime/pprof.writeGoroutine+0x9f				/Users/yuchanns/go/go1.14/src/runtime/pprof/pprof.go:656
#	0x135cf89	runtime/pprof.(*Profile).WriteTo+0x3d9				/Users/yuchanns/go/go1.14/src/runtime/pprof/pprof.go:329
#	0x136a3a9	net/http/pprof.handler.ServeHTTP+0x339				/Users/yuchanns/go/go1.14/src/net/http/pprof/pprof.go:248
#	0x1587ef7	net/http.HandlerFunc.ServeHTTP+0x77				/Users/yuchanns/go/go1.14/src/net/http/server.go:2012
#	0x1587ea6	github.com/gin-contrib/pprof.pprofHandler.func1+0x26		/Users/yuchanns/go/pkg/mod/github.com/gin-contrib/pprof@v1.3.0/pprof.go:56
#	0x157245a	github.com/gin-gonic/gin.(*Context).Next+0x3a			/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/context.go:156
#	0x1585caf	github.com/gin-gonic/gin.RecoveryWithWriter.func1+0x5f		/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/recovery.go:83
#	0x157245a	github.com/gin-gonic/gin.(*Context).Next+0x3a			/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/context.go:156
#	0x1584de0	github.com/gin-gonic/gin.LoggerWithConfig.func1+0xe0		/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/logger.go:241
#	0x157245a	github.com/gin-gonic/gin.(*Context).Next+0x3a			/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/context.go:156
#	0x157c345	github.com/gin-gonic/gin.(*Engine).handleHTTPRequest+0x665	/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/gin.go:409
#	0x157ba1d	github.com/gin-gonic/gin.(*Engine).ServeHTTP+0x17d		/Users/yuchanns/go/pkg/mod/github.com/gin-gonic/gin@v1.6.2/gin.go:367
#	0x12d3f32	net/http.serverHandler.ServeHTTP+0xa2				/Users/yuchanns/go/go1.14/src/net/http/server.go:2807
#	0x12cf8ab	net/http.(*conn).serve+0x86b					/Users/yuchanns/go/go1.14/src/net/http/server.go:1895
```
同事贴出他的代码，询问错误在哪里。实际代码比较复杂，特别是在循环返回错误那块，因此一时之间大家也没看出问题所在。

幸好因为事先知道问题在于这段代码造成的泄露，经过简化，很快大家就弄清楚了问题在于使用了go关键字的循环中，往无缓冲的通道写数据，而下面的通道读数据却并不总是全部读完，就会返回。这就造成了多个goroutine阻塞等待通道让位可以写入数据。

而goroutine都是平等而独立的，并且不会被gc所回收，一旦发生阻塞，就会一直存在，也就形成了事实上的“**goroutine泄露**”。更可怕的就是一次请求产生少量的泄露，一天下来的大量请求则会造成海量的goroutine泄露，数量飙升，后果就会变得严重，导致监控告警。

## 解决方法
代码中有两处错误，第一处是使用无缓冲通道。

使用无缓冲通道，通道只能容纳一个单位类型的数据；当存在多个写入成员时，需要等待原有的数据被读取后才能再次写入，造成阻塞排队。

所以提倡应该使用有缓冲的通道，并且把通道长度设置成写入成员的个数。

```go
func leakGrs() error {
	s := []int{1, 2, 3, 4, 5, 6, 7, 8, 9}
	ch := make(chan error, 9)
```
将`ch := make(chan error)`加上长度9，就不会发生泄露的问题了。所有的goroutine完成了通道写入，自动退出；而尽管读取通道并没有用到那么多数据，随着方法的结束，通道也将被gc回收。

第二处错误则是遇到错误直接return。

这种错误写法源于对常驻进程的不了解。这位同事和我一样是从php转语言而来的。习惯于php-fpm的程序员一般认为变量的生命周期仅在于一次请求当中；当请求结束后，代码内容全被清空，自然也就不存在链接忘记回收、goroutine阻塞等泄露问题。

所以即使发生了错误，正确的做法也应该是收集全部错误信息，或者及时通知goroutine退出。

## 总结
goroutine很好用，可以以极小的资源轻松创建成千上万，但这并不意味着可以被滥用。

防止goroutine泄露，一定要做好协程的退出准备和意外退出处理。

无缓冲通道会造成写入阻塞。
