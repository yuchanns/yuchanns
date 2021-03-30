---
title: "使用Jenkins（一）"
date: 2020-05-05T07:04:00+08:00
draft: false
---
![](/images/jenkins2.png)

## 前言
[Jenkins](https://www.jenkins.io)是一个用Java编写的持续集成开源工具，与之类似的还有[TravisCI](https://travis-ci.org/)和[CircleCI](https://circleci.com/)以及最近推出的[GithubActions](https://github.com/features/actions)等工具。笔者以前使用得较多的是Circle——无论是Travis还是Circle，两者都是github上十分流行于开源者之间的选择。

但是编码生活不仅仅只有开源，当我们编写一些私密商业项目、公司内部项目时，往往不希望源码流出到第三者CI/CD工具中，这时候我们就可以选择开源可自行部署的Jenkins。
## 使用docker安装
在官网上提供了多种Jenkins安装部署的方式，笔者是容器化部署的推崇者，因此选择docker镜像部署的方式，这样可以免除因对Java不熟而历程坎坷的问题。
### 镜像的选择
如果我们到[dockerhub](https://hub.docker.com/)上进行搜索，会发现排名第一的是名为Jenkins的官方镜像，一般来说既是官方的又排名第一，可以放心使用了。然而点进去详情页面才知道：
> ## DEPRECATION NOTICE
> This image has been deprecated in favor of the jenkins/jenkins:lts image provided and maintained by Jenkins Community as part of project's release process. The images found here will receive no further updates after LTS 2.60.x. Please adjust your usage accordingly.

很不幸，官方已经停止了对Jenkins镜像的维护，同时还推荐我们使用由社区维护的`jenkins/jenkins:lts`镜像。

笔者一开始没有注意到这段说明，使用了这个镜像，后果就是插件因为版本问题无法安装成功。

那么我们决定使用`jenkins/jenkins:lts`这个镜像。
### 镜像的编排
直接部署镜像也是可以的，但是笔者不想每次都输入一大串参数，因此使用docker-compose进行镜像的编排。

首先我们编写一个dockerfile，包含这些内容：以`jenkins/jenkins:lts`镜像为基础，以root身份将jenkins用户加入到docker用户组中，然后切回jenkins身份。启动容器时挂载将宿主机中的`./jenkins_home`挂载到容器中`/var/jenkins_home`，此举确保插件和流水任务存储在宿主机中；jenkins需要用到docker，所以还要把`/usr/bin/docker`和`/var/run/docker.sock`挂载到容器中，前者是docker客户端，后者是客户端与服务端通信的终端文件。需要注意的是docker.sock是需要使用权限的，因此我们才需要将jenkins加入到dockery用户组中，否则在使用docker进行构建任务时会发生权限问题。

在宿主机中运行
```bash
awk -F ':' '/docker/{print $3}' /etc/group
```
获取到宿主机中docker的权限组id(例如133)，接着编写如下dockerfile内容：
```bash
FROM jenkins/jenkins:lts

USER root

ARG dockerGid=133

RUN  echo "docker:x:${dockerGid}:jenkins" >> /etc/group

USER jenkins
```
然后使用如下docker-compose.yaml进行编排
```yaml
version: '3'
services:
  jenkins:
    container_name: jenkins
    restart: always
    build:
      dockerfile: dockerfile
      context: .
    ports:
      - '8080:8080'
      - '50000:50000'
    volumes:
      - ./jenkins_home:/var/jenkins_home
      - /usr/bin/docker:/usr/bin/docker
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      TZ: Asia/Shanghai
```
### 在容器中使用docker
前文中我们提到对容器进行了组的设置，便于与docker进行通信。此处可以运行`docker pull circleci/node:10`进行验证。
## 流水线语法的简单使用
Jenkins的流水线语法很简单，而且官方软件也提供了语法生成器。
### Jenkinsfile语法概览
和其他ci工具类似，Jenkins的语法分为：
* 定义执行环境：
  ```
  agent { 
    docker { image 'image-tag' }
  }
  ```
* 定义执行步骤：
  ```
  stages {
    stage('step1') {
      steps {
        sh 'echo "Hello World"'
      }
    }
  }
  ```
* 使用环境变量
  ```
  environment {
    TZ = 'Asia/Shanghai'
  }
  ```
* 清理
  ```
  post {
    always {
      deleteDir()
    }
    success {
      echo 'success'
    }
    unstable {
      echo 'unstable'
    }
    failure {
      echo 'failed'
    }
    changed {
      echo 'changed'
    }
  }
  ```
上述的语法全部包含在一个`pipeline {}`中。

更多用法查阅[官方教程](https://www.jenkins.io/zh/doc)。
### 一次构建的尝试
测试目标为本博客的皮肤[yuchanns/vuepress-theme-hermit](https://github.com/yuchanns/vuepress-theme-hermit)的构建。

![](/images/jenkins02.png)

首先我们在Jenkins管理首页左侧的[凭据->系统->全局凭据->添加凭据]中添加凭据，输入自己的github账号和密码。

然后到首页点新建任务，决定一个任务名称，比如`vuepress-theme-hermit`，选择流水线。

接着勾选github项目，填写项目的地址`https://github.com/yuchanns/vuepress-theme-hermit`；下面还有触发器、构建条件等选项，不是此时的重点，先略过不提。

流水线一栏，选择`Pipline script from SCM`，SCM则选择`git`，输入仓库地址以及刚才添加的全局凭据。脚本路径默认为Jenkinsfile，这意味着我们需要在项目仓库的根目录创建一个Jenkinsfile，并在里面编写上文提到的语法。保存。

下面给出此次测试用的Jenkinsfile内容，读者也可以在[仓库](https://github.com/yuchanns/vuepress-theme-hermit/blob/master/Jenkinsfile)进行阅读：
```
pipeline {
   agent { docker 'circleci/node:10' }

   stages {
      stage('Build') {
         steps {
            sh 'yarn install --frozen-lockfile'
            sh 'yarn build'
         }
      }
   }
}
```
点击立即构建，稍等一段时间构建就完成了。
![](/images/jenkins03.png)
### 结语
Jenkins还有很多复杂用法，比如仓库推送触发机制，单元测试机制等等。本文目前只是做了一个简单的介绍。

后续笔者还会结合自建gitlab、gitlab-mirros同步github等角度来扩展关于Jenkins的使用。
