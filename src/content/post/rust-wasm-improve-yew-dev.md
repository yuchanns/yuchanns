---
title: "提升Yew开发体验的方案"
date: 2021-03-01T08:45:40+08:00
draft: false
---
![预览效果](/images/yew-tailwindcss.yuchanns.xyz_.png)

> TLDR; 本文先后讲了Yew框架开发过程中引入tailwindcss、使用DarkMode、使用Cargo-watch进行热重载和模拟dangerouslySetInnerHtml。

**友情提示**：本文提到的内容均可以通过最下方的**阅读原文**预览效果。

**特别说明**：网站样式取自[antfu.me](https://antfu.me/)。

**郑重声明**：笔者乃前端小白，这篇文章仅代表笔者在学习Wasm过程中的进行的一些探索。如果读者有更好的方法，可以使用下方的小程序留言或者扫描文末二维码与笔者交流给出建议。

## TailwindCSS
像笔者这样对CSS一窍不通的后端一筋工程师在进行页面开发的时候无疑是一件非常痛苦的事情。

幸好开源社区提供了很多开箱即用的CSS框架。而笔者对其中的[TailwindCSS](https://tailwindcss.com/)则情有独钟。

TailwindCSS提倡**utility-first**的理念，提供了各种见名知义的样式名称——使用者只需要将其组合使用就可以轻松实现观感极佳的响应式页面效果。

![官方效果图](/images/tailwindcss.png)

此外，该框架还提供了[TreeShaking](https://en.wikipedia.org/wiki/Tree_shaking)的功能，实现了样式按需引入编译的效果，节省样式文件的体积。

说了这么多，要怎么和Yew结合使用呢？

### 环境准备
需要下载安装[npmjs](https://www.npmjs.com/).

需要安装Rust工具链和Yew框架——如果你对这句话一无所知建议从头阅读笔者的[《Rust学习笔记》](https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzkzNTIwMjYwMA==&action=getalbum&album_id=1699595912076935173&scene=21&subscene=91&sessionid=1613910975&enterid=1613910985&from_msgid=2247483667&from_itemidx=1&count=3#wechat_redirect)。

### PostCSS
在TailwindCSS官网中提供了好几种框架使用场景，这些框架会在使用过程中进行样式的最终编译和**TreeShaking**。但还没有Yew的。

不过不用担心，官方提供了一种缺省的使用方式，那就是通过[PostCSS](https://postcss.org/)这个js工具对css进行转换编译。

### 配置
首先在我们的Yew项目根目录下创建一个styles文件夹，执行下列命令：
```
cd styles
npm init
npm install -d postcss autoprefixer postcss-cli tailwindcss
```
等待安装完成。

接着创建一个`tailwind.config.js`作为TailwindCSS的配置文件：
```
module.exports = {
  purge: [
      '../src/**/*.rs'
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
```
其中`purge`字段用于配置进行**Treeshaking**的文件，我们选择了根目录下的`src`文件夹中所有**rs**后缀的文件。

然后创建一个`postcss.config.js`作为**postcss-cli**的配置文件：
```
module.exports = {
    plugins: {
        tailwindcss: { config: './tailwind.config.js' },
        autoprefixer: {},
        'postcss-nested': {},
    }
}
```
可以看到，使用了三个插件，`tailwindcss`并指定了刚才的配置文件，`autoprefixer`用于针对不同浏览器添加差异化的样式前缀，`postcss-nested`则是允许使用嵌套css的写法。

最后再创建一个`main.pcss`作为我们的样式源码文件，里面首先使用了TailwindCSS的样式，后续可以续写一些自定义的样式：
```
@tailwind base;

@tailwind components;

@tailwind utilities;
```
### 编译
尽情在`rs`文件中写下需要使用的样式名，然后在`styles`目录执行：
```
NODE_ENV=production node_modules/.bin/postcss main.pcss -o ../static/app.css
```
**postcss-cli**就会按需引入编译样式并输出到根目录下的`static`文件夹中。

而我们只需要在`static/index.html`中引入这个`app.css`文件就可以使用样式了。

每次都要输出这么一大串命令自然是麻烦又难记，所以我们可以在`package.json`的`scripts`字段写入：
```
{
  "scripts": {
    "build": "NODE_ENV=production postcss main.pcss -o ../static/app.css"
  },
}
```
## Dark Mode
近年来[Dark Mode](https://en.wikipedia.org/wiki/Light-on-dark_color_scheme)成为一个很流行的主题，假如你开源了一个博客皮肤或者静态网站生成器，那么肯定有人会请求实现**Dark Mode**这个特性。

### 实现方式
实现这个特性的方法有好几种，因为使用的是TailwindCSS，本文主要讲两种：
* `media`就是自动根据系统的设置来决定使用明暗主题
* `class`是通过手动添加样式的方式来实现明暗主题

`media`的缺陷在于无法手动切换，只能完全根据系统设置来决定，所以我们最后使用`class`的方式。

细心的读者应该有注意到在上一节`styles/tailwind.config.js`配置文件里有个`darkMode`被我们设置成了`class`，这就是为**DarkMode**做的准备。

### 实现步骤
#### 样式配置
在`styles/main.pcss`文件中，使用[CSS Variable](https://www.w3schools.com/css/css3_variables.asp)给定几种颜色变量和指定初始值：
```
// 省略上文
:root {
    --c-bg: #fff;
    --c-scrollbar: #eee;
    --c-scrollbar-hover: #bbb;
}

html {
    background-color: var(--c-bg);
    @apply text-gray-700;
}
```
可以看到紧接着我们在html里指定了背景颜色使用预设的颜色变量`--c-bg`。

为什么要这么做呢？

这是因为使用变量可以方便地在切换成**Dark Mode**之后控制样式颜色变换：
```
// 省略上文
html.dark {
    --c-bg: #050505;
    --c-scrollbar: #111;
    --c-scrollbar-hover: #222;
    @apply text-gray-200;
}
```
就像这样，在`html`被加上`dark`类后，将三个变量的值改成适合黑色主题的颜色。

#### 代码配置
样式的思路已经确定，接下来就是在Yew框架中实现主题的切换。

通过RustWasm的库`web_sys`提供的Dom操作Api，可以实现对html标签的样式添加与删除操作。

首先在`Cargo.toml`添加相关依赖：
```
// 省略上文
[dependencies]
wasm-bindgen = "0.2.67"

[dependencies.web-sys]
version = "0.3.4"
features = [
    'Document',
    'Element',
    'HtmlElement',
    'Node',
    'Window',
    'MediaQueryList',
]

[dependencies.js-sys]
version = "0.3.47"
```
然后编写一个组件，名叫`ToggleTheme`：
```
use wasm_bindgen::prelude::*;
use yew::prelude::*;
use yew_functional::*;

fn set_class(is_dark: bool) {
	// 下面的操作展示了获取html元素并添加`dark`class的过程
    let window = web_sys::window().expect("no global `window` exists");
    let document = window.document().expect("should have a document on window");
    let element = document
        .document_element()
        .expect("should hav a element on document");
    // js_sys提供了数组数据结构用于添加到Element结构体中
    let arr = js_sys::Array::new_with_length(1);
    arr.set(0, JsValue::from_str("dark"));
    let class_list = element.class_list();
    if is_dark {
        class_list.add(&arr).expect("should add dark class success");
    } else {
        class_list
            .remove(&arr)
            .expect("should remove dark class success");
    }
}

#[function_component(ToggleTheme)]
pub fn toggle_theme() -> Html {
	let (is_dark, set_is_dark) = use_state(|| false);
    let onclick = {
        let (is_dark, set_is_dark) = (s_dark.clone(), set_is_dark.clone());
        Callback::from(move |_| {
            set_is_dark(!*is_dark);
            set_class(!*is_dark);
        })
    };
    html! {
      <button onclick=onclick>{"切换主题"}</button>
    }
}
```
将这个组件挂载到页面合适的地方，然后编译成Wasm并使用简易http服务器进行浏览，点击之后就实现了黑色和亮色主题的切换效果。
![toggle theme](/images/toggle_theme.gif)
### 结合系统偏好
实现了手动切换，但是有一个缺点：用户首次进来永远是亮色主题，想要使用黑色主题只能手动。

有没有办法默认使用系统设置，并允许用户手动切换呢？

答案自然是有的，我们只需要使用`window`对象提供的`matchMedia`方法，获取系统偏好设置就行了。
```
// 省略上文
fn use_prefered_dark() -> bool {
	let window = web_sys::window().expect("no global `window` exists");
    let mut is_perfered_dark = false;
    match window.match_media("(prefers-color-scheme: dark)") {
        Ok(option_media_query_list) => match option_media_query_list {
            Some(media_query_list) => {
                is_perfered_dark = media_query_list.matches();
            }
            None => {}
        },
        Err(_) => {}
    };
    is_perfered_dark
}

#[function_component(ToggleTheme)]
pub fn toggle_theme() -> Html {
	let (is_dark, set_is_dark) = use_state(|| use_prefered_dark());
    use_effect({
        let is_dark = is_dark.clone();
        move || {
            set_class(*is_dark);
            || {}
        }
    });
    // 省略下文
}
```
我们添加了一个`use_prefered_dark`方法，通过`window.match_media`去匹配`prefers-color-scheme:`来得到系统默认颜色是否为黑色，并置为初始值。

然后使用了`use_effect`这个**Hook**在组件一加载的时候应用主题。

### 其他改进？
就在刚才，我们实现了一个勉强可用的**Dark Mode**，现在思考一下还有什么可以改进呢？

* 通过事件监听系统随着时间流逝切换主题，实时应用主题变更
* 通过`local_storage`记忆用户的设置，并在下次访问时进行应用

读者可以自行拓展，笔者这里不再赘述。

## 热重载
不知道在前两节中，读者有没有对时而编译CSS时而编译Wasm而感到手忙脚乱？

在使用React或者Vue进行开发的时候框架往往自带很方便的热重载功能，要是这里也能用上将会极大地提升开发体验。

[cargo-watch](https://github.com/passcod/cargo-watch)就是一个提供热重载的全局工具。

它默认根据`.gitignore`的配置进行文件监听，只要监听的文件发生了变动就会重复执行预先设置的指令，从而达到热重载的效果。

针对当前场景，我们只需要在项目根目录执行：
```
 cargo-watch -s "yarn --cwd styles build" \ 
  -s "wasm-pack build --target web --out-name wasm --out-dir ./dist"
```
就可以放手开发而不管编译操作。

### 使用拓展
上述操作虽然简单，但是重载过程需要一定时间。


读者可以自行阅读`cargo-watch`的使用手册，实现分别监听css变化和rs文件变化热重载，进一步提高使用体验。

> 此外，如果有前端读者知道如何使用`vite`或者其他工具实现热重载自动刷新页面也请告知笔者。
>
> 笔者尝试过使用vite+ts引用wasm的方式进行开发，但是遇到了两个问题：
>
> 1.自动刷新页面后变成空白
>
> 2.构建后无法正确读取Wasm文件。

## dangerouslySetInnerHtml
如果你和笔者一样，想用Yew开发一个读取[Markdown](https://en.wikipedia.org/wiki/Markdown)文件并生成文章的静态博客网站生成器，那么一定会需要类似于React的`dangerouslySetInnerHtml`或Vue的`v-html`指令。

这个指令的用途是无转义地将Markdown渲染生成的html内容嵌入到组件中。

很遗憾目前Yew并没有提供一个直接设置的指令，但是官方给出了一个[间接实现的方案](https://github.com/yewstack/yew/issues/189)：
```
use yew::prelude::*;
use yew::web_sys::Element;
use yew_functional::*;

#[derive(Debug, Clone, Eq, PartialEq, Properties)]
pub struct Props {
    pub inner_html: String,
}

#[function_component(Post)]
pub fn post(props: &Props) -> Html {
    let node_ref = NodeRef::default();
    {
        let inner_html = props.inner_html.clone();
        let node_ref = node_ref.clone();
        use_effect(move || {
            let el = node_ref.cast::<Element>().unwrap();
            el.set_inner_html(inner_html.as_str());
            || {}
        });
    }
    html! {
      <>
        <div class="prose m-auto mb-8">
          <h1 class="mb-0">{"Yew Tailwindcss"}</h1>
        </div>
        <div class="prose m-auto" ref=node_ref.clone() />
      </>
    }
}
```
通过`NodeRef`来调用元素自身，然后进行`inner_html`的设置，将渲染内容填充进去。

## 接下来
关于Wasm和Yew系列的文章即将到达尾声。

笔者学习Wasm的目的在于想要实现一个类似于**Vuepress**或**Gatsbyjs**的静态网站生成器，目前看来只剩下最后一个需要解决的问题：

**为每个路由生成一个服务端渲染后的静态页面并输出，解决SEO问题。**

读者也许注意到了，笔者在以往的文章中故意没有提及`yew-router`的使用。其实就是为了在最后一篇文章中一起讲解。

## 关于源码
本文中描述的相关代码可以在[yuchanns/rustbyexample](https://github.com/yuchanns/rustbyexample)找到。

这是一个笔者创建的学习Rust过程中记录各种demo的git仓库。欢迎各位观众star关注，以及fork和pr添加新的demo，大家一起学习进步


