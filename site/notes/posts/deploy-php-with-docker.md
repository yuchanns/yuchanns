---
title: 使用 docker 部署 PHP 开发环境
---
[[文章索引|posts]]

> 2017，我曾写过关于[[利用虚拟机如何搭建开发环境|deploy-php]]的文章。

之后我还尝试过`Windows Subsystem Linux`，也因为曾经是外包需要频繁搭建环境的关系从优哉游哉地编译源码转向一键快捷的宝塔面板（生产环境不推荐，**极不安全！**）。

## 为什么要使用Docker

无论是windows环境下的wamp，或是linux环境下的lnmp；无论是外包快速切换项目，还是~~跳槽~~入职新公司，搭建开发环境总是一件非常繁琐地事情，众所周知——尤其是像php之类的严重依赖c扩展的语言，在安装各种扩展的过程中简直是费时费力，恨不得把自己现有的环境整个复制过去。事实上我也曾在github写过Dotfile整理收集自己的习惯设置。

~~这里要给不涉及cgo时的go点个赞！~~

当我使用Anaconda/Miniconda安装的python环境开发项目中的一个桌面客户端时，又因为目标用户环境复杂的系统而挠头不已。

虽然我日常使用Mac作为私人开发环境，并且十分讨厌使用Windows开发（因为Windows安装各种扩展麻烦，并且生产环境实际也是Linux），但上班这种外力因素也逼迫你不得不与windows打交道——我曾冲动之下把公司系统换成Ubuntu，结果工作中交流常用QQ和微信也要为此开启一个装了Windows的虚拟机十分痛苦！~~腾讯不给我使用网页版微信我一点也不生气~~

> 吐槽

实际上Mac对开发人员，尤其是C用户也不太友善。选择它只不过是因为同时兼具类Unix环境和便利使用的聊天软件而已。

后来我接触到了Docker这一容器概念，心中遂窃喜。鸟枪换炮般把自己的开发环境切换成了Docker。所做之事无非是把自己以前制作的Dotfile和Script搬运到容器内，把Docker当做虚拟操作系统来使用。所幸多少利用到了一点Docker的集装箱便利之处，安装环境时也少了一些幺蛾子……

直到最近开始关注Docker的正确用法，我才正视了这一工具的使用。

## Dockerfile它不香吗

在Docker诞生的年代，其实有很多和它一样的进程隔离型虚拟软件。而Docker之所以能脱颖而出，Dockerfile的存在功不可没。

Docker最大的优点就是标准化——如同集装箱一般、将各种类型的软件分门别类封装到由Dockerfile构建成的镜像中：

**一次编写，到处运行**

再结合Docker-compose这一编排利器，我们就可以轻松地将一系列Dockerfile编写的软件集成起来随心所欲地开箱即用。极小的体积方便云端存储随处读取，无论在什么系统中只要安装好了Docker就都是我们熟悉的舞台。

> 我超喜欢Dockerfile，里面的大兄弟们个个都是人才，写起来又标准方便，部署起来又省时省力，就像回到了家里开发一样。

所以在三年后的今天，我决定更新一下我关于搭建开发环境的笔记。

## 入门和起步

