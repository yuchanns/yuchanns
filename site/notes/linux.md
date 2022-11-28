---
title: Linux Tips
---
* 并发执行 bash 脚本命令
    ```bash
    #!/bin/bash
    start_time=`date +%s`

    tmp_fifofile="/tmp/$$.fifo"
    mkfifo $tmp_fifofile
    # to read and write fifo on fd 6
    exec 6<>$tmp_fifofile
    rm $tmp_fifofile

    thread_num=10

    # put thread_num line into fd 6
    for ((i=0;i<${thread_num};i++)); do
    echo
    done >&6

    # declare an array variable read from user input
    read -a array

    # get length of the array
    arraylength=${#array[@]}

    # use for loop to read all values and indexes
    for (( i=0; i<${arraylength}; i++ ));
    do
    # read from fd 6
    read -u6
    # run asynchronous command
    {
        git clone git@github.com:yuchanns/${array[$i]}.git
        echo >&6
    } &
    done

    wait

    stop_time=`date +%s`
    echo "TIME: `expr $stop_time - $start_time`s"

    exec 6>&-
    echo "finished"
    ```
* 解压到指定文件夹并去除父目录
    ```bash
    tar xf archive.tar -C /target/directory --strip-components=1
    ```
* bash 开启箭头历史补全
    * 创建 ~/.inputrc 写入如下内容
        ```bash
        # Respect default shortcuts.
        $include /etc/inputrc

        ## arrow up
        "\e[A":history-search-backward
        ## arrow down
        "\e[B":history-search-forward
        ```
        然后关闭终端重新启动 bash 即可。
* pve 挂载硬盘
    ```bash
    # 获取 SERIAL
    lsblk -o name,size,vendor,model,serial
    # 过滤出地址
    ls /dev/disk/by-id/* | grep -v part | grep <disk serial number>
    # 挂载到 vm id 的第 i 个硬盘
    dev=/dev/disk/by-id/<data-disk data path> ; qm set <data-node ID> --scsi<n> ${dev[}[,iothread=1],snapshot=0,backup=0,serial=$(lsblk -nd -o serial ${dev})
    ```
* 按日期删除文件
    ```bash
    ls -l /path/to/diretory | grep "^-.*Mar 25" | awk '{print $NF}' | xargs rm
    ```
* Ubuntu 开启 bbr
    ```bash
    echo net.core.default_qdisc=fq >> /etc/sysctl.conf
    echo net.ipv4.tcp_congestion_control=bbr >> /etc/sysctl.conf
    # 应用
    sysctl -p
    # 查看效果
    sysctl net.ipv4.tcp_available_congestion_control
    ```
* tmux 操作小技巧
    ```bash
    ## 将 pane 拆分为窗口
    ctrl+b !
    ## 将窗口合并为 pane
    ctrl+b : join-pane -ht {index} 
    ## 创建新 pane
    ctrl+b %
    ## 跳转 pane
    ctrl+b q
    ```
* 替换操作系统镜像源
    * 替换 alpine 镜像源
    ```bash
    sed -i "s/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g" /etc/apk/repositories
    ```
    * 替换 ubuntu 镜像源
    ```bash
    sed -i "s/archive.ubuntu.com/mirrors.aliyun.com/g" /etc/apt/sources.list
    ```
