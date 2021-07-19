---
title: "用 ffmpeg 压制 b 站 4k 视频"
date: 2021-07-19T20:59:33+08:00
draft: false
---
{{<video src="//player.bilibili.com/player.html?aid=716809834&bvid=BV13X4y1c7gk&cid=372539377&page=1" >}}

尝试使用 ffmpeg 压制 4k 视频投稿 b 站。

> TL; DR
> 
> ```
> /bin/ffmpeg -stats -i /path/to/src.webm -c:v libx264 -profile:v main -b:v 19000k -profile:v main -preset veryslow -s 3840x2160 -c:a aac -b:a 320k -x264opts crf=12 -maxrate:v 24000k -bufsize 24000k -pix_fmt yuv420p /path/to/dest.mp4
> ```

## 历程
### GithuActions + Google Drive
压制视频过于耗时，笔者手上又只有一台 mbp 2018，为了不影响生产力工具的使用，一开始打了 github actions 的注意。

首先将本地的视频上传到 [Google Drive](https://drive.google.com/drive/u/0/my-drive) ，路径为`/ffmpeg_workflows/source/src.webm` 。

然后编写 github actions 脚本，通过 [Skicka Api](https://github.com/satackey/action-google-drive) 下载视频，接着使用上述命令压制转换，最后再传回 Google Drive ，路径为 `/ffmpeg_workflows/dest/dest.webm`。

```
name: webm-to-mp4

on:
  push:
    branches:
      - main
    paths:
      - '.github/workflows/webm-to-mp4.yaml'

jobs:
  webm2mp4:
    runs-on: ubuntu-20.04
    env:
      SOURCE: src.webm
      DEST: dest.mp4
    steps:
      - uses: actions/checkout@v2
      - name: Download from Google Drive
        uses: satackey/action-google-drive@v1
        with:
          skicka-tokencache-json: ${{ secrets.SKICKA_TOKENCACHE_JSON }}
          download-from: /ffmpeg_workflows/source/${{ env.SOURCE }}
          download-to: ./${{ env.SOURCE }}

          google-client-id: ${{ secrets.GOOGLE_CLIENT_ID }}
          google-client-secret: ${{ secrets.GOOGLE_CLIENT_SECRET }}
      - uses: FedericoCarboni/setup-ffmpeg@v1
        id: setup-ffmpeg
      - name: Webm To MP4
        run: |
          ffmpeg -i $SOURCE -c:v libx264 -profile:v main -b:v 19000k \
            -profile:v main -preset veryslow -s 3840x2160 -c:a aac -b:a 320k -x264opts crf=12 \
            -maxrate:v 24000k -bufsize 24000k -pix_fmt yuv420p -ss 40 -t 60 $DEST
      - name: Upload to Google Drive
        uses: satackey/action-google-drive@v1
        with:
          skicka-tokencache-json: ${{ secrets.SKICKA_TOKENCACHE_JSON }}
          upload-from: ./${{ env.DEST }}
          upload-to: /ffmpeg_workflows/dest/${{ env.DEST }}

          google-client-id: ${{ secrets.GOOGLE_CLIENT_ID }}
          google-client-secret: ${{ secrets.GOOGLE_CLIENT_SECRET }}
```
该方案需要到 [Google Cloud Console](https://console.cloud.google.com/projectcreate) 申请测试密钥，并添加内测认证邮箱，详细获取方式参考[这篇文章](https://qiita.com/satackey/items/34c7fc5bf77bd2f5c633) (日语限定)。

目前的缺陷在于，github actions 单个 job 最多只能执行6个小时，整个 workflow 上限72小时，对于视频压制这种耗时漫长工作来说不太方便。

**改进方式**：将视频分割成多个部分，保证每个部分的压制耗时不超过6小时，然后每个 workflow 压制12部分，如果还不够就创建多个 workflows 。

这意味着需要编写一个调度脚本，笔者稍嫌麻烦，故而作罢。

不过这应该是个不错的方向。

### 容器化
仔细分析需求，笔者想要解决的问题是 **"压制视频时间太长"** 和 **"不能长时间占用生产力工具"** 之间的矛盾。因此最简单的解决方案就是让 ffmpeg 只占用有限的 cpu 资源，这样就不会影响到笔者的日常使用。

尝试搜索 ffmpeg 使用手册是否包含限制资源的指令，结果没有。

**"限制资源"** 这个关键词引起了笔者的注意，日常工作中经常面临这类需求，直接使用容器就可以解决了！

于是在 [DockerHub](http://dockerhub.com/) 上找到了符合需求的 ffmpeg [镜像](https://hub.docker.com/r/jrottenberg/ffmpeg/) 。通过 docker-compose 的方式配置了容器，进行转换。
```
version: '3'
services:
  ffmpeg:
    container_name: ffmpeg
    image: jrottenberg/ffmpeg:4.4-scratch
    volumes:
      - .:/workflows
    deploy:
      resources:
        limits:
          cpus: '8'
    entrypoint: /bin/ffmpeg -stats -i /workflows/src.webm -c:v libx264 -profile:v main -b:v 19000k -profile:v main -preset veryslow -s 3840x2160 -c:a aac -b:a 320k -x264opts crf=12 -maxrate:v 24000k -bufsize 24000k -pix_fmt yuv420p /workflows/dest.mp4
```
现在，笔者的6核 mbp 有2核可以用于日常使用啦~

![](/images/docker-friend.jpeg)
