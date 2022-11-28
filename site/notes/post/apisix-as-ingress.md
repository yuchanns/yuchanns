---
title: K8s 入门-使用 APISIX 作为 Ingress
---
[[文章索引|posts]] [[K8s 系列|k8s]]

**系列文章**

* [[K8s 入门-使用 kubeadm 安装|post/k8s-install-with-kubeadm]]

> 太长不看版：
>
> 本文在集群外部架设了 `nfs server` 作为远程存储 ，然后在集群内部署了 `subdir provisioner` 并在此基础上创建 `nfs storage class` 实现持久卷的自动创建。接着使用 `Helm` 部署 APISIX 和 Ingress Controller 以及 Dashboard 组件，最后创建一条路由规则实现从集群外部访问 Dashboard 对网关进行管理。

## 什么是 Ingress$^{\[1\]}$
当我们理解 `pod`, `deployment` 和 `service` 的概念，并使用 **Kubeadm** 部署了一个 K8S 集群后，接下来会做的第一件事一般是部署一个简单的服务并通过外部去访问它。

在集群里访问服务只需简单地通过 `svc`.`namespace`:`port` 也就是**服务名**.**命名空间**:**端口号**的形式实现，这被称为 `ClusterIP` 。但集群外可无法轻易进行访问，除非通过宿主机临时代理，但这并非长久之计。

如果进一步阅读文档$^{\[2\]}$，也许会了解到 k8s 的服务有三种暴露方式`NodePort`, `LoadBalancer` 和 `Ingress` 。

其中 NodePort 最好理解，就是在所有节点上暴露一个指定的物理端口号，通过该端口来直达集群内的特定服务——问题在于，节点的端口有限，最多只有65535个(实际可用更少)，并且服务数量膨胀之后难以管理，也无法利用到 K8S 内建强大的 DNS 调度功能。
```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: NodePort
  selector:
    app: MyApp
  ports:
      # By default and for convenience, the `targetPort` is set to the same value as the `port` field.
    - port: 80
      targetPort: 80
      # Optional field
      # By default and for convenience, the Kubernetes control plane will allocate a port from a range (default: 30000-32767)
      nodePort: 30007
```

更好的选择是 LoadBalancer 。这是一种通过外部提供的负载均衡器来访问内部的 ClusterIP 的方式，但是要求既要有外部服务提供商的支持，还需要暴露大量的 LoadBalancer IP 和 ClusterIP 。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: MyApp
  ports:
    - protocol: TCP
      port: 80
      targetPort: 9376
  clusterIP: 10.0.171.239
  type: LoadBalancer
status:
  loadBalancer:
    ingress:
    - ip: 192.0.2.127
```

在没有外部协助、并且不想不可控地暴露大量端口的前提下， Ingress 常常是最合适的选择。

Ingress 实际上是对 NodePort 的一种特殊形式。使用 NodePort 暴露一个特殊的服务，该服务作为集群的“唯一入口”，被定义了一系列 Ingress 资源路由规则，提供“智能路由”的分发功能。

所有对集群服务的访问都可以使用域名根据 Ingress 资源定义的规则转发给集群内对应的服务。这样只需要暴露少数几个端口（通常是是 http 和 https 端口），又利用上了 K8S 复杂的 DNS 调度能力。如果有外部负载均衡器提供商，还能结合使用并减少 ip 暴露的数量。
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: minimal-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - http:
      paths:
      - path: /testpath
        pathType: Prefix
        backend:
          service:
            name: test
            port:
              number: 80
```

## Apache APISIX
Ingress 只是定义了一些路由规则，想要让规则生效，还需要一个 Ingress Controller 。

K8S 官方支持 AWS, GCE 和 NGINX 。如果跟着官方文档的示例做，那么首选的 Ingress Controller 则会是 NGINX 。

需要提前声明的是，由于公司内使用的网关是 Apache APISIX ，所以这成为了我技术选型的首要考虑因素。

坦白地说，APISIX 也不过是基于 OpenResty (NGINX+LuaJIT)。除了上述原因，还有什么理由不直接使用 NGINX 呢$^{[3]}$？

个人认为，直接使用 NGINX 的痛点有两点，**无法热重载**和**缺失控制面**(Control Plane)。

至于 Kong ，它自带的数据库 PostgreSQL 是单点，也无法动态扩缩容。

APISIX 具有官方提供的 Dashboard 作为控制面，使用 etcd 作为配置中心，并在部署中自带了高可用，提供的插件特性也十分丰富。

下面笔者分享一下自己在 K8S 集群中搭建 APISIX 网关的步骤过程。

