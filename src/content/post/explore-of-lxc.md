---
title: "容器化技术初探索笔记（一）Namespace"
date: 2020-05-01T13:58:00+08:00
draft: false
---
## 前言
虽然作为一个开发人员，快速布置好开发环境是一个无需多言的基本功，但是每切换到一个新的主机环境，想要完全重现自己熟悉的环境依旧是一个耗时麻烦的工作。于是在过去两年中我逐渐习惯于把docker作为自己的开发环境——得益于可定制化的开箱即用配置我再也不用操心每一步动作该如何因地制宜。

那么容器这种技术到底是如何实现的，原理是什么？在使用的过程中我的好奇心越来越重，终于买了一本《自己动手写Docker》[^1]的书，尝试对容器化技术的实现进行初步的了解。
## 环境
在此先说明下自己使用的开发环境，以便保证读者获得行为一致的结果：
* 操作系统：Ubuntu 20.04LTS
* 语言版本：Golang1.14、PHP7.4-cli
* 内核版本: 5.4.0-28-generic
* 硬件：Intel NUC8i7BEH

```
yuchanns@yuchanns-NUC8i7BEH
---------------------------
OS: Ubuntu 20.04 LTS x86_64
Host: NUC8i7BEH J72992-307
Kernel: 5.4.0-28-generic
Uptime: 16 hours, 47 mins
Packages: 1622 (dpkg), 6 (snap)
Shell: zsh 5.8
Terminal: /dev/pts/2
CPU: Intel i7-8559U (8) @ 4.500GHz
GPU: Intel Iris Plus Graphics 655
Memory: 955MiB / 15881MiB
```
书籍中所使用的内核版本较旧，因此部分设置有所改变，本文以`Ubuntu 20.04LTS`为准进行学习。
## 概念
LXC，全称*Linux Container*即**Linux容器化**，是一种利用Linux内核本身提供的Namespace和Cgroup功能实现的进程层面的资源隔离的虚拟化技术。
### Namespace
在编程语言中(如C++、PHP等)，有一种命名空间的概念。在不同命名空间中，相同名称的函数、类等是相互隔离独立的东西。一般的操作系统进程，他们共享了外部的系统资源，例如uid、mount、ipc等等。而LXC可以以上述命名空间的形式将这些共享的部分独立开来实现进程隔离的目的。
### Cgroup
此外，对于上述的隔离进程，我们还需要限制其资源的使用，例如可使用的cpu核心数、占用内存等等资源，则是通过Cgroup来实现的。

需要明确一点概念，这两者是Linux内核提供的功能，理论上只要实现了系统调用的相关接口，任何语言都可以在Linux环境下实现LXC，并不仅限于C或者Go而已。
### MobyLinuxVM
刚接触到LXC的概念时，有点令我很疑惑——因为无论在Mac还是Windows下，我都曾使用过Docker。而上文却提到Namespace和Cgroup是Linux独有的技术，难道Docker打破了这种限制使用了另外的技术实现？

其实很容易发现，当我们在Windows10下使用Docker时，Docker会提示我们需要开启Windows的HyperV或者安装VirtualBox等虚拟机软件才能使用Docker。经过一番搜索，我了解到无论在Windows还是MacOS下，Docker首先会创建一个MobyLinux虚拟机，用以模拟出Linux底层内核环境，再此基础上再使用runC等容器引擎实现进程隔离。通过一系列的复杂转换，作为使用者的我们基本上是感觉不出有什么差别。只有共享磁盘I/O给人感觉性能异常低下（尤其是使用了oh-my-zsh！）。

在这里小小地提一句Windows下进入MobyLinux的方法[^2]：
```
#get a privileged container with access to Docker daemon
docker run --privileged -it --rm -v /var/run/docker.sock:/var/run/docker.sock -v /usr/bin/docker:/usr/bin/docker alpine sh

#run a container with full root access to MobyLinuxVM and no seccomp profile (so you can mount stuff)
docker run --net=host --ipc=host --uts=host --pid=host -it --security-opt=seccomp=unconfined --privileged --rm -v /:/host alpine /bin/sh

#switch to host FS
chroot /host
```
这也让我稍微理解了Docker的开源项目后来改名时为什么叫Moby[^3]。
## 实现流程(namespace)
先从Namespace说起，不包含Cgroup。
### 流程图概览

