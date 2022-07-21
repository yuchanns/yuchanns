---
title: Rust 宏入门
---
[[Rust|rust]]

There are two types of macros in Rust:
* **Declarative macros**: It's similar to a match expression that operates codes
  users provide as arguments.
* **Procedural macros**: operates the AST of codes given.

## Declarative macros
[typesofmacrosinrust](https://blog.logrocket.com/macros-in-rust-a-tutorial-with-examples/#typesofmacrosinrust)
```rust
macro_rules! add {
    // match add!(1, 2)
    ($a:expr,$b:expr)=>{
        {
            $a+$b
        }
    };
    // match add!(1)
    ($a:expr)=>{
        {
            $a
        }
    };
}

add!(1, 2);
add!(3);
```
## Procedural macros
There are three subtypes of Procedural macros:
* **Derive macros**: Derive Trait for struct, enum, union
* **Attribute-like macros**: Attach attributes to an item and manipulates the
  item
* **Function-like macros**: Very similar to Declarative macros, looks like
  function calls. Be executed at compile time instead of runtime

```rust
#[proc_macro_derive(SomeTrait)]
pub fn derive_trait(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    unimplemented!()
}

#[derive(SomeTrait)]
struct SomeT {

}

#[proc_macro_attribute]
pub fn some_attr(args: TokenStream, input: TokenStream) -> TokenStream {
    unimplemented!()
}

#[some_attr(a)]
fn do_something() {}

#[proc_macro]
pub fn some_func(input: TokenStream) -> TokenStream {
    unimplemented!()
}

some_func! { n in 0..10 {
    /* dome something */
}}
```
