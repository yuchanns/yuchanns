---
title: "使用CircleCI发布版本"
date: 2020-02-18T13:05:00+08:00
draft: false
---
最近我写了两个博客皮肤。

写第一个的时候，手动填写版本号，进行发布，又要在github上贴tag，又要`npm publish`，有时候顺序搞反了，或者忘记其中一个操作，很麻烦。

后来我在看**date-fns**[^1]的的仓库的时候，注意到这个仓库的**package.json**文件里的`version`字段是一个字符串，写着：

> "version": "DON'T CHANGE; IT'S SET AUTOMATICALLY DURING DEPLOYMENT; ALSO, USE YARN FOR DEVELOPMENT",

好奇之下花了几个小时研究，总算初步用上了ci自动发版本的功能——


## 前言
本文理论上分为两个部分，第一部分是文章的核心内容，说明**持续集成**发版本的一些要点，第二部分则是结合npm发布来实践。当然第一部分适用于任何语言产品包的版本发布，只是笔者最近正好用在nodejs里所以才使用npm进行说明。

首先我看了一下date-fns是怎么实现部署发版的：
* 在仓库根目录有个**scripts**文件夹，里面有个**release**就是负责版本发布的[^2]
* 执行脚本**release.sh**主要做的工作就是利用CI提供的环境变量读取tag值判断发布类型，然后通过**writeVersion.js**文件将tag值写入到package.json里，接着执行npm publish发布
* **writeVersion.js**这个文件的主要内容就是利用`process.env`获取CI环境变量tag值，然后替换package.json的文本内容

接着看看CI配置：作者使用的**TravisCI**，这是个老牌的CI工具，使用广泛[^3]；配置的大致内容是在`git push --follow-tags`的时候触发执行scripts/release/release.sh脚本。

### 一个结论
好了，现在进行一个小结：
> 持续集成自动发版本的思路就是，利用CI条件触发功能，在感知到git tags被推送时，利用CI环境变量获取到tag值，并执行定义好的脚本进行版本发布。脚本可以是任何语言写的，因为这里发布的是npm包，正好装了node环境，所以便复用环境，使用javascript来执行写入操作。

## CircleCI配置文件解读
由于笔者一直使用的另一款CI工具，**CircleCI**，便从CircleCI说起。先阅读一下官方社区使用文档[^4]。

其实文档里已经解释得很清楚了，不过由于是英语，并非笔者习惯的用语，所以在看得时候很容易错漏细节，以至于踩了好多坑才读懂。