```flowchart
st=>start: 创建进程，传入命令cmd
uns=>operation: 调用unshare设置
使进程的namespace隔离
self=>parallel: 在进程中调用自身，
创建出子进程(容器)
init=>subroutine: 在容器中进行一些
mount初始化操作
execve=>subroutine: 调用内核级函数execve
替换初始进程为cmd
e=>end: 等待子进程cmd
执行结束(wait)

st->uns(right)->self(path1, bottom)->init->execve(right)->e
self(path2, right)->e
```

其中，`unshare`、`mount`和`execve`均属于Linux内核提供的系统调用，与语言无关，只需要使用的语言实现了这些接口就能进行调用。可以通过`man`命令查看相关的描述。
### 手册
* unshare
  ```
  UNSHARE(1)                                                                          User Commands                                                                          UNSHARE(1)

  NAME
        unshare - run program with some namespaces unshared from parent

  SYNOPSIS
        unshare [options] [program [arguments]]

  DESCRIPTION
        Unshares the indicated namespaces from the parent process and then executes the specified program. If program is not given, then ``${SHELL}'' is run (default: /bin/sh).

        The namespaces can optionally be made persistent by bind mounting /proc/pid/ns/type files to a filesystem path and entered with nsenter(1) even after the program terminates (except PID namespaces where permanently running init process is required). Once a persistent namespace is no longer needed, it can be unpersisted with umount(8). See the EXAMPLES section for more details.
  ```
  > unshare将从父进程取消共享指定的命名空间，然后执行指定的程序。
  >
  > 通过将/proc/pid/ns/type文件绑定到文件系统路径并使用nsenter(1)输入，即使在程序终止之后(需要永久运行init进程的PID名称空间除外)，也可以选择使名称空间持久化。一旦不再需要持久命名空间，就可以使用umount(8)取消持久命名空间。

  unshare有7种命名空间*flag*，分别是**CLONE_NEWNS**、**CLONE_NEWUTS**、**CLONE_NEWIPC**、**CLONE_NEWNET**、**CLONE_NEWPID**、**CLONE_NEWCGROUP**、**CLONE_NEWUSER**。详细解释见man手册。

* mount
  ```
  MOUNT(8)                                                                                               System Administration                                                                                              MOUNT(8)

  NAME
        mount - mount a filesystem

  SYNOPSIS
        mount [-l|-h|-V]

        mount -a [-fFnrsvw] [-t fstype] [-O optlist]

        mount [-fnrsvw] [-o options] device|dir

        mount [-fnrsvw] [-t fstype] [-o options] device dir

  DESCRIPTION
        All  files accessible in a Unix system are arranged in one big tree, the file hierarchy, rooted at /.  These files can be spread out over several devices.  The mount command serves to attach the filesystem found on some device to the big file tree.  Conversely, the umount(8) command will detach it again.  The filesystem is used to control how data is stored on the device or provided in a virtual way by network or another services.

        The standard form of the mount command is:

              mount -t type device dir
  ```
  > Unix系统中所有文件都排列在一个大型树状组织中，即file hierarchy，根目录为/。mount命令用于将在某些设备上找到的文件系统附加到大文件树上。

  结合**CLONE_NEWPID**在容器中使用`mount proc proc /proc`命令挂载/proc，然后使用`top`或者`ps -ef`可以看到容器和宿主机的进程产生了隔离。然而如果直接在容器中使用该命令，使用者将会发现，宿主系统中的/proc受到了影响。在手册中，我们发现：
  ```
  Since Linux 2.6.15 it is possible to mark a mount and its submounts as shared, private, slave or unbindable.  A shared mount provides the ability to create mirrors of that mount such that mounts and unmounts within  any of  the  mirrors  propagate  to the other mirror.  A slave mount receives propagation from its master, but not vice versa.  A private mount carries no propagation abilities.  An unbindable mount is a private mount which cannot be cloned through a bind operation.  The detailed semantics are documented in Documentation/filesystems/sharedsubtree.txt file in the kernel source tree.

        Supported operations are:

                mount --make-shared mountpoint
                mount --make-slave mountpoint
                mount --make-private mountpoint
                mount --make-unbindable mountpoint

        The following commands allow one to recursively change the type of all the mounts under a given mountpoint.

                mount --make-rshared mountpoint
                mount --make-rslave mountpoint
                mount --make-rprivate mountpoint
                mount --make-runbindable mountpoint
  ```
  在mount命令中添加`--make-private`参数就可以避免宿主受到影响。当然，不止是/proc，我们期待所有的mount操作都与外部隔离，那么还可以使用`--make-rprivate`参数，该参数从指定的路径开始递归地作用于各级子目录。
