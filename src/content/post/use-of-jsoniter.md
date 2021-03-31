---
title: "json-iterator/go使用笔记"
date: 2020-02-06T11:10:00+08:00
draft: false
---
[`json-iterator`](https://github.com/json-iterator/go)是由滴滴开源的第三方json编码库，它同时提供**Go**和**Java**两个版本。

## 为什么使用
这个库具有很多优点。最常被人称道的就是性能高于充满反射的官方提供的编码库——据说在编码结构体时候，Go版本的效率是`encoding/json`的6倍，而Java版本的效率是官方的3倍。

同时这个库还完全兼容官方库的**api**，替换官方库的方式不需要那么**hack**。
```
import jsoniter "github.com/json-iterator/go"

type Student struct {
  ID       uint     `json:"id"`
  Age      uint8    `json:"age"`
  Gender   uint8    `json:"gender"`
  Name     string   `json:"name"`
  Location Location `json:"location"`
}

type Location struct {
  Country  string
  Province string
  City     string
  District string
}

var s = Student{
  ID:     1,
  Age:    27,
  Gender: 1,
  Name:   "yuchanns",
  Location: Location{
    Country:  "China",
    Province: "Guangdong",
    City:     "Shenzhen",
    District: "Nanshan",
  },
}

func Marshal() {
  // 使用ConfigCompatibleWithStandardLibrary完全兼容官方库
  json := jsoniter.ConfigCompatibleWithStandardLibrary
  result, _ := json.Marshal(&s)
  println(result)
  // output: {"id":1,"age":27,"gender":1,"name":"yuchanns","location":{"Country":"China","Province":"Guangdong","City":"Shenzhen","District":"Nanshan"}}
}
```
对于**gin-gonic/gin**，官方提供[^1]`$ go build -tags=jsoniter .`命令在编译时替换编码库。更多信息请看文后[补充](#补充)

对于一些没有提供替换接口的库，也可以通过monkey补丁[^2]来简单粗暴的替换掉官方编码库。
```
// 使用go get -u "bou.ke/monkey"获取猴子补丁库
import (
  "bou.ke/monkey"
  "encoding/json"
  jsoniter "github.com/json-iterator/go"
)

func MonkeyPatch() ([]byte, error) {
  monkey.Patch(json.Marshal, func(v interface{}) ([]byte, error) {
    println("via monkey patch")
    return jsoniter.Marshal(v)
  })

  sjson, err := json.Marshal(&s)

  if err == nil {
    println(string(sjson))
  }
}
```
**注意**，该补丁只需在main函数中定义一次就可以到处使用。
## 自定义编码解码器
当然，如果只是这些，并不值得我专门写一篇笔记来记录。值得一提的是`json-iterator/go`还提供了一个十分好用的**自定义解码编码功能**。

### 问题
对于写惯了`php orm`的笔者而言，在使用go编写web业务过程中，最让我困惑的问题之一就是输出替换。
```
$user = Db::name("user")->where("name", "yuchanns")
    ->field("id, name, created_at, updated_at")
    ->find();
$user.created_at = date("Y-m-d H:i:s", $user.created_at);
echo json($user);
```
简单看上面这个例子，在`$user`对象中，`created_at`原本是一个**int**类型的字段(因为在表中这个字段对应int)。但是在使用api提供**json**格式输出给前端时，一般会将这个字段替换成`ISO 8601`[^3]的日期格式，提供人性化阅读。

这么做在**php**这类可随意变更变量/字段类型的动态语言中当然没有问题，但是在**golang**这种确定了变量类型之后不可变更的语言里就大有问题了。
### 旧的解决方案
这个问题我和使用go语言开发的朋友们讨论过，自己也想出了一种解决方法，不过不是很满意。

这个解决方案就是通过结构体`tag`和多余字段来进行转换。

以下这段代码完整版可以参考笔者的代码库[yuchanns/gobyexample](https://github.com/yuchanns/gobyexample/blob/master/gorm/model/order.go#L53-L54)。
```
type User struct {
  ID          uint   `json:"id" gorm:"primary_key"`
  Name        string `json:"name"`
  CreatedAt   int64  `json:"-"`
  UpdatedAt   int64  `json:"-"`
  CreatedTime string `json:"created_at" gorm:"-"`
  UpdatedTime string `json:"updated_at" gorm:"-"`
}

func (u *User) AfterFind() {
  const ISO8601 = "2006-01-02 15:04:05"
  u.CreatedTime = time.Unix(u.CreatedAt, 0).Format(ISO8601)
  u.UpdatedTime = time.Unix(u.UpdatedAt, 0).Format(ISO8601)
}
```
结合**jinzhu/gorm**[^4]对应的钩子函数，在**CURD**之后将`CreatedTime`和`CreatedAt`字段做转化，并使用tag令json输出或者gorm交互sql过程中忽视不必要的字段和更改字段名。

这样做有一定的记忆负担，使用者需要记得哪个字段是`int64`类型哪个是`string`类型以及该修改哪个字段，并且在各个钩子中写上一大堆转化代码。
### 使用RegisterTypeEncoder/RegisterTypeDecoder解决
而在`json-iterator/go`中有一个更优的解法，不需要在原有的结构体中添加多余的字段，也不需要在钩子函数中写一堆重复代码，使用者也不需要记忆修改哪个字段。

光是查阅`RegisterTypeEncoder/RegisterTypeDecoder`这两个方法的源码的注释，可能会一时间摸不着头脑，幸好官方中`extra.timeAsInt64Codec`使用了这两个方法可供我们参考[^5]。
```
func RegisterTypeEncoder(typ string, encoder ValEncoder) {
  typeEncoders[typ] = encoder
}

type ValEncoder interface {
  IsEmpty(ptr unsafe.Pointer) bool
  Encode(ptr unsafe.Pointer, stream *Stream)
}
```
首先这个注册函数接受两个参数，第一个参数为`string`类型，用来指定生效的类型，支持自定义类型；第二个字段是一个接口类型参数，也就是提供使用者进行自定义的入口。用户所需要做的就是实现这个`jsoniter.ValEncoder`接口，提供需要的方法，然后将接口的实现实例使用这个函数进行注册。
```
type locationAsStringCodec struct{}

func (locationAsStringCodec) IsEmpty(ptr unsafe.Pointer) bool {
  lc := *((*Location)(ptr))

  return lc.Country == "" && lc.Province == "" && lc.District == "" && lc.City == ""
}

func (locationAsStringCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
  lc := *((*Location)(ptr))

  stream.WriteString(strings.Join([]string{lc.Country, lc.Province, lc.City, lc.District}, " "))
}

func RegisterEncoder() {
  jsoniter.RegisterTypeEncoder("json_iterator.Location", &locationAsStringCodec{})
  sjson, err := jsoniter.Marshal(&s)

  if err == nil {
    println(string(sjson))
    // output: {"id":1,"age":27,"gender":1,"name":"yuchanns","location":"China Guangdong Shenzhen Nanshan"}
  }
}
```
如上，笔者使用`locationAsStringCodec`实现了`jsoniter.ValEncoder`接口。代码清晰易懂，只是涉及到了业务层不常用的`unsafe.Pointer`。

`unsafe.Pointer`类型的变量用于获取传入的值，然后我们就可以在`Encode`方法中对字段的值进行任意的组合，最后使用`*jsoniter.Stream`写入到转化后的json中就可以了。在这个例子中笔者把location字段从Location结构类转化为一个字符串，前面小节提到的日期同理。

读者可以尝试自行实现`jsoniter.ValDecoder`接口。

## 补充
**gin-gonic/gin**，官方提供编译时替换编码库，每次在build中添加tags并不是很方便(当然也可以通过脚本控制)，此外在写测试样例的时候也需要添加这个命令。

笔者使用**Goland**作为IDE，测试样例通常使用IDE的快捷功能进行。当读者也是如此情况，替换json编码库有两种选择：
* 在IDE测试设置中添加`Go tool arguments`参数
* 在`pkg_test.go`的头部添加`build prama`[^6]

第一种方法的缺陷在于每个使用这段代码库的人都需要对IDE作出同样设置才能生效。

第二种方法则与IDE无关，编译指示写在了文件之中，所有获得这份代码的人都可以得到同样的设置。只不过使用IDE的时候进行测试方便一点。下面是`pkg_test.go`：
```
// +build jsoniter

package json_iterator

import (
  "github.com/stretchr/testify/assert"
  "net/http"
  "net/http/httptest"
  "testing"
)

func TestSetupRouter() {
  router := SetupRoter()

  w := httptest.NewRecorder()
  req, _ := http.NewRequest("GET", "/jsoniter", nil)

  router.ServeHTTP(w, req)

  assert.Equal(t, http.StatusOK, w.Code)
  assert.Equal(t, fmt.Sprintln(`{"code":0,"data":{"id":1,"age":27,"gender":1,"name":"yuchanns","location":"China Guangdong Shenzhen Nanshan"}}`), w.Body.String())
}
```
以及对gin官方文档测试案例的稍微更改[^7]：
```
package json_iterator

import (
  "github.com/gin-gonic/gin"
  jsoniter "github.com/json-iterator/go"
  "net/http"
)

func SetupRoter() *gin.Engine {
  // to build with jsoniter, a build pragma should be in the main.go file
  // such as "// +build jsoniter"
  jsoniter.RegisterTypeEncoder("json_iterator.Location", &locationAsStringCodec{})
  r := gin.Default()
  r.GET("/jsoniter", func(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{
      "code": 0,
      "data": &s,
    })
  })

  return r
}
```
同理正式编译时只需把上述编译指示放在`main.go`中即可。

## 补充二
与`jsoniter.RegisterTypeEncoder`类似功能的函数还有`jsoniter.RegisterFieldEncoder`。它接受三个参数，分别是结构体类型(`string`)、结构体字段名(`string`)和自定义编码入口(`jsoniter.ValEncoder`)。

在上面的演示中，虽然我们成功地在输出`Student`结构体时把结构体中的`Location`转化成了一个字符串，但是这样一来单独输出Location结构体也会受到影响，所以正确的做法就是使用`jsoniter.RegisterFieldEncoder`。结果是只有在Student结构体输出时才会把Location结构体转化为一个字符串，其他地方则不受影响。

本文相关代码[yuchanns/gobyexample](https://github.com/yuchanns/gobyexample/tree/master/json-iterator)。

[^1]: [文档/jsoniter](https://gin-gonic.com/zh-cn/docs/jsoniter/)
[^2]: [bouk/monkey](https://github.com/bouk/monkey)
[^3]: [wiki/ISO_8601](https://en.wikipedia.org/wiki/ISO_8601)
[^4]: [jinzhu/gorm](https://github.com/jinzhu/gorm)
[^5]: [extra/time_as_int64_codec.go](https://github.com/json-iterator/go/blob/master/extra/time_as_int64_codec.go#L10-L31)
[^6]: [build constraints](https://golang.org/pkg/go/build/#hdr-Build_Constraints)
[^7]: [文档/test](https://gin-gonic.com/zh-cn/docs/testing/)
