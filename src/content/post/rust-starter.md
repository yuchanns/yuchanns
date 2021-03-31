---
title: "Rust初学者-语言精要"
date: 2021-01-16T23:23:00+08:00
draft: false
---
![](/images/parts-of-ferris-the-crab.png)

一文总结Rust语言精要，快速形成整体风格认知。

## 文章构成
* 环境安装与工具链
    * 环境安装
    * 编译器与包管理器
    * 核心库与标准库
* 语法和语义介绍
    * 语句与表达式
    * 变量声明语义
    * 函数与闭包
    * 流程控制
* 类型系统
    * 基础类型
    * 复合类型
    * 标准库通用集合类型
    * 智能指针
    * 泛型
    * trait
* 错误处理
* 注释与打印

## 环境安装与工具链
Rust语言使用[rustup](https://rustup.rs/)作为安装器，它可以安装、更新和管理Rust的所有官方工具链。绝大多数情况下建议使用者使用该工具进行环境安装。
### 环境安装
对于`*nix`系统用户而言，执行：
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
对于`Windows`系统用户而言，下载安装[rustup-init.exe](https://win.rustup.rs/x86_64)。

安装完毕后可以通过`rustup show`获取工具链安装地址，进一步查看有哪些工具链，例如在笔者的macOS上是：
```
❯ rustup show
Default host: x86_64-apple-darwin
rustup home:  /Users/yuchanns/.rustup

stable-x86_64-apple-darwin (default)
rustc 1.49.0 (e1884a8e3 2020-12-29)
❯ ls /Users/yuchanns/.rustup
settings.toml toolchains    update-hashes
❯ ls /Users/yuchanns/.rustup/toolchains
stable-x86_64-apple-darwin
❯ ls /Users/yuchanns/.rustup/toolchains/stable-x86_64-apple-darwin
bin   etc   lib   share
❯ ls /Users/yuchanns/.rustup/toolchains/stable-x86_64-apple-darwin/bin
cargo         cargo-clippy  cargo-fmt     clippy-driver rust-gdb      rust-gdbgui   rust-lldb     rustc         rustdoc       rustfmt
```
通过`rustup doc`可以打开本地的Rust文档，而不用网络。
### 编译器与包管理器
`rustc`是**官方编译器**，负责将源代码编译为可执行文件或库文件。经过分词和解析生成**AST**，然后处理为**HIR**(进行类型检查)，接着编译为**MIR**(实现增量编译)，最终翻译为**LLVM IR**，交由LLVM作为后端编译为各个平台的目标机器码，因此Rust是跨平台的，并且支持交叉编译。

`rustc`可以用`run`命令和`build`命令编译运行源码，但大多数情况下用户不直接使用`rustc`对源码执行操作，而是使用`cargo`这一工具间接调用`rustc`。

`cargo`是**官方包管理器**，可以方便地管理包依赖的问题。

使用`cargo new proj_name`可以创建一个新的项目，包含一个`Cargo.toml`依赖管理文件和`src`源码文件夹。
```
❯ cargo new proj_name
     Created binary (application) `proj_name` package
❯ tree proj_name
proj_name
├── Cargo.toml
└── src
    └── main.rs

1 directory, 2 files
```
执行`cargo run .`可以简单编译运行默认的代码，编译结果将会与`src`同级的`target`下，包含`target/debug`和`target/release`两个文件夹。
```
❯ cd proj_name
❯ cargo run .
   Compiling proj_name v0.1.0 (/Users/yuchanns/Coding/backend/github/rustbyexample/trpl/proj_name)
    Finished dev [unoptimized + debuginfo] target(s) in 1.02s
     Running `target/debug/proj_name .`
Hello, world!
```
同时我们注意到文件根目录下生成了一个`Cargo.lock`文件，记录详细的依赖版本信息。然后观察`Cargo.toml`：
```
❯ cat Cargo.toml
[package]
name = "proj_name"
version = "0.1.0"
authors = ["yuchanns <airamusume@gmail.com>"]
edition = "2018"

[dependencies]
rand = "0.8.1"
```
可以看到，`[package]`记录的是关于本项目的一些信息，而下方的`[dependencies]`则记录了对外部包的依赖。

添加依赖，是通过编辑该文件，手动写入包名和版本，然后在编译过程中`cargo`就会自动下载依赖并使用。

也许有的读者好奇是否还有类似于其他语言的**CLI**命令，通过`cargo add`等命令添加依赖的方式，遗憾的是官方并没有提供这样的支持。而社区则提供了一个[killercup/cargo-edit](https://github.com/killercup/cargo-edit)实现了这一需求：
```
cargo install cargo-edit
cargo add rand
cargo rm rand
```
在一个issue [Subcommand to add a new dependency to Cargo.toml #2179](https://github.com/rust-lang/cargo/issues/2179) 中官方推荐了该工具，可能很多人(包括笔者在内)都如同下面这位老哥一样很难接受官方因为社区有解决方案而不提供官方解决的决定。不过也许可以理解为这就是官方宣称的 **“重视社区”** 的身体力行吧。

![](/images/issue-subcommand-of-cargo-add-new-dependency.png)

和许多其他语言一样，身在中国境内，用户还需要设置`cargo`的镜像站点，改善下载状况：
```
❯ cat ~/.cargo/config
[source.crates-io]
registry = "https://github.com/rust-lang/crates.io-index"
replace-with = 'ustc'
[source.ustc]
registry = "git://mirrors.ustc.edu.cn/crates.io-index"
```

### 核心库与标准库
Rust语言分为核心库和标准库。

核心库是语言核心，不依赖于操作系统和网络，不提供并发和I/O，全部是栈分配：
* 基础trait
* 基础类型
* 内键宏

标准库提供开发所需要的基础和跨平台支持：
* 基础trait和数据类型
* 并发、I/O和运行时
* 平台抽象
* 底层操作接口
* 错误处理类型和迭代器

## 语法和语义介绍
### 语句与表达式
Rust语法分为 **语句(Statement)** 和 **表达式(Expression)** 。

语句用于声明数据结构和引入包、模块等:
* 通过`extern`或`use`引入外部代码：`use std::prelude::v1::*;`
* 通过`let`声明变量，通过`fn`声明函数：`let greet = "world";`
* 宏语句，语句名以`!`为结尾，可像函数一样被调用：`println!("hello {}", greeter);`

表达式进行求值：
* 表达式结尾没有`;`则返回求值结果，有`;`则返回单元值`()`
* 由`{}`和一系列表达式组成的表达式为 **块表达式(Block Expression)** ，总是返回最后一个表达式的求值结果，如果有`;`则返回单元值

因此块表达式常常可以这样使用：
```
fn main() {
    let a = {
        let a = 1;
        let b = 2;
        a + b // 注意这里没有;会直接返回求值结果
    };
    println!("a: {}", a);
}
```

### 变量声明语义
表达式内部又可分为 **位置表达式(Place Expression)** 和 **值表达式(Vaue Expression)** 。

位置表达式表示内存位置，可以对数据单元的内存进行读写，代表持久性数据；值表达式引用数据值，只能读，代表临时数据。

```
fn main () {
    let a = "hello world"
}
```
如上，`a`是位置表达式，持久性地将值写入到内存中；而`"hello world"`则是值表达式，是一个临时数据，不可写，只可被读。

有其他语言背景的读者可能就会觉得，这只是左值和右值的另一种称呼，实际上并不是，这两个概念是为了下面会提到的**内存管理**所服务的。

表达式的求值过程具有求值上下文，分为位置上下文和值上下文：
* 赋值表达式的左侧，称为位置上下文
* `match`判别式也是位置上下文
* 赋值表达式的右侧使用`ref`模式时也是位置上下文
* 其他情况都是值上下文

Rust使用`let`声明变量时默认不可对位置表达式重新赋值，需要在声明时通过`mut`关键字声明可变的位置表达式：
```
fn main () {
    let mut a = "hello";
    a = "world";
}
```
通过`let`可以重复对同一个变量名进行不同数据类型的赋值，这样的操作会“遮蔽”前一个同名变量，可以认为是“只对变量名字进行复用”(那个变量的实际上还在内存当中)：
```
fn main() {
    let a = String::from("hello world");
    let b = &a;
    let a = String::from("hello yuchanns");
    println!("a is {}, b is {}", a, *b);
}
```

当位置表达式出现在值上下文中，会出现内存地址的转移，同时 **转移(Move)** 对内存的 **所有权(Ownership)** ，其结果是将无法再通过这个位置表达式读写该内存地址。
```
fn main () {
    let a = String::from("hello world");
    // 下面的表达式中位置表达式出现在值上下文(即赋值表达式的右侧)
    // 将一个位置表达式赋值给另一个位置表达式，出现了所有权的转移
    let b = a;
    println!("b is {}", b);
    // println!("a is {}", a); // 这里会编译失败，提示：a value used here after move.
}
```
细心的读者这时候会注意到上面的代码清单中声明字符串使用了另一种方式，这和Rust的内存分配有关，本文不展开讨论，暂时不必深究。

Rust没有GC，就是 **依靠所有权实现对内存的管理** 。

与 **转移(Move)** 语义相对的，还有 **复制(Copy)** 语义，不转移而对内存进行复制。

同时Rust也提供了 **借用(Borrow)** 操作符(`&`)，在不转移的情况下获取内存位置，并通过 **解引用(Deref)** 操作符(`*`)取值。

变量在块表达式的词法作用域范围时结束生命周期。可以在词法作用域内主动使用`{}`开辟一段新的词法作用域。

### 函数与闭包
Rust使用`fn`声明函数定义，并通过在入参后面加`: type`的方式约定入参类型，通过在函数括号后面加`-> type`的方式约定函数返回类型：
```
fn fizz_buzz(num: i32) -> String {
    // ...
}
```
函数在Rust中是**一等公民**，可以作为参数和返回值使用。

有其他语言背景的读者也许会觉得，当函数作为返回值使用时，它就是闭包。但在Rust中还是有所不同的：
* 闭包实际上是一个匿名结构体和trait的组合实现
* 函数无法引用外部变量
* 闭包使用`||`代替函数的`()`
* 闭包需要使用`move`关键字显式转移变量所有权避免成为悬垂指针(即使你忘了，编译器也会帮你检查出来)

```
fn main() {
    // 返回值里的impl表明闭包实际上是用匿名结构体实现了一个trait
    fn make_true2() -> impl Fn() -> bool {
        let s = "hello world2";
        // 函数作为返回值
        fn is_true() -> bool {
            //函数内部无法引用外部变量
            // println!("s: {}", s); // can't capture dynamic environment in a fn item
            true
        }
        fn make_true() -> fn() -> bool {
            is_true
        }
        println!("make_true: {}", make_true()());
        // 闭包作为返回值
        // 使用||代替函数的()
        move || -> bool {
            // 闭包可以引用外部变量
            // 但需要通过move显式转移所有权，代替默认的引用
            println!("s: {}", s);
            true
        }
    }
    println!("make_true2: {}", make_true2()());
}
```
### 流程控制
Rust中没有三元操作符，`if`表达式的分支必须返回同一个类型的值。每一个`if`分支其实也是一个块表达式。

循环表达式有三种：`while`、`loop`和`for...in`：
* `for...in`本质上是一个迭代器
* 无限循环请使用`loop`而不是`while true`，因为编译器会忽略循环体里的表达式，引起报错

```
fn main () {
    let n = 13;
    // if分支是块表达式，返回类型必须相同
    let result = if (n > 10) {
        true
    } else {
        false
    };
    println!("result: {}", result);
    for n in 1..10 {
        println!("now n is {}", n);
    }
    fn while_true() -> i32 {
        while true {
            return 10; // 编译器忽略内部会返回i32，因为认为while条件有真有假，不会一直为true
        }
        return 11; // 如果省略这一行，编译器会认为函数最终返回了一个单元值()
    }
    println!("while_true: {}", while_true());
}
```

Rust还提供了`match`表达式和某些场景下可以代替它进行简化的`if let`、`while let`表达式：
* `match`表达式返回类型必须一致
* `match`表达式左侧可以通过操作符`@`将匹配值赋予某个变量
* `match`表达式必须穷尽所有可能，可以用通配符`_`处理剩余情况

```
fn main() {
    let number = 42;
    match number {
        0 => println!("zero"),
        n @ 42 => println!("value is {}", n),
        _ => println!("rest of all"),
    }
    let mut v = vec![1, 2, 3, 4];
    while let Some(x) = v.pop() {
        println!("{}", x);
    }
}
```
## 类型系统
### 基础类型
* 布尔： `let x = true; let y: bool = false;`，任意一个比较操作都会产生bool类型
* 数字：
    * 可以使用**类型后缀**(例如`let a = 42u32;`)
    * 可以使用`_`提升可读性(例如`let a = 100_000;`)
    * 可以使用前缀表示进制(十六进制`0x2A`、八进制`0o106`、二进制`0b1101_1011`)
    * 可以使用**字节字面量**(例如`b'*'`等价于`42u8`)
    * 可以表示无穷大(`INFINITY`)，负无穷大(`NEG_INFINITY`)，非数字值(`NAN`)，最小有限值(`MIN`)和最大有限值(`MAX`)

|数字类型|范围|占用|
|---|---|---|
|u8|0~2<sup>8</sup>-1|1个字节|
|u16|0~2<sup>16</sup>-1|2个字节|
|u32|0~2<sup>32</sup>-1|4个字节|
|u64|0~2<sup>64</sup>-1|8个字节|
|u128|0~2<sup>128</sup>-1|16个字节|
|i8|-2<sup>7</sup>~2<sup>7</sup>-1|1个字节|
|i16|-2<sup>15</sup>~2<sup>15</sup>-1|2个字节|
|i32|-2<sup>31</sup>~2<sup>31</sup>-1|4个字节|
|i64|-2<sup>63</sup>~2<sup>63</sup>-1|8个字节|
|i128|-2<sup>127</sup>~2<sup>127</sup>-1|16个字节|
|usize|0\~2<sup>32</sup>-1或0\~2<sup>64</sup>-1|4或8个字节，取决于机器的字长|
|isize|-2<sup>31</sup>\~2<sup>31</sup>-1或-2<sup>63</sup>\~2<sup>63</sup>-1|4或8个字节，取决于机器的字长|
|f32|-3.4x10<sup>38</sup>~3.4x10<sup>38</sup>||
|f64|-1.8x10<sup>308</sup>~1.8x10<sup>308</sup>||

* 字符：
    * 使用`''`来表示字符类型，代表一个**Unicode标量值**
    * 每个字符占4个字节
    * 可使用ASCII和Unicode码定义(`'\x2A'`表示`*`，`'\u{151}'`表示`ő`)
* 数组：
    * 签名为`[T; N]`(`let arr: [i32; 3] = [1, 2, 3]`)
    * 类型必须一致
    * 编译时必须确定长度，不可变化长短
    * 会在编译器检查越界访问
    * 必须声明`mut`才能修改值
* 范围：
    * 本质是迭代器
    * 左闭右开区间`(1..5)`
    * 全闭区间`(1..=5)`
* 切片：
    * 引用数组的一部分，无需拷贝
    * 包含指向数组其实位置的指针和数组长度
    * 通过`&`产生(`let arr = [1, 2, 3, 4];let b = &arr[1..3];`)
    * 可以通过声明`mut`修改值
    * 通过`len`和`is_empty`判断长度和是否为空(`b.len(); b.is_empty();`)
* 字符串：
    * 基础类型字符串为固定长度字符串
    * 类型写作`&str`
    * 可以通过`as_ptr`和`len`获取指针和长度
* 原生指针：提供不可变原生指针(`*const T`)和可变原生指针(`*mut T`)，不安全，需要在`unsafe`块中执行，一般不直接使用
* never：
    * 表示永远不可能有返回值
    * 用`!`表示

### 复合数据类型
Rust提供4种复合数据类型：
* 元组Tuple：`let tuple: (i32, char) = (5, 'c');`
    * 元素可以类型不同
    * 长度固定
    * 可以使用`let`解构(`let (x, y) = tuple;`)
    * 只有一个值时需要加`,`(`let tuple = (0,)`)
    * 单元值是空元组
* 结构体：
    * 使用`struct`声明定义
    * 元组结构体：
        * 字段没有名称，只有类型
        * `struct Color(i32, i32, i32);`
    * 单元结构体：
        * 没有任何字段的结构体
        * 多个实例在Relase编译模式下会被优化编译成同一个对象
        * `struct Empty;`
    * 具名结构体：
        * 命名建议使用驼峰
        * 可使用`impl`关键字为结构体添加方法和类似构造函数
        * 方法中第一个参数如果是`&self`，通过`.`调用
        * 否则方法使用`::`调用

```
struct People {
    name: &'static str,
    gender: u32,
}

impl People {
    fn new(name: &'static str, gender: u32) -> Self {
        return People{name: name, gender: gender};
    }

    // 自身需要mut
    fn set_name(&mut self, name: &'static str) {
        self.name = name;
    }

    fn name(&self) {
        println!("name: {:?}", self.name);
    }

    fn gender(&self) {
        let gender = if self.gender == 1 {"boy"} else {"girl"};
        println!("name: {:?}", gender);
    }
}

fn main() {
    // 需要mut才能调用set_name
    let mut p = People::new("yuchanns", 1);
    p.name();
    p.set_name("yuchanns2");
    p.name();
    p.gender();
}
```
* 枚举体：
    * 使用`enum`声明定义
    * 成员是值，不是类型
    * 也支持**类C枚举体**
    * 还支持携带类型参数

```
// 成员是值
enum Number {
    Zero,
    One,
    Two,
}
// 类C枚举
enum Color {
    Red = 0xff0000,
    Green = 0x00ff00,
    Blue = 0x0000ff,
}
// 携带类型参数
enum IpAddr {
    V4(u8, u8, u8, u8),
    V6(String),
}

fn main() {
    // 调用
    let a = Number::One;
    match a {
        Number::Zero => println!("0"),
        Number::One => println!("1"),
        Number::Two => println!("2"),
    }
}
```
### 标准库通用集合类型
Rust标准库提供了4种通用集合类型：
* 线性序列：**Vec**、**VecDeque**、**LinkedList**
* 映射表：无序的**HashMap**、有序的**BTreeMap**
* 集合：无序的**HashSet**、有序的**BTreeSet**
* 优先队列：二叉堆**BinaryHeap**
### 智能指针
可以自动释放内存，无痛使用堆内存，确保内存安全。

以`Box<T>`为例：
* 值被默认分配到栈内存，可以通过`Box::new(value)`分配到堆上
* 返回一个指向类型T的堆内存分配值的智能指针。
* 可以通过`*`解引用取值
* 超出作用域范围时自动析构，销毁内部对象，释放内存。

### 泛型
和其他语言的泛型类似，解决代码复用。

通常使用`<T>`来表示。

可以结合**trait**指定泛型行为。

### trait
* trait是Rust唯一的接口抽象方式
* 可以静态分发，也可以动态分发
* 可以作为标签标记类型拥有某些特定性为
* **组合优于继承，面向接口编程**

```
struct Plane;
struct Car;
trait Behave {
    fn behave(&self);
}
impl Behave for Plane {
    fn behave(&self) {
        println!("plane move by fly");
    }
}
impl Behave for Car {
    fn behave(&self) {
        println!("car move by wheels");
    }
}
// 泛型结合trait限定行为
fn behave_static<T: Behave>(s: T) {
    s.behave();
}
fn behave_dyn(s: &dyn Behave) {
    s.behave();
}
fn main() {
    let plane = Plane;
    // 静态分发，编译时展开，无运行时开销
    behave_static::<Plane>(plane);
    // 动态分发，有运行时开销
    behave_dyn(&Car);
}
```
## 错误处理
Rust的错误处理通过返回`Result<T, E>`的方式进行，这是一个枚举体。
```
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```
结合`match`进行处理，下面这个[猜数字游戏](https://rust-lang.budshome.com/ch02-00-guessing-game-tutorial.html)是一个简单的示例：
```
use rand::Rng;
use std::cmp::Ordering;
use std::io::stdin;

fn main() {
    println!("Guess the number!");
    let secret_number = rand::thread_rng().gen_range(1..101);

    loop {
        println!("Please input your guess:");

        let mut guess = String::new();

        stdin().read_line(&mut guess).expect("Failed to read line");

        // Result是个枚举
        // 可以通过match Result进行成功或失败的处理
        let guess: u32 = match guess.trim().parse() {
            Ok(num) => num,
            Err(_) => {
                // 失败的时候跳过当次循环
                println!("Please type a number!");
                continue;
            }
        };

        println!("Your guessed: {}", guess);

        match guess.cmp(&secret_number) {
            Ordering::Less => println!("Too small!"),
            Ordering::Greater => println!("Too big!"),
            Ordering::Equal => {
                println!("You win!");
                break;
            }
        }
    }
}
```
## 注释与打印
Rust注释分为普通注释和文档注释：
* 普通注释：
    * 使用`/*...*/`进行块注释
    * 使用`//`进行行注释
* 文档注释：
    * 使用`///`或`//!`注释
    * 支持Markdown语法
    * 可以通过`rustdoc`构建生成HTML文档

使用`println!`进行格式化打印：
* 只有`{}`表示trait `Display`，需要实现该trait才能打印：`println!("{}", 2);`
* `{:?}`表示trait `Debug`，需要实现该trait才能打印：`println!("{:?}", 2);`
* `{:o}`表示八进制
* `{:x}`表示十六进制小写
* `{:X}`表示十六进制大写
* `{:p}`表示指针
* `{:b}`表示二进制
* `{:e}`表示指数小写
* `{:E}`表示指数大写
