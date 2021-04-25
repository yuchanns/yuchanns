---
title: "【译】Go的ORM和查询构建"
date: 2021-04-25T14:39:23+08:00
draft: false
---
> 原文地址：[https://andrewpillar.com/programming/2019/07/13/orms-and-query-building-in-go/](https://andrewpillar.com/programming/2019/07/13/orms-and-query-building-in-go/)

最近，我一直在研究各种解决方案，以便在Go中轻松地与数据库进行交互。我在Go中使用的包是[sqlx](https://github.com/jmoiron/sqlx)，这使得从数据库中提取数据到结构中变得非常容易。你可以写出你的SQL查询，用`db`标签来标记你的结构，然后让`sqlx`来处理剩下的事情。然而，我遇到的主要问题是在构建符合语言习惯的查询方面。这促使我研究这个问题，并在这篇文章中写下我的一些想法。

> TL;DR 
>
> 第一公民函数是在Go中进行SQL查询的一种习惯性方法。请查看这个包含了我写的测试例子的代码库：[https://github.com/andrewpillar/query](https://github.com/andrewpillar/query)。

## GORM，复杂的分层查询和Active Record模式

大部分人在刚接触Go的数据库作业时，很大程度上会被指导使用[gorm](https://gorm.io/)来处理数据库作。它是一个功能相当全面的ORM，支持包括但不限于迁移、关系、事务等等。对于那些曾经使用过ActiveRecord或Eloquent的人来说，GORM的使用方法对你来说是非常熟悉的。

我以前曾短暂地使用过GORM，对于简单的基于CRUD的应用程序来说，很好用。然而，当涉及到更多层次的复杂性时，我发现它是不够的。假设我们正在建立一个博客应用程序，我们允许用户通过URL中的`search`查询字符串来搜索文章。如果存在这种情况，我们要用`WHERE title LIKE`来限制查询，否则我们就不这样做。

```
posts := make([]Post, 0)

search := r.URL.Query().Get("search")

db := gorm.Open("postgres", "...")

if search != "" {
    db = db.Where("title LIKE ?", "%" + search + "%")
}

db.Find(&posts)
```

没有什么可争议的，我们只是检查一下是否有一个值，然后修改对GORM本身的调用。然而，如果我们想允许搜索某个日期之后的帖子呢？我们需要增加一些检查，首先要看URL中是否有`after`查询字符串，如果有，就适当地修改查询。

```
posts := make([]Post, 0)

search := r.URL.Query().Get("search")
after := r.URL.Query().Get("after")

db := gorm.Open("postgres", "...")

if search != "" {
    db = db.Where("title LIKE ?", "%" + search + "%")
}

if after != "" {
    db = db.Where("created_at > ?", after)
}

db.Find(&posts)
```

所以我们又增加了一个检查，以确定是否应该修改调用。到目前为止，这工作得很好，但事情可能开始变得难以控制。理想情况下，我们想要的是用一些自定义的回调来扩展 GORM，这些回调将接受`search`和`after`的变量，不管它们的值如何，并将逻辑推迟到该自定义回调。GORM 确实支持一个[插件系统](https://gorm.io/docs/write_plugins.html)，用于编写自定义回调，然而这似乎更适合于在某些操作时修改表的状态。

正如上面所展示的，我发现GORM最大的缺点是做复杂的分层查询很麻烦。更多的时候，在编写SQL查询时，你更需要这一点。试着想象一下当你需要根据一些用户输入在查询中添加一个`WHERE`子句，或者你需要为查询结果排列顺序。

我相信这可以归结为一件事，前段时间我在HN上对这个问题做了一个[评论](https://news.ycombinator.com/item?id=19851753)：

> 我个人认为，像gorm这样的主动记录式的ORM在Go语言中并不适合，因为这种语言本身并不具有OOP的特点。翻阅gorm的一些文档，它似乎严重依赖方法链，考虑到Go语言中的错误处理方式，这似乎是错误的。在我看来，ORM应该尽可能地符合语言使用习惯。

这个评论是在文章[《该不该使用ORM》](https://eli.thegreenplace.net/2019/to-orm-or-not-to-orm/)下发表的，我强烈建议你阅读这篇文章。该文章的作者对GORM的结论与我相同。

## 符合Go语言习惯的查询构建

标准库中的`database/sql`包对于与数据库的交互是非常好的。而`sqlx`是在此基础上的一个很好的扩展，用于处理数据的返回。然而，这仍然不能完全解决眼前的问题。我们如何才能有效地以编程方式构建复杂的查询，并使之符合Go的语言习惯。假设我们使用`sqlx`来处理上面的同一个查询，会是什么样子呢？

```
search := r.URL.Query().Get("search")
after := r.URL.Query().Get("after")

db := sqlx.Open("postgres", "...")

query := "SELECT * FROM posts"
args := make([]interface{}, 0)

if search != "" {
    query += " WHERE title LIKE ?"
    args = append(args, search)
}

if after != "" {
    if search != "" {
        query += " AND "
    } else {
        query += " WHERE "
    }
    
    query += "created_at > ?"
    
    args = append(args, after)
}

err := db.Select(&posts, sqlx.Rebind(query), args...)
```

比我们用GORM做的好不了多少，事实上要丑得多。我们要检查`search`是否存在两次，以便为查询准备正确的SQL语法，将我们的参数存储在`[]interface{}`切片中，并连接成一个字符串。这也是不可扩展的，也不容易维护。理想情况下，我们希望能够建立起查询，并把它交给`sqlx`来处理其他的事情。那么，Go中的符合语言习惯的查询生成器会是什么样子呢？在我看来，它有两种形式，一种是利用选项结构，另一种是利用第一类函数。

让我们来看看[squirrel](https://github.com/masterminds/squirrel)。这个库提供了建立查询的能力，并以我认为比较符合Go语言习惯的方式直接执行它们。在这里，我们将只关注查询的建立方面。

通过`squirrel`，我们可以像这样实现我们的上述逻辑。

```
posts := make([]Post, 0)

search := r.URL.Query().Get("search")
after := r.URL.Query().Get("after")

eqs := make([]sq.Eq, 0)

if search != "" {
    eqs = append(eqs, sq.Like{"title", "%" + search + "%"})
}

if after != "" {
    eqs = append(eqs, sq.Gt{"created_at", after})
}

q := sq.Select("*").From("posts")

for _, eq := range eqs {
    q = q.Where(eq)
}

query, args, err := q.ToSql()

if err != nil {
    return
}

err := db.Select(&posts, query, args...)
```

这比我们用GORM做的要好一点，也比我们以前做的字符串连接好很多。然而，写起来还是略显繁琐。`squirrel`在SQL查询中的一些子句中使用了选项结构。可选结构是Go中常见的模式，旨在使API高度可配置。

在Go中建立查询的API应该满足这两个需求：

* 直观性
* 可扩展性

如何用 Go 实现这一点？

## 查询构建的第一公民函数

Dave Cheney 写了两篇关于第一公民函数的博文，基于 Rob Pike 关于同一主题的帖子。对此感兴趣的读者，可以在这里找到它们：

- [Self-referential functions and the design of options](https://commandcenter.blogspot.com/2014/01/self-referential-functions-and-design.html)
- [Functional options for friendly APIs](https://dave.cheney.net/2014/10/17/functional-options-for-friendly-apis)
- [Do not fear the first class functions](https://dave.cheney.net/2016/11/13/do-not-fear-first-class-functions)

我强烈建议你阅读以上三篇文章，当你下次要实现一个需要高度可配置的API时，请使用他们建议的模式。

下面是一个例子，说明可能存在的查询构建的情况：

```
posts := make([]*Post, 0)

db := sqlx.Open("postgres", "...")

q := Select(
    Columns("*"),
    Table("posts"),
)

err := db.Select(&posts, q.Build(), q.Args()...)
```

一个天真的例子，我知道。但让我们来看看我们如何实现这样一个API，以便它能被用于构建查询。首先，我们应该实现这样一个查询结构，以便在构建查询时追踪其状态。

```
type statement uint8

type Query struct {
    stmt  statement
    table []string
    cols  []string
    args  []interface{}
}

const (
    _select statement = iota
)
```

上述结构将追踪我们正在构建的语句，无论是`SELECT`、`UPDATE`、`INSERT`还是`DELETE`，正在操作的表，正在被处理的列，以及将被传递给最终查询的参数。为了保持简单，让我们专注于实现查询生成器的`SELECT`语句。

接下来，我们需要定义一个可以用来修改我们正在构建的查询的类型。这是一个会被无数次作为第一公民函数传递的类型。每次调用这个函数时，它应该返回新修改的查询，如果适用的话。

```
type Option func(q Query) Query
```

我们现在可以实现构建器的第一部分，即`Select`函数。这将开始为我们要建立的`SELECT`语句建立一个查询。

```
func Select(opts ...Option) Query {
    q := Query{
        stmt: select_,
    }

    for _, opt := range opts {
        q = opt(q)
    }

    return q
}
```

现在你应该能够看到所有的东西都在慢慢地组合起来，以及`UPDATE`、`INSERT`和`DELETE`语句也可以简单地实现。如果不真正实现一些传递给`Select`的选项，上面的函数是相当无用的，所以让我们来实现它。

```
func Columns(cols ...string) Option {
    return func(q Query) Query {
        q.cols = cols

        return q
    }
}

func Table(table string) Option {
    return func(q Query) Query {
        q.table = table

        return q
    }
}
```

正如你所看到的，我们实现这些第一公民函数的方式是让它们返回将被调用的基础选项函数。通常情况下，我们希望选项函数能够修改传递给它的查询，并返回一个副本。

为了使其对我们建立复杂查询的使用情况有用，我们应该实现向查询添加`WHERE`子句的能力。这将需要跟踪查询中的各种`WHERE`子句。

```
type where struct {
    col string
    op  string
    val interface{}
}

type Query struct {
    stmt   statement
    table  []string
    cols   []string
    wheres []where
    args   []interface{}
}
```

我们为`WHERE`子句定义了一个自定义类型，并在原始查询结构中添加了一个`wheres`属性。让我们根据需要实现两种类型的`WHERE`子句，第一种是`WHERE LIKE`，另一种是`WHERE >`。

```
func WhereLike(col string, val interface{}) Option {
    return func(q Query) Query {
        w := where{
            col: col,
            op:  "LIKE",
            val: fmt.Sprintf("$%d", len(q.args) + 1),
        }

        q.wheres = append(q.wheres, w)
        q.args = append(q.args, val)

        return q
    }
}

func WhereGt(col string, val interface{}) Option {
    return func(q Query) Query {
        w := where{
            col: col,
            op:  ">",
            val: fmt.Sprintf("$%d", len(q.args) + 1),
        }

        q.wheres = append(q.wheres, w)
        q.args = append(q.args, val)

        return q
    }
}
```

在处理向查询添加`WHERE`子句时，我们适当地处理了底层SQL驱动的bindvar语法，这里的例子是**Postgres**，并将实际值本身存储在查询的`args`切片中。

因此，我们在一点点地以一种符合语言习惯的方式实现我们想要的东西。

```
posts := make([]Post, 0)

search := r.URL.Query().Get("search")
after := r.URL.Query().Get("after")

db := sqlx.Open("postgres", "...")

opts := []Option{
    Columns("*"),
    Table("posts"),
}

if search != "" {
    opts = append(opts, WhereLike("title", "%" + search + "%")) 
}

if after != "" {
    opts = append(opts, WhereGt("created_at", after))
}

q := Select(opts...)

err := db.Select(&posts, q.Build(), q.Args()...)
```

稍微好一点，但程度仍然不大。然而，我们可以扩展功能以获得我们想要的东西。因此，让我们实现一些函数，这些函数将返回满足我们特定需求的选项。

```
func Search(col, val string) Option {
    return func(q Query) Query {
        if val == "" {
            return q
        }

        return WhereLike(col, "%" + val + "%")(q)
    }
}

func After(val string) Option {
    return func(q Query) Query {
        if val == "" {
            return q
        }

        return WhereGt("created_at", val)(q)
    }
}
```

有了以上两个函数的实现，我们现在可以为我们的用例干净地建立起一个有点复杂的查询。这两个函数只会在传递给它们的值被认为是正确的情况下修改查询。

```
posts := make([]Post, 0)

search := r.URL.Query().Get("search")
after := r.URL.Query().Get("after")

db := sqlx.Open("postgres", "...")

q := Select(
    Columns("*"),
    Table("posts"),
    Search("title", search),
    After(after),
)

err := db.Select(&posts, q.Build(), q.Args()...)
```

我发现这是在Go中建立复杂查询的一种相当符合语言习惯的方式。当然，你在文章中看到这里，一定在想，"这很好，但你没有实现Build()或Args()方法"。在某种程度上，这是真的。为了不延长这篇文章的时间，我没有这么做。所以，如果你对这里展示的某些想法感兴趣，可以看看我提交给GitHub的[代码](https://github.com/andrewpillar/query)。它并不严格，也没有涵盖一个查询生成器所需要的一切，例如，它缺少`JOIN`，而且只支持Postgres的bindvar。