首先我们从上面的[小结](#小结)知道，我们需要通过CI的环境变量获取tag值，查阅环境变量文档[^5]，可知在CircleCI中，tag值的环境变量是`CIRCLE_TAG`。

然后我们来解读一个CircleCI的**config.yml**常见配置项[^6]。

配置文件的一级指令共有七个，分别是：
```
version
orbs
commands
parameters
executors
jobs
workflows
```
限于篇幅，笔者并不会对所有指令进行介绍，感兴趣的读者可以自行阅读官方文档。

* `version`字段用于指定配置文件的版本，不同版本支持的配置有所不同，一般来说越新的版本功能越多。所以我们使用最新**2.1**就行了
* `executors`就是执行环境，可以指定执行的语言，然后指定使用的语言来源，一般指定docker
* `jobs`是任务列表，一次持续集成过程中，可以执行多个任务，比如构建源码、测试代码规范、发布版本，这样就是三个任务。在配置了任务名的二级指令中，可以指定执行环境——这时候就可以利用到上面配置的执行环境；接着是执行任务的步骤`steps`，一般用`run`来设定命令的`name`和`command`
* 当然如果需要执行的步骤非常的长，而且在多个任务里都会用到，我们可以使用一级指令`commands`预先给这个完整步骤分配名字，然后在`steps`中调用名字就可以
* `workflows`顾名思义就是任务流程，用于指导集成工具需要执行哪些任务，在其下的二级指令`jobs`中分配上面定义的任务名

接下来说一点细节性的东西。在date-fns中，笔者看到原作者使用travisCI的`on`指令，限定版本发布功能只在推送tags时触发。与之对应，在CircleCI中则是使用`filters`来过滤实现同样的功能。

但是官方文档没有说得很清楚(或许是笔者鸟语不精没看到)[^7]，如果你发版任务只指定了filters过滤“只对tag起作用”，那么在普通的分支推送时，依然会触发发版动作，原因是你只指定了对tags生效而没指定忽略branch(仿佛玩文字游戏一般)。笔者一开始没注意，找了好久原因。

与此同时，我们也要小心，有时候我们写出了错误的代码，将会导致产品无法使用，然而却触发了发版任务，这样就很尴尬和不靠谱了。所以我们可以在任务中使用`requires`(与filters平级)指令，要求这个任务需要在构建和测试任务成功时才能执行。但是这里你也要注意一个**陷阱**，如果你在构建和测试的任务中没有使用过滤器同样设置`only tags`，那么构建和测试任务就会无视tag推送，从而导致依赖于前者的版本发布任务也不会触发(笔者猜测这应该是CircleCI默认只关注branches而忽视tags的原因吧)。
### 一个例子
我们可以根据上面的解读，开始尝试写一个配置文件了，并且没有涉及到npm的操作部分——这一部分假定放到了一个叫`scripts/release/realeas.sh`的脚本文件中，我们只需要指定执行这个脚本就行：
```
version: 2.1 # 指定使用最新的配置版本

executors: # 预定义配置环境，方便复用
  node: # 环境名字
    docker: # 来源
      - image: circleci/node:10 # docker所使用的镜像

commands: # 预定义命令，方便复用
  install: # 命令名称
    steps: # 步骤指令
      - checkout # 步骤一先拉取仓库
      - restore_cache: # 步骤二设置缓存名，提供给后面的步骤使用
          name: Restore Yarn Package Cache
          keys: # 可以看到这里使用yarn.lock的哈希摘要做缓存名称，一旦文件变化缓存就重置
            - yarn-packages-{{ checksum "yarn.lock" }}
      - run: # 步骤三安装依赖
          name: Install Dependencies
          command: yarn install --frozen-lockfile
      - save_cache: # 步骤四将依赖缓存到上面设置的缓存名中
          name: Save node_modules Cache
          key: yarn-packages-{{ checksum "yarn.lock" }}
          paths: # 需要缓存的文件路径
            - node_modules

jobs: # 任务列表
  build: # 任务名
    executor: node # 执行的环境，这里就可以指定上面预设的环境了
    steps: # 执行的步骤
      - install # 预设的依赖安装步骤
      - run: # 构建的步骤
          name: Build Docs
          command: yarn build
  release: # 发版任务
    executor: node # 复用执行环境
    steps:
      - install
      - run: # 发版的步骤
          name: Release Version
          command: sh -c "scripts/release/release.sh" # 执行了一个脚本，脚本内容此时我们不关心，但是要注意使用 chmod +x 保证文件可执行权限

workflows: # 工作流，指导任务分配
  version: 2
  checks:
    jobs: # 指定执行的任务列表
      - build:
          filters:
            tags:
              only: /^v.*/ # 就是这里，注意要过滤tag，才能在tag推送时触发构建任务
      - release:
          filters:
            tags:
              only: /^v.*/ # 这里要设置只在tag推送时触发构建任务
            branches:
              ignore: /.*/ # 同时记得要忽视分支推送触发
          requires: # 设置任务前置条件，依赖于构建任务的成功
            - build
```
每一步指令的解释已在代码块中标注，结合理解即可。

## 结合npm发包
这里容许笔者偷个懒，直接使用date-fns作者提供的脚本稍作修改——
```
#!/bin/bash

# The script builds the package and publishes it to npm

set -e

# A pre-release is a version with a label i.e. v2.0.0-alpha.1
if [[ "$CIRCLE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-.+$ ]] # 根据环境变量获取的tag值的内容判断是预发布还是正式发布
then
  IS_PRE_RELEASE=true
else
  IS_PRE_RELEASE=false
fi

./scripts/release/writeVersion.js # 执行写入版本的动作

echo "//registry.npmjs.org/:_authToken=$NPM_KEY" > ~/.npmrc # 写入笔者的npm仓库token密钥，才有权限发布。这里通过CI工具设置为环境变量，保证安全隐蔽性

if [ "$IS_PRE_RELEASE" = true ] # 根据发布类型执行相应命令
then
  npm publish --tag next
else
  npm publish
fi
```
而写入版本则如同上述一样，利用node环境对package.json做写入操作：

```
#!/usr/bin/env node

const path = require('path')
const fs = require('fs')

// Extract version from CIRCLE_TAG
let version
try {
  [, version] = process.env.CIRCLE_TAG.match(/v(.+)/) // 利用正则获取版本
} catch (err) {
  console.error(`Can not extract version from CIRCLE_TAG (${process.env.CIRCLE_TAG})`)
  console.error(err)
  process.exit(1)
}

console.log(`Version: ${version}`)

console.log('Writing to package.json...')
// Write package.json with the version equal to the version encoded in the tag name
const packagePath = path.join(process.cwd(), 'package.json') // 解析绝对路径
const packageContent = JSON.parse(fs.readFileSync(packagePath).toString()) // 利用node文件系统读取配置文件并解析成json对象
Object.assign(packageContent, {version}) // 替换对象中的版本号
const newPackageContentStr = JSON.stringify(packageContent) // 重新格式化为字符串
fs.writeFileSync(packagePath, `${newPackageContentStr}\n`) // 将新的内容写入到package.json中
```
然后推送到仓库中，可以看到只触发了构建命令。

再试着打一个`github tag`，两者都被触发了，任务执行完毕，我们还可以在npm官网看到自己发布的包，版本和github tag完全一致！

注：本文所使用代码可参考笔者的代码库[yuchanns/vuepress-theme-hermit](https://github.com/yuchanns/vuepress-theme-hermit)。


[^1]: [date-fns/date-fns](https://github.com/date-fns/date-fns)
[^2]: [scripts/release](https://github.com/date-fns/date-fns/tree/master/scripts/release)
[^3]: [date-fns/.travis.yml](https://github.com/date-fns/date-fns/blob/master/.travis.yml)
[^4]: [Publishing npm Packages Using CircleCI 2.0](https://circleci.com/blog/publishing-npm-packages-using-circleci-2-0/)
[^5]: [Using Environment Variables](https://circleci.com/docs/2.0/env-vars/)
[^6]: [Configuring CircleCI](https://circleci.com/docs/2.0/configuration-reference/#table-of-contents)
[^7]: [filters](https://circleci.com/docs/2.0/configuration-reference/#filters)
