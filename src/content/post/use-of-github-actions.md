---
title: "自下而上的github actions使用笔记"
date: 2021-01-02T16:25:23+08:00
draft: false
---
![](/images/github-action-01.png)
## 前言
笔者常常在github上使用一些**XXexample**的仓库记录使用某种语言的过程中对第三方包的试用或者验证一些思路和想法，时间一长，整个仓库就显得杂乱无比。

于是笔者打算采用Monorepo的方式对这些仓库进行管理，将各自的记录过程进行隔离，并且独立运行对应的单元测试。

调研过程一开始想到的是熟悉的CircleCI，遗憾的是这个工具官方不支持分割配置文件，所有的job都需要塞到同一个`config.yml`里，同样会显得冗长繁杂(民间是有通过makefile进行分割合并的解决方案，但是笔者觉得太过复杂)；再者印象中曾看过别人使用github自带的CI/CD工具Actions似乎支持多个工作流，而且天然亲近github自身，于是决定新年的第一天就把它掌握了，用于接下来的Monorepo管理辅助。

> 注：在这篇文章中，笔者假定读者都已经掌握了yaml配置语法。

## 开始
学习一个工具的第一件事自然是去翻阅官方文档——github actions的官方文档很完整，令人感到欣喜的是还有中文版本。

> [github actions 手册](https://docs.github.com/cn/free-pro-team@latest/actions)

### 开启支持
只要在仓库的根目录创建一个`.github/workflows`的文件夹，然后往其中添加一个`learn-github-action.yml`文件，就开启了该仓库的github actions功能，并且得到了第一个工作流**learn-github-action**。注意，yml文件可以是任意名字，一个文件就是一个工作流，这正是笔者之所以用它的重要原因。

该配置文件主要由三个标签组成，分别是`name`、`on`和`jobs`。
* `name`: 工作流名称
* `on`: 触发条件
* `jobs`: 作业集

```yaml
name: learn-github-action
on: push
jobs:
  say-hello:
    env:
      Action: Hello
    runs-on: ubuntu-latest
    steps:
      - name: Say hello
        shell: bash
        env:
          Object: World
        run: |
          echo $Action $Object!
```

### 如何触发
配置标签`on`，决定了触发工作流的条件。官方称之为**指定触发事件**。

它支持多种事件，可以从[这里](https://docs.github.com/cn/free-pro-team@latest/actions/reference/events-that-trigger-workflows)获取支持列表。

这里笔者简单举例三个比较重要的事件`push`、`pull_request`和`schedule`。

用户可以简单地在on标签上配置事件关键字数组，例如：
```yaml
on: [push, pull_request]
```
这样在仓库发生**push**和**pr**时就会触发该工作流。

也可以将on的内容改成一个对象，将事件当做键名，对事件进行具体的配置。

例如，在笔者的example仓库中，将旧有的代码保留在分支master上，新的Monorepo管理方式的代码放在monorepo分支上。笔者希望工作流只在更新monorepo分支的时候触发，那么可以通过`on.<event>.branches`来配置这一条件：
```yaml
on:
  push:
    branches:
      - monorepo
```
当然，也可以通过`on.<event>.branches-ignore`来配置忽略的分支，需要注意的是，两者不能同时使用。

另外，计划上每个工作流只负责monorepo中的每个小仓库，笔者还需要工作流只被对应的小仓库的变更触发，也就是对文件路径的指定支持。这里可以使用`on.<event>.paths`来配置：
```yaml
on:
  push:
    branches:
      - monorepo
    paths:
      - 'learn-github-action/**'
      - '.github/workflows/learn-github-action.yml'
```
这样一来，只有配置文件本身以及`learn-github-action`文件夹的内容发生了变更才会触发这个工作流的执行。

除此之外，事件触发还支持`on.<event>.tags`、`on.<event>.types`配置，除了`types`以外的事件都有相应的`-ignore`配置。

> `types`指`published, created, edited`这些操作，对`types`感兴趣的读者可以查看[手册](https://docs.github.com/cn/free-pro-team@latest/actions/reference/workflow-syntax-for-github-actions#onevent_nametypes)获取详细的说明

而`schedule`这一事件相对比较特殊，它是一个定时器事件，支持`Posix cron`语法调度配置：

```yaml
on:
  schedule:
    - cron: '*/15 * * * *'
```
**Posix cron**语法：

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of the month (1 - 31)
│ │ │ ┌───────────── month (1 - 12 or JAN-DEC)
│ │ │ │ ┌───────────── day of the week (0 - 6 or SUN-SAT)
│ │ │ │ │                                   
│ │ │ │ │
│ │ │ │ │
* * * * *
```
支持运算符：

|运算符|描述|示例|
|---|---|---|
|* | 任意值 | * * * * * 在每天的每分钟运行。|
|, |	值列表分隔符 |	2,10 4,5 * * * 在每天第 4 和第 5 小时的第 2 和第 10 分钟运行。|
|- |	值的范围 |	0 4-6 * * * 在第 4、5、6 小时的第 0 分钟运行。|
|/ |	步骤值 |	20/15 * * * * 从第 20 分钟到第 59 分钟每隔 15 分钟运行（第 20、35 和 50 分钟）。|

### 默认配置
想象一下，笔者的每一个作业都是针对某个小仓库(文件夹)下的代码配置的，在涉及到一些路径操作时，如果能将文件夹设置为根目录，以此进行相对路径操作是再好不过了，用`defaults`标签就可以实现：
```yaml
defaults:
  run:
    working-directory: learn-github-action
```

这样一来，工作目录转移到了`learn-github-action`下，进行相对路径操作时直接从根目录相对进行就可以了。

`defaults`配置预先指定了默认的配置，如果下面的作业步骤中没有指定将会采用这里的默认配置。

### 配置作业
和大多数CI/CD工具一样，具体作业通过`jos`标签进行配置。

这是一个对象，每个键名就是一个作业的名称，例如笔者打算创建一个作业名叫`say-hello`，而它的值也将是一个对象：

```yaml
job:
  name: # 作业名称
  needs: # 依赖项
  runs-on: # 运行器
  env: # 环境变量
  container: # 容器配置
    image: # 使用镜像
    env: # 环境变量
    ports: # 暴露端口
      - 80
    options: # 容器运行选项
    volumes: # 挂载卷
  services:
    image:
    ports:
    volumes:
  steps: # 步骤
    name: # 步骤名称
    uses: # 使用工作流插件
    run: # shell命令
    with: # 入参
    env: # 步骤环境变量
    shell: # 选择shell
```
这里只列出一些笔者觉得比较重要的标签，全部标签可以查看[手册](https://docs.github.com/en/free-pro-team@latest/actions/reference/workflow-syntax-for-github-actions#jobs)来获取。

在job中，有一个必须指定的标签，是`runs-on`，用于指定使用的运行器，也就是虚拟机环境，它支持Windows、Ubuntu和macOS这三种环境，一般使用`ubuntu-latest`：
```yaml
jobs:
  say-hello:
    runs-on: ubuntu-latest
```

|虚拟环境|YAML工作流标签|
|---|---|
|Windows Server 2019 |	windows-latest or windows-2019|
|Ubuntu 20.04 |	ubuntu-20.04|
|Ubuntu 18.04 |	ubuntu-latest or ubuntu-18.04|
|Ubuntu 16.04 |	ubuntu-16.04|
|macOS Big Sur | 11.0	macos-11.0|
|macOS Catalina | 10.15	macos-latest or macos-10.15|

在一个工作流中，先进行构建，然后单元测试，最后再发布，这是很常见的事情，这三者之间存在一个先后顺序，也就是依赖性，可以通过`needs`标签来配置:
```yaml
jobs:
  build:
  test:
    needs: [build]
  release:
    needs: [build, test]
```

`steps`标签则用于配置作业的所有步骤，它是一个数组，每个成员是一个对象：
```yaml
steps:
  - uses: actions/checkout@v2
  - uses: actions/setup-node@v1
  - name: Install bats
    run: npm install -g bats
```
在每一个`step`中，它常见有这些标签：`name`(步骤名称)、`env`(环境变量)、`run`(shell命令)、`uses`、`shell`(shell工具)等。值得一提的是`uses`标签。github actions有一个市场(Marketplace)，[这里](https://github.com/marketplace?type=actions)提供了许多官方的、民间的工作流配置，可以以类似插件的形式，通过`uses`标签被用户搭配使用。

比如最常见的，在一个作业中，往往第一个步骤是拉取仓库代码，这涉及到生成密钥等一系列复杂操作。官方有一个`actions/checkout@v2`配置，用户只需要在`steps`第一个步骤中指定使用该插件，就可以简单配置仓库代码拉取步骤。如果想要安装一个语言环境，也可以通过这种方式，使用别人或者自己预先配置好的插件实现安装步骤，十分方便。

有时候，我们希望在一个已打包的标准容器中进行CI/CD，这时候就需要`container`和`services`标签。例如笔者其中一个仓库是`gobyexample`，使用go语言进行编码，而代码中还用到了redis和mysql，这时候最简单的方式就是配置三个容器，作为作业运行环境：
```yaml
jobs:
  build:
  test:
    needs: [build]
    container: golang:1.15
    services:
      redis:
        image: redis:latest
        ports:
          - 6379:6379
      mysql:
        image: mysql:5.7
        volumes:
          - ./mysql_data:/var/lib/mysql 
        env:
          MYSQL_ROOT_PASSWORD: 11111
        ports:
          - 3306:3306
```

## 实践
作为练习，笔者创建了一个[yuchanns/github-action](https://github.com/yuchanns/github-action)库，用来实践手册上学习到的内容。

* 目标：使用go代码学习casbin包的权限管理用法，编写单元测试，使用github actions运行测试用例。
* 步骤：
    * 首先我们创建一个[go-demo](https://github.com/yuchanns/github-action/tree/main/go-demo)文件夹，写下相关的代码。
    * 接着在`.github/workflows/go-demo.yml`中进行相关的配置。
        * 触发条件：代码库发生push事件，且`go-demo`文件夹或者`.github/workflows/go-demo.yml`出现更新时
        * 工作流全局配置工作目录为`go-demo`，使用bash作为shell工具
        * 使用go官方镜像1.15作为容器环境
        * 拉取本代码库的代码
        * 获取或创建依赖的缓存，节省每次安装依赖的时间，加速工作流进程。这里使用`go.sum`文件的哈希结果来判断缓存是否需要更新。
        * 执行依赖安装
        * 执行单元测试

按照上述思路，我们可以编写出如下配置：
```yaml
name: go-demo # 工作流名称
on: # 触发条件
  push:
    paths:
      - 'go-demo/**'
      - '.github/workflows/go-demo.yml'
defaults: # 全局配置
  run:
    shell: bash
    working-directory: go-demo # 步骤中的工作目录
jobs:
  test: # 测试作业
    runs-on: ubuntu-latest # 指定运行器
    container: golang:1.15 # 使用go1.15镜像
    steps:
      - uses: actions/checkout@v2 # 使用市场插件拉取代码
      - name: Cache go modules # 步骤名称：缓存依赖
        uses: actions/cache@v2 # 使用市场插件进行缓存操作
        env:
          cache-name: cache-go-modules
        with: # 输入缓存配置参数
          path: vendor # 缓存的路径是vendor
          key: ${{ runner.os }}-build-${{ env.cache-name }}-${{ hashFiles('**/go.sum') }} # 键值包含go.sum的哈希值
          restore-keys: |
            ${{ runner.os }}-build-${{ env.cache-name }}-${{ hashFiles('**/go.sum') }}
      - name: Install Dependencies
        run: go mod download # 进行依赖安装
      - name: Test
        run: go test -v . # 进行测试
```
当我们将代码推送到github仓库，就可以在[仓库的Actions](https://github.com/yuchanns/github-action/actions)工作流中看到CI/CD的操作日志了。

![](/images/github-actions-workflows.png)

作为拓展练习笔者还实现了一个node-demo，有兴趣的读者可以和go-demo相互对比印证。

