---
title: "用Rust编写WASM生命游戏"
date: 2021-02-22T08:45:41+08:00
draft: false
---


> TLDR; 本文介绍了Wasm相关概念，并通过Rust编写一个嵌入到JS中使用的Wasm模块实现了[康威生命游戏](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life)。最终效果可以点击最下方的**阅读原文查看**。

近年来心系互联网技术进展的朋友们也许听到过一个名词：**Wasm**。一些夸张的营销号甚至叫嚣其将会取代JS，是前端们的末日~

而在学习Rust（等一些性能较高语言）时，我们也会发现介绍中提及对WASM的支持，同样令人十分好奇。
## 什么是Wasm
[官方网站](https://webassembly.org/)的描述：
> WebAssembly（缩写为Wasm）是一种基于堆栈的虚拟机的二进制指令格式。Wasm被设计为一个可移植的编程语言编译目标，使客户端和服务器应用程序能够部署在网络上。

从这段描述上可以看出，Wasm就是一种类汇编结果的二进制指令格式，看起应该是高性能的；而基于虚拟机，则表示它像Java那样具有跨平台性。

官网宣称Wasm具有**高效和快速**、**安全**以及**开放和易于debug**的特点，而且是**开放网络平台的一部分**。

### Wat
Wasm是二进制的，但它提供了一种名为[Wat](https://webassembly.github.io/spec/core/text/index.html)的文本格式用于阅读，下面是一段示例：
```
(module
  (func $fac (param f64) (result f64)
    local.get 0
    f64.const 1
    f64.lt
    if (result f64)
      f64.const 1
    else
      local.get 0
      local.get 0
      f64.const 1
      f64.sub
      call $fac
      f64.mul
    end)
  (export "fac" (func $fac)))
```
可以看到，语法上采用了**S-表达式**，关键字等语法则有点类似于汇编。
### S-表达式
上例代码清单中的`()`，是一种由古老语言**Lisp**所开创使用的计算机语法。

往前追溯到1920年代，这其实是波兰数学家[扬·武卡谢维奇](https://zh.wikipedia.org/wiki/%E6%89%AC%C2%B7%E6%AD%A6%E5%8D%A1%E8%B0%A2%E7%BB%B4%E5%A5%87)引入的[波兰表示法](https://zh.wikipedia.org/wiki/%E6%B3%A2%E5%85%B0%E8%A1%A8%E7%A4%BA%E6%B3%95)，又称为**前缀表达式**。其常被用于编译器构造概念中，尤其适合使用在基于堆栈的数据结构上。

这里借用王垠的文章[《谈语法》](https://www.yinwang.org/blog-cn/2013/03/08/on-syntax)的观点来说：“前缀表达式”没有表达歧义，(机器)进行语法分析时非常容易。例如`(* (+ 1 2) 3) `，不需要解析运算符优先级，可以直接得出先加后成的结果。

### WSI
看到这里读者也许会有疑问，难道我们要手写Wat吗？

当然不是，这篇文章的标签可是 #rust 。

Wasm运行时提供了一个叫做[WASI](https://wasi.dev/)的通用接口标准，方便各种高级语言编译成Wat。而在本文中我们使用Rust编写。

### 为什么是Rust
WSI支持很多语言，包括Rust、C、Python、.Net和Go，为什么我们非得使用Rust呢？

理由有很多啦~本着“手里拿着锤子看啥都是钉子”的心态，既然我们在学习Rust，当然会想用Rust去编写Wasm！

上面只是开玩笑，[Rust and WebAssembly](https://rustwasm.github.io/docs/book/why-rust-and-webassembly.html)告诉我们，Rust的内存管理手段强大，没有gc，所以生成的Wasm体积更小，单凭这一点就可以排除上述三门动态语言。而C的Wasm生态系统其实更加成熟，但出于学习Rust的目的，这里就选择了使用Rust。

### 取代JS？
错，Wasm被设计为可以和现有前端工具协作，用来更好地辅助JS，承担一些JS不擅长的、需要高性能的计算工作。事实上，就目前而言，Wasm还无法避开JS调用DOM节点。

### 小结
Wasm是一个通用的**低级**且**高性能**的二进制指令格式，支持多种语言编译，可以和JS协作，不仅仅可用于Web，但目前主要用于Web。

![底层是什么意思？](/images/rust-wasm-01.png)
![底层是什么意思？](/images/rust-wasm-02.png)

## 安装环境
最基础的Rust安装不再赘述，不了解的读者建议先从笔者的 #rust学习笔记 系列文章的第一篇看起。

### wasm-pack
[wasm-pack](https://github.com/rustwasm/wasm-pack)是一个Rust->Wasm的一站式工具，提供构建、测试和发布功能。

获取方式是使用`cargo`安装：
```
cargo install wasm-pack
```
### cargo-generate
[cargo-generate](https://github.com/cargo-generate/cargo-generate)将用来拉取wasm项目模板，节省项目布置时间。

获取方式是使用`cargo`安装：
```
cargo intall cargo-generate
```
### npm
npm是一个JS的包管理器，可以快速创建node项目，将JS项目编译压缩成产品。

获取方式是通过这个页面下载：`https://nodejs.org/en/download`。

## Wasm初体验
### Hello World
接触新工具的惯例是「问候世界」，在这里也不例外。

首先通过`cargo generate --git https://github.com/rustwasm/wasm-pack-template`拉取wasm项目的模板，这里用到了我们刚才安装的cargo-generate工具。项目起名为**wasm-game-of-life**。

进入到项目中可以看到如下tree：
```
.
├── Cargo.toml
├── LICENSE_APACHE
├── LICENSE_MIT
├── README.md
├── src
│   ├── lib.rs
│   └── utils.rs
└── tests
    └── web.rs

2 directories, 7 files
```
#### Cargo.toml
`Cargo.toml`预置了`[lib]`和`[dependencies]`。解释一下`crate-type`中[`cdylib`和`rlib`的作用](https://users.rust-lang.org/t/what-is-the-difference-between-dylib-and-cdylib/28847)：
* cdylib：顾名思义，是C的动态链接库的意思，可以被C和C++程序链接使用
* rlib：Rust静态链接库，用于静态连接其他crates

依赖中使用的：
* `wasm-bindgen`可以将Rust编写的函数和结构体暴露到JS中或者把JS的方法引入到Rust中使用
* `console_error_panic_hook`提供了Wasm输出Rust Panic的能力
* `wee_alloc`是一个轻量的Wasm内存分配器，但是会比默认分配器慢一些。

#### 模板代码
查看`src/lib.rs`：
```
mod utils;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    alert("Hello, wasm-game-of-life!");
}
```
看到内容主要就是使用`wasm-bindgen`引入了JS的`alert`方法，并暴露出一个调用了`alert`的`greet`方法，同时指定了内存分配器的使用。

#### 编译Wasm
直接执行`wasm-pack build`，可以看到根目录下生成了一个`pkg`文件夹，里面是一些`js`、`d.ts`和`wasm`后缀的文件：
```
pkg
├── README.md
├── wasm_game_of_life.d.ts
├── wasm_game_of_life.js
├── wasm_game_of_life_bg.js
├── wasm_game_of_life_bg.wasm
└── wasm_game_of_life_bg.wasm.d.ts

0 directories, 6 files
```
这些就是可以被JS所引用的产物。
#### 引用Wasm
我们先在`pkg`文件夹中使用`npm init`将它初始化为一个npm包，填充如下内容：
```
{
  "name": "wasm-game-of-life",
  "collaborators": [
    "yuchanns <airamusume@gmail.com>"
  ],
  "description": null,
  "version": "0.1.0",
  "license": null,
  "repository": null,
  "files": [
    "wasm_game_of_life_bg.wasm",
    "wasm_game_of_life.d.ts"
  ],
  "main": "wasm_game_of_life.js",
  "types": "wasm_game_of_life.d.ts"
}
```

然后在根目录下使用`npm init wasm-app www`创建一个使用了`wasm-app`模板的npm项目`www`。

修改`www/package.json`在`dependencies`一栏添加`"wasm-game-of-life": "file:../pkg"`，指向刚才产出的`pkg`文件夹。

然后修改`www/index.js`内容：
```
 // 下面这一行是修改过的
import * as wasm from "wasm-game-of-life";

wasm.greet();
```
接着执行一下`npm install`——整篇文章只需要执行这一次。

最后执行`npm run start`，访问`http://localhost:8081`，会发生弹窗问候！

### 康威生命游戏
**Conway's Game of Life**是英国数学家约翰·何顿·康威在1970年发明的放置类(❎)无玩家参与的(✔️)游戏，类似于细胞生命演化，规则总结起来为4条：
1. 任何一个活细胞相邻活细胞数量少于2个将在下一个周期死亡
2. 任何一个活细胞相邻活细胞数量有2到3个的在下一个周期存活
3. 任何一个活细胞相邻活细胞数量多于3个将在下一个周期死亡
4. 任何一个死细胞相邻活细胞数量等于3个将在下一个周期繁殖新生

可以清楚看出，前三条关于活细胞，只有最后一条和死细胞有关。

规则很适合表述成状态机，我们将会使用状态机实现状态管理。

#### 语言分工
这个游戏的要点在于对每一次生命周期中每个细胞的存活情况的渲染。

使用一个划分成64x64(或者更大)的正方形格子表示地图，其中黑色占据的格子表示有活细胞，白色占据的格子表示没有活细胞。这样使用JS的canvas进行循环绘制很容易实现。

![康威生命游戏](/images/rust-wasm-conway-game-of-life.jpeg)

有什么是Wasm可以做的事情呢？

我们知道JS等动态语言在计算方面很弱，就算引入了**JIT**特性也远远不如那些编译型语言；而对整个地图遍布的格子做细胞存活判断需要进行大量的计算，正好是Wasm的特长。

所以我们将会使用JS进行canvas绘制，同时在每轮迭代中使用Rust->Wasm进行生命判断，实现一个康威生命游戏。
## 实现生命
**注：限于篇幅，本文的重点是Wasm，有关于JS方面canvas的代码将直接给出而不进行细节描述，感兴趣的读者请自行阅读canvas api手册。**
### Event Storm
JS负责操作DOM进行canvas绘制，以及从Wasm获取生命状态。

Rust计算整张地图的生命状态，需要使用一个一维的`Vec`保存整张地图的格子信息，并附带一些获取状态和迭代周期的方法，这些同一个领域的事物可以聚合在一起成为一个**Universe**聚合。

此外每个格子中存在着细胞实体，每个实体都保存着自身的存活状态，可以命名为**Cell**。

下面是聚合的信息整理：

|名称|说明|
|---|---|
|Universe|世界聚合|
|Universe::new|用于世界实例化|
|Universe::width|获取世界的宽度|
|Universe::height|获取世界的高度|
|Universe::is_cell_alive|获取指定坐标细胞存活状态|
|Universe::tick|用于触发迭代周期计算|
|Universe::live_neighbor_count|周期迭代中获取坐标相邻的存活数|
|Universe::get_index|周期迭代中获取对应canvas坐标在Vec中对应的索引|
|Cell|细胞实体|
|Cell::Dead = 0|细胞死亡状态，使用数字状态方便存活累加计算|
|Cell::Alive = 1|细胞存活状态，使用数字状态方便存活累加计算|

前面的方法都是需要暴露给JS使用的公开方法，而最后两个方法用于迭代周期计算内部，无需公开。
### 画布
修改`www/index.html`，如下代码清单：
```
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>WASM GAME OF LIFE</title>
    <meta name="description" content="wasm game of life">
    <style>
      body {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      #fps {
        white-space: pre;
        font-family: monospace;
      }
    </style>
  </head>
  <body>
    <noscript>This page contains webassembly and javascript content, please enable javascript in your browser.</noscript>
    <button id="play-pause"></button>
    <div id="fps"></div>
    <canvas id="game-of-life-canvas"></canvas>
    <script src="./bootstrap.js"></script>
  </body>
</html>
```
主要是添加了一个画布，以及fps模块和一个暂停用按钮，并设定了css样式。

然后在`www/index.js`中，根据上面整理出来的聚合信息，可以根据公开的Wasm api编写如下代码：
```
import { Universe } from "wasm-game-of-life";
import { memory } from "wasm-game-of-life/wasm_game_of_life_bg";

// 设置每个细胞的大小
const CELL_SIZE = 5; // px
// 设置世界格子边框的颜色
const GRID_COLOR = "#CCCCCC";
// 设置细胞死亡颜色
const DEAD_COLOR = "#FFFFFF";
// 设置细胞存活颜色
const ALIVE_COLOR = "#000000";

// 实例化世界，并获取世界的宽高
const universe = Universe.new();
const width = universe.width();
const height = universe.height();

// 操作DOM创建一个画布
// 并设置一个略大于所有细胞的宽高，用于包裹细胞
const canvas = document.getElementById("game-of-life-canvas");
canvas.height = (CELL_SIZE + 1) * height + 1;
canvas.width = (CELL_SIZE + 1) * width + 1;

const ctx = canvas.getContext('2d');
// 暂停功能的实现开始====
let animationId = null;

const isPaused = () => {
    return animationId === null;
};

const playPauseButton = document.getElementById("play-pause");

const play = () => {
    playPauseButton.textContent = "⏸";
    renderLoop();
};

const pause = () => {
    playPauseButton.textContent = "▶";
    cancelAnimationFrame(animationId);
    animationId = null;
};

playPauseButton.addEventListener("click", event => {
    if (isPaused()) {
        play();
    } else {
        pause();
    }
});
// 暂停功能的实现结束====

// 绘制循环
const renderLoop = () => {
    // 对fps进行渲染
    fps.render();
    // 触发生命周期迭代
    universe.tick();
    // 绘制世界格子
    drawGrid();
    // 绘制细胞存活状况
    drawCells();

    animationId = requestAnimationFrame(renderLoop);
};

// 绘制格子的具体实现
const drawGrid = () => {
    ctx.beginPath();
    ctx.strokeStyle = GRID_COLOR;

    // Vertical lines.
    for (let i = 0; i <= width; i++) {
        ctx.moveTo(i * (CELL_SIZE + 1) + 1, 0);
        ctx.lineTo(i * (CELL_SIZE + 1) + 1, (CELL_SIZE + 1) * height + 1);
    }

    // Horizontal lines.
    for (let j = 0; j <= height; j++) {
        ctx.moveTo(0,                           j * (CELL_SIZE + 1) + 1);
        ctx.lineTo((CELL_SIZE + 1) * width + 1, j * (CELL_SIZE + 1) + 1);
    }

    ctx.stroke();
};

// 绘制细胞的具体实现
const drawCells = () => {
    ctx.beginPath();

    // 绘制活细胞
    ctx.fillStyle = ALIVE_COLOR;
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            // 调用了世界获取细胞存活状态的api
            if (!universe.is_cell_alive(row, col)) {
                continue;
            }

            ctx.fillRect(
                col * (CELL_SIZE + 1) + 1,
                row * (CELL_SIZE + 1) + 1,
                CELL_SIZE,
                CELL_SIZE
            );
        }
    }

    // 绘制死细胞
    ctx.fillStyle = DEAD_COLOR;
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            if (universe.is_cell_alive(row, col)) {
                continue;
            }

            ctx.fillRect(
                col * (CELL_SIZE + 1) + 1,
                row * (CELL_SIZE + 1) + 1,
                CELL_SIZE,
                CELL_SIZE
            );
        }
    }

    ctx.stroke();
};

// fps的具体实现
const fps = new class {
    constructor() {
        this.fps = document.getElementById("fps");
        this.frames = [];
        this.lastFrameTimeStamp = performance.now();
    }

    render() {
        // Convert the delta time since the last frame render into a measure
        // of frames per second.
        const now = performance.now();
        const delta = now - this.lastFrameTimeStamp;
        this.lastFrameTimeStamp = now;
        const fps = 1 / delta * 1000;

        // Save only the latest 100 timings.
        this.frames.push(fps);
        if (this.frames.length > 100) {
            this.frames.shift();
        }

        // Find the max, min, and mean of our 100 latest timings.
        let min = Infinity;
        let max = -Infinity;
        let sum = 0;
        for (let i = 0; i < this.frames.length; i++) {
            sum += this.frames[i];
            min = Math.min(this.frames[i], min);
            max = Math.max(this.frames[i], max);
        }
        let mean = sum / this.frames.length;

        // Render the statistics.
        this.fps.textContent = `
Frames per Second:
         latest = ${Math.round(fps)}
avg of last 100 = ${Math.round(mean)}
min of last 100 = ${Math.round(min)}
max of last 100 = ${Math.round(max)}
`.trim();
    }
};

// 手动调用第一次迭代
drawGrid();
drawCells();
play();
```
可以看到，JS和Wasm的交互主要在于：
1. 实例化(**new**)Wasm暴露的世界类
2. 根据实例的宽高(**width, height**)创建画布
3. 调用实例的细胞存活api(**is_cell_alive**)进行存活状况绘制
4. 调用实例的迭代api(**tick**)进行生命周期迭代推动

需要注意的是：把死细胞和活细胞分开绘制是一种**优化手段**，目的在于降低画布的样式切换成本。