* execve
  ```
  EXECVE(2)                                  EXECVE(2)
  NAME
        execve - execute program
  SYNOPSIS
        #include <unistd.h>

        int execve(const char *pathname, char *const argv[],
                    char *const envp[]);
  DESCRIPTION
        execve() executes the program referred to by pathname.  This causes
        the program that is currently being run by the calling process to be
        replaced with a new program, with newly initialized stack, heap, and
        (initialized and uninitialized) data segments.
  ```
  > execve执行路径引用的程序，将当前的执行程序替换为新的程序，包括初始化的堆栈和数据片段

  在容器中，我们通过调用这个方法替换初始化所使用的进程，同时可以获取到对方的pid=1。

### 实现
书中使用Golang实现了Namespace隔离，笔者此处不赘述，可以参考[yuchanns/toybox](https://github.com/yuchanns/toybox)。

本文从php这门脚本语言来实现相应的功能。从不同的语言角度来看，实际上有助于读者理解这些命令的作用，分辨清楚语言和系统调用的边界。
```
#!/usr/bin/php
<?php
$command = "/bin/sh";

if ($argv[0] == __FILE__) {
    // 在容器中进行挂载等初始化操作
    // 首先设置递归根目录私有化
    system("mount --make-rprivate /");
    // 然后挂载/proc目录
    // noexec (手册)不允许在/proc中直接执行任何二进制文件。
    // nosuid (手册)在/proc执行程序时禁止使用set-user-ID和set-group-ID或file capabilities。
    // nodev (手册)禁止创建和访问/proc
    system("mount -t proc proc /proc -o noexec,nosuid,nodev");
    // 系统调用execve将init替换为command
    pcntl_exec($command, [], getenv());
} else {
    pcntl_unshare(CLONE_NEWPID | CLONE_NEWUTS | CLONE_NEWIPC | CLONE_NEWNS | CLONE_NEWNET);

    // 注意：第一个参数需要使用数组的形式传递
    // 直接执行自身脚本，生成子进程容器，并定位标准IO
    $process = proc_open([__FILE__], [
        STDIN,
        STDOUT,
        STDERR,
    ], $pipe, null, getenv());

    if (!is_resource($process)) exit(-1);
    // 等待容器进程退出
    pcntl_wait($status);
}
```
值得注意的地方有：
* 在编译型语言中，调用自身生成子进程是通过`/proc/self/exe`实现的，而对于php这类脚本语言来说，此方法调用的是解释器而非脚本。
* unshare功能在php中是从7.4开始才支持的特性；而proc_open在7.4中，传递数组可以直接调用参数目标文件而非通过/bin/sh调用，这一点很关键，否则无法替换init进程，用户指定的command只能作为pid2进程来使用。
* 挂载目录之前需要先设置挂载递归私有化，避免影响到宿主机。

上述脚本运行之后，我们将进入到容器中。在容器中使用`top`或`ps -ef`可以看到自身成为了pid为1的初始进程。这是**CLONE_NEWNS**和**CLONE_NEWPID**的功劳：
```
# ps -ef
UID          PID    PPID  C STIME TTY          TIME CMD
root           1       0  0 22:03 pts/0    00:00:00 /bin/sh
root           6       1  0 22:03 pts/0    00:00:00 ps -ef
```
当然，在上述脚本中，我们还隔离了UTS、进程IPC通信和网络等资源，使用`ifconfig`可以看到与宿主机相反，容器中什么网络设备都没有；在容器中创建`ipc Message Queues`，宿主机并不能看到创建的消息队列：
```
# ipcmk -Q
Message queue id: 0
# ipcs -q

------ Message Queues --------
key        msqid      owner      perms      used-bytes   messages    
0xa8dd3a61 0          root       644        0            0           
```
读取进程uts的符号链接指向，宿主的父进程与容器本身的进程也是不同的，在容器中修改hostname不会影响到宿主机的hostname：
```
# hostname -b toybox
# hostname
toybox # 宿主机输出yuchanns-NUC8i7BEH
```
本文使用代码可在[yuchanns/php-toybox](https://github.com/yuchanns/php-toybox)获取。

下一篇文章开始记录实现内存和cpu资源限制的过程。

[^1]: [《自己动手写Docker》](https://book.douban.com/subject/27082348/)
[^2]: [How can I ssh into the Beta's MobyLinuxVM](https://forums.docker.com/t/how-can-i-ssh-into-the-betas-mobylinuxvm/10991/6)
[^3]: [moby/moby](https://github.com/moby/moby)
