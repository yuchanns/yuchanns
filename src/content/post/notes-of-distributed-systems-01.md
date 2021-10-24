---
title: "分布式系统学习笔记01"
date: 2021-10-24T14:35:57+08:00
draft: false
---
> Martin Kleppmann 的 Youtube 视频系列 [Distributed Systems](https://www.youtube.com/watch?v=UEAMfLPZZhE&list=PLeKd45zvjcDFUEv_ohr_HdUFe97RItdiB&index=1) 学习笔记。

## 分布式系统定义
### 系统为什么需要分布式？
* 一些系统的本质就是分布式的，例如从一端通过网络发送消息到另一端，就是分布式消息传递系统
* 更好的可靠性，某些节点停机的情况下系统整体还能保持功能正常
* 更好的性能表现，从附近的节点获取数据，而不是绕过大半个世界耗费更多时间
* 解决更大规模问题，例如海量数据处理和分析，无法仅靠一台机器实例完成，需要大量小型计算机分工协同
### 系统为什么不需要分布式？
* 通信可能失败，并且我们无法得知
* 处理进程可能宕机，并且我们无法得知
* 上述问题随时可能发生，无法预测

## 计算机网络
### 通信抽象模型
![](/images/simple-abstraction-of-communication.png)

**通信的简单抽象模型**

实际情况会更加复杂：
    
1. 多样的网络类型(wifi、手机信号等) 
2. 多种的物理通信(电缆、激光等)

### 延迟和带宽
**延迟**：消息到达的时间

**带宽**：每单位时间发送的数据量

### tcp 和 http 以及消息通信的简单关系
在通信的抽象模型中，消息是一个高层次的对象。

在 tcp 的通信中，每个数据包大小都有最大值的限制，所以一个消息会被分割成很多个数据包。

http 在 tcp 的基础上，接收消息时，将从 tcp 获得的被分割的数据包组装还原成消息；发送消息时，将消息分割成多个数据包，然后使用 tcp 传送。

## 远程过程调用
以在线商店购物为例，由购物网站处理订单、收集信用卡付费信息，扣款动作则通过网络由另外的支付公司完成，这就是远程过程调用(**RPC** Remote Procedure Call)。
```
card := &Card{
    CardNumber: "1234 5678 8765 4321",
    ExpiryDate: "10/2024",
    CVC:        "123",
}

result := paymentSrv.ProcessPayment(card, 3.99, Currency.GBP)

if result.IsSuccess() {
    FullfillOrder()
}
```
如上述代码片段，其中 `paymentSrv.ProcessPayment` 函数(**Stub Function**)的实现是在另一个网络节点上。本地通过发送消息到其他节点上进行通信实现扣款。

使用 RPC 可以使远程调用**看起来像**本地函数调用一样。

### RPC 面临的问题
* 在函数调用过程中服务挂了会发生什么事
* 消息丢失会发生什么事
* 消息延迟会发生什么事
* 如果过程中发生了错误，重试是否安全

### RPC 在企业中的应用
面向服务架构/微服务：将大体量的软件应用分割成多节点上的多个服务，并通过 RPC 进行通信，形成分布式系统。
* 数据类型转换互通
* **IDL** ，语言无关的 API 定义

```
message PaymentRequest {
  message Card {
    required string cardNumber = 1;
    optional int32 expiryMonth = 2;
    optional int32 expiryYear  = 3;
    optional int32 CVC         = 4;
  }
  enum Currency { GBP = 1; USD = 2; }

  required Card     card       = 1;
  required int64    amount     = 2;
  required Currency currency   = 3;
}

message PaymentStatus {
  required bool   success      = 1;
  optional string errorMessage = 2;
}

service PaymentService {
  rpc ProcessPayment(PaymentRequest) returns (PaymentStatus) {}
}
```
上例代码片段为一种 IDL 谷歌的 GRPC 的接口定义示例。


