---
title: "Rust 豆知识"
date: 2021-05-22T13:57:48+08:00
draft: false
---
> 记录一些暂未被笔者归档的、零散的知识点

### Profile

参考文档：[Profile - The rustup book](https://rust-lang.github.io/rustup/concepts/profiles.html)。

rust 工具链在安装的时候可以选择附加 components 组，通过 profile 来控制。

profile一共分为三个档位：
* **minimal**：仅包含必备组件，`rustc`, `rust-std` 和 `cargo`
* **default**：除了必备组件，额外附加了`rust-docs`, `rustfmt` 和 `clippy`
* **complete**：安装全部组件，不建议使用

通过`rustup set profile`命令设置。

### Components

参考文档：[Components - The rustup book](https://rust-lang.github.io/rustup/concepts/components.html)。

rust 工具链 (toolchain) 拥有一系列的 components ，其中有必选(如`rustc`)和可选(如`clippy`)的组件。

通过`rustup component list`可以查看所有可用组件。

通过`rustup component add`来选择添加的组件。

也可以在安装工具链的时候通过`rustup toolchain install nightly --component`的方式指定附加安装的组件。
