---
title: 在 M1 UTM 安装 Manjaro
---

[[Linux 系列|linux]]

参考文章[Running Manjaro ARM in UTM on M1 Mac](https://www.appelgriebsch.org/005-utm/)

* 下载 ARM 版 Manjaro
* 解压 `...img.xz` 得到 `...img` 
* 挂载 `...img` 到 Mac 磁盘，进入内容
* 复制 `...img` 里面的 `dtbs`, `Image`, `initramfs-linux.img` 到 `...img`
  同级目录，并把 `...img/extlinux` 里的 `extlinux.conf`
  也复制到该目录下。这样我们就得到了 `...img.xz`, `...img`, `dtbs`, `Image`,
  `initramfs-linux.img`, `extlinux.conf` 这些文件同级
* 打开 UTM 创建虚拟机并选择虚拟化，操作系统类型选择 `Linux` 
    * 勾选 `Boot from kernel image`
    * `Linux kernel` 选择 `Image`
    * `Linux initial ramdisk` 选择 `initramfs-linux.img`
    * `Linux Root FS Image` 选择 `...img`
    * 打开 `extlinux.conf` 将 `root=PARTUUID=... splash` 内容复制到 `Boot
      Arguments`
    * 下一步注意取消勾选 `OpenGL 加速`
    * 最后一步勾选 `Open VM Settings`
* 在 `VM Settings` 里
    * `Display` 选项卡模拟显卡选择 `virtio-gpu-pci` 并勾选 `Retina Mode`
    * `Input` 选项卡勾选 `Invert Mouse Scroll`
    * `Drivers` 选项卡删除最后一项名称为 `data.qcow2` 的卷轴
* 在 `~/Library/Containers/com.utmapp.UTM/Data/Documents/<Name of your VM>.utm`
  里执行
  ``````bash
  qemu-img resize Images/<Name of your Root FS image>.qcow2 +32G
  ``````
  增加容量
* 启动虚拟机设置安装
* 在商店中忽略 `linux` 相关升级，并安装 `spice-vdagent`  重启可开启高分辨率
