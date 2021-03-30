---
title: "go新手常见陷阱"
date: 2020-01-25T14:56:00+08:00
draft: false
---
节选自[《50 Shades of Go: Traps, Gotchas, and Common Mistakes for New Golang Devs》](http://devs.cloudimmunity.com/gotchas-and-common-mistakes-in-go-golang/)，仅摘录一些笔者比较在意的片段。

关联仓库[yuchanns/gobyexample](https://github.com/yuchanns/gobyexample/tree/master/newbee_traps)(包含测试用例)

## 初级篇
### 未指定类型变量不能用nil初始化
支持`nil`初始化的变量类型有`interface`、`function`、`pointer`、`map`、`slice`和`channel`。所以使用nil初始化未指定类型的变量会导致编译器无法自动推断：
```go
package main

func main() {
  var x interface{} = nil
  _ = x
}
```
### 初始化为nil的map无法添加元素
应该使用*make*方法声明来对`map`进行实际的内存分配；slice可以使用*append*方法对值为nil追加元素。

当然，初始化slice时最好预估一个长度，节省重复扩容开销。
```go
package main

func main() {
  m := make(map[string]int)
  // var m map[string]int // 错误示范，初始化值为nil
  m["one"] = 1 // 如果对上述值为nil的map添加元素，会报错

  var s []int
  s = append(s, 1) // 正确的slice追加元素用法
}
```
### 初始化string不能为nil
`nil`不支持`string`类型的初始化。它的初始值应为空字符串：
```go
package main

func main() {
  var s string
  // var s string = nil // 错误示范，cannot use nil as type string in assignment
  if s == "" {
    s = "default"
  }
}
```
### range遍历slice和array时的非预期值用法
使用*rang*进行遍历时，第一个值固定返回索引，第二个值固定返回值。

如果只想用值，在索引位置可用`_`来接收，节省复制开销。

在大数组中最好不使用range来遍历，因为range的本质是对索引和值的复制和再赋值，开销较大；推荐使用`for i := 0; i < len(s); i++ {}`的方式进行。

```go
package main

import "fmt"

func main() {
  x := []string{"a", "b", "c"}

  for _, v := range x { // 索引不进行复制
    fmt.Println(v)
  }
}
```
### 使用独立的一维slice组装创建多维数组
分为两步：
* 创建外层slice
* 为每个元素分配一个内层slice

这样的好处是每个内层数组都是独立的，更改不影响其他内层数组。
```go
package main

func main() {
  x := 2
  y := 4
  
  table := make([][]int, x)
  for i := range table {
    table[i] = make([]int, y)
  }
}
```
### 字符串是不可改变的
字符串是只读的二进制slice，无法通过访问索引的方式更改个别字符。如果想要更改，需要转化成`[]byte`类型。

对于**UTF8**字符串，实际上应该转换为`[]rune`类型，避免出现字节更新错误。
```go
package main

import "fmt"

func main() {
  x := "test"
  xbytes := []byte(x)
  xbytest[0] = 'T'

  y := "s界"
  yrunes := []rune(y)
  yrunes[0] = '世'

  fmt.Println(string(xbytes))
  fmt.Println(string(yrunes))
}
```
### 判断字符串是否为utf8文本以及获取字符串长度
字符串的内容并不一定是合法utf8文本，可以是任意字节，可以用`unicode/utf8`包的*ValidString*方法判断。

直接用内建的*len*方法获取的是字符串的byte数，同样可以使用`unicode/utf8`包的*RuneCountInString*来获取字符长度
```go
package main

import (
  "fmt"
  "unicode/utf8"
)

func main() {
  data := "♥"
  fmt.Println(utf8.ValidString(data))
  fmt.Println(len(data))
  fmt.Println(utf8.RuneCountInString(data))
}
```
### 使用值为nil的通道
向值为nil的通道发送和接收信息会永远阻塞，造成死锁。利用这个特性可以在select中动态的打开和关闭case语句块。
```go
package main

import "fmt"

func main() {
  inCh := make(chan int)
  outCh := make(chan int)

  go func() {
    var in <-chan int = inCh
    var out chan<- int
    var val int

    for {
      select {
      case out <- val:
        println("--------")
        out = nil
        in = inCh
      case val = <-in:
        println("++++++++++")
        out = outCh
        in = nil
      }
    }
  }()

  go func() {
    for r := range outCh {
      fmt.Println("Result: ", r)
    }
  }()

  time.Sleep(0)
  inCh <- 1
  inCh <- 2
  time.Sleep(3 * time.Second)
}
```
> 分析执行逻辑
1. 首先令变量`in`和`out`分别为单向输出和单向输入通道(这里原作者对in和out的意思定义和我似乎相反：我认为输入才是in，输出才是out😓)。
2. 然后对通道`inCh`输入第一个数字1，这时候单向输出通道in有值输出，而out为nil——对于select来说，此时只有一个`case val = <-in:`的选项。于是执行打印++++++++++并将out赋值为outCh，令in值为nil。
3. 此时对于select来说，内部又变成了`case out <- val:`选项。内部执行了和2步骤相似的操作。
4. 以此类推第二个数字。需要注意的是打印协程的输出实机视具体的运行平台而定。


## 中级篇
### json使用Encode和Marshal的区别
两者都是把数据结构转化为json格式，但是两者的结果并不相等。

原因在于*Encode*是为了流准备的方法，它会在转换结果末尾自动添加一个换行符——这是流式json通信中用于换行分隔另一个json对象的符号。
```go
package main

import (
  "fmt"
  "encoding/json"
  "bytes"
)

func main() {
  data := map[string]int{"key": 1}
  
  var b bytes.Buffer
  json.NewEncoder(&b).Encode(data)

  raw,_ := json.Marshal(data)
  
  if b.String() == string(raw) {
    fmt.Println("same encoded data")
  } else {
    fmt.Printf("'%s' != '%s'\n",raw,b.String())
  }
}
```
这是一个规范的结果，不是错误，但是需要注意这个细节差异。

笔者通常使用`Marshal`方法，确实没注意到这个细节😅。
### json自动转义html关键字行为
json包默认任何html关键字都会进行自动转义，这有时候和使用者的预期不符：

有可能第三方提出不能进行转义的奇葩要求，有可能你想表达的意思并非是html关键字代表的意思。
```go
package main

func main() {
  data := "x < y" // 使用者想表达的是x比y小这个意图
  
  raw, _ := json.Marshal(data)
  fmt.Println(string(raw)) // 结果被转义成"x \u003c y"

  var b1 bytes.Buffer
  _ = json.NewEncoder(&b1).Encode(data)
  fmt.Println(b1.String()) // 和上面一样的结果

  var b2 bytes.Buffer
  enc := json.NewEncoder(&b2)
  enc.SetEscapeHTML(false)
  _ = enc.Encode(data)
  fmt.Println(b2.String()) // 这才是想表达的意思"x < y"
}
```
### json数字解码为interface
如果像笔者这样直接使用结构体和*Gin*接收和发送json数据，很容易忽视这点而踩坑里：
> 默认情况下，go会将json中的数字解成`float64`类型的变量，这会导致panic

解决办法有：1.先转成int再使用；2.使用`Decoder`类型明确指定值类型；3.使用结构体(也就是笔者通常用的方法)
```go
package main

import (
  "bytes"
  "encoding/json"
  "fmt"
  "log"
)

func main() {
  var data = []byte(`{"status": 200}`)
  var result map[string]interface{}

  if err := json.Unmarshal(data, &result); err != nil {
    log.Fatalln(err)
  }

  var status1 = uint64(result["status"].(float64)) // 第一种方法，先转成uint64再使用
  fmt.Println("Status value:", status1)

  var decoder = json.NewDecoder(bytes.NewReader(data))
  decoder.UseNumber()

  if err := decoder.Decode(&result); err != nil {
    log.Fatalln(err)
  }

  var status2, _ = result["status"].(json.Number).Int64() // 第二种方法，使用Decoder明确指定数字类型
  fmt.Println("Status value:", status2)

  var resultS struct {
    Status uint64 `json:"status"`
  }

  if err := json.NewDecoder(bytes.NewReader(data)).Decode(&resultS); err != nil {
    log.Fatalln(err)
  }

  var status3 = resultS.Status // 第三种方法，使用结构体
  fmt.Println("Status value:", status3)
}
```
虽然是个小细节，笔者很少用到第三种以外的方法，仍然值得注意。

值得一提的是，当struct遇到字段类型不固定时(事实上在对接第三方接口的时候很有可能会遇到这种难受的事情)，可以使用json.RawMessage来接收并根据情况解码为不同类型的变量。
```go
pakcage main

import (
  "fmt"
  "log"
)

func main() {
  records := [][]byte{
    []byte(`{"status": 200, "tag": "one"}`),
    []byte(`{"status": "ok", "tag": "two"}`),
  }

  for _, record := range records {
    var result struct {
      StatusCode uint64          `json:"-"`
      StatusName string          `json:"-"`
      Status     json.RawMessage `json:"status"`
      Tag        string          `json:"tag"`
    }

    if err := json.NewDecode(bytes.NewReader(record)).Decoder(&result); err != nil {
      log.Fatalln(err)
    }

    var name string
    var code uint64
    if err := json.Unmarshal(result.Status, &name); err == nil {
      result.StatusName = name
    } else if err := json.Unmarshal(result.Status, &code); err == nil {
      result.StatusCode = code
    }

    fmt.Printf("result => %+v\n", result)
  }
}
```
### slice中隐藏的容量
从`slice`中切出新的slice时，底层指向的都是同一个数组。如果原slice非常大，尽管后来切分的新的slice只有一小部分数据，但是cap仍然会和原有的slice一样大。这样会导致难以预料的内存消耗。

正确的做法是使用*copy*方法复制临时的slice数据到一个指定了内存分配的变量中。

也可以使用完整的切片表达式，*input[low:hight:max]*，这样容量就变成`max-low`了。

上面两种做法的结果是新的slice底层指向的是新的数组。
```go
package main

import "fmt"

func main() {
  raw := make([]byte, 10000)
  fmt.Println(len(raw), cap(raw), &raw[0])
  rawNew := raw[:3]
  fmt.Println(len(rawNew), cap(rawNew), &rawNew[0])
  rawCopy := make([]byte, 3)
  copy(rawCopy, raw[:3])
  fmt.Println(len(rawCopy), cap(rawCopy), &rawCopy[0])
  rawFull := raw[:3:3]
  fmt.Println(len(rawFull), cap(rawFull), &rawFull[0])
}
```
### defer执行时机
`defer`执行的时间不是在语句块结束后，而是在函数体执行结束后。

如果在main中直接使用defer，结果只有当main结束时defer才会调用。

在如下的循环体中，如果需要每次循环都执行defer里的操作，应该创建一个函数来执行循环中的操作。常见于批量读取文件需要关闭文件之类的场景中。

同时可以注意另一个小细节：**每次循环的变量v应该通过赋值或者作为函数参数的方式来使用，否则循环中会指向最后一个值**。
```go
package main

import "fmt"

func main() {
  a := []int{1, 2, 3}

  for _, v := range a {
    func(v int) {
      fmt.Println(v)
      defer fmt.Println("defer execution")
      // defer在这个匿名函数执行完毕之后立即调用
    }(v) // v作为函数传值
  }
}
```
## 高级篇
### 值为nil的interface
`interface`类变量只有在类型和值均为`nil`的时候才与nil相等。

尤其需要注意当返回值类型为interface时，应明确返回nil，才能用是否为nil来判断。
```go
func main() {
    var data *byte
    var in interface{}

    fmt.Println(data, data == nil)
    fmt.Println(in, in == nil)

    in = data
    fmt.Println(in, in == nil)
}
```

