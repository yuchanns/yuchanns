* 介绍
    * syslog是一种工业标准的协议，可用来记录设备的日志
    * UNIX 系统通过 syslogd 系统和应用程序有关事件记录
    * 可以实现机器间通信
* 安装
    * 在 Arch Linux 上
        * 使用 [[yay]] 安装
            ```bash
            yay -Syu syslog-ng
            ```
        * 启动服务
            ```bash
            systemctl start syslog-ng@default
            ```
        * 使用
            ```bash
            logger -t syslog_test "a message from logger"
            ```
        * 查看
            ```bash
            cat /var/log/user.log
            ```
