---
title: 操作系统概论-概览
---
[[文章索引|posts]] [[操作系统系列|os]]

## 定义
操作系统是一种复杂的 **系统软件** ，是不同 **程序代码 数据结构 数据初始化文件** 的集合，可执行。

操作系统屏蔽硬件细节，提供 **用户** 与 **计算机硬件** 之间的 **接口** ，使 **应用程序** 的开发变得简单高效。

> 目标：
> * 与硬件部分相互作用
> * 为应用程序提供执行环境

重要特点：支持 **多任务** 。

管理资源：
* 处理机管理（cpu）- 决定给哪个程序用
* 内存管理 - 给程序分配内存空间
* 设备管理 - 怎么分配设备，分配哪台设备，怎么和设备连接
* 文件管理 - 为文件分配空间，建立目录，在外存进行读写
* 网卡、带宽

## 发展
* 无操作系统（1946年）
* 单道批处理系统（20世纪50年代）
    * 内存中任意时刻只有一道作业，资源被独占
    * 特点：自动、顺序、单道性
    * 优点：减少了等待人工操作的时间
    * 缺点：资源利用不充分
* 多道批处理系统（20世纪60年代）
    * 由操作系统的 **作业调度程序** 按一定策略从 **后备作业队列** 中选择若干个作业调入内存，共享资源
    * 特点：无序、多道、调度、复杂性
    * 优点：提高资源利用率和系统吞吐量
    * 缺点：平均周转时间长，缺乏交互能力
* 分时操作系统
    * 允许 **多个用户** 通过终端机 **同时使用** 计算机，交互得到 **快速响应**
    * 特点：多路性、独立性、及时性、交互性
    * 优点：提供了 **人机交互的方便性** ，共享主机
* 实时操作系统
    * **及时响应** 外部请求，用于 **实时控制** 和 **实时信息处理**
    * 特点：多路性、独立性、及时性、交互性、可靠性

## 现代操作系统特征
支持多任务

* 并发：多个事件在同一时间间隔内发生
* 共享
* 虚拟：使每个用户感觉自己独占了资源
* 异步性：程序的运行结果、运行次序以及多次运行的时间都不确定

## 功能
#### 管理资源
* 内存管理
    * 提高 **内存利用率** ，从 **逻辑上扩充内存** 实现 **虚拟内存**
    * 内存分配：静态分配、动态分配
    * 内存保护：保护 **内核空间** ，确保 **用户程序** 运行在 **自己的内存空间** ，互不干扰
    * 地址映射：物理内存映射到逻辑内存
    * 内存扩充：**虚拟技术**，**逻辑** 扩充，提供比物理内存大的容量
* 进程管理：进程的描述与组织、控制、同步、通信和调度
* 设备管理：
    * 完成用户的 **I/O请求** ，分配 **I/O设备**
    * 缓冲管理
    * 设备分配
    * 设备处理
    * 独立性和虚拟
* 文件管理：
    * 存储空间的管理：提高外存利用率，提高文件访问速度
    * 目录管理：建立目录项
    * 读写管理和存取控制：从外存读数据或数据写入外存

### 提供用户接口
* 命令接口：
    * 方便交互
    * **联机** 用户接口：一组 **键盘操作命令** 和 **命令解释程序**
    * **脱机** 用户接口：**批处理用户接口**
* 图形用户接口
* 程序接口：**系统调用**

## 体系结构
是一种 **软件** 的体系结构。

* 简单的监控程序模型：功能简陋，任意时刻只能运行一个任务
* 单体结构模型：所有的软件和数据结构都放置在一个逻辑模块中，对外提供统一内核界面（UNIX）
* 层次结构模型：分解为多个小的、容易理解的层
* C/S 模型和微内核结构：核心功能外移（Windows NT）
* 动态可扩展结构模型：运行时动态地实现系统行为扩展的结构

## 指令的执行
**程序是指令的集合** ，程序的执行就是按照某种控制流执行指令的过程

* 指令周期
    * 一个 **单一指令** 需要的处理
    * 分为 **取指周期** 和 **执行周期**
* 程序计数器（PC）：保存下一次要取的指令的地址
* 指令寄存器（IR）：保存取到的指令

处理器解释指令并执行要求的动作：
* **处理器与存储器** 之间的 **指令或数据传送** 操作
* **处理器与I/O设备** 之间的 **指令或数据传送** 操作
* **算术运算** 操作或 **逻辑运算** 操作
* **控制** 操作，即 **修改指令的执行顺序** 的操作
