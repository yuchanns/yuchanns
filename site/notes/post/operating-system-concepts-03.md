---
title: 操作系统概论-进程调度与死锁
---
[[文章索引|posts]] [[操作系统系列|os]]

## 功能和时机
进程调度功能由操作系统的 **进程调度程序** 完成。

按照某种策略和算法 **从就绪态进程中为当前空闲的 CPU 选择在其上运行的新进程** 。

调度时机：
* 进程正常结束
* 进程阻塞
* 更高优先级
* 时间片用完
* 进程异常结束

## 调度算法
* 先来先服务
* 短进程优先
* 优先权
* 时间片轮转
* 多级队列
* 多级反馈队列

### 选择方式和准则
* 周转时间短
    * 外存等待时间+就绪队列等待时间+执行时间+等待I/O操作完成
    * 平均周转时间公式 $T=\frac{1}{n}[\sum\limits_{i=1}^nTi]$
    * 带权平均周转时间（服务时间$Ts$：一个作业在 CPU 上执行的总时间） $W=\frac{1}{n}[\sum\limits_{i=1}^n\frac{Ti}{Ts}]$
* 响应时间快
* 截止时间的保证
* 系统吞吐量高
* 处理机利用率好

* 周转时间=服务时间+等待时间
* 开始运行时间=进入系统时间+等待时间=上一个进程开始运行时间+上一个进程服务时间=上一个进程周转时间+上一个进程进入系统时间

### FCFS
先来先服务调度算法。从就绪队列的队首 **选择最先到达就绪队列的进程** ， 为该进程分配 CPU

> 一个栗子
>
> |进程名|进入系统时间|开始运行时间|服务时间|等待时间|周转时间|
> |:---:|:---:|:---:|:---:|:---:|:---:|
> |p1|0|0|24|0|24|
> |p2|1|24|3|23|26|
> |p3|2|27|3|25|28|
>
> 系统平均周转时间$T=\frac{1}{n}\times(T_1+T_2+T_3+...+T_n)=\frac{1}{3}\times(24+26+28)=26$
>
> 带权平均周转时间$W=\frac{1}{n}\times(\frac{T_1}{T_{1s}}+\frac{T_2}{T_{2s}}+...+\frac{T_n}{T_{ns}})=\frac{1}{3}\times(\frac{24}{24}+\frac{26}{3}+\frac{28}{3})=6.33$

### SPF
短进程优先调度算法。从就绪队列中 **选择估计运行时间最短的进程** ， 为该进程分配 CPU。

> 一个栗子
>
> |进程名|进入系统时间|开始运行时间|服务时间|等待时间|周转时间|
> |:---:|:---:|:---:|:---:|:---:|:---:|
> |p1|2|6|24|4|28|
> |p2|1|3|3|2|5|
> |p3|0|0|3|0|3|
>
> 系统平均周转时间$T=\frac{1}{n}\times(T_1+T_2+T_3+...+T_n)=\frac{1}{3}\times(28+5+3)=12$
>
> 带权平均周转时间$W=\frac{1}{n}\times(\frac{T_1}{T_{1s}}+\frac{T_2}{T_{2s}}+...+\frac{T_n}{T_{ns}})=\frac{1}{3}\times(\frac{28}{24}+\frac{5}{3}+\frac{3}{3})=1.28$

* 优点：与 FCFS 相比，**有效降低进程的平均等待时间，提高了系统吞吐量**
* 缺点：对长进程不利，不能保证紧迫进程的处理，长短由用户估计不一定准确

### PSL
优先权调度算法。系统将 CPU 分配给就绪队列中 **优先权最高的进程** 。

分类：
* 非抢占式：运行期间有更高优先权的进程到来，不能剥夺 CPU
* 抢占式：运行期间有更高优先权的进程到来，可以抢占 CPU

优先权类型：
* 静态优先权：创建时确定，运行期间保持不变
* 动态优先权：创建时确定，随着进程推进或等待时间增加而改变

存在问题：无穷阻塞（饥饿问题）

解决方案：老化技术（增加等待时间很长的进程的优先权）

### RR
时间片轮转调度算法。

> 系统将所有就绪进程按先来先服务的原则排成一个队列，每次调度时把 CPU 分给队首进程，并令其执行一个时间片。当时间片用完时，调度程序终止当前进程的执行，并将它送到就绪队列的队尾。

把 CPU 的1 s 执行时间划分为多个时间片，每个时间片大小 **10-100 ms** 。

现在的分时操作系统基本上都是使用以 RR 为基础结合 PSL 的调度算法。

> Linux 2.4 的时间片大小是 **50 ms** 。

