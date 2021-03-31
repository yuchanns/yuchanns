---
title: "pongo2使用笔记"
date: 2020-02-06T11:10:00+08:00
draft: false
---
**pongo2**[^1]是一个`Django`风格的模板引擎，目标是模板语法完全适配Django。

## 简介
虽然传统的**MVC/MTV**大势已去，日益复杂的前端技术致使如今的**Trending**是前后分离，后端模板引擎不再受到开发者的重视，但是依然有开源库还提供这一功能。

甚至gin本身也自带了一个简陋的模板引擎，虽然正式开发中基本上不会用到这个功能，但是笔者还是想要了解一下相关的事情。然而在稍微阅读了gin的文档和源码之后，稍微写一个小demo时，笔者发现gin的模板引擎过于简陋，很是不爽。于是决定找找第三方的模板引擎。

在笔者有限的经历中，用起来最强大和舒爽的模板引擎当属`Jinja2`——这是一个用python实现的著名的模板引擎，具有诸如`Macro`、`Block`、`Include`等强大功能，同时性能也很好。在[pkg.go.dev](https://pkg.go.dev/)中，笔者轻易找到了一个自称**A Django-syntax like template-engine**的模板引擎，它就是[pongo2](https://pkg.go.dev/github.com/flosch/pongo2)。这里对不了解python的读者解释一下，Jinja2和Django模板引擎的语法基本一致。

pongo2的文档很简单，仅提供了Api的说明，作者表示关于模板的用法，只需要查看Django的文档就可以了[^2]。

## 接入gin
笔者并不打算浪费篇幅描述关于模板语法的内容，这些在Django文档上可以清楚地了解到。

本文的重点是研究将pongo2和gin结合起来使用。
### 分析gin的模板引擎接口
gin的文档中关于模板引擎的使用描述不多，如何替换模板引擎我们可以先从使用的源码入手：
```
// HTML方法渲染指定文件名的HTTP模板
// 同时更新HTTP code并设置Content-Type为"text/html"
func (c *Context) HTML(code int, name string, obj interface{}) {
	instance := c.engine.HTMLRender.Instance(name, obj)
	c.Render(code, instance)
}
```
常规的模板渲染用法就是在路由中调用<mark>*gin.Context.HTML</mark>方法，从源码中我们可以看到此方法先获取一个模板引擎的实例，然后调用实例的<mark>Render</mark>方法进行渲染。

也就是说我们只需要替换掉`c.engine.HTMLRender`就可以了。

继续追溯源码，可以看到`HTMLRender`是一个接口，同时它内部又包含了另一个接口`Render`：
```
type HTMLRender interface {
	// Instance方法返回一个HTML实例
	Instance(string, interface{}) Render
}

type Render interface {
	// Render方法写入数据和自定义的ContentType
	Render(http.ResponseWriter) error
	// WriteContentType方法写入自定义的ContentType
	WriteContentType(w http.ResponseWriter)
}
```
这下答案就清晰了。我们所要做的工作就是在pongo2和gin之间编写出实现这两个接口中间结构。
### 分析pongo2的API
快速浏览pogon2仓库的**API-usage examples**，可以看到渲染方式就是先调用<mark>pongo2.FromString</mark>方法构建模板，然后调用模板的<mark>Execute</mark>方法就可以获得渲染结果。当然，我们要使用的不是这两个方法。追溯FromString方法可以看到类似功能的方法还有<mark>FromFile</mark>和<mark>FromCache</mark>等方法。
>  思考
**FromFile**很明显就是我们寻求的从html模板构建渲染模板的方法，但是为什么笔者还要提到**FromCache**呢？

如果你阅读两个方法的源码，就会发现内容大多相似，区别只在于后者会将第一次的读取结果缓存在内存中，这对性能有一定的影响。

这意味着我们在正式环境中应该是使用后者；与之相对的，没有缓存功能的前者则适合开发中使用，因为开发过程中时常对html模板做出改动需要实时反映。

并且`Render`接口的<mark>Render</mark>方法要求的是将内容写入`http.ResponseWriter`实例中，这是一个实现了`io.Writer`接口的结构，于是我们从源码中找到接收对应接口参数的方法<mark>ExecuteWriter</mark>。

### 实现思路
现在整理一下实现思路：

* 编写一个名为`PongoRender`的结构体，它通过返回创建一个实现`Render`接口的名为`PongoHTML`的实例来实现`HTMLRender`接口。
* `PongoHTML`结构在<mark>Render</mark>方法中调用<mark>ExecuteWriter</mark>方法来实际进行渲染工作。
* 那么具有<mark>ExecuteWriter</mark>的结构体`*pongo2.Template`需要包含在`PongoHTML`结构体中作为一个属性成员。
* 在实例化的过程中注意根据**gin.Mode**来判断程序运行环境进而选择通过**FromFile**还是**FromCache**来构建模板。
* 至于<mark>WriteContentType</mark>需要完成的工作可以直接复制默认模板引擎的代码。

下面直接给出结果，可以结合注释进行理解：
```
package main

import (
	"github.com/flosch/pongo2"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/render"
	"net/http"
	"path"
)

type PongoRender struct {
	TmplDir string // 考虑到模板位置不定，需要一个字符串来存储绝对父路径
}

// 返回一个模板引擎实例用于替换*gin.Engine.HTMLRender
func New(tmplDir string) *PongoRender {
	return &PongoRender{
		TmplDir: tmplDir,
	}
}

func (p *PongoRender) Instance(name string, data interface{}) render.Render {
	var template *pongo2.Template
	fileName := path.Join(p.TmplDir, name) // 拼接绝对父路径和相对路径

	if gin.Mode() == gin.DebugMode { // 判断运行环境构建pongo2模板
		template = pongo2.Must(pongo2.FromFile(fileName))
	} else {
		template = pongo2.Must(pongo2.FromCache(fileName))
	}

	return &PongoHTML{
		Template: template,
		Name:     name,
		Data:     data.(pongo2.Context), // 断言为pongo2接受的类型
	}
}

type PongoHTML struct {
	Template *pongo2.Template // pongo2模板
	Name     string // 模板文件绝对路径
	Data     pongo2.Context // 上下文数据
}

// Render方法通过pongo2模板向http.ResponseWriter写入数据和自定义的ContentType
func (p *PongoHTML) Render(w http.ResponseWriter) error {
	p.WriteContentType(w)
	return p.Template.ExecuteWriter(p.Data, w)
}

func (p *PongoHTML) WriteContentType(w http.ResponseWriter) {
	header := w.Header()
	if val := header["Content-Type"]; len(val) == 0 {
		header["Content-Type"] = []string{"text/html; charset=utf-8"}
	}
}
```
本文相关代码[yuchanns/gobyexample](https://github.com/yuchanns/gobyexample/tree/master/pongo2render)

[^1]: [flosch/pongo2](https://github.com/flosch/pongo2)
[^2]: [Django 文档](https://docs.djangoproject.com/zh-hans/3.0/)
