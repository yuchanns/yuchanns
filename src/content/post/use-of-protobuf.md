---
title: "protobuf的使用"
date: 2021-01-09T15:36:12+08:00
draft: false
---
protobuf是谷歌开发的一款跨平台跨语言强扩展性的用于序列化数据的协议，就像人们常用的xml、json一样。它主要由C++编写，用户按照相应的接口描述语言(Interface description language, **IDL**)可以批量生成对应语言的代码模板，用于诸如微服务rpc交换数据之类的通信。

而grpc是使用protobuf协议实现的一个RPC框架，由谷歌开发。

本文通过一个小例子演示创建grpc的go服务端以及php和node的客户端进行通信，并为go服务端启用grpc gateway使之支持http访问。

> 注意：本文只适用于Linux或者macOS。

![](/images/protobuf.png)

## 环境安装
* 安装protoc
* 安装go插件
* 安装php插件
* 安装node插件

### 安装protoc
protoc是protobuf的编译器。就像其他编程语言，用户编写代码，编译器将其编译成其他后端语言，protoc可以将用户编写的IDL编译成其他后端语言。具体编译成什么语言则根据稍后安装的语言插件以及用户操作而定。

直接从[protocolbuffers/protobuf](https://github.com/protocolbuffers/protobuf)下载编译安装。

```bash
# 下载
wget https://github.com/protocolbuffers/protobuf/releases/download/v3.14.0/protobuf-all-3.14.0.tar.gz
# 解压
tar -zxvf protobuf-all-3.14.0.tar.gz
# 进入并编译安装
cd protobuf-3.14.0 
./configure
# 这里根据相应的cpu提高make速度
make -j6
make install
# 检查安装是否成功
protoc --version
# libprotoc 3.14.0
```
> 注意，用Linux内核的操作系统安装protoc时，很高概率的情况下还需执行`ldconfig`才能成功执行`protoc --version`。

### 安装go插件
*如果你关注的不是go服务端的部分，可以跳过这一节。*

**注意**，这里笔者使用的是`v1.3`版本的插件。v1.4版本在一些语法和命令上有所不同，会出现不兼容的情况，请锁好版本。

> 比如，生成代码不同。v1.3中rpc代码和grpc代码是合在一个文件上一起生成的；而v1.4会分成两个文件。
>
> v1.3对gatewayc的支持也和v1.4不同，语法上也有所不同。

首先安装生成go语言代码的插件v1.3版本[protoc-gen-go](https://github.com/golang/protobuf/tree/master/protoc-gen-go)。
```bash
GO111MODULE=on GOPROXY=https://goproxy.cn go get github.com/golang/protobuf/protoc-gen-go@v1.3
```
然后安装`grpc gateway`插件，这里我们使用v1插件，理由同上，避免不兼容情况。
```bash
GO111MODULE=on GOPROXY=https://goproxy.cn go get github.com/grpc-ecosystem/grpc-gateway/protoc-gen-grpc-gateway@v1
```
> 注意，如果操作系统是macOS，还需要把两个插件(`protoc-gen-go`和`protoc-gen-grpc-gateway`)从`$GOPATH/bin/`移动到`/usr/local/go/bin`下才能在使用时自动寻找到。

### 安装php插件
*如果你关注的不是php客户端的部分，可以跳过这一节。*

安装php的插件是三种语言中最麻烦的一个步骤。

首先确认你的php环境包含`pecl`，然后安装`grpc-1.34.0`和`protobuf`的扩展:
```bash
pecl install grpc-1.34.0 protobuf
## 找到php.ini的位置
php -i | grep php.ini
## 往php.ini中添加扩展
echo 'extension=grpc.so' >> php.ini
echo 'extension=protobuf.so' >> php.ini
## 查看扩展是否已经安装
php -m | egrep 'grpc|protobuf'
```
接下来编译安装适用于protoc的`grpc_php_plugin`。

由于插件编译已经废弃了make方式，所以这里采用`bazel`进行编译安装，首先需要安装bazel：

> `bazel`是Google开发的一款代码构建工具，可以处理大规模构建，解决环境问题。

```bash
sudo apt install curl gnupg
curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor > bazel.gpg
sudo mv bazel.gpg /etc/apt/trusted.gpg.d/
echo "deb [arch=amd64] https://storage.googleapis.com/bazel-apt stable jdk1.8" | sudo tee /etc/apt/sources.list.d/bazel.list
apt update
apt install bazel
```
> 如果使用macOS则直接使用**Homebrew**安装`brew install bazel`。

然后Clone [grpc/grpc](https://github.com/grpc/grpc)，并编译安装：
```bash
git clone git@github.com:grpc/grpc.git
cd grpc
bazel build @com_google_protobuf//:protoc
bazel build src/compiler:grpc_php_plugin
```
完成之后会在`grpc/bazel-bin/src/compiler`下生成一个`grpc_php_plugin`，供后续使用。

### 安装node插件
*如果你关注的不是node客户端的部分，可以跳过这一节。*

Node安装gprc是最简单的。直接在项目根目录(`package.json`所在的目录)安装两个插件就可以了：
```bash
yarn add grpc @grpc/proto-loader
```

## 编写proto
安装完相应的插件，我们就可以编写`proto`文件，并生成相应的`grpc`代码了。

`proto`文件拥有[官方语法参考手册](https://developers.google.com/protocol-buffers/docs/proto3)，这里简单解释些基本概念。

首先，在文件开头，需要声明采用的语法版本为**proto3**，否则默认为**proto2**。

`package`关键字可以用于定义代码生成后的包名、命名空间等。

### 编写message

一次通讯过程中会有请求和响应体，在protobuf中，被定义为`message`关键字。写起来有点像定义结构体那样：
```protobuf
syntax = "proto3";

package "greeter"

message HelloRequest {
  string name = 1;
  enum Corpus {
    UNIVERSAL = 0;
    WEB = 1;
  }
  Corpus corpus = 1;
}
```
在这个作为请求体的名为`HelloRequest`的`message`结构中又定义了一些字段，通过`类型 字段名 = 数字标识`的方式编写：
* 所有类型都是标量类型，支持的类型有`string`、`bool`、`double`、`float`、`int32`、`int64`等，可以参考[官方手册](https://developers.google.com/protocol-buffers/docs/proto3#scalar)获得；
* 注意这里面还有一个特殊的类型，`enum`(枚举)，用于限定某个字段的侯选值范围。
* 同一个`message`的每个字段的数字标识必须不重复，这是用于在protobuf压缩成的二进制中识别使用的标记。支持范围从1到2<sub>29</sub> - 1(536_870_911)，但是注意`19000~19999`是protobuf内置的标识，也无法使用，使用时会被编译器提示警告；
* 字段名也不能重复。

同样，我们可以再定义一个`HelloResponse`，作为响应体:
```protobuf
/* 这里可以添加注释
 * 可以是多行注释 */
message HelloResponse {
  string msg = 1; // 也可以用这种方式添加注释
}
```
如果对`message`做出了更新，删除字段或数字标识等操作，需要避免后来人重用这些字段或数字标识造成的问题，这时候使用`reserved`关键字指定保留字段和数字标识。一旦这些字段或标识被使用，编译器将会提示：
```protobuf
message Foo {
  reserved 2, 15, 9 to 11;
  reserved "foo", "bar";
}
```
如果希望`message`中某个字段可以重复数次，可以在字段前面加上`repeated`关键字。

`message`之间也可以嵌套使用，如：
```protobuf
message SearchResponse {
  repeated Result results = 1;
}

message Result {
  string url = 1;
  string title = 2;
  repeated string snippets = 3;
}
```
以及可以通过`import`关键字引入其他`proto`文件(在编译时需要指定所有文件所在的路径)：
```protobuf
import other "myproject/other_protos.proto";
```
如果你希望一个`message`中两个字段二选一，可以使用`oneof`关键字：
```protobuf
message SampleMessage {
  oneof test_oneof {
    string name = 4;
    SubMessage sub_message = 9;
  }
}
```
定义一个字典：
```protobuf
message SampleMessage {
  map<key_type, value_type> map_field = N;
}
注意字典不可使用`repeated`关键字。
```

### 编写service
有了请求和响应，接下来就是定义通信服务。

使用`service`关键字可以定义一个通信服务的接口；然后通过`rpc`关键字定义路由(接口的方法)，这一步骤将会用上前面定义的`message`结构体，将他们组合起来，表达请求和响应的内容结构：
```protobuf
service Greeter {
  rpc SayHello(HelloRequest) returns (HelloResponse);
}
```

## 生成对应语言的代码
编写完`proto`文件，我们就可以对其进行编译了，请确保环境安装环节没有缺漏，否则会失败。
### 生成go服务端代码
使用安装好的**protobuf**编译器`protoc`，它具有一个flag参数`-I`，表示`Import Path`，以及对应语言的`--lang_out`参数。
```bash
protoc -I . --go_out=plugins=grpc:. *.proto
```
这段命令表达的意思是，使用当前路径(`-I .`)，在当前目录生成go代码并且使用grpc插件(`--go_out=plugins=grpc:.`)，编译源为当前目录下的所有`proto`文件(`*.proto`)。注意`.`不要忽略，它表示当前目录。

于是我们可以在当前目录找到一个`greeter.pb.go`的文件。

在这个文件中，提供了`RegisterGreeterServer`方法，接受一个`*grpc.Server`和一个实现了`GreeterServer`接口的结构体指针。

我们只要在代码中实现对应的接口，在实现中编写具体的业务逻辑，然后通过`RegisterGreeterServer`注册到`grpc.Server`，接着启动，就实现了go grpc服务端的编写：
```go
package main

import (
	"context"
	"fmt"
	"log"
	"net"

	"github.com/yuchanns/grpc-practise/proto/greeter"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

func main() {
	l, err := net.Listen("tcp", ":9090")
	if err != nil {
		log.Fatalf("failed to create listener: %s", err)
	}
	srv := grpc.NewServer()

	greeterServer := &GreeterServer{}
	greeter.RegisterGreeterServer(srv, greeterServer)

	reflection.Register(srv)

	log.Println("start at :9090")

	if err := srv.Serve(l); err != nil {
		log.Fatalf("failed to serve: %s", err)
	}
}

// GreeterServer implements greeter.GreeterServer
type GreeterServer struct{}

// SayHello returns a grpc response
func (s *GreeterServer) SayHello(c context.Context, req *greeter.HelloRequest) (*greeter.HelloResponse, error) {
	return &greeter.HelloResponse{
		Msg: fmt.Sprintf("hello, %s", req.Name),
	}, nil
}
```
运行代码，启动grpc服务端。
### 生成PHP端代码
```bash
protoc -I. --php_out=. --grpc_out=. --plugin=protoc-gen-grpc=./grpc/bazel-bin/src/compiler/grpc_php_plugin *.proto 
```
这段命令表达的意思是，使用当前路径(`-I .`)，在当前目录生成php代码(`--php_out=.`)，grpc代码生成在当前目录(`--grpc_out=.`)，指定插件路径(`--plugin=protoc-gen-grpc=./grpc/bazel-bin/src/compiler/grpc_php_plugin`)，编译源为当前目录下的所有`proto`文件(`*.proto`)。注意`.`不要忽略，它表示当前目录。

结果将会在当前目录生成两个文件夹`GPBMetadata`和`Greeter`，分别包含了`message`和gprc服务代码。

然后我们通过`composer`安装`grpc/grpc:1.34`的代码库，引用生成的代码编写客户端请求代码：
```php
<?php
require __DIR__ . "/vendor/autoload.php";
require __DIR__ . "/proto/GPBMetadata/Greeter.php";
require __DIR__ . "/proto/Greeter/GreeterClient.php";
require __DIR__ . "/proto/Greeter/HelloRequest.php";
require __DIR__ . "/proto/Greeter/HelloResponse.php";

$client = new Greeter\GreeterClient('localhost:9090', [
    'credentials' => Grpc\ChannelCredentials::createInsecure(),
    ]);
 $request = new Greeter\HelloRequest();
 $name = "php";
 $request->setName($name);
 list($reply, $status) = $client->SayHello($request)->wait();
 $msg = $reply->getMsg();
 echo $msg,PHP_EOL;
```
运行脚本，即可成功请求grpc服务器和获取返回信息。

### 生成node端代码
node端是使用起来最简单的。无需生成代码，直接引用原始proto文件就可以使用：
```js
const PROTO_PATH = __dirname + '/greeter.proto'
const grpc = require('grpc')
const protoLoader = require('@grpc/proto-loader')
const packageDefinition = protoLoader.loadSync(PROTO_PATH)
const greeter = grpc.loadPackageDefinition(packageDefinition).greeter
const client = new greeter.Greeter("localhost:9090", grpc.credentials.createInsecure())
client.SayHello({name: "node"}, (error, resp) => {
    if (error) {
        console.log(error)
        return
    }
    console.log(resp)
})
```
运行脚本，即可成功请求grpc服务器和获取返回信息。

## 使用Grpc Gateway转发http请求
接下来是扩展话题——往往我们写一个服务端不仅仅是接收服务间的rpc调用，有时候还需要使用RESTFUL提供给外部http请求访问，如果再写一遍支持http请求的服务，未免造成了重复编码浪费时间，一旦接口出现变更，可能还要维护着两套代码。

幸好`grpc-ecosystem`(grpc生态)团队提供了一个[grpc-ecosystem/grpc-gateway](https://github.com/grpc-ecosystem/grpc-gateway)，将http请求反向代理转发给grpc服务器，进行同步处理。使用者要做的则是在已有的`proto`文件上，添加一些关于http请求的定义描述，就可以生成支持`grpc-gateway`的代码了。

根据这个库，我们得知：`grpc-gateway`根据`proto`文件中使用`google.api.http`的`annotations`定义的规则生成RESTFUL的http请求反向代理服务。

### 更新proto
因此我们需要在`proto`文件中引入`google/api/annotations.proto`，这个文件可以在[googleapis/googleapis](https://github.com/googleapis/googleapis)获得。

将其下载下来放置在`./googleapis/google/api`下，然后对`proto`文件进行修改：
```protobuf
syntax = "proto3";
package greeter;
option go_package="greeter";

import "google/api/annotations.proto";

service Greeter {
  rpc SayHello(HelloRequest) returns (HelloResponse) {
    option (google.api.http) = {
      post: "/api/greeter/say_hello"
      body: "*"
    };
  }
}

message HelloRequest {
  string name = 1;
}

message HelloResponse {
  string message = 1;
}
```
可以发现，主要是三处地方做了改动。
* 在第三行添加了一个`options go_package="greeter";`。这是`protobuf`提供的选项功能，用于添加一些额外的处理，完整的可用选项可以参考[google/protobuf/descriptor.proto](https://github.com/protocolbuffers/protobuf/blob/master/src/google/protobuf/descriptor.proto)。
* 第五行引入了`google/api/annotations.proto`，编译的时候需要指定该文件所在路径。
* 在rpc方法体中，添加了`option (google.api.http)`，它内部有两个字段，分别是`RESTFUL请求方法: "路由"`和`body: "*"`。

### 编译go服务端代码
然后重新进行编译，这次一并生成`grpc gateway`的代码：
```bash
protoc -I. -I./googleapis --go_out=plugins=grpc:. *.proto
protoc -I. -I./googleapis --grpc-gateway_out=:. *.proto
```
`-I`这个flag是可以重复使用的，可以看到这次额外指定了一个`./googleapis`，因为上面的`import "google/api/annotations.proto";`查找需要用到。另外还使用了`--grpc-gateway_out=:.`表明在当前目录生成`grpc-gateway`相关的代码。

稍后在当前目录可以看到生成了两个文件，分别带`*.pb.go`和`*.pb.gw.go`后缀。

然后我们在原来的`grpc server`基础上添加一个`*runtime.ServeMux`，使用`*.pb.gw.go`提供的`RegisterGreeterHandlerFromEndpoint`方法将实现了`GreeterServer`接口的结构体指针注册到`runtime.ServeMux`，然后再次启动服务：
```go
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"

	"github.com/grpc-ecosystem/grpc-gateway/runtime"
	"github.com/yuchanns/grpc-practise/proto/greeter"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

func main() {
	endpoint := ":9090"
	addr := ":8080"
	// grpc
	l, err := net.Listen("tcp", endpoint)
	if err != nil {
		log.Fatalf("failed to create listener: %s", err)
	}
	srv := grpc.NewServer()

	greeterServer := &GreeterServer{}
	greeter.RegisterGreeterServer(srv, greeterServer)

	reflection.Register(srv)

	// grpc-gateway
	mux := runtime.NewServeMux()
	greeter.RegisterGreeterHandlerFromEndpoint(context.Background(), mux, endpoint, []grpc.DialOption{
		grpc.WithInsecure(),
	})

	log.Printf("grpc-server start at %s and grpc-gateway start at %s\n", endpoint, addr)

	go func() {
		if err := http.ListenAndServe(addr, mux); err != nil {
			log.Fatalf("failed to start grpc gateway: %+v", err)
		}
	}()

	if err := srv.Serve(l); err != nil {
		log.Fatalf("failed to serve: %s", err)
	}
}

// GreeterServer implements greeter.GreeterServer
type GreeterServer struct{}

// SayHello returns a grpc response
func (s *GreeterServer) SayHello(c context.Context, req *greeter.HelloRequest) (*greeter.HelloResponse, error) {
	return &greeter.HelloResponse{
		Msg: fmt.Sprintf("hello, %s", req.Name),
	}, nil
}
```
尝试通过curl发出一个post请求到路由`/api/greeter/say_hello`:
```bash
curl -X POST -d '{"name": "curl"}' localhost:8080/api/greeter/say_hello
## {"msg":"hello, curl"}
```
RESTFUL请求成功。

### PHP客户端的变动
需要注意，对`proto`文件的变更，也对PHP端生成代码有两个影响：
* composer需要添加一个新的依赖`composer require google/common-protos`，否则会找不到`annotation`相关的代码
* 生成PHP代码时记得带上`googleapis`路径，避免找不到报错

```bash
protoc -I. -I./googleapis --php_out=. --grpc_out=. --plugin=protoc-gen-grpc=./grpc/bazel-bin/src/compiler/grpc_php_plugin *.proto
```

### Node客户端的变动
对Node没有影响。

## 结尾
本文所有代码均可在[yuchanns/grpc-practise](https://github.com/yuchanns/grpc-practise)找到并根据**README**步骤安装和运行。推荐使用Github提供的[Codespaces](https://github.com/codespaces)在线编辑器进行安装运行，节省环境适配时间。