程序需要的时间 < 时间片大小 ，进程结束，调度。

程序需要的时间 > 时间片大小，时间片用完，执行态->就绪态，调度。

系统对响应时间的要求：响应时间要求越短，时间片越小。

就绪队列中进程的数目：进程数越多，时间片越小。

系统的处理能力：处理能力越小，时间片越小，并发越多。

> 性能评价
>
> 时间片很大，等同于 FCFS
>
> 时间片很小，增大了 CPU 对进程切换和调度的开销

### 多级队列调度算法
将就绪队列分成多个独立队列，每个队列有自己的调度算法。

### 多级反馈队列调度算法
建立多个优先权不同的就绪队列，每个队列有大小不同的时间片。

队列优先权越高，时间片越短。优先权越低，时间片越长。

## 实时系统中的调度
### 基本条件
* 提供必要的调度信息：就绪时间、开始截止时间和完成截止时间、处理时间、资源要求、优先级
* 系统处理能力强
* 采用抢占式调度机制
* 具有快速切换机制

### 常用实时调度算法
* EDF -最早截止时间优先：开始截止时间越早，进程优先级越高，越优先获得 CPU
* LLF - 最低松弛度优先：$L = T - T_c - T_s = 完成截止时间 - 当前时间 - 处理完该任务还需要的时间$

## 进程切换
当前正在执行的进程成为被替换进程，让出其所使用的 CPU ， 以运行被进程调度程序选中的新进程。

### 切换步骤
* **保存** 包括程序计数器和其他寄存器在内的 **CPU 上下文环境**
* **更新** 被替换进程的 **进程控制块**
* **修改进程状态** ， 把执行态改为 **就绪态或阻塞态**
* 将被替换进程的进程控制块 **移到就绪队列或阻塞队列**
* **执行** 通过进程调度程序选择的 **新进程** ，并 **更新** 该进程的 **进程控制块**
* **更新内存管理** 的数据结构
* **恢复** 被调度程序选中的进程的 **硬件上下文**

## 多处理器调度 MPS
### 类型
* 紧密耦合：共享主存储器和 I/O 设备
* 松弛耦合：有各自的存储器和 I/O 设备
* 对称：处理单元功能和结构相同
  * 静态分配：就绪队列的进程只能在与就绪队列对应的处理器上运行
  * 动态分配：进程随机地被分配到当时处于空闲状态的某一处理器上执行
* 非对称：有多种类型的处理单元，一个主处理器，多个从处理器
  * 主-从式分配： Master 调度 Slave 运行


### 进程（线程）调度方式
* 自调度
  * 最常用最简单的方式。任何一个空闲处理器都可以从就绪队列中选取一个进程或线程运行。 FCFS
  * 优点：易移植，有利于提高 CPU 利用率
  * 缺点：瓶颈问题，低效性，线程切换频繁
* 成组调度
  * 系统将一组相互合作的进程或线程同时分配到一组处理器上运行，进程或线程与处理器一一对应
  * 优点：减少线程切换，减少调度开销
* 专用处理器分配
  * 在程序执行期间，专门为该程序分配一组处理器，每线程一个
  * 优点：加快程序运行速度，避免进程切换
  * 缺点：处理器资源严重浪费

## 死锁
### 定义
由 **多个进程竞争共享资源** 而引起的 **进程不能向前推进** 的僵死状态。

### 产生的原因和必要条件
原因： **竞争** 共享资源且分配资源的 **顺序不当**

必要条件：
* 互斥条件
* 请求和保持条件
* 不剥夺条件
* 环路等待条件

### 处理死锁的基本方法
* 预防：通过 **破坏死锁的产生条件** 来保证不发生死锁（至少破坏四个必要条件其中之一）
  * 摒弃请求和保持条件：一次性请求全部资源、申请其他资源前释放已占用的资源
  * 摒弃不剥夺条件：系统抢占被占用的资源分配给需要的进程（实现复杂、代价高）
  * 摒弃环路等待条件：进程必须按规定的顺序申请资源（限制了新设配的增加、资源浪费、用户编程麻烦）
* 避免：通过 **算法合理分配资源** 来保证不发生死锁
  * 找到一个进程的 **执行序列** ，不会发生死锁，就是安全状态
  * 不安全状态，可能会发生死锁（不是一定发生）
  * 银行家算法：一个进程提出资源请求后，系统先进行资源的试分配，分配后检测系统是否安全
* 检测：检测当前系统是否出现死锁
  * 充分条件：当且仅当目前状态的资源分配图是不可完全简化的
* 解除：检测到系统有死锁后进行解除
  * 进程终止


