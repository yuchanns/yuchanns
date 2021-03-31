---
title: "使用NFS共享文件夹"
date: 2020-06-30T15:46:00+08:00
draft: false
---
这是一篇衍生自笔者的k8s学习过程的前置知识文章。

## 前言
在谈论到k8s的持久卷(Persistent Volume)时，其实质表达的意思是，将集群系统节点中的某个路径挂载到pod中。

例如，使用基于docker驱动的minkube时，持久卷是将minikube容器中的某个路径挂载到容器中的docker创建的pod中——它的存储不受pod生命周期的影响，因而得名。然而当你删除minikube集群时，持久卷中的东西照样会消失，毕竟这是在minikube容器中的卷。

而笔者更希望的持久卷能像使用docker-compose那样，做到真正持久在宿主机上，不受minikube存在与否的影响。

在minikube的issue社区中，笔者发现有人正在讨论相关的**feature request**[#7604](https://github.com/kubernetes/minikube/issues/7604)。遗憾的是该问题是今年四月11才提出的，而解决的**PR**[#8136](https://github.com/kubernetes/minikube/pull/8136)截止本文写下之时的16小时之前还陷于rebase的问题中。不管怎么说，距离minikube下一个版本的发布估计还很远，暂时无法报以期待。

在issue中也有人提到当前minikube会自动挂载宿主机的某个路径到minikube中，但经过笔者尝试，依然会受到`minikube delete`的影响。这还是基于docker驱动的，基于其他虚拟机驱动更不用说，都只有固定挂载的路径，还会受到minikube生命的影响。
> Currently we are mounting the /var directory as a docker volume, so that's the current workaround.
>
> i.e. use this host directory, for getting things into the container ?
>
> See e.g. docker volume inspect minikube for the details on it
>
> Mounting the /home directory has security implications, some want it disabled by default for VMs...
>
> See [#6788](https://github.com/kubernetes/minikube/issues/6788)
>
> And [#5012](https://github.com/kubernetes/minikube/issues/5012)

那么在这之前如何达到、有没有办法实现这样的需求？

答案是有的，使用**NFS**(~~极品飞车Need For Speed~~网络文件系统Network File System)。

![](/images/need4speed.jpeg)

## NFS
这是一种通过网络实现了标准接口的文件系统，使得Linux主机可以透过网络将局域网其他主机挂载本地，如同访问本地文件那样轻松访问其他主机共享路径。

具体介绍笔者不花费精力多说，读者可自行搜索。下面快速讲解一下测试经过，为k8s的学习之路铺下基础。

### 流程
我们将在宿主机上搭建nfs服务器，并指定分享一个路径，然后使用docker创建一个debian容器，并在内部安装nfs客户端，通过宿主机在docker中的ip(docker0)来挂载分享路径。

### 服务端
宿主机使用的是Deepin15，Debian系主机。

```
# 首先安装nfs服务器和rpcbind
sudo apt install nfs-kernel-server rpcbind
# 查看两者是否启动服务
systemctl status nfs-kernel-server.service
systemctl status rpcbind.service
# 设置开机启动
systemctl enable nfs-kernel-server.service
systemctl enable rpcbind.service
```
然后在/etc/exports配置要分享的路径，允许访问的ip，权限等
```
# 首先创建一个分享路径
mkdir /home/$(echo $USER)/share-for-nfs
# 设置拥有者为匿名组
sudo chown nobody /home/$(echo $USER)/share-for-nfs
# 配置/etc/exports
echo "/home/$(echo $USER)/share-for-nfs *(rw,sync,all_squash)" >> /etc/exports
# 重载配置文件，生效
sudo /usr/sbin/exportfs -ra
```
其中，配置/etc/exports时，*号表示对任何访问者都允许，如果要设置特定访问者，可以写上具体ip，例如192.168.1.140(rw,sync,all_squash)；而括号中的东西则表示访问的权限。上文里表示可读写(rw)，同步写入(sync)，访问者映射为匿名组(all_squash)。常用可选参数有：
```
ro：共享目录只读；
rw：共享目录可读可写
sync：同步，将数据同步写入内存缓冲区与磁盘中，效率低，但可以保证数据的一致性；
async：异步，将数据先保存在内存缓冲区中，必要时才写入磁盘，效率高，但有丢失数据的风险；
wdelay（默认）：如果有多个客户端要对同一个共享目录进行写操作，则将这些操作集中执行。对有很多小的IO写操作时，使用该选项可以有效的提高效率；
no_wdelay：如果有多个客户端要对同一个共享目录进行写操作则立即写入。当设置了async选项时，no_wdelay选项无效，应与sync配合使用；
root_squash（默认）：将来访的root用户映射为匿名用户或用户组；
no_root_squash：来访的root用户保持root帐号权限；
all_squash：所有访问用户都映射为匿名用户或用户组；
no_all_squash（默认）：访问用户先与本机用户匹配，匹配失败后再映射为匿名用户或用户组；
anonuid=<UID>：指定匿名访问用户的本地用户UID，默认为nfsnobody（65534）；
anongid=<GID>：指定匿名访问用户的本地用户组GID，默认为nfsnobody（65534）；
secure（默认）：限制客户端只能从小于1024的tcp/ip端口连接服务器；
insecure：允许客户端从大于1024的tcp/ip端口连接服务器；
subtree_check ：若输出目录是一个子目录，则nfs服务器将检查其父目录的权限；
no_subtree_check（默认） ：即使输出目录是一个子目录，nfs服务器也不检查其父目录的权限，这样可以提高效率；
hide：共享一个目录时，不共享该目录的子目录；
no_hide：共享子目录；
```
可用`man exports`进一步了解。

而exportfs的flag含义如下：
```
-a ：全部输出或取消输出/etc/exports中共享的内容
-r ：重新读取/etc/exports中的配置
-u ：取消一个或多个共享目录的输出
-i ：忽略/etc/exports中的配置，而使用默认或命令行中指定的选项
-o ：通过命令添加共享目录，重启后失效。
-v ：如果不跟其他选项一起使用，则显示当前共享的所有目录及他们的选项设置，如果输出或取消输出共享目录，则显示进行了那些操作。
```
于是我们配置好了nfs服务器和分享路径。

最后，我们获取一下宿主机在docker中的ip
```
ip addr show docker0
# inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
```

### 客户端
客户端采用docker容器，符合目的使用场景。

```
# 使用debian容器，注意选择性配置sys_admin权限才能挂载
docker run -it --rm --cap-add sys_admin debian /bin/bash
# 进入容器进行一系列中国特色设置以及安装需要的依赖
sed -i 's/security.debian.org/mirrors.ustc.edu.cn/g' /etc/apt/sources.list
sed -i 's/deb.debian.org/mirrors.ustc.edu.cn/g' /etc/apt/sources.list
apt update
apt install libterm-readkey-perl dialog nfs-common rpcbind -y
# 可查看宿主机共享了哪些路径
showmount -e 172.17.0.1
# /home/yuchanns/share-for-nfs *
# 创建挂载点
mkdir /share-for-nfs
# 这里配置上一节获取到的宿主机ip，并设置nolock，挂载网络文件
mount -t nfs -o rw,bg,nolock,retry=1 172.17.0.1:/home/yuchanns/share-for-nfs /share-for-nfs
# 在挂载点创建文件，可在宿主机中看到
echo "hello from container" >> /share-for-nfs/helloworld
```