作为入门文章，首先会顺便介绍 PV, PVC 的概念和作为演示用例的 NFS 部署流程。

然后使用 Helm 部署 APISIX Ingress 和 Dashboard 。

最后配置第一条路由规则使控制面可通过外部集群访问。
## 持久卷与 NFS
由于 APISIX 使用 etcd 作为存储，在部署前需要确保集群具有空闲可用的持久存储卷。

### PV 和 PVC
我们对有状态的应用的存储具有持久化的需求，要知道 K8S 的一大特点就是 Pod 根据调度可以随时创建和销毁，其产生的数据（例如数据库表）则不能是**易失的**。

为了解决存储问题，保证数据的安全，人们煞费苦心地发明了各种各样的分部署存储方案，例如 **Ceph RBD** 等等。而这类设施往往要求用户具备一定的相应背景知识才能使用，存在门槛。

在 K8S 中则引入了一个 `Persistent Volume` 对象，作为持久化存储卷的抽象，同各种存储方案结合起来。

平台提供者（这一角色通常是运维）只需要在配置文件中简单声明所使用的存储实现（由 `storageClassName` ）关联，访问模式和大小即可创建一个空闲的存储卷：
```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: task-pv-volume
  labels:
    type: local
spec:
  storageClassName: manual
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: "/mnt/data"
```
存储卷创建之后要如何被集群用户指定给 **Pod** 使用呢？这里又引入了一个 `Persistent Volume Claim` 对象，用户通过该对象描述希望被满足的存储卷属性，然后由 K8S 控制面查找满足条件的 **PV** 并将两者绑定，这样一来就可以被 **Pod** 使用了：
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: task-pv-claim
spec:
  storageClassName: manual
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 3Gi
```
我们只需要在 **Pod** 对象中指定挂载即可：
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: task-pv-pod
spec:
  volumes:
    - name: task-pv-storage
      persistentVolumeClaim:
        claimName: task-pv-claim
  containers:
    - name: task-pv-container
      image: nginx
      ports:
        - containerPort: 80
          name: "http-server"
      volumeMounts:
        - mountPath: "/usr/share/nginx/html"
          name: task-pv-storage
```
上述例子摘自官方文档$^{[4]}$。

### StorageClass
运维人员在提供持久化存储卷的时候并不能预料到后续使用者会有多少存储卷的需求，如果每当用户声明一个新的 **PVC** 时都需要跟着提供一个 **PV** 会显得十分被动且麻烦，于是这部分职责就被赋予到 **StorageClass** 这个对象上。

在前文例子中提到存储实现由 `StorageClass` 所关联，具体则是由描述文件中的 `provisioner` 字段指定$^{[5]}$。
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp2
reclaimPolicy: Retain
allowVolumeExpansion: true
mountOptions:
  - debug
volumeBindingMode: Immediate
```
大部分存储实现都可以在声明 **StorageClass** 对象后动态自动创建满足 **PVC** 需求的 **PV** ，少数则不支持，比如本地存储。

除了特殊需求（高速 IO 等）外我们一般也不使用本地存储，它有许多缺点：需要准备定期备份方案、磁盘满了会影响本地程序运行、无法自由调度 **Pod** 等。

在本文中，笔者用于玩耍的存储则由 `Network File System` 提供，此前笔者写过一篇文章简单介绍过$^{[6]}$，本文将一笔带过。

### 部署 NFS 和声明 StorageClass
笔者的集群建立在 **Proxmox** 虚拟机上，在宿主机 Proxmox 上额外挂载了一个用于存储的卷 `/mnt/storage2`。

首先需要在宿主机上安装并启用 **NFS Server** ：
```yaml
# 首先安装nfs服务器和rpcbind
sudo apt install nfs-kernel-server rpcbind
# 查看两者是否启动服务
systemctl status nfs-kernel-server.service
systemctl status rpcbind.service
# 设置开机启动
systemctl enable nfs-kernel-server.service
systemctl enable rpcbind.service
# 创建一个分享路径
mkdir /mnt/storage2/nfsshare
# 设置拥有者为匿名组
sudo chown nobody /mnt/storage2/nfsshare
# 配置/etc/exports
echo "/mnt/storage2/nfsshare *(rw,sync,all_squash,no_subtree_check)" >> /etc/exports
# 重载配置文件
sudo /usr/sbin/exportfs -ra
# 检查是否生效
showmount -e 10.9.40.59
# Export list for 10.9.40.59:
# /mnt/storage2/nfsshare *
```
宿主机在局域网中的 ip 是10.9.40.59，可以看到 nfs 服务已经开始提供。

集群中访问资源需要 RBAC 权限，因此我们创建一个 nfs 集群角色，注意这里将命名空间设置为 `kube-system`。关于 RBAC 权限的详细介绍将在后续其他文章中进行：
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nfs-client-provisioner
  namespace: kube-system
---
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: nfs-client-provisioner-runner
rules:
  - apiGroups: [""]
    resources: ["persistentvolumes"]
    verbs: ["get", "list", "watch", "create", "delete"]
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "watch", "update"]
  - apiGroups: ["storage.k8s.io"]
    resources: ["storageclasses"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["create", "update", "patch"]
---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: run-nfs-client-provisioner
subjects:
  - kind: ServiceAccount
    name: nfs-client-provisioner
    namespace: kube-system
roleRef:
  kind: ClusterRole
  name: nfs-client-provisioner-runner
  apiGroup: rbac.authorization.k8s.io
---
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: leader-locking-nfs-client-provisioner
  namespace: kube-system
rules:
  - apiGroups: [""]
    resources: ["endpoints"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
---
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: leader-locking-nfs-client-provisioner
  namespace: kube-system
subjects:
  - kind: ServiceAccount
    name: nfs-client-provisioner
    namespace: kube-system
roleRef:
  kind: Role
  name: leader-locking-nfs-client-provisioner
  apiGroup: rbac.authorization.k8s.io
```
然后部署一个 nfs 客户端 provisoner 服务，即 **StorageClass** 对象中的 `provisioner` 。

