---
title: "用Rust编写WASM井字棋游戏"
date: 2021-02-22T08:45:23+08:00
draft: false
---
![井字棋](/images/tic-tac-toe.jpeg)

> TLDR; 本文介绍了yew的两种开发使用方式，然后以React入门教程`tic tac toe`为例，给出了使用yew的函数式组件实现了rust wasm版本。

友情提示：本文最终效果可以通过点击下方的**阅读原文**访问

## 前言
在[《用Rust炼金术创造WASM生命游戏》](https://mp.weixin.qq.com/s/WGZcEDiVqyAT7_LmBz_SLg)我们初步了解了什么是**Wasm**，以及Rust怎么写Wasm。

有过前端开发经验的朋友也许会像笔者一样好奇了——Rust有没有类似于[React](https://zh-hans.reactjs.org/)或者[Vue](https://vuejs.org/)这样用于开发客户端webapp的数据驱动框架呢？

答案是有的，那就是[yewstack/yew](https://github.com/yewstack/yew)。

## 认识一下Yew
官方简介上写着：
> Yew是一个现代的Rust框架，用于使用WebAssembly创建多线程前端Web应用程序。

笔者的体验是：Yew就像**React**那样，使用类似[JSX](https://reactjs.org/docs/introducing-jsx.html)的语法开发页面，同时支持class和函数式两种组件编写方式。

## 准备环境
基础的Rust环境安装笔者不再赘述，有不懂的读者建议参考笔者的[《Rust学习笔记》](https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzkzNTIwMjYwMA==&action=getalbum&album_id=1699595912076935173&scene=173&subscene=91&sessionid=1613910975&enterid=1613910985&from_msgid=2247483667&from_itemidx=1&count=3#wechat_redirect)从头看起。

### 安装打包工具
需要`wasm-pack`，执行`cargo install wasm-pack`安装即可。
### 创建项目
使用`--lib` flag创建一个名为`yew-tic-tac-toe`的项目:
```
cargo new yew-tic-tac-toe --lib
```
### 添加依赖
然后在项目根目录的`cargo.toml`添加依赖：
```
[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2.67"
yew-functional = { git = "https://github.com/yewstack/yew", rev = "f27e268"}
yew = { git = "https://github.com/yewstack/yew", rev = "f27e268"}
yew-router = { git = "https://github.com/yewstack/yew", rev = "f27e268"}
```
读者们会注意到，笔者在这里没有使用[crates.io](https://crates.io/)上发布的yew包，而是直接使用git库的代码。

#### 为什么直接使用git库
解释下：

一方面，目前的yew还未稳定，不可用于生产环境，所以用什么版本没那么重要，越新越好。

另一方面，后面笔者会提到yew的函数式组件开发方式，并且会以函数式组件的方式进行开发，已发布的版本里无法使用这一功能。

当然，也正因为yew的不稳定，经常有[激进的破坏性api更改](https://github.com/yewstack/yew/issues/1549)，所以读者**请注意**保持和笔者写这篇文章时使用的commit一样（即`rev = "f27e268"`），以免出现行为不一致的问题。

### 准备静态资源
在项目根目录创建一个`static`文件夹，并分别创建一个`index.html`和`style.css`：
```
cd yew-tic-tac-toe
mkdir static
touch static/index.html
touch static/style.css
```
接着在`index.html`中填充如下代码：
```
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta name="generator" content="Yew 0.17">
    <title>Yew Tic Tac Toe</title>
    <meta name="description" content="Yew Tic Tac Toe">
    <link rel="stylesheet" href="style.css"/>
    <script type="module">
        import init from "./wasm.js"
        init()
    </script>
</head>
<body></body>
</html>
```
也不能忘了`style.css`的内容：
```
body {
    font: 14px "Century Gothic", Futura, sans-serif;
    margin: 20px;
}

ol, ul {
    padding-left: 30px;
}

.board-row:after {
    clear: both;
    content: "";
    display: table;
}

.status {
    margin-bottom: 10px;
}

.square {
    background: #fff;
    border: 1px solid #999;
    float: left;
    font-size: 24px;
    font-weight: bold;
    line-height: 34px;
    height: 34px;
    margin-right: -1px;
    margin-top: -1px;
    padding: 0;
    text-align: center;
    width: 34px;
}

.square:focus {
    outline: none;
}

.kbd-navigation .square:focus {
    background: #ddd;
}

.head {
    top: 0;
    position: sticky;
}
.head-icon {
    width: 2em;
    height: 2em;
}
.head-icon-link {
    margin: 0 .2em;
}

.game {
    display: flex;
    flex-direction: row;
    padding-top: 20px;
}

.game-info {
    margin-left: 20px;
}
```
这些静态资源一旦准备好，我们之后就不会再去碰它了。

后面，我们会通过编译命令将代码打包成wasm并构建到静态目录使用。

### 安装服务端
构建完wasm，我们还会需要使用一个简易http服务端搭建服务，浏览效果。

读者可以自行选择，也可以使用[TheWaWaR/simple-http-server](https://github.com/TheWaWaR/simple-http-server)：
```
// 安装
cargo install simple-http-server
rehash
// 在项目根目录使用
simple-http-server --index=index.html static
```
## Class风格开发简介
如同React的历史开发方式一般，Yew首要支持了Class风格的组件开发。

完整的开发介绍读者可以[官方文档](https://yew.rs/docs/en/)。

**简而言之**，开发人员需要创建自己的结构体，并为它实现`yew::prelude::Component`这个trait。

假设我在`lib.rs`创建一个叫`HelloWorld`的结构体，并实现了`yew::prelude::Component`，那么我只要在`lib.rs`上编写如下代码：
```
use wasm_bindgen::prelude::*;
use yew::prelude::*;

// ... HelloWorld的实现代码

#[wasm_bindgen(start)]
pub fn run_app() {
    App::<HelloWorld>::new().mount_to_body();
}
```
然后在根目录执行`wasm-pack build --target web --out-name wasm --out-dir ./static`构建wasm到资源目录，再使用http服务器浏览即可看到效果。

### Component详解
接下来讲解一下实现`yew::prelude::Component`需要做的工作。

#### 关联类型
**Component**这个trait使用了两个**关联类型**参数`type Message`和`type Properties`，交给用户自行实现：
* `type Message`只需要是`'static`的生命周期即可
* `type Properties`需要实现`yew::html::Properties`这个trait，以及`Clone`和`PartialEq`——幸运的是这些都可以直接使用`#[derive(Clone, PartialEq, Properties)]`派生指令让编译器自动派生

`type Message`通常用于网页中的分发回调事件，例如onclick触发事件、onsave触发事件等，因此通常使用`enum`枚举实现。

`type Properties`是组件的属性，类似于React组件中的`props`，用于父子组件间的参数传递，通常使用`struct`实现。
#### 实现方法
除此之外，用户还需要实现几个结构体方法，满足**Component**的实现需求。它们分别是：
* `fn create(props: Self::Properties, link: ComponentLink<Self>) -> Self`
* `fn update(&mut self, msg: Self::Message) -> bool`
* `fn change(&mut self, props: Self::Properties) -> bool`
* `fn view(&self) -> Html`

其中`create`是组件的构造方法，用于初始化组件自身。

它包含两个参数：一个是`Properties`用于父子传参；一个是`yew::html::ComponentLink<Self>`，用于创建回调事件。

这也意味着我们需要在创建的结构体中包含这两个参数。

`update`则用于组件更新时判断事件发生时是否需要刷新组件的视图效果，它使用一个`Message`作为参数。

如前文所说，我们使用`enum`实现`Message`，然后在这个方法里通过`match`的方式枚举匹配触发的事件，进行回调操作。

`update`则用于决定组件属性父传参变化时是否需要刷新组件视图。

最后的`view`就是类似于`JSX`的html构造方法了。它使用一个`html!`宏创建视图界面，然后被框架渲染到html中。

除此之外，还有些其他方法，默认不需要我们自己实现，比如`fn rendered(&mut self, _first_render: bool)`和`fn destroy(&mut self)`，分别是渲染之后html更新之前的方法和解构方法。在有需要的时候也可以覆盖掉自己实现。

### 编写demo
在Class风格介绍的最后，笔者以一个简单的hello world的实现结束。
```
use wasm_bindgen::prelude::*;
use yew::prelude::*;

#[derive(Clone, PartialEq, Properties, Default)]
struct Properties {
    name: String,
}

enum Message {
    ChangeName(String),
}

struct HelloWorld {
    link: ComponentLink<Self>,
    props: Properties,
}

impl HelloWorld {
    fn change_name(&mut self, name: String) {
        self.props.name = name;
    }
}

impl Component for HelloWorld {
    type Message = Message;
    type Properties = Properties;

    fn create(_props: Self::Properties, link: ComponentLink<Self>) -> Self {
        Self {
            link,
            props: Properties {
                name: "world".to_string(),
            },
        }
    }

    fn update(&mut self, msg: Self::Message) -> bool {
        match msg {
            Message::ChangeName(name) => {
                self.change_name(name);
            }
        };
        true
    }

    fn change(&mut self, props: Self::Properties) -> bool {
        if self.props != props {
            self.props = props;
            true
        } else {
            false
        }
    }

    fn view(&self) -> Html {
        html! {
        <div>
            <p>{"hello "}{self.props.name.clone()}</p>
            <Button onclick={self.link.callback(|name: String| Message::ChangeName(name))} />
        </div>
        }
    }
}

#[derive(Clone, PartialEq, Properties, Default)]
struct ButtonProperties {
    onclick: Callback<String>,
}

enum ButtonMessage {
    ChangName,
}

struct Button {
    props: ButtonProperties,
    link: ComponentLink<Self>,
}

impl Button {
    fn change_name(&mut self) {
        self.props.onclick.emit("yuchanns".to_string());
    }
}

impl Component for Button {
    type Message = ButtonMessage;
    type Properties = ButtonProperties;

    fn create(props: Self::Properties, link: ComponentLink<Self>) -> Self {
        Self { props, link }
    }

    fn update(&mut self, msg: Self::Message) -> bool {
        match msg {
            ButtonMessage::ChangName => {
                self.change_name();
            }
        };
        true
    }

    fn change(&mut self, props: Self::Properties) -> bool {
        if self.props != props {
            self.props = props;
            true
        } else {
            false
        }
    }

    fn view(&self) -> Html {
        html! {
        <button onclick={self.link.callback(|_| ButtonMessage::ChangName)}>{"click me"}</button>
        }
    }
}

#[wasm_bindgen(start)]
pub fn run_app() {
    App::<HelloWorld>::new().mount_to_body();
}
```
在这段代码片段里，笔者创建了父组件`<HelloWorld>`和子组件`<Button>`，并实现了一个由父组件传递给子组件的改变名字的onclick回调事件。

![class hello world](/images/class_helloworld.gif)

如果你跟笔者一样是逐字代码敲下来，相信敲到一半已经血压升高~

### 缺点
是的，通篇代码写来的感觉就是，繁琐，需要实现一堆方法，写一堆枚举事件定义。其中大多数属于无效代码。而限于Rust的trait代码复用率不高，整个开发过程的体验十分糟糕！

## 函数式开发风格简介
针对这个问题，社区提出了很多意见。

于是Yew官方又仿照React的函数式组件，使用一系列宏极大提高了开发体验。

用户只需要在原本的yew框架基础上，追加引入一个`yew_functional`包就可以使用。

`yew_functional`提供了一些`hook`，以及一个派生宏`function_component`。使用户可以简单通过编写一个返回JSX视图的函数以及使用钩子来避免上述繁琐的实现和操作。

下面看一个例子:
```
use yew::prelude::*;
use yew_functional::*;

#[function_component(HelloWorld)]
fn hello_world() {
	let greet = "hello world";
    html! {
    	<div>{greet}</div>
    }
}

#[wasm_bindgen(start)]
pub fn run_app() {
    App::<HelloWorld>::new().mount_to_body();
}
```
看完上述代码，读者肯定会感到疑惑：“并没有看到HelloWorld结构体，是不是代码写错了？”

答案是否定的。这就是**Rust宏强大之处的体现**。

派生宏`function_component`会在编译器自动展开，将用户编写的`hello_world`方法派生成结构体`HelloWorld`，自动实现上面**class**小节中`Component` trait需要实现的那些方法。所以虽然源码上没有，编译的时候却可以正确通过，构建结果也可以正常使用。

当然，涉及上述小节中的demo还需要结合这个包提供的`hook`机制才能实现。

### Hook详解
目前`yew_functional`提供了五个内建`hooks`，它们分别是：
* `use_state`
* `use_reducer`
* `use_ref`
* `use_effect`
* `use_context`

以及一个实现自定义hook的trait。

如果读者有使用react或者vue3的经验，应当很容易就能理解到这些`hooks`的用途。

#### 创建变量
`use_state`是用于创建变量的`hook`。它接收一个闭包，然后返回一个`getter`和`setter`。用户可以通过`getter`读取值，通过`setter`设置值。

为什么要用这么做呢？个人的看法，仅供参考：
* 一方面，模仿React，给相关背景的开发人员提供熟悉的体验
* 另一方面，在Rust中，所有权机制的约束导致开发人员在编写组件过程中常常要负担大量的心智与**可变**和**借用**打交道。使用这种方式可以减轻负担（相信经历过上面的class demo的读者深有体会）

下面展示一下简单的使用例子(摘自官方文档)：
```
use std::rc::Rc;
use yew::prelude::*;
use yew_functional::*;

#[function_component(UseState)]
pub fn state() -> Html {
    let (
        counter,
        set_counter,
    ) = use_state(|| 0);
    let onclick = {
        let counter = Rc::clone(&counter);
        Callback::from(move |_| set_counter(*counter + 1))
    };

    html! {
        <div>
            <button onclick=onclick>{ "Increment value" }</button>
            <p>
                <b>{ "Current value: " }</b>
                { counter }
            </p>
        </div>
    }
}
```
这个例子实现了一个经典的计数器。访客在点击了button之后就会进行次数计数。
![fn counter](/images/fn_counter.gif)

关于这里面有几点需要特别说明：
* `use_state`返回两个值都是使用`Rc`指针进行了包裹的变量
* 使用`Rc`指针的原因是方便复制：在编写组件的过程中，会有大量的复制需求
* 使用`Callback::from`可以创建一个含有闭包函数的枚举变量绑定到回调事件上；通过该变量提供的`clone`方法，用户可以将回调事件进行复制(**在父子传参的时候很重要！**)

#### 创建变量-进阶
`use_reducer`和`use_state`类似，只是增加了class中的枚举事件功能。这样可以实现对一个变量进行不同的事件设置的作用。

下面是使用例子(摘自官方文档)：
```
use std::rc::Rc;
use yew::prelude::*;
use yew_functional::*;

#[function_component(UseReducer)]
pub fn reducer() -> Html {
    /// reducer's Action
    enum Action {
        Double,
        Square,
    }

    /// reducer's State
    struct CounterState {
        counter: i32,
    }

    let (
        counter, // the state
        // function to update the state
        // as the same suggests, it dispatches the values to the reducer function
        dispatch,
    ) = use_reducer(
        // the reducer function
        |prev: Rc<CounterState>, action: Action| CounterState {
            counter: match action {
                Action::Double => prev.counter * 2,
                Action::Square => prev.counter * prev.counter,
            },
        },
        // initial state
        CounterState { counter: 1 },
    );

    let double_onclick = {
        let dispatch = Rc::clone(&dispatch);
        Callback::from(move |_| dispatch(Action::Double))
    };
    let square_onclick = Callback::from(move |_| dispatch(Action::Square));

    html! {
        <>
            <div id="result">{ counter.counter }</div>

            <button onclick=double_onclick>{ "Double" }</button>
            <button onclick=square_onclick>{ "Square" }</button>
        </>
    }
}
```
可以看到该`hook`返回的是一个`getter`和一个`dispatch`分发方法，可以进行事件分发。

#### 引用节点
有时候我们需要使用组件存储一些状态，而这不能依赖于组件本身，因为组件会被刷新：
> 例如，导航菜单中，我们需要鼠标在导航组件及其子组件悬浮时，自动保持导航组件的展开状态；在离开导航组件时则收缩。

像上面这种例子，如果仅依靠css的hover判断，那么鼠标在子组件上悬浮时是无法阻止导航收缩的。这就是`use_ref`的作用。

下面是使用例子(摘自官方文档)：
```
use yew::prelude::*;
use yew_functional::*;

#[function_component(UseRef)]
pub fn ref_hook() -> Html {
    let (message, set_message) = use_state(|| "".to_string());
    let message_count = use_ref(|| 0);

    let onclick = Callback::from(move |_e| {
        let window = yew::utils::window();

        if *message_count.borrow_mut() > 3 {
            window.alert_with_message("Message limit reached");
        } else {
            *message_count.borrow_mut() += 1;
            window.alert_with_message("Message sent");
        }
    });

    let onchange = Callback::from(move |e| {
        if let ChangeData::Value(value) = e {
            set_message(value)
        }
    });

    html! {
        <div>
            <input onchange=onchange value=message />
            <button onclick=onclick>{ "Send" }</button>
        </div>
    }
}
```
这是一个会统计信息发送次数的组件，在达到一定信息次数后就会停止发送并提示已满。
![fn ref](/images/fn-ref.gif)

#### use_effect
`use_effect`类似于class风格中的构造和解构方法。它由两部分组成：
* 首先是一个函数体：里面的内容会在组件构造时执行，且只执行一次
* 然后返回值是一个闭包：里面的内容会在组件解构时执行，且执行一次

没错，和React很像。但是还没有React那么强大。

React的`use_effect`还有第二个参数，是一个数组，用于确定组件依赖哪些参数变更时进行渲染更新。

下面是使用例子(摘自官方文档)：
```
use std::rc::Rc;
use yew::prelude::*;
use yew_functional::*;

#[function_component(UseEffect)]
pub fn effect() -> Html {
    let (counter, set_counter) = use_state(|| 0);

    {
        let counter = counter.clone();
        use_effect(move || {
            // Make a call to DOM API after component is rendered
            yew::utils::document().set_title(&format!("You clicked {} times", counter));

            // Perform the cleanup
            || yew::utils::document().set_title("You clicked 0 times")
        });
    }
    let onclick = {
        let counter = Rc::clone(&counter);
        Callback::from(move |_| set_counter(*counter + 1))
    };

    html! {
        <button onclick=onclick>{ format!("Increment to {}", counter) }</button>
    }
}
```
该代码会在网页的标题记录你点击的次数，并在组件销毁后，重置标题。

#### 关于其他
限于精力，笔者还未弄懂自定义`hook`和`use_context`(官网例子报错，无效)，以后再补。

### 编写demo
笔者在此也给出上面小节中实现繁琐的demo的函数式简洁实现方式：
```
use wasm_bindgen::prelude::*;
use yew::prelude::*;
use yew_functional::*;

#[function_component(HelloWorld)]
fn hello_world() -> Html {
    let (name, set_name) = use_state(|| "world".to_string());
    let onclick = Callback::from(move |name: String| set_name(name));
    html! {
        <div>
            <p>{"hello "}{name}</p>
            <Button onclick=onclick />
        </div>
    }
}

#[derive(Clone, PartialEq, Properties)]
struct ButtonProps {
    onclick: Callback<String>,
}

#[function_component(Button)]
fn button(props: &ButtonProps) -> Html {
    let onclick = {
        let onclick = props.onclick.clone();
        Callback::from(move |_| onclick.emit("yuchanns".to_string()))
    };
    html! {
        <button onclick=onclick>{"click me"}</button>
    }
}

#[wasm_bindgen(start)]
pub fn run_app() {
    App::<HelloWorld>::new().mount_to_body();
}
```
显而易见，相同的功能，简洁了很多！

这里值得一提的就是，在函数式组件中，父子传参是通过**引用**的方式传入的。

而传参中如果包含了`Callback`类型的参数，在闭包中使用时，需要通过`clone`的方式获取一个引用副本，否则无法使用。**这个细节困扰了笔者好几天才发现。**

## React经典教程：Tic Tac Toe
请原谅笔者，原本打算在这一小节详细讲述井字棋游戏怎么使用yew实现。

![](/images/tic-tac-toe.gif)

然而在写了上面这一大段内容之后，笔者感到实在没有精气神来继续剩下的计划，因此直接给出两个演示demo，分别使用class和函数式方式开发的：
* class井字棋演示：http://yew-tic-tac-toe.yuchanns.xyz/
* 函数式井字棋演示：https://yew-fn-tic-tac-toe.yuchanns.xyz/

其中函数式井字棋的演示可以通过点击下方的**阅读原文**访问。

## 关于源码
本文中描述的相关代码可以在[yuchanns/rustbyexample](https://github.com/yuchanns/rustbyexample)找到。

这是一个笔者创建的**学习Rust过程中记录各种demo的git仓库**。欢迎各位观众star关注，以及fork和pr添加新的demo，大家一起学习进步！





























