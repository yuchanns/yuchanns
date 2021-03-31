---
title: "go应用平滑重启"
date: 2019-12-22T05:50:00+08:00
draft: false
---
## 从一个例子开始
工作中，一个web应用常常需要迭代更新。与php-fpm脚本类语言的应用不同，编译成二进制文件部署的进程需要往内存中重新载入新版本的代码才能完成更新。

而我们对于这种持续型网站的服务，期望它不需要暂停用户的使用就可以完成这一步骤，也就是所谓的“平滑重启”。

笔者所使用的是github上的开源库[fvbock/endless](https://github.com/fvbock/endless)。

使用方式很简单：

```
package main

import (
	"fmt"
	"github.com/fvbock/endless"
	"log"
	"net/http"
	"os"
	"time"
)

const layout = "2006-01-02 15:04:05"

func main() {
	http.HandleFunc("/delay", func(writer http.ResponseWriter, request *http.Request) {
		time.Sleep(20 * time.Second)
		str := fmt.Sprintf("hello world in %s and pid is %d", time.Now().Format(layout), os.Getpid())
		_, _ = writer.Write([]byte(str))
		log.Println(str)
	})
	srv := endless.NewServer(":9001", nil)
	srv.BeforeBegin = func(add string) {
		log.Printf("pid is %d", os.Getpid())
	}

	_ = srv.ListenAndServe()
}
```

为了方便测试，笔者添加了一个`/delay`路由，效果是在访问后睡眠20秒，然后响应一句话并显示响应的时间的进程id。

应用在启动时会打印它的pid。然后打开一个终端，使用curl访问`localhost:9001/delay`，同时使用`kill -1 $pid`对该应用发出**SIGHUP**的信号，接着再使用另一个终端curl再次访问同样的路由，可以看到应用具有类似如下输出：

```
2020/09/14 17:03:11 pid is 1877
2020/09/14 17:03:23 1877 Received SIGHUP. forking.
2020/09/14 17:03:23 1877 Received SIGTERM.
2020/09/14 17:03:23 pid is 1883
2020/09/14 17:03:23 1877 Waiting for connections to finish...
2020/09/14 17:03:23 1877 [::]:9001 Listener closed.
2020/09/14 17:03:35 hello world in 2020-09-14 17:03:35 and pid is 1877
2020/09/14 17:03:35 1877 Serve() returning...
```
观察可知，原应用收到**SIGHUP**信号之后首先进行了fork操作，同时又对自身再次发起一个**SIGTERM**信号。然后日志显示旧进程在等待连接结束后再关闭监听。这一点我们也可以通过第一个curl终端返回了旧的pid、第二个curl终端则返回新的pid得到证明。

> 注意：进行平滑重启之后，由于应用自身做了fork操作，导致和终端的对话断开，无法使用`ctrl+c`的方式关闭应用，这时候可以使用`lsof -i tcp:9001`找出新进程的pid，将其kill掉。

当然本文并不是介绍该库的使用，而是借此研究一下平滑重启的实现方式。

## 平滑重启的实现
从上面的例子可以看出，一个平滑重启的过程，其实就是“当前进程唤起一个新的进程载入内存接管新的tcp访问，同时当前进程停止对新的tcp连接的接收，并等待旧有的连接完成操作，再自行退出”。

了解了这个原理，我们就可以直接自己实现相同的步骤。事实上笔者也确实这么[做](https://github.com/yuchanns/gobyexample/tree/master/graceful)了。

不过当前就让我们通过阅读第三方库的源码来了解平滑重启的实现。

首先，和普通的`net/http`相比，该库使用`endless.endlessServer`代替原生的`http.Server`结构体，然后我们就可以用通过发送相应的信号使它平滑重启或平滑关闭。

```
type endlessServer struct {
	http.Server
	EndlessListener  net.Listener
	SignalHooks      map[int]map[os.Signal][]func()
	tlsInnerListener *endlessListener
	wg               sync.WaitGroup
	sigChan          chan os.Signal
	isChild          bool
	state            uint8
	lock             *sync.RWMutex
	BeforeBegin      func(add string)
}
```
观察这个结构体，可以看到它内嵌了标准库原生的http.Server结构体，这样就可以继承全部功能。除此之外，需要关注的重点就是`SignalHooks`——信号钩子。

我们必须通过`endless.NewServer`这个方法创建该结构体的实例。然后调用`func (srv *endlessServer) ListenAndServe() (err error)`唤起服务器。

在这个方法中，调用了一个`func (srv *endlessServer) handleSignals()`方法，就是关于平滑重启的具体实现过程。可以看到，上面提到的SignalHooks，具有`PRE`和`POST`两种调用时机，分别在信号处理前和信号处理后。这样用户就可以自定义前置和后置信号动作了。

```
func (srv *endlessServer) handleSignals() {
	var sig os.Signal

	signal.Notify(
		srv.sigChan,
		hookableSignals...,
	)

	pid := syscall.Getpid()
	for {
		sig = <-srv.sigChan
		srv.signalHooks(PRE_SIGNAL, sig)
		switch sig {
		case syscall.SIGHUP:
			log.Println(pid, "Received SIGHUP. forking.")
			err := srv.fork()
			if err != nil {
				log.Println("Fork err:", err)
			}
		case syscall.SIGUSR1:
			log.Println(pid, "Received SIGUSR1.")
		case syscall.SIGUSR2:
			log.Println(pid, "Received SIGUSR2.")
			srv.hammerTime(0 * time.Second)
		case syscall.SIGINT:
			log.Println(pid, "Received SIGINT.")
			srv.shutdown()
		case syscall.SIGTERM:
			log.Println(pid, "Received SIGTERM.")
			srv.shutdown()
		case syscall.SIGTSTP:
			log.Println(pid, "Received SIGTSTP.")
		default:
			log.Printf("Received %v: nothing i care about...\n", sig)
		}
		srv.signalHooks(POST_SIGNAL, sig)
	}
}
```

接下来就是本文的重点，`func (srv *endlessServer) fork() (err error)`过程的实现。

为避免读者迷惑，笔者删除与重点无关的代码。

```
func (srv *endlessServer) fork() (err error) {
	var files = make([]*os.File, len(runningServers))
	var orderArgs = make([]string, len(runningServers))
	// 获取所有服务实例的socket文件描述符
	for _, srvPtr := range runningServers {
		switch srvPtr.EndlessListener.(type) {
		case *endlessListener:
			// normal listener
			files[socketPtrOffsetMap[srvPtr.Server.Addr]] = srvPtr.EndlessListener.(*endlessListener).File()
		}
		orderArgs[socketPtrOffsetMap[srvPtr.Server.Addr]] = srvPtr.Server.Addr
	}
  
	env := append(
		os.Environ(),
		"ENDLESS_CONTINUE=1",
	)

	path := os.Args[0]
	var args []string
	if len(os.Args) > 1 {
		args = os.Args[1:]
	}

	cmd := exec.Command(path, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.ExtraFiles = files
	cmd.Env = env

	err = cmd.Start()
	if err != nil {
		log.Fatalf("Restart: Failed to launch, error: %v", err)
	}

	return
}
```
通体看下来，实际上实现的方式就是使用`exec`包的**Command**方法，自我调用了二进制文件。比较令人感兴趣的是，socket监听是怎么移交给新进程的。

众所周知，linux的哲学，就是一切皆文件，socket监听资源自然也是一个文件，所以理论上我们应该可以通过文件资源句柄传递的方式，把当前进程的socket句柄传递给新的进程。

注意到此函数体中间有一段`srvPtr.EndlessListener.(*endlessListener).File()`，追踪进去发现实际上调用的是`func (l *TCPListener) File() (f *os.File, err error)`方法，这是一个标准库的方法。

查看相关注释就可以知道，该方法正式把socket句柄以`*os.File`的形式返回给用户，然后用户可以通过`exec.ExtraFiles []*os.File`附加这些句柄，传递给下一个进程。

> ExtraFiles specifies additional open files to be inherited by the new process. It does not include standard input, standard output, or standard error. If non-nil, entry i becomes file descriptor 3+i.
>
> ExtraFiles用于指定新进程继承的被打开的文件，它不包括标准io和错误。可以通过3+i的方式获取文件描述符来接管文件。

比如说，在当前进程中，一个socket资源句柄在`cmd.ExtraFiles`的索引是0，那么在新进程中，我们就可以通过`os.NewFile(3+0, "")`的方式获取到对应的文件描述符。

稍稍往下一点，可以发现该方法对系统注入了一个环境变量`ENDLESS_CONTINUE=1`，这是用来标记是否为被fork的子进程所使用的环境变量。

回到`func (srv *endlessServer) ListenAndServe() (err error)`这个方法，我们这时才注意到，中间有一段关于`srv.isChild`的分支，其实就是通过上面那个环境变量来标记是否为子进程。如果是，他就对父进程发起**SIGTERM**信号，通知进程终结。其他操作和父进程启动时无误。

而通过刚才的`func (srv *endlessServer) handleSignals()`我们可以知道，进程在接收到终止命令后，会调用`func (srv *endlessServer) shutdown()`方法。此方法内部调用了标准库`func (l *TCPListener) Close() error`方法，将闲置的连接关闭，以及阻塞等待正在执行的连接关闭。之后就会自行退出。

如此，就实现了一次平滑重启的流程。

## 总结
现在笔者将整个平滑重启的流程总结如下：
* 进程启动后注册信号处理函数，分别注册了**SIGHUP**和**SIGTERM**信号
* 接收到**SIGHUP**信号后，获取当前tcp服务的socket资源句柄，将其描述符附加到子进程中并注入环境变量标记子进程要启动，启动子进程
* 子进程启动后，根据环境变量对父进程发出**SIGTERM**信号，然后开始接收新的连接提供服务。
* 父进程根据**SIGTERM**，等待已有连接活动结束后自行退出。