根据官方文档可选的有 `Ganesha` 和 `subdir` ，笔者选择了 `subdir` 。
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nfs-client-provisioner
  namespace: kube-system
  labels:
    app: nfs-client-provisioner
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: nfs-client-provisioner
  template:
    metadata:
      labels:
        app: nfs-client-provisioner
    spec:
      serviceAccountName: nfs-client-provisioner
      containers:
      - name: nfs-client-provisioner
        #image: gcr.io/k8s-staging-sig-storage/nfs-subdir-external-provisioner:v4.0.0
        image: yuchanns/nfs-subdir-external-provisioner:v4.0.0
        volumeMounts:
        - name: nfs-client-root
          mountPath: /persistentvolumes
        env:
        - name: PROVISIONER_NAME      
          value: nfs-client
        - name: NFS_SERVER
          value: 10.9.40.59
        - name: NFS_PATH
          value: /mnt/storage2/nfsshare
      volumes:
      - name: nfs-client-root
        nfs:
          server: 10.9.40.59
          path: /mnt/storage2/nfsshare
```
在该描述文件中指定了我们刚刚创建的 nfs 服务器地址和存储路径。

注：因为 gcr.io 在国内网络不通，笔者先预先将镜像拉下来后推送到了自己的 github 仓库上方便集群内拉取。

最后声明一个 `StorageClass` 对象：
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-storage
  annotations:
    storageclass.kubernetes.io/is-default-class: "true" # 设置为默认 storage class
provisioner: nfs-client
parameters:
  archiveOnDelete: "true"
mountOptions:
  - hard
  - nfsvers=4 # 根据 nfs 服务版本设置
```
以后我们就不必再为该集群中的存储操心，一切需求基本由 **StorageClass** 自动满足。

可以通过命令`kubectl get storageclass`查看到被设置为默认 **StorageClass** :
```yaml
kubectl get storageclass
# NAME                    PROVISIONER   RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION   AGE
# nfs-storage (default)   nfs-client    Delete          Immediate           false                  3d8h
```

## 部署 APISIX Ingress Controller
APISIX 的 Ingress Controller 是 APISIX 的外部插件，需要和 APISIX 一起部署。本次我们将通过部署 APISIX 时指定同时部署 Ingress Controller 和 Dashboard 。

### Helm
Helm$^{[7]}$ 是一个 K8S 的包管理软件，就像 Apt 之于 Debian 和 Ubuntu ， Homebrew 之于 MacOS 。

快速通过脚本安装：
```bash
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh
```
可以通过 `helm list --all-namespaces` 查看已安装列表，`helm search` 搜索包，详细命令可参考官网，不再赘述。
### 安装 APISIX 及其组件
添加 APISIX 的 helm 仓库：
```bash
helm repo add apisix https://charts.apiseven.com
helm repo update
```
在开始安装之前，有必要说明：

* APISIX 将作为集群的外部入口，所以需要以 **NodePort** 的形式部署。
* 一般整体架构中集群前面还有一个 **SLB** ，所以可以让集群为 APISIX 随机指定一个端口号；本文中为了方便访问，则指定 80 端口号和 443 端口号对外暴露。
* K8S 默认允许暴露的端口范围是 30000-32767 ，需要手动更改。笔者使用 Kubeadm 安装的集群，因此直接在 master 节点上更改`/etc/kubernetes/manifests/kube-apiserver.yaml` 文件，在 `command` 列表下添加一行 `--service-node-port-range=1-65535` 即可。

