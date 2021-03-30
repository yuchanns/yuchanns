---
title: "Rust类型系统学习笔记"
date: 2021-02-01T08:30:00+08:00
draft: false
---
![](/images/parts-of-ferris-the-crab.png)

> 本文为《[Rust编程之道](https://book.douban.com/subject/30418895/)》学习笔记。
>
> 友情提示：文中代码可以使用[Rust Playground](https://yuchanns.xyz/r/playground/playground-rust)在线运行。

Rust是**显式静态强类型的类型安全语言**。

* `静态`表明它在编译期进行类型检查
* `强类型`表明它不允许类型自动隐式转换，不同类型无法进行计算
* `类型安全`表明它保证运行时的内存安全
* `显示`是因为它的类型推导在某些时候需要显示指定

## 类型大小
### 动态大小类型
Rust中大部分类型都可以在编译期确定大小。

对于无法确定大小的类型(即**DST**, **Dynamic Sized Type**)，只能在运行时分配，使用指针关联。

这样的指针存储了内存地址和长度信息，被称为**胖指针**。

例如`&str`字符串类型，它是一个引用类型，我们可以获取它指向的地址和长度信息：
```rust
fn main() {
	let str = "yuchanns";
    let ptr = str.as_ptr();
    let len = str.len();
    println!("{:p}", ptr);
    println!("{:?}", len);
}
// 0x558706bd2000
// 8
```
由于存储内存地址和长度的变量类型都为`usize`(在64位系统上为8字节)，所以胖指针可在编译期确定为16字节，分配到栈上。

可以通过下面的代码清单查看胖指针`&str`的大小：
```rus
fn main() {
	println!("{}", std::mem::size_of::<&str>());
}
// 16
```
需要注意的是，并非所有指针都是胖指针。如果引用的类型大小可以确定，相应的指针大小仅为8字节：
```rust
fn main() {
	// 长度不确定，需要携带长度信息，是胖指针
	println!("{}", std::mem::size_of::<&[u32]>());
    // 长度确定，是普通指针
    println!("{}", std::mem::size_of::<&[u32; 5]>());
}
// 16
// 8
```
### 零大小类型
单元结构体(`struct Foo`)、单元类型(`()`)和空枚举(`enum Void {}`)在运行时不占用内存空间(**ZST**，**Zero Sized Type**)。

在只需要迭代次数的场合中利用`Vec<()>`可以提高性能。
### 底类型
`!`表示无，也可以等同于任何类型。

由于在Rust的流程控制中`if`属于表达式，两个分支需要返回相同类型的值，在无法返回的情况下可以使用底类型(**Bottom Type**)：
```rust
// 该方法死循环，无法返回需要的String类型
fn foo() -> ! {
	loop {println!("loop");}
}
fn main() {
	let msg = if false {
    	foo();
    } else {
    	format!("failed")
    };
    println!("{}", msg);
}
```
## 类型推导
Rust部分情况下可以自动推导类型。

在无法自动推断时需要显式指定类型，帮助编译器确定推导的类型。
```rust
fn main() {
    let x = "1";
    assert_eq!(x.parse::<i32>().unwrap(), 1);
}
```
上面的代码清单中，`parse::<i32>()`这种为泛型函数在`<>`中标注类型的方式称作**Turbofish**。

## 泛型
泛型可以节省人编码过程的工作量，提高语言抽象能力。

例如实现两数相加，没有泛型的情况下，我们需要为每个类型实现一遍加法，如`fn add_i32(i32, i32) -> i32`、`fn add_i64(i64, i64) -> i64`、`fn add_u32(u32, u32) -> u32`和`fn add_u64(u64, u64) -> u64`等。

而有了泛型的帮助，这些类型共用一个`fn add<T>(T, T) -> T`函数即可。

其中类型**T**在编译时根据传入的参数类型确定。

如果有多种类型分别调用了该函数，则会在编译期替我们为每个类型实现了一遍加法。

这在Rust中被称为**单态化(Monomorphization)** ，是零成本抽象的一种，缺点是生成的文件体积会变大。

## Trait
**Trait**为Rust提供了零成本抽象能力。

### 接口抽象和泛型约束
人们常常在工程中提倡面向接口编程，即定义和实现分离，实现理想的解耦状态。

在Rust中可以使用`trait`定义接口，然后用`impl for`进行实现：
```rust
trait Shape {
	fn desc(&self) -> String;
}

struct Circle {}
struct Triangle {}

impl Shape for Circle {
	fn desc(&self) -> String {
    	"this is a circle".to_string()
    }
}
impl Shape for Triangle {
	fn desc(&self) -> String {
    	"this is a triangle".to_string()
    }
}

fn get_desc_from_shape<T: Shape>(shape: T) {
	println!("describe: {:?}", shape.desc());
}

fn main() {
	let c = Circle{} ;
    let t = Triangle{};
    get_desc_from_shape(c);
    get_desc_from_shape(t);
}
// describe: "this is a circle"
// describe: "this is a triangle"
```
同时可以看到，函数`get_desc_from_shape`是通过`<T: Shape>`来确保入参类型实现了`Shape`定义，所以**Trait**还可以为Rust提供泛型约束。

这一机制实现了**Ad-hoc多态**，又称为**函数重载**，同样在编译期展开，是零成本抽象。

此外，**Trait**还通过`&dyn`提供了非零成本的运行时抽象：
```rust
fn get_desc_from_shape_dyn(shape: &dyn Shape) {
	println!("describe: {:?}", shape.desc());
}
fn main() {
	let c = Circle{};
    get_desc_from_shape_dyn(&c);
}
```
`trait`还可以预先实现方法，节省具体类型的实现工作：
```rust
trait ShapePrinter {
	fn print_shape(&self) {
    	println!("this is a type implemented ShapePrinter");
    }
}

impl ShapePrinter for Circle {}

fn print_shape<T: ShapePrinter>(shape: T) {
	shape.print_shape();
}

fn main() {
	let c = Circle{} ;
    print_shape(c);
}
```
### Trait继承扩展
`trait`具有继承扩展能力，结合泛型约束可以实现。

例如，我们要为上面小节中所有实现了`Shape`的结构体扩展`ShapePrinter`，其实不需要为每个结构体重新实现一遍：
```rust
trait ShapePrinter: Shape {
	fn print_shape(&self) {
    	println!("this is a type implemented ShapePrinter");
    }
}

impl <T: Shape> ShapePrinter for T {}

fn main() {
	let c = Circle{} ;
    let t = Triangle{};
    print_shape(c);
    print_shape(t);
}
```
通过泛型约束为所有实现了`Shape`的泛型实现`ShapePrinter`，只需要写一次，就可以全部实现。
### 静态分发
如果不结合泛型约束，零成本抽象函数可以通过`impl`指定静态分发：
```rust
fn get_desc_from_shape_static(shape: impl Shape) {
	println!("describe: {:?}", shape.desc());
}
fn main() {
	let c = Circle{};
    get_desc_from_shape_static(c);
}
```
该关键字也可以在返回值中使用，如`fn create_shape() -> impl Shape`。

目前只能在入参和出参使用。
### 孤儿规则
Rust规定，如果要实现某个`trait`，那么该`trait`和要实现的类型至少有一个在当前的**crate**中定义，即**Orphan Rule**。

该规则保护了标准库和第三方库中定义的类型，避免使用者随意覆盖实现，引发难以预料的Bugs。
### 关联类型
**Associate Types**使用`type`关键字在`trait`中定义一个泛型，具体类型实现时指定。

关于关联类型的作用，我是参考了[Associated Types](http://web.mit.edu/rust-lang_v1.25/arch/amd64_ubuntu1404/share/doc/rust/html/book/first-edition/associated-types.html)这篇文章才更好地理解了。

例如下列结构体：
```rust
struct Test {
    name: String,
}
```
我们要定义一个接口，它含有一个`test`方法，其返回值根据具体实现决定。

使用普通泛型的代码思路：
```rust
trait TestB<RHS, S> {
    fn test(self) -> S;
}

impl TestB<Self, String> for Test {
    fn test(self) -> String {
        format!("{}", self.name)
    }
}
```
这样在调用时显得怪异而冗长，还会增加理解难度：
```rust
// RHS和S是T里使用到的泛型
// 在T作为函数参数时不得不在泛型声明里也写上RHS和S
fn test_b<RHS, S, T: TestB<RHS, S>>(t: T) -> S {
    t.test()
}
```
而使用关联类型的代码：
```rust
trait TestA<RHS = Self> {
    type Output;
    fn test(self) -> Self::Output;
}


impl TestA for Test {
    type Output = String;
    fn test(self) -> Self::Output {
        format!("{}", self.name)
    }
}
```
在实现中直接定义了泛型类型，调用时简洁了很多，也体现了高内聚的工程性：
```rust
// 不必写RHS和S，不用关心这个结构体内部声明了多少泛型
fn test<T: TestA>(t: T) -> T::Output {
    t.test()
}
```
比较糟糕的情况下，如果**trait TestA**增加了新的泛型，也只需要在实现中指定新的关联类型，而不必每个调用者都跟着追加新的泛型声明，重构影响小。

### 内置Trait
Rust在标准库中`std::marker`内置了5个重要的`trait`，它们分别是：
* `Sized trait`：实现了该`trait`的类型编译期可以确定大小
* `Unsize trait`： 实现了该`trait`的类型大小是动态的
* `Copy trait`：实现了该`trait`的类型可以安全复制
* `Send trait`：实现了该`trait`的类型可以安全地跨线程传递所有权
* `Sync trait`：实现了该`trait`的类型可以安全地跨线程共享引用

其中`Send`和`Sync`保证了Rust在编译期就能排除数据竞争。

内置的`trait`当然不仅仅是这5个，此处暂且不提。对于内置的`trait`，可以通过`#[derive]`派生属性让编译器替用户实现：
```rust
#[derive(Debug)]
struct Test {}

fn main() {
    println!("{:?}", Test{});
}
```
例如上面的代码清单中，我们要求编译器为结构体`Test`派生`Debug`，那么它就可以被以`println!("{:?}", Test{})`的形式打印。

## 类型转换
### 基本类型转换
Rust可以通过`as`关键字为基本类型进行转换：
```rust
fn main() {
	let a = 1u32;
    let b = a as u64;
}
```
需要注意，从长类型转换为短类型，存在被截断的可能。

### 无歧义完全限定语法
在上面的**Trait**小节中，细心的读者可能早已发现，一个结构体在实现多个`trait`时，完全有可能存在同名的方法，调用可能存在歧义。

这时候结合`as`关键字可以避免歧义：
```rust
struct S(i32);

trait A {
	fn test(&self, i: i32) {
    	println!("from A: {:?}", i);
    }
}

trait B {
	fn test(&self, i: i32) {
    	println!("from B: {:?}", i);
    }
}

impl A for S {}

impl B for S {}

fn main() {
	let s = S(1);
    <S as A>::test(&s, 1);
    <S as B>::test(&s, 1);
}

// from A: 1
// from B: 1
```
### 其他转换
结合内置的各种`trait`，Rust还实现了诸如**自动解引用**等少数隐式转换.

由于目前学习掌握的信息不足，暂不深入了解，知道即可。
