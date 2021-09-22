---
title: "K8S 入门-使用Kubeadm安装"
date: 2021-04-03T15:33:00+08:00
draft: false
---
![](/images/k8s-banner.png)

**系列文章**

* [K8S入门-使用 APISIX 作为 Ingress](/2021/09/22/apisix-as-k8s-ingress/)

## 环境准备
### 安装虚拟机软件
安装 [Virtualbox](https://www.virtualbox.org/wiki/Downloads) 和 [Extension Pack](https://www.virtualbox.org/wiki/Downloads) 。

![](/images/virtualbox-extension-pack.png)

我们将会使用 Virtualbox 部署 K8S 集群的master和一个node。

安装 Extension Pack 的目的是使用 Headless 模式启动虚拟机，方便后续在宿主机使用终端 ssh 通信操作。

### 安装OS
本文选择了 [CentOS7](http://mirrors.aliyun.com/centos/7.9.2009/isos/x86_64/) 。

虚拟机属性上，分配 4核 CPU 和 4g 内存，网络使用桥接模式。

设置转发端口的目的是为了后续 ssh 连接到虚拟机。

启动虚拟机，选择镜像，按照提示安装操作系统。

这里假设我们把虚拟机 OS 的管理员命名为 yuchanns 。

### 关闭 swap 和开启 ssh 服务
> 进入虚拟机 OS ，**注意** 下面的操作都在虚拟机的 Shell 中执行的。

K8S 官方建议关闭 swap 分区，这里我们选择关闭，免得后续安装 K8S 时出现警告提示。

先执行 `sudo swapoff -a` 关闭分区，然后去掉 `/etc/fstab` 中对 swap 的加载(**注意！** 是注释 `/dev/mapper/centos-swap swap` 这一行配置，而不是删除掉文件本身)。
```
#
# /etc/fstab
# Created by anaconda on Sat Apr  3 15:13:29 2021
#
# Accessible filesystems, by reference, are maintained under '/dev/disk'
# See man pages fstab(5), findfs(8), mount(8) and/or blkid(8) for more info
#
/dev/mapper/centos-root /                       xfs     defaults        0 0
UUID=56bde1b4-7b8d-4b1d-ac9f-51975adefa6e /boot                   xfs     defaults        0 0
# 注释下面这一行
# /dev/mapper/centos-swap swap                    swap    defaults        0 0
```
> 上面这一步操作也可以使用 `sudo sed -i '/swap/ s/^/#/' /etc/fstab && sudo swapoff -a` 代替。

接着设置 ssh 服务的配置文件 `/etc/ssh/sshd_config` ，主要是"设置监听端口、允许 root 登录和允许账号密码登录"。
```
# /etc/ssh/sshd_config 关键配置
Port 22 # 取消注释
#AddressFamily any
ListenAddress 0.0.0.0 # 取消注释
ListenAddress :: # 取消注释
# 省略
PermitRootLogin yes # 取消注释
# 省略
PasswordAuthentication yes # 取消注释
```
启动服务并使用 systemctl 设置开机启动。
```
sudo service sshd start
sudo systemctl enable sshd.service
```
关闭防火墙服务和禁用 SELinux 。
```
sudo systemctl disable firewalld
sudo systemctl stop firewalld
sudo setenforce 0
```
启用 `bridge-nf-call-iptables` 。
```
sudo echo 'net.bridge.bridge-nf-call-iptables = 1' >> /etc/sysctl.conf
```
### Headless 模式
在关闭虚拟机之前，执行 `ifconfig` 获取到虚拟机的 ip，例如 master 为192.168.31.207， node 为192.168.31.17
关闭虚拟机。

接下来我们通过 Headless 模式启动虚拟机，并在终端使用 ssh 操作 OS 。

> **注意** 下面这段 Shell 命令是在宿主机的终端上执行的。

```
❯ VBoxManage list vms
"x86" {e1f31c26-84e8-496e-93ce-5cb843368ad4}
"CentOS7-master" {45d4e304-704d-4835-9816-58465a1ce4f7}
❯ VBoxHeadless -s CentOS7-master
Oracle VM VirtualBox Headless Interface 6.1.18
(C) 2008-2021 Oracle Corporation
All rights reserved.


```
这样虚拟机就在后台启动了。

在宿主机的新终端中执行 `ssh yuchanns@虚拟机ip` ，连接上虚拟机。

下面没有特殊说明，全都是在宿主机终端的 ssh 通信中操作。
### 安装 Docker
这一部分直接参考阿里云的 [Docker CE 镜像源站](https://developer.aliyun.com/article/110806) 手册操作。
```
# step 1: 安装必要的一些系统工具
sudo yum install -y yum-utils device-mapper-persistent-data lvm2
# Step 2: 添加软件源信息
sudo yum-config-manager --add-repo http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
# Step 3: 更新并安装 Docker-CE
sudo yum makecache fast
sudo yum -y install docker-ce
# Step 4: 开启Docker服务
sudo service docker start
```
安装完成之后，使用阿里云的 [容器镜像服务](https://cr.console.aliyun.com/cn-hangzhou/instances/mirrors) 设置 Docker 使用国内镜像源并重启docker刷新配置以及设置开机启动。
```
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": ["https://你申请的镜像源.mirror.aliyuncs.com"]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
sudo systemctl enable docker
```
### 安装 K8S 工具
> 安装 Kubeadm 工具，并预先拉取 K8S 相关的镜像。

首先配置 yum 国内源，创建 `/etc/yum.repos.d/kubernetes.repo` 写入如下内容。
```
[kubernetes]
name=Kubernetes Repository
baseurl=http://mirrors.aliyun.com/kubernetes/yum/repos/kubernetes-el7-x86_64/
enabled=1
gpgcheck=0
```
开始安装 kubelet 、 kubeadm 和 kubectl 等 K8S 工具。
```
sudo yum install -y kubelet kubeadm kubectl --disableexcludes=kubernetes
```
设置 kubelet 开机启动。
```
systemctl enable kubelet && systemctl start kubelet
```
### 配置 Kubeadm 和拉取镜像
首先执行 `sudo kubeadm config print init-defaults > init.default.yaml` 获取默认的初始化参数文件。

然后参照该文件创建 `init-config.yaml` ，定制镜像仓库为阿里云仓库（默认使用的是 `k8s.gcr.io`）。
```
apiVersion: kubeadm.k8s.io/v1beta2
imageRepository: registry.aliyuncs.com/google_containers
kind: ClusterConfiguration
kubernetesVersion: v1.20.0
```
使用配置文件拉取安装 K8S 需要的镜像。
```
sudo kubeadm config images pull --config=init-config.yaml
[config/images] Pulled registry.aliyuncs.com/google_containers/kube-apiserver:v1.20.0
[config/images] Pulled registry.aliyuncs.com/google_containers/kube-controller-manager:v1.20.0
[config/images] Pulled registry.aliyuncs.com/google_containers/kube-scheduler:v1.20.0
[config/images] Pulled registry.aliyuncs.com/google_containers/kube-proxy:v1.20.0
[config/images] Pulled registry.aliyuncs.com/google_containers/pause:3.2
[config/images] Pulled registry.aliyuncs.com/google_containers/etcd:3.4.13-0
[config/images] Pulled registry.aliyuncs.com/google_containers/coredns:1.7.0
```
到这里，关闭虚拟机，然后生成快照，以便后续如果有需要可以快速恢复备份，并复制一份命名为 node 。

![](/images/virtualbox-backup.png)

然后更改两份虚拟机的 hostname，分别命名为 `yuchanns-master` 和 `yuchanns-node-1` 。
```
hostnamectl set-hostname yuchanns-master
```

## 安装 K8S
### Master
我们先启动 master 虚拟机，安装 K8S Master 。
```
sudo kubeadm init --config=init-config.yaml
```
片刻后得到如下输出。
```
Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

Alternatively, if you are the root user, you can run:

  export KUBECONFIG=/etc/kubernetes/admin.conf

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/addons/

Then you can join any number of worker nodes by running the following on each as root:

kubeadm join 192.168.31.207:6443 --token hx8f96.5yh392lco45qkd94 \
    --discovery-token-ca-cert-hash sha256:cb21467e644298e460e0db036e0472bdce9d87bb5beba6e1453d9f3efa8ebe48
```
上面的片段告诉我们作为普通用户应该执行的一些命令（如果不执行，将无法使用 kubelet 正确与集群通信），以及 node 集群如何加入 master 的方法。

按照提示，执行命令。
```
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```
### Node
启动 `node` 虚拟机，安装 K8S Node 。

这里我们根据安装 Master 时得到的加入提示，创建相应的配置文件 `join-config.yml`。
```
apiVersion: kubeadm.k8s.io/v1beta2
kind: JoinConfiguration
discovery:
  bootstrapToken:
    apiServerEndpoint: 192.168.31.207:6443
    token: hx8f96.5yh392lco45qkd94
    unsafeSkipCAVerification: true
  tlsBootstrapToken: hx8f96.5yh392lco45qkd94
```
然后执行 `sudo kubeadm join --config=join-config.yml`。

安装成功！
### 安装网络插件
master 需要安装网络插件， 这里使用 waves 。
```
kubectl apply -f "https://cloud.weave.works/k8s/net?k8s-version=$(kubectl version | base64 | tr -d '\n')"
```
然后执行 `kubectl get nodes` 看到所有集群状态都为 Ready 。
```
NAME              STATUS   ROLES                  AGE     VERSION
yuchanns-master   Ready    control-plane,master   11m     v1.20.5
yuchanns-node-1   Ready    <none>                 8m46s   v1.20.5
```
检查所有 pod 状态是否正常。这里可以看到包括 node 集群的 pod 状态。
```
kubectl get pods --all-namespaces
NAMESPACE     NAME                                            READY   STATUS    RESTARTS   AGE
kube-system   coredns-7f89b7bc75-2z2lm                  1/1     Running        0          11m
kube-system   coredns-7f89b7bc75-gz26q                  1/1     Running        0          11m
kube-system   etcd-yuchanns-master                      1/1     Running        0          11m
kube-system   kube-apiserver-yuchanns-master            1/1     Running        1          11m
kube-system   kube-controller-manager-yuchanns-master   1/1     Running        0          12m
kube-system   kube-proxy-p2r8v                          1/1     Running        0          9m4s
kube-system   kube-proxy-xjzkp                          1/1     Running        0          11m
kube-system   kube-scheduler-yuchanns-master            1/1     Running        0          11m
kube-system   weave-net-9slcj                           2/2     Running        0          9m4s
kube-system   weave-net-sskbj                           2/2     Running        0          10m
```
如果存在异常，可以使用 `kubectl --namespace=kube-system describe pod <pod_name>` 的方式查看错误日志。

若安装失败，也可以通过 `sudo kubeadm reset` 重置再重新安装。

![](/images/kubernets-all-nodes.png)