接下来创建一个命名空间，并安装 APISIX ，同时指定暴露的端口号以及额外安装的组件：
```bash
kubectl create ns ingress-apisix
helm install apisix apisix/apisix   --set gateway.type=NodePort --set gateway.http.nodePort=80 --set gateway.tls.nodePort=443 --set admin.allow.ipList="" --set ingress-controller.enabled=true --set dashboard.enabled=true  --namespace ingress-apisix --kubeconfig ~/.kube/config
```
值得一提的是，在安装参数中笔者添加了一个 `--set admin.allow.ipList=""` ，这个细节在官方的安装示例中没有提及，造成的后果是其他服务无法访问 `apisix-admin` 这个服务，属实有点坑人😅。

稍等片刻即可看到一共有6个 **Pod** 在命名空间 `ingress-apisix` 部署成功。其中三个 etcd 如果前面没有设置 **StorageClass** 就会导致卡在创建阶段找不到存储卷 ：
```bash
kubectl get pods -n ingress-apisix
# NAME                                        READY   STATUS    RESTARTS   AGE
# apisix-5ff456d8d5-zctbk                     1/1     Running   0          4h49m
# apisix-dashboard-78ffd8596-ctxfx            1/1     Running   0          4h49m
# apisix-etcd-0                               1/1     Running   0          4h49m
# apisix-etcd-1                               1/1     Running   0          4h49m
# apisix-etcd-2                               1/1     Running   0          4h49m
# apisix-ingress-controller-b5f5d49db-znbvc   1/1     Running   0          4h49m
```
这里有个小坑要注意下，如果你通过 `kubectl logs --tail=20 apisix-ingress-controller-b5f5d49db-znbvc -n ingress-apisix` 查看日志可能会看到里面有大量的 error 报错，提示无法拉取到 `apisix-admin` 服务的接口，这是由于该 **ingress controller** 代码存在一个小 bug$^{[8]}$ ，当 **ingress controller** 比 **apisix-admin** 提前启动并拉取不到接口，就会陷入永远拉不到的错误告警中。

解决办法很简单，手动删除 **Pod** 让它重新创建即可: `kubectl delete pod apisix-ingress-controller-b5f5d49db-znbvc -n ingress-apisix`。

### 添加第一条路由规则
看到这里，本文的最终目的——使用 APISIX 作为 Ingress 基本上已经达成！接下来我们进入 **apisix-admin** 的 **Pod** 添加第一条路由规则，以便从外部访问集群内的 APISIX Dashboard 控制台：
```bash
kubectl exec -it apisix-5ff456d8d5-zctbk -n ingress-apisix -- /bin/sh
curl "http://apisix-admin:9180/apisix/admin/upstreams/1" -H "X-API-KEY: edd1c9f034335f136f87ad84b625c8f1" -X PUT -d '
{
  "type": "roundrobin",
  "nodes": {
    "apisix-dashboard:80": 1
  }
}'
curl "http://apisix-admin:9180/apisix/admin/routes/1" -H "X-API-KEY: edd1c9f034335f136f87ad84b625c8f1" -X PUT -d '
{
  "uri": "*",
  "host": "apisix-gateway.k8s",
  "upstream_id": "1"
}'
```
我们创建了一个从域名`apisix-gateway.k8s` 访问 dashboard 的规则，记得在本地 hosts 中将域名和集群 ip 绑定起来，最后使用默认账号密码 admin 访问该域名，可以看到规则确实生效了。

---
参考：
1. [Kubernetes NodePort vs LoadBalancer vs Ingress? When should I use what?](https://medium.com/google-cloud/kubernetes-nodeport-vs-loadbalancer-vs-ingress-when-should-i-use-what-922f010849e0)
2. [Kubernetes Documentation](https://kubernetes.io/docs/home/)
3. [有了 NGINX 和 Kong，为什么还需要 Apache APISIX](https://segmentfault.com/a/1190000040412320)
4. [Configure a Pod to Use a PersistentVolume for Storage](https://kubernetes.io/docs/tasks/configure-pod-container/configure-persistent-volume-storage/)
5. [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
6. [[使用NFS共享文件夹|file-shared-by-nfs]]
7. [Helm the package manager for kubernetes](https://helm.sh/)
8. [bug: Always sync ingress failed if apisix cluster not ready when apisix-ingress start.](https://github.com/apache/apisix-ingress-controller/issues/448)
