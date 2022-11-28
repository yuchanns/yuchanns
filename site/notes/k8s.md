---
title: K8s
---
* 利用 k3s 上传镜像
    * 在家里构建的镜像想要上传到公司的局域网，通过 vpn 登录到在公司搭建的 k3s 集群：
        ```bash
        # 导出压缩文档
        docker save domain/image:tag > /path/to/archive-image.tar
        # 家中机
        kubectl cp /path/to/archive-image.tar pod-name:/path/for/temp/save/archive-image.tar -n namespace
        # 宿主机
        kubectl cp pod-name:/path/for/temp/save/archive-image.tar /path/to/host/archive-image.tar -n namespace
        # 利用 ctr 解压包并上传
        k3s ctr images import /path/to/host/archive-image.tar
        k3s ctr images push domain/image:tag -u username:password
        ```
* k8s 强制删除 pod
    ```bash
    kubectl delete pod NAME --grace-period=0 --force
    ```
*  k8s 节点资源配置
    * 参考：
        * [提前预防K8s集群资源不足的处理方式配置](https://kubesphere.com.cn/forum/d/1155-k8s)
        * [为系统守护进程预留计算资源](https://kubernetes.io/zh/docs/tasks/administer-cluster/reserve-compute-resources/)
        ```bash
        --kube-reserved=cpu=200m,memory=250Mi \ # k8s组件预留资源的大小
        --system-reserved=cpu=200m,memory=250Mi \ # 系统守护进程预留资源的大小
        # 驱逐pod的硬阈值
        --eviction-hard=memory.available<5%,nodefs.available<10%,imagefs.available<10% \
        # 驱逐pod的软阈值
        --eviction-soft=memory.available<10%,nodefs.available<15%,imagefs.available<15% \
        # 触发驱逐需要的持续时间
        --eviction-soft-grace-period=memory.available=2m,nodefs.available=2m,imagefs.available=2m \
        --eviction-max-pod-grace-period=120 \ # 驱逐pod前最大等待时间
        --eviction-pressure-transition-period=30s \ # kubelete 上报间隔
        # 至少回收的资源量
        --eviction-minimum-reclaim=memory.available=0Mi,nodefs.available=500Mi,imagefs.available=500Mi
        ```
* 去除 StorageClass standard 默认标志
    ```bash
    kubectl patch storageclass standard -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
    ```
* 一键部署 k3s ，使用 wireguard 和禁用 traefik 。主从节点都记得要安装 wireguard 否则会启动不了
* 创建节点
    ```bash
    ## 国内
    curl http://rancher-mirror.cnrancher.com/k3s/k3s-install.sh | INSTALL_K3S_MIRROR=cn INSTALL_K3S_EXEC="--flannel-backend=wireguard --no-deploy traefik"  sh -
    ## 国外
    curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--flannel-backend=wireguard --no-deploy traefik"  sh -
    ## 部署后获取 token
    sudo cat /var/lib/rancher/k3s/server/node-token
    ## 如果需要开通公网访问则在 INSTALL_K3S_EXEC 参数中加入 "--tls-san=公网 ip"
    ```
* 加入节点
    ```bash
    ## 国内
    curl -sfL http://rancher-mirror.cnrancher.com/k3s/k3s-install.sh | K3S_URL="主节点 ip:端口" K3S_TOKEN="获取的 token" sh -
    ## 国外
    curl -sfL https://get.k3s.io | K3S_URL="主节点 ip:端口" K3S_TOKEN="获取的 token" sh -
    ```
* 卸载
    ```bash
    ## 卸载主节点
    /usr/local/bin/k3s-uninstall.sh
    ## 卸载从节点
    /usr/local/bin/k3s-agent-uninstall.sh
    ```