关于如何入门，网上可以找到很多教程。我也不打算鹦鹉学舌，在此我推荐读者可以去github上看看张馆长的[「Docker need to know」](https://github.com/zhangguanzhang/docker-need-to-know)，这是来自一位专业的运维大佬精心总结的非常到位的基础知识。

下面我记录一下我搭建开发环境的过程。相关的文件源代码仓库点击[yuchanns/docker-compose-php](https://github.com/yuchanns/docker-compose-php)查看。

首先对于我自己来说，以dockerfile的角度分割lnmp开发环境可以分为6个部分：

* php-fpm/python-uwsgi/golang
* nginx webserver
* mysql database
* redis no-sql-database
* rabbitmq
* vim-git-zsh

其中语言端，负责执行源代码/二进制文件，一般采用alpine镜像作基础自己稍加调整；nginx直接使用官方alpine镜像即可，注意更改**CMD**和共享nginx配置目录，方便从外部直接修改nginx的网站配置；mysql也可以用官方镜像，注意将数据存放在宿主机中，这样可以避免无状态容器故障之后**数据丢失**的问题；redis和rabbitmq也是直接拉取官方的镜像即可；最后一项则是我个人的习惯，我喜欢特制.vimrc环境和zsh-gnzh主题的oh-my-zsh，以及使用此容器对代码进行提交和更新操作。

综上所述，其实我们只需要制作语言端镜像就可以了。下面以php-fpm为例（后面会补上golang版本的镜像制作）：

> php-fpm dockerfile

基于官方7.2 alpine镜像(查找镜像可以登录[Docker hub](https://hub.docker.com)搜索)。

将软件管理镜像源设置为中国区，时区设置为中国上海。

使用软件管理下载需要的一些编译扩展依赖工具（比如gcc make等），然后利用docker-php-ext-install安装php扩展，最后记得删除掉那些编译过程依赖。

顺便安装一下composer，这是php的依赖下载安装工具。

最后将**CMD**替换成php-fpm

`docker-php-ext-install`是php官方docker镜像提供的扩展安装工具，集成了一些标准化的扩展，这样安装扩展就再也不是难事。

在编写Dockerfile的过程中，记得使用一个Run就执行完所有命令，因为多个Run命令会形成多层的镜像写入层（具体可以看张馆长的解释），增大镜像的体积。

<details>
<summary>点击查看Dockerfile</summary>

```dockerfile
FROM php:7.2-fpm-alpine

WORKDIR /www

ENV TZ=Asia/Shanghai

RUN sed -i "s/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g" /etc/apk/repositories \
    && apk update && apk add --no-cache \
        libpng-dev make gcc musl-dev \
		g++ zlib-dev imagemagick-dev \
		autoconf \
    && docker-php-ext-install -j$(nproc) gd bcmath sockets zip pdo_mysql \
	&& pecl install imagick redis && docker-php-ext-enable redis imagick \
    && php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" \
    && php composer-setup.php \
    && rm composer-setup.php \
    && mv composer.phar composer \
    && ./composer config -g repo.packagist composer https://mirrors.aliyun.com/composer/ \
	&& apk del make gcc musl-dev g++ zlib-dev autoconf libpng-dev

EXPOSE 9000

CMD ["php-fpm"]
```
</details>

## Docker-compose的编排

得到上面的六个Dockerfile后，我们可以手动执行`docker build .`将其逐个编译成镜像，然后逐一启动，但是更好注意是使用Docker-compose配置统一管理启动关闭，以及端口和挂载等相关事宜。

这里稍微讲解一下用到的Docker-compose.yaml编写功能，更详细的请自行搜索：

```yaml
version: '3'  # 指定docker-compose版本，主流3.x，支持docker1.13+
services:  # 配置服务，每个服务都用于生成一个镜像
  nginx:
    restart: always  # 重启条件，分为always、on-failure、no、unless-stopped
    build:  # 配置构建镜像的详情
      dockerfile: dockerfile  # 指定构建的配置文件
      context: ./nginx  # 指定构建时的上下文
    ports:  # 指定映射的端口
      - '80:80'
    volumes:  # 指定要挂载的共享文件夹
      - ./web:/web
      - ./nginx/conf.d:/etc/nginx/conf.d
    networks:  # 指定网络方式（host、bridge、overlay）
      - code-network
  php-fpm:
    restart: on-failure
    build:
      dockerfile: dockerfile
      context: ./php
    ports:
      - '9000:9000'
    volumes:
      - ./web:/web
    networks:
      - code-network
  mysql:
    image: mysql:5.7  # 指定直接使用的镜像源
    ports:
      - '3306:3306'
    volumes:
      - ./mysql:/var/lib/mysql
      - ./web:/web
    environment:
      MYSQL_ROOT_PASSWORD: JoKwlar0JtOTZFL5
    networks:
      - code-network
  redis:
    image: redis:latest
    ports:
      - '6379:6379'
    volumes:
      - ./web:/web
    networks:
      - code-network
networks:
  code-network:
    driver: bridge
```

然后我们执行
```bash
docker-compose up --build -d # 第一次执行时添加--build，后台运行添加-d
```
就可以构建镜像群，并且启动。

如果要关闭镜像群，执行
```bash
docker-compose down
```
删除镜像群则使用
```bash
docker-compose rm -f
```

> 注意事项
由于上面的例子中我们使用的网络方式为桥接(bridge)，每个容器都有各自的虚拟网卡和ip地址。因此不同容器之间相互访问时，不能直接使用`127.0.0.1`或者`localhost`来访问——只有宿主机可以通过二者来访问相关的网络服务。

假设我们要使用语言端访问mysql，需要将连接地址从`127.0.0.1:3306`改为`服务名:3306`，以上面的yaml文件为例，就是`mysql:3306`

以此类推，访问redis就是`redis:6379`等等。

直接填写对应的局域网ip地址并不推荐，因为ip可能会发生变化。

一键命令启动docker容器，使用`docker ps -s`来查看容器信息，可以看到，整个lnmp环境大小才600MB左右，其中大部分是mysql的体积(占据了400+)。

绝妙的地方就是，我写完了这一系列Dockerfile，将其上传到我的github仓库中，那么下次我可以在任意安装了Docker的环境中轻松快速构建标准化的我熟悉的开发环境。

而每当我写一些小demo进行演示时，想要让别人立即获得我展示的效果。那么我也可以将其配置为一个`docker-compose.yml`文件，随着demo源代码上传到仓库中。这样，别人克隆了源码之后，可以准确地复现演示，避免了各种环境不同造成的困惑尴尬局面！
