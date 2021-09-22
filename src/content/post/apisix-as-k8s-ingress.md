---
title: "K8S 入门-使用 APISIX 作为 Ingress (未完成)"
date: 2021-09-22T20:49:45+08:00
draft: false
---
![](/images/ingress.png)

**系列文章**

* [K8S 入门-使用Kubeadm安装](/2021/04/03/k8s-install-with-kubeadm/)

## 定义: 什么是 Ingress$^{\[1\]}$
当我们理解 `pod`, `deployment` 和 `service` 的概念，并使用 **Kubeadm** 部署了一个 K8S 集群后，接下来会做的第一件事一般是部署一个简单的服务并通过外部去访问它。

在集群里访问服务只需简单地通过 `svc`.`namespace`:`port` 也就是**服务名**.**命名空间**:**端口号**的形式实现，这被称为 `ClusterIP` 。但集群外可无法轻易进行访问，除非通过宿主机临时代理，但这并非长久之计。

如果进一步阅读文档$^{\[2\]}$，也许会了解到 k8s 的服务有三种暴露方式`NodePort`, `LoadBalancer` 和 `Ingress` 。

其中 NodePort 最好理解，就是在所有节点上暴露一个指定的物理端口号，通过该端口来直达集群内的特定服务——问题在于，节点的端口有限，最多只有65535个(实际可用更少)，并且服务数量膨胀之后难以管理，也无法利用到 K8S 内建强大的 DNS 调度功能。
```
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

```
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
```
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

## 技术选型: Apache APISIX
Ingress 只是定义了一些路由规则，想要让规则生效，还需要一个 Ingress Controller 。

K8S 官方支持 AWS, GCE 和 NGINX 。如果跟着官方文档的示例做，那么首选的 Ingress Controller 则会是 NGINX 。

需要提前声明的是，由于公司内使用的网关是 Apache APISIX ，所以这成为了我技术选型的首要考虑因素。

坦白地说，APISIX 也不过是基于 OpenResty (NGINX+LuaJIT)。除了上述原因，还有什么理由不直接使用 NGINX 呢$^{[3]}$？

个人认为，直接使用 NGINX 的痛点有两点，**无法热重载**和**缺失控制面**(Control Plane)。

至于 Kong ，它自带的数据库 PostgreSQL 是单点，也无法动态扩缩容。

APISIX 具有官方提供的 Dashboard 作为控制面，使用 etcd 作为配置中心，并在部署中自带了高可用，提供的插件特性也十分丰富。

## 落地: 安装 APISIX Ingress Controller
下面笔者分享一下自己在 K8S 集群中搭建 APISIX 网关的步骤过程。

作为入门文章，首先会顺便介绍 PV, PVC 的概念和作为演示用例的 NFS 部署流程。

然后使用 Helm 部署 APISIX Ingress 和 Dashboard 。

最后配置第一条路由规则使控制面可通过外部集群访问。
### 持久卷与 NFS
![](/images/persistent-volume.jpeg)

由于 APISIX 使用 etcd 作为存储，在部署前需要确保 k8s 集群具有空闲可用的持久存储卷。

(未完成...)

---
参考：
1. [Kubernetes NodePort vs LoadBalancer vs Ingress? When should I use what?](https://medium.com/google-cloud/kubernetes-nodeport-vs-loadbalancer-vs-ingress-when-should-i-use-what-922f010849e0)
2. [Kubernetes Documentation](https://kubernetes.io/docs/home/)
3. [有了 NGINX 和 Kong，为什么还需要 Apache APISIX](https://segmentfault.com/a/1190000040412320)
