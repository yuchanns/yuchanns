---
title: "博客主题去掉javascript"
date: 2021-06-23T21:05:22+08:00
draft: false
---
![](/images/gopher_hugo.png)

我的博客换过好几次技术栈。

从一开始刚学 php 时自己开发的前后不分离简单博客系统、Wordpress，到接触静态网站生成器和现代前端框架后的 [Vuepress](https://vuepress.vuejs.org/) 以及 [GatsbyJs](https://www.gatsbyjs.com/) ，以及受不了这两个前端框架编译速度转而投向如今的 [Hugo](https://gohugo.io/) 。

当然，博客皮肤都是自己编写（移植）的。

从目前的页面可以看出，我的皮肤偏好是偏向简单整洁的，而对 javascript 的依赖也越来越少。因为我的网站根本不需要动起来，最好是纯**静态**的。

由于我的文章中包含 [LaTex](https://www.latex-project.org/) ，必须使用 [MathJax](https://www.mathjax.org/) 这一插件进行数学公式的排版。让我感到颇为困扰的一点就是 MathJax 的渲染属于运行时渲染，这在静态的一成不变的文章中是十分不必要的。

因此我开始考虑如何在编译阶段就生成渲染完毕的数学公式 svg 图片。

## 方案
这几天我考虑如下几种方案：

1. 借助搜索引擎查找其他人在 Hugo 上使用 LaTex 的解决方案
2. 通过正则匹配抓取目标文章内容中的数学表达式，使用 [v8go](https://github.com/rogchap/v8go) 等开源工具执行 mathjax 源码进行渲染然后替换原文。
3. 通过正则匹配抓取目标文章内容中的数学表达式，收集起来创建一个临时页面，使用 [chromedp](https://github.com/chromedp/chromedp) 渲染执行 mathjax 然后替换原文。 
4. 逐一对 hugo 生成的 html 页面使用 chromedp 渲染，然后通过正则匹配移除 script 标签，全文替换原文。

就结果而言，我最终选择了第4种方案。

## 分析

第一种方案，没有可参考的案例，几乎全是 nodejs 使用者通过框架的预渲染功能实现。

第二种方案，一开始 v8go 不支持 mathjax 源码的模块化写法，然后我尝试了使用 esbuild 和 webpack 打包 mathjax 的源码转成普通 js ，却发现仓库里写明只能在 node 环境下执行而作罢。

第三种方案我写了一个小 [demo](https://github.com/yuchanns/gobyexample/tree/monorepo/chromedp) 验证了可行性，然后花了一天半时间写了一个 CLI 工具。最后在使用时发现对数学公式的正则匹配过于复杂，存在把其他文章内容（例如 php 代码片段）误提取的问题，不得不放弃。

最后则是**兜底方案**，实际上和第三种差不多，但是需要对相当多的页面进行浏览器预渲染，效率很低下；优点则是规避了匹配数学公式的复杂性，只需要简单的匹配 script 片段并进行剔除即可。

最终的成品源码可以在 [yuchanns/hugo-pre-render](https://github.com/yuchanns/hugo-pre-render) 查看，而应用则可以看我的博客仓库中的部署 [workflow](https://github.com/yuchanns/yuchanns/blob/master/.github/workflows/blog.yml) 的使用。

$$F(\omega)=\int_{-\infty}^{\infty}f(t)e^{-iwt}d\omega$$

## 完全去除 js
鉴于本人博客小透明根本用不上留言功能，后来我又把 gitalk 关闭，并去除了手动切换主题模式的代码，现在博客本身在运行时已经没有任何的 js 了。

## 未来的打算……
寻找比目前更高效率的预渲染生成方式，也许第二种方案还有可以深挖的可能性。

使用 Go 编写一个类似于 [pangu](https://github.com/vinta/pangu.js/) 的自动美化中英混合排版的插件。
