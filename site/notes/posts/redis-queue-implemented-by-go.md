---
title: go 语言实现 redis 队列
---
[[文章索引|posts]] [[Go 系列|go]]

最近做一个小型项目，因为**rabbitMQ**等专业软件比较重，故团队决定采用**redis**实现一个轻量的队列。

## 目标
在这篇文章中，你可以获得：
* `redigo`包的基本用法
* 初步认知`context`包的作用
* 了解一个功能模块的实现思路以及如何逐步完善的步骤
* **Go**特性(`select`、`channel`和`goroutine`)的利用

最终代码量大概265行左右。

## redis队列的原生用法
`redis`并不是被设计用来做队列的，事实上它并不是那么适合作为队列载体——官方也不推荐用来做队列，甚至因为使用`redis`做队列的人太多，而促使[antirez](https://github.com/antirez)(redis的作者)开发了另一个名为Disque[^1]的专业队列库，据说将会加入到`redis6`中。

尽管如此，`redis`依旧提供了号称*Reliable queue*的队列指令[^2]。

> 我们知道，当生产者在另一端生成消息之后，这一端的消费者就要取出这一消息进行消费动作；而在消费的过程中如果出现任何异常——例如“程序崩溃”等问题，造成进程的退出，消息就会丢失。为此，`redis`官方提供了`RPOPLPUSH`这一队列指令，在从队列中取出消息的同时又塞进另一个队列中。这样当程序发生异常退出时，我们也可以通过第二个队列来找回丢失的消息。

它的使用方法是：
```
127.0.0.1:6379> RPOPLPUSH sourceQueue destQueue
```
这意味着我们需要准备两个队列，一个待执行队列，一个执行队列。在消费动作完成之后，通过`LREM`执行删除执行队列中的消息成员；除此之外，我们还需要时常检查执行队列中是否有滞留的消息成员。如果有，表示之前有消息没被消费，再通过`RPOPLPUSH`指令重新放回待执行队列。
```
127.0.0.1:6379> LREM queue numbers msg
```
而生产者则是通过`LPUSH`这一指令将消息推入待执行队列的：
```
127.0.0.1:6379> LPUSH queue msg
```
下图展示了原生redis下的整个**生产-消费**流程：

## 队列、消息的设计思路
接下来我们使用Go语言来编写实现队列的代码。

首先可以明确的是，我们需要一个队列结构，以及一个消息结构。

### 队列的功能
队列需要做哪些工作呢？队列需要和redis产生通信、交互。因此它需要拥有一个字段用来保存redis的连接；我们所有的对redis操作都通过队列来实现，因此最好在此结构上封装一些简易的redis操作方法，比如`lrem`；另外当我们把消息传给队列时，它需要有一个`delivery`方法将消息投递到队列中；此外也要有一个`receive`方法将消息从队列中取出。

基于这些描述，我们对队列的结构有了一个大致的了解，可以将其用代码描述出来：
```go
type Queue struct {
    conn *redis.Connect
}

func (q *Queue) lrem(msg, queue string) {
    q.conn.lrem(queue, 1, msg)
}

// 大写是因为这个方法是提供给外部调用的
func (q *Queue) Delivery(msg, queue string) {
    q.conn.lpush(queue, msg)
}

func (q *Queue) Receive(source, dest string) {
    msg := q.conn.rpoplpush(source, dest)
    // 做一些消费操作
}
```
当然这只是一个雏形，后面我们会把它变得更复杂一点。
### 消息的功能
既然是消息，那么它就需要携带一些信息。

通过上一小节的队列功能设想，我们发现每个方法都需要告诉队列要投递的队列名称，因此我们其实可以把队列名称附加到消息结构体上，这样一来，队列结构拿到消息之后，可以通过调用`getChannel`之类的方法来获取要投递的队列名称。此外消息结构体需要存储的信息不一定是一个字符串那么简单，可能是更复杂的多维信息，并且维持一定的格式也有助于规范使用者使用消息，方便程序处理——但是redis队列只支持传入字符串值，那么我们需要两个方法，把消息内容转化为字符串以及从字符串转化回来，也就是序列化，将其命名为`marshal`和`unmarshal`。

同时我们注意到在队列取出消息之后，还会执行消费操作。当我们传递不同的信息时，可能需要执行的消费动作也不同；为扩展考虑，不能每新增一种消息就往队列中添加新的消费动作代码，所以我们最好让消息结构本身自带一个消费方法，只需要队列取出消息之后调用这个方法进行消费即可，将其命名为`resolve`。

不同消息需要创建不同的消息结构，但是他们都最好遵照我们前面定下的消息结构规范，这样队列可以统一使用同一种流程来处理消息。因此我们这里使用**接口**来约定结构。
```go
type IMessage interface {
    Resolve()
    GetChannel() string
    Marshal() string
    Unmarshal(string) IMessage
}
```
## 第三方库的选择
为了实现上面两个结构体，我们需要一些第三方库的协助。

* redis交互：这里笔者采用`gomodule/redigo`[^3]来实现。这个库自带维护一个redis连接池，可以为后面的多消费者扩展提供方便。
* 消息序列化：序列化有多种选择，比如JSON、Protobuf、Gob等。笔者采用`json-iterator/go`[^4]这个库来实现。

这里简单介绍一下两个第三方库的基本用法，感兴趣的读者可以自行查阅官方文档或者源码了解更详细的用法。

### redigo
`redigo`提供了一个连接池管理方案，通过实例化`redis.Pool`结构，可以获取一个连接池实例，每次使用时通过调用实例的`func (p *Pool) Get() redis.Conn`方法获取一个redis连接，然后通过redis连接的`func (ac *activeConn) Close() error`方法将用完的连接回收。
```go
import "github.com/gomodule/redigo/redis"

// 创建连接池实例
pool := &redis.Pool{
    Dial: func() (conn redis.Conn, err error) {
        return redis.Dial("tcp", ":6379")
    },
    TestOnBorrow: func(c redis.Conn, t time.Time) error {
        if time.Since(t) < time.Minute {
            return nil
        }
        _, err := c.Do("PING")
        return err
    },
}
// 获取一个连接
conn := pool.Get()
// 回收一个连接
defer conn.Close()
```
使用`redigo`从redis队列中读取或推送消息时，需要使用[]byte类型的消息：
```go
msg := []byte("hello redis")
if _, err := conn.Do("LPUSH", "prepare", msg); err != nil {
    panic(err)
}
r, err := conn.Do("RPOPLPUSH", sourceQueue, destQueue)
if err != nil {
    panic(err)
}
rUint8, ok := r.([]uint8)
if !ok {
    panic("cannot assert reply as []uint8")
}
fmt.Println(string(rUint8)) // "hello redis"
```

### jsoniter
我写过一篇[《json-iterator/go使用笔记》](https://yuchanns.org/posts/2020/02/07/usage-of-json-iterator-go/)，感兴趣的读者可以点击阅读。

**jsoniter**可以将结构体转化成`[]byte`，也可以将`[]byte`转化成结构体。
```go
import jsoniter "github.com/json-iterator/go"

// 通过tag标注序列化后对应的字段
type Test struct{
    Id      int    `json:"id"`
    Content string `json:"content"`
}

t := &Test{Id: 1, Content: "a test"}
// 序列化
str := jsoniter.Marshal(t) // {"id":1,"content":"a test"}
// 反序列化
var t2 Test
jsoniter.Unmarshal(str, &t2)
```

## 整理实现
在接触了两个第三方库之后，我们需要对原先设计的队列和消息做一些适配修改。

### 消息接口
首先从消息接口`IMessage`着手，然后我们通过编写一个结构体`Message`来实现该接口。
> message.go

```go
package main

type IMessage interface {
    Resolve() error                     // 返回一个error类型告知队列消息是否消费成功
    GetChannel() string                 // 返回一个字符串类型告知队列要投递的目标
    Marshal() ([]byte, error)           // 将自身序列化为[]byte类型的消息，并返回一个error类型表示是否成功
    Unmarshal([]byte) (IMessage, error) // 接收一个[]byte类型的消息，将其反序列化为实现了IMessage接口的结构体，并返回一个error类型表示是否成功
}

// 实现接口的结构
type Message struct {
    name    string // 投递的目标名称
    Content map[string]string `json:"content"` // 要进行序列化的消息内容
}

func (m *Message) GetChannel() string {
    return m.name
}

func (m *Message) Resolve() error {
    // 简单通过打印来表示已经消费。在实际使用中可能是复杂的业务逻辑
    fmt.Printf("consumed %+v\n", m.Content)
    return nil
}

func (m *Message) Marshal() ([]byte, error) {
    return jsoniter.Marshal(m)
}

func (m *Message) Unmarshal(reply []byte) (IMessage, error) {
    var msg Message
    err := jsoniter.Unmarshal(reply, &msg)

    return &msg, err
}
```

### 队列结构
队列结构需要存储redigo的连接池实例。
> queue.go

```go
package main

type Queue struct {
    pool *redis.Pool
}

// 此方法用于删除执行队列中的消息
func (q *Queue) lrem(queue string, reply interface{}) error {
    conn := q.pool.Get()
    defer conn.Close()
    if _, err := conn.Do("LREM", queue, 1, reply); err != nil {
        fmt.Println("failed to lrem", err)

        return err
    }
    return nil
}

// 此方法用于读取消息并反序列化为消息结构
func (q *Queue) rpoplpush(imsg IMessage, sourceQueue, destQueue string) (interface{}, IMessage, error) {
    conn := q.pool.Get()
    defer conn.Close()
    r, err := conn.Do("RPOPLPUSH", sourceQueue, destQueue)
    // 读取失败，返回原因
    if err != nil {
        return nil, nil, err
    }
    // 读取成功，但有可能是空消息
    if r == nil {
        return nil, nil, nil
    }
    // 断言为[]uint8类型
    rUint8, ok := r.([]uint8)
    if !ok {
        return nil, nil, errors.New("cannot assert reply as type []uint8")
    }
    
    if msg, err := imsg.Unmarshal(rUint8); err != nil {
        // 使用消息结构自带的反序列方法进行反序列
        return nil, nil, err
    } else if _, ok := msg.(IMessage); ok {
        // 判断消息结构是否实现了接口标准
        return r, msg, nil
    } else {
        return nil, nil, errors.New("cannot assert msg as interface IMessage")
    }
}

// 此方法用于投递消息
func (q *Queue) Delivery(msg IMessage) error {
    conn := q.pool.Get()
    defer conn.Close()
    // 投递目标名称加“.prepare”用于表示待执行队列
    prepareQueue := fmt.Sprintf("%s.prepare", msg.GetChannel())
    if msgJson, err := msg.Marshal(); err != nil {
        return err
    } else {
        _, err := conn.Do("LPUSH", prepareQueue, msgJson)
        fmt.Println("produced", string(msgJson))

        return err
    }
}
```
很容易知道，队列读取消息需要循环地进行，不停检测是否有新的消息推送，因此我们需要一个死循环语句来重复执行读取消息的方法。为了不阻碍主协程的进行，需要使用`go`关键字开启一个新的协程来进行这一动作：
> queue.go

```go
func (q *Queue) InitReceiver(msg IMessage) {
    // 投递目标名称加“.prepare”用于表示待执行队列
    prepareQueue := fmt.Sprintf("%s.prepare", msg.GetChannel())
    // 投递目标名称加“.doing”用于表示执行队列
    doingQueue := fmt.Sprintf("%s.doing", msg.GetChannel())

    go func() {
        for {
            reply, msg, err := q.rpoplpush(msg, prepareQueue, doingQueue)
            if err != nil {
                // 读取失败，直接跳过此轮循环
                fmt.Println("failed to pop msg", err)
                continue
            }
            if msg == nil {
                // 消息为空，直接跳过此轮循环
                continue
            }
            // 使用消息结构自带的消费方法进行消费，如果成功就从执行队列中删除该消息
            if err := msg.Resolve(); err == nil {
                q.lrem(doingQueue, reply)
            } else {
                fmt.Println(err)
            }
        }
    }()

    fmt.Printf("receiver have been initialized\n")
}
```
好了，我们可以说基本上实现了大致的队列功能。现在可以写个测试跑一下看看效果：
> main.go

```go
package main

import (
    "github.com/gomodule/redigo/redis"
    "os"
    "os/signal"
    "syscall"
)

func main() {
    pool := &redis.Pool{
        Dial: func() (conn redis.Conn, err error) {
            return redis.Dial("tcp", ":6379")
        },
        TestOnBorrow: func(c redis.Conn, t time.Time) error {
            if time.Since(t) < time.Minute {
                return nil
            }
            _, err := c.Do("PING")
            return err
        },
    }
    queue := &Queue{pool: pool}

    msg := &Message{
        name: "demoQueue",
    }

    queue.InitReceiver(msg)

    go func() {
        for i := 0; i < 10; i++ {
            msg := &Message{name: "demoQueue", Content: map[string]string{
                "order_no": strconv.FormatInt(time.Now().Unix(), 10),
            }}
            _ = queue.Delivery(msg)
        }
    }()

    quit := make(chan os.Signal, 1)

    signal.Notify(quit, syscall.SIGINT)

    for {
        switch <-quit {
        case syscall.SIGINT:
            return
        }
    }
}
```
看起来似乎正常工作了，不是么？

现在我们对消息结构体的消费方法做出一点改动，使用`crypto/rand`[^5]包让它随机产生失败——这是一个常用的伪随机数标准库，感兴趣的请阅读官方文档。
> message.go

```go
import (
    "crypto/rand"
    "math/big"
)

func (m *Message) Resolve() error {
    n, _ := rand.Int(rand.Reader, big.NewInt(100))
    // 偶数成功，奇数失败
    if n.Int64()%2 == 0 {
        fmt.Printf("consumed %+v\n", m.Content)
        return nil
    }
    return errors.New("consume failed")
}
```
于是我们发现一部分消息因为消费失败而丢失了。

## 改进·Ack机制解决消息丢失问题
当然，在[前文](#redis队列的原生用法)中我们已经预料到了这种意外情况，并且已经做出了预防工作——利用redis的“可靠队列”指令`RPOPLPUSH`将要进行消费的消息放入了执行队列中。现在我们只需要实现从队列找回消息的功能。

> Ack确认机制，Acknowledgement (data networks)[^6]
>
> 在数据网络、电信和计算机总线中，ACK是在通信进程、计算机或设备之间传递的信号，表示确认或接收消息，作为通信协议的一部分。发送否定确认信号以拒绝先前接收的消息或指示某种类型的错误。确认和否定确认通知发送方接收方的状态，以便它可以相应地调整自己的状态。

我们使用方法名为`ack`为队列结构体添加这一功能。当然，更简单的方式，并不需要发送确认或否定信息：单纯地在每次获取信息之前(或消费信息之后)，轮询执行队列中是否有多余的消息，如果有，说明是之前因为意外而消费失败丢失的消息，将其再次通过`rpoplpush`放回待执行队列即可。
> queue.go

```go
func (q *Queue) ack(imsg IMessage, sourceQueue, destQueue string) {
    for {
        // 这是一个死循环，需要小心注意打断避免永远循环
        reply, _, err := q.rpoplpush(imsg, sourceQueue, destQueue)
        if err != nil {
            // 读取失败，打断循环
            fmt.Println("ack failed", err)
            break
        }
        if reply == nil {
            // 读取到空消息，说明无滞留，打断循环
            break
        } else {
            // 获取到滞留消息，打印提示
            fmt.Printf("got undo msg in the queue %s\n", sourceQueue)
        }
	}
}
```
然后在循环消费的协程中调用此方法：
> queue.go

```go
func (q *Queue) InitReceiver(msg IMessage) {
    // 省略代码
    go func() {
        for {
            // 在开头调用，注意队列名称先后顺序
            q.ack(msg, doingQueue, prepareQueue)
            reply, msg, err := q.rpoplpush(msg, prepareQueue, doingQueue)
            // 省略代码
        }
    }()

	fmt.Printf("receiver have been initialized\n")
}
```
再次运行代码，可以看到消费失败的消息会被找回并再次消费。

还没完，这个队列的功能还不够完善。

前面我们在写测试文件的时候，通过信号通道来维持主协程不退出，消息读取协程得以存活。当我们对进程发出**SIGINT**信号，也就是进程打断信号的时候，主协程就会退出，这时其他协程也会被“突然杀死”。这会引发什么问题呢？

依旧是对消息结构体的消费方法做改动，用以模拟这一情况的发生：
> message.go

```go
import (
    "crypto/rand"
    "math/big"
    "time"
)

func (m *Message) Resolve() error {
    n, _ := rand.Int(rand.Reader, big.NewInt(100))
    // 偶数成功，奇数失败
    if n.Int64()%2 == 0 {
        fmt.Printf("consumed %+v\n", m.Content)
        time.Sleep(time.Second)
        return nil
    }
    return errors.New("consume failed")
}
```
使用`time`包，在打印了消费成功之后，进行一秒钟的睡眠，模拟消费成功但还未返回确认的情况。这时候如果遭到信号杀死，就会导致“已经消费过的消息因为来不及回收而被当成遗失的消息处理而再次被消费”的局面。

也许有的读者会说，只要在消费消息之前确认该消息是否已经被消费过，避免再次消费就可以解决这个问题了——自然，我们在编写消费方法的时候肯定要考虑到这一点，但是队列本身也应该主动解决这一问题，努力成为一个可靠性更强的队列工具。

在Go语言中，官方提供了`context`包来解决协程退出控制的问题。

## 改进·使用Context实现安全退出
`context`包是Go语言标准库的包之一，在各种接口中被广泛使用。在本文中，将被用来使`goroutine`“安全退出”。

笔者强烈建议读者通过阅读**Go夜读**团队成员饶全成写的这篇《深度解密Go语言之context》[^7]文章来了解`context`的原理；而本文则只着重描写一个使用案例。

使用`context.Background()`方法，我们首先创建一个父上下文`ctx`，然后通过`ctx.WithCancel()`创建出子上下文`childCtx`，用于传递给循环消费协程。

在创建`childCtx`的时候，我们同时会获得一个`cancel`函数，一旦调用这个函数，就会向`childCtx`内置的一个空结构体channel发送信号；而协程中就可以通过`childCtx.Done()`这个方法读取到这一信号——此信号用于通知协程，该退出了。
> main.go

```go
import "context"

func main() {
    // 省略代码
    // 创建一个父上下文
    ctx := context.Background()
    // 传递给队列方法
    cancelFunc := queue.InitReceiver(ctx, msg)
    // 省略代码
    for {
        switch <-quit {
        case syscall.SIGINT:
            // 通知协程取消
            cancelFunc()
            return
        }
    }
}
```
> queue.go

```go
// 注意方法形参添加了一个context.Context类型的变量ctx
// 方法返回了一个函数类型的值
func (q *Queue) InitReceiver(ctx context.Context, msg IMessage) func() {
    // 省略代码
    childCtx, cancel := context.WithCancel(ctx)

    go func(ctx context.Context) {
        for {
            // 这里使用到了go的select特性，当ctx接收到信号就会退出循环
            select {
            case <-ctx.Done():
                fmt.Println("context has been cancelled")
                return
            default:
            }
            // 省略代码
        }
    }(childCtx) // 这里为什么要通过形参传递？下一节给出解释
    // 省略代码
    return func () {
        cancel()
    }
}
```

子协程收到消息，看了看手里正在进行的工作，连忙大喊：“等等，我还没好！”但是主协程没有听见，还是退出了——我们并未看到“context has been cancelled”这句话打印出来。

事实上，子协程甚至还未接收到停止的通知就被杀死；主协程只是自顾自地发出了一个通知，并不关心子协程是否收到。

因此我们还需要建立一个通道，等待子协程完成了当前工作， 收到消息之后通知主协程。而主协程需要在得到“可以结束了”的通知之后再退出：
> queue.go

```go
func (q *Queue) InitReceiver(ctx context.Context, msg IMessage) func() {
    // 省略代码
    childCtx, cancel := context.WithCancel(ctx)
    // 新增了一个quit通道
    quit := make(chan struct{}, 1)

    go func(ctx context.Context) {
        for {
            select {
            case <-ctx.Done():
                fmt.Println("context has been cancelled")
                // 收到信号后发送可以结束了的通知
                quit <- struct{}{}
                return
            default:
            }
            // 省略代码
        }
    }(childCtx) // 这里为什么要通过形参传递？下一节给出解释
    // 省略代码
    return func () {
        cancel()
        // 等待可以退出的通知
        <-quit
    }
}
```
这一次，运行代码之后发送SIGINT信号，我们可以看到子协程先是打印退出消息，然后整个进程才被关闭。

## 改进·支持复数消费者
通过上面的两次改进，这个队列结构已经具备了一定的可靠性，可以投入工作使用了。

在经过一段的时间运行之后，由于请求的流量迅速增加，而消息的每次处理大约需要花费一秒钟(模拟)的时间，因此redis队列中消息大量堆积，占用的内存开始暴涨，可能最后导致redis崩溃或者影响到整个服务器的运行。

一个消费者独木难支，那么我们可以多开几个协程，并行/并发地处理更多消息，提升单位时间内的效率：
> main.go

```go
func main() {
    // 省略代码
    // 新增了第三个参数，用来设定协程数量
    cancelFunc := queue.InitReceiver(ctx, msg, 5)
    // 省略代码
}
```
> queue.go

```go
// 新增了第三个形参，用来设定协程数量
func (q *Queue) InitReceiver(ctx context.Context, msg IMessage, number int) func() {
    // 投递目标名称加“.prepare”用于表示待执行队列
    prepareQueue := fmt.Sprintf("%s.prepare", msg.GetChannel())
    // 这里去掉了原本的doingQueue，多个协程应该有自己的执行队列，避免造成ack争抢
    // 限制协程数量最少为1
    if number <= 0 {
        number = 1
    }
    // quit通道的长度根据number参数确定
    quit := make(chan struct{}, number)
    // 新增了一个cancelSlice的切片，用于存储多个子协程创建的子上下文的取消函数
    cancelSlice := make([]context.CancelFunc, number)

    for i := 0; i < number; i++ {
        // 每个协程都应该创建一个子上下文
        childCtx, cancel := context.WithCancel(ctx)
        // 把取消函数存储到切片中
        cancelSlice[i] = cancel
        go func(ctx context.Context, number int) {
            // 投递目标名称加“.doing”加数字用于表示各自的执行队列
            doingQueue := fmt.Sprintf("%s.doing%d", msg.GetChannel(), number)
            // 省略代码
        }(childCtx, i) // 之所以要立即作为参数传入，是因为for循环的i和childCtx最终全部指向最后一次循环的值
    }

    fmt.Printf("receiver have been initialized\n")

    return func() {
        // 需要取消number次子上下文
        for i := 1; i < number; i++ {
            cancel := cancelSlice[i]
            cancel()
            <-quit
        }
	}
}
```
再次运行代码，现在单位时间的消费能力提升了。

## 思考
文中的源码可以在[yuchanns/gobyexample](https://github.com/yuchanns/gobyexample/tree/master/queue)中找到。

本文到这里结束，我们经历了——
* redis原生用法调研
* 结合具体语言设计队列和消息的结构
* 第三方库辅助的选择
* 根据第三方库调整设计
* 着手实现代码
* 分析缺陷，设计改进方案

这些流程，结合Go语言实现了具有一定可靠性的redis队列。

需要新增不同的消息和消费方式？只需要遵守`IMessage`接口的约定编写新的消息实现就可以了！

那么，还有哪些可以改进的方案呢？上面的代码有哪些不足？一些处理是否有更好的选择？希望读者可以思考一下:)

[^1]: [antirez/disque](https://github.com/antirez/disque)
[^2]: [Pattern: Reliable queue](https://redis.io/commands/rpoplpush#pattern-reliable-queue)
[^3]: [gomodule/redigo](https://github.com/gomodule/redigo)
[^4]: [json-iterator/go](https://github.com/json-iterator/go)
[^5]: [crypto/rand](https://godoc.org/crypto/rand)
[^6]: [Acknowledgement (data networks)](https://en.wikipedia.org/wiki/Acknowledgement_(data_networks))
[^7]: [深度解密Go语言之context](https://qcrao.com/2019/06/12/dive-into-go-context/)
