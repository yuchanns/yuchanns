---
title: "链路追踪建设分享"
date: 2020-12-22T15:56:32+08:00
draft: false
---
## 背景
* 开发跨部门权限问题，无法在线上(测试、预发布、正式环境)查看容器内错误日志
* 微服务化，即使有权限查看容器日志，业务出现bug时排查定位问题所在的微服务很慢很麻烦
* 被动发现问题。比如说某些api的请求出现异常，被动等待下游反馈

## 链路追踪如何解决问题
* 上报每一个请求和响应的详细数据，包括header头，路由，请求参数，请求体，通信状态，以及支持自定义更多参数上报。
* 阿里采集，提供查询接口，开发可以另外搭建查询服务独立查询，无需权限
* 采用OpenTracing标准，可以跨语言跨服务形成链路调用日志，一个请求经过了哪些服务，在哪里发生了故障被截断一目了然
* 通过请求和响应状态可以为链路日志打上状态标签，然后上报到Prometheus统计指标。可以另外扩展出指标异常统计告警机制，及时主动获知错误发生，在下游反馈前解决问题

## 原理简述
![](/images/jaeger-query.png)

> [Jaeger参考文档](https://www.jaegertracing.io/docs/1.11/client-libraries/)

* header头注入标识，支持多种标识(`b3`,`uber-trace-id`等)。我们采用jaeger默认的`uber-trace-id`标记链路id。
* id值格式为：`{trace-id}:{span-id}:{parent-span-id}:{flags}`。
    * **trace-id**：链路追踪id，一次请求从头到尾的唯一标识
    * **span-id**：span的标识。span是链路追踪的基本单位，表示一个独立的工作单元，可以是一次函数调用，对一个服务的请求等。记录了服务名称，开始结束时间，以及服务打上的tag(上文说的状态异常标签，`error=true`)，logs(记录请求和响应的详细数据)
    * **parent-span-id**：父span标识
    * **flags**：采样标志
* 作为服务端，接收请求的时候检测是否有`uber-trace-id`标识，如果没有就创建一个，如果有则获取值并按照格式拆分，然后把请求中的`span-id`改成自身的`parent-span-id`，生成一个新的`span-id`
* 作为客户端，对其他服务发起调用，在请求头注入`uber-trace-id`标识，传递给被调用服务
* 服务在一次请求和响应完成后独自上报span
* 一个trace由多个span组成，表示了一次完整的链路追踪，按照span的父子关系向下排列，以时间轴的方式展示。

## 落地实践
![](/images/opentracing.png)

* 原子服务集成上报中间件
* 部署Jaeger服务端，包括Jaeger Agent和Jaegger Collector
* Agent采用udp协议与客户端(原子服务)通信，无状态，消耗低，适用每个请求都上报的场景。客户端发送就完事，不关心Agent是否收到
* Agent收集一定量链路日志后批量上报给Collector，用的是http协议，然后Collector再写入到数据库里
* 阿里提供了日志数据库存储服务。链路日志存储到第三方
* 通过另外部署的Jaeger Query客户端读取阿里存储的日志，完全和生产服务解耦。可以用默认的客户端查询，或者将客户端暴露的api集成到Grafana查阅。
* go服务端采用的第三方上报工具内置了指标暴露接口，可以被promehteus采集统计请求状态

## go服务端gin中间件使用方法
> 代码库地址：[yuchanns/bullets](https://github.com/yuchanns/bullets)

```bash
go get -u github.com/yuchanns/bullets
```

* 使用中间件

```go
package main

import (
	"context"
	"github.com/gin-gonic/gin"
	"github.com/yuchanns/bullets/common"
	"github.com/yuchanns/bullets/common/middlewares"
	"os"
)

func main() {
	g := gin.Default()
	// 服务名
	serviceName := "openapi-service"
	// 上报agent地址
	agentAddr := os.Getenv("OPENTRACING_AGENT")
	// 操作前缀
	operationPrefix := []byte("api-request-")
	opentracerCloseFunc, opentracerMiddleware, err := middlewares.BuildOpenTracerInterceptor(serviceName, agentAddr, operationPrefix)
	if err != nil {
		common.Logger.Error(context.Background(), err)
	} else {
		defer opentracerCloseFunc()
		g.Use(opentracerMiddleware)
	}
}
```

* 自定义打tag

```go
import (
	"github.com/gin-gonic/gin"
	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/log"
	"github.com/pkg/errors"
)

func CustomTag(ctx *gin.Context) {
	if cspan, ok := ctx.Get("tracing-context"); ok {
		if span, ok := cspan.(opentracing.Span); ok {
			span.SetTag("error", true)
			span.LogFields(log.Error(errors.New("err")))
			span.LogFields(log.String("exampleKey", "stringValue"))
		}
	}
}
```

