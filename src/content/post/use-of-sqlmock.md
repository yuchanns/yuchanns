---
title: "sqlmock的使用"
date: 2020-09-16T14:43:04+08:00
draft: false
---
今天q群一哥们儿说，他使用beego orm的`InserOrUpdate`的时候出现了相同主键还是会执行新增插入的bug，找我帮忙看看什么情况。

当时我的第一反应是让他先在debug模式下打印sql语句看看有没有什么问题，但小伙子可能是比较紧张一直打印不出来。

由于我当时不在生产电脑前，对beego也不是很熟悉，只能临时用普通电脑装一个go，设置一下环境拉一下代码写一个测试用例。因为安装mysql太麻烦了，所以我打算简单的用[DATA-DOG/go-sqlmock](https://github.com/DATA-DOG/go-sqlmock)来mock数据库返回。

于是就顺手写一下使用记录，算是给那位大兄弟的一个教程科普吧。

## 情景简述
案例情景介绍如下：有一个`TExchangeInfo`结构体，实例化后填充数据，然后执行**InsertOrUpdate**，当数据存在时，使用更新，当数据不存在时才插入：
```go
type TExchangeInfo struct {
	ID           int64     `orm:"column(id);auto"`
	DeparmentID  int64     `orm:"column(deparment_id)"`
	Times        uint      `orm:"column(times)"`
	Number       uint      `orm:"column(number)"`
	Lastmodified time.Time `orm:"column(lastmodified);type(datetime);auto_now"`
}
```
## sqlmock使用
sqlmock的使用其实很简单，参照文档就可以。我这里简单说明一下。

首先大家都知道，go标准库有一个`datebase/sql/driver`包，内部定义了数据库驱动标准接口，不管什么方言的数据库，只要实现了这些接口，就可以统一调用接口定制的方法来进行数据库交互。

而sqlmock也是通过`sqlmock.New()`这个方法返回一个标准的sql.DB结构体实例指针，这是一个数据库连接句柄。当然除此之外还返回了一个`sqlmock.Sqlmock`结构体实例。

而我们拿到`*sql.DB`之后，就可以递交给orm来使用了。

以beego orm为例，它有一个`orm.NewOrmWithDB`方法，用来实例化并指定连接句柄。
```go
func InsertOrUpdatePrintSql() error {
	db, mock, err := sqlmock.New()
	if err != nil {
		return err
	}
	defer db.Close()
	orm.Debug = true  // 开启debug模式才能打印出拼装的sql语句
	o, err := orm.NewOrmWithDB("mysql", "default", db)
	if err != nil {
		return err
	}
}
```
写到这里，似乎我们已经能够和往常一样使用orm了。试着写一个测试用例运行这个函数，结果会发现报错了，一个`panic`：
```bash
panic: all expectations were already fulfilled, call to Prepare 'SELECT TIMEDIFF(NOW(), UTC_TIMESTAMP)' query was not expected [recovered]
```
一时之间令人摸不着头脑？这和接下来我们要讲的`sqlmock.Sqlmock`有关。
## mock数据
mock的核心就在于**mock**这个词，也就是说，屏蔽上游细节，使用一些实现设定好的数据来模拟上游返回的数据。

sqlmock也同样如此，你需要在mock测试过程中，指定你期望(**Expectations**)执行的查询语句，以及假定的返回结果(**WillReturnResult**)。

> 注：beego orm在启动时候，会先执行`SELECT TIMEDIFF...`和`SELECT ENGINE...`两个语句，所以我们也需要把它添加到我们的期望中。

```go
func InsertOrUpdatePrintSql() error {
	db, mock, err := sqlmock.New()
	if err != nil {
		return err
	}
	defer db.Close()
	// ExpectPrepare，期望执行一条Prepare语句
	mock.ExpectPrepare("SELECT TIMEDIFF")
	mock.ExpectPrepare("SELECT ENGINE")
	// ExpectExec，期望执行一条Exec语句
	// 然后假定会返回(1, 1)，也就是自增主键为1，1条影响结果
	mock.ExpectExec("INSERT").
		WillReturnResult(sqlmock.NewResult(1, 1))
	orm.Debug = true
	o, err := orm.NewOrmWithDB("mysql", "default", db)
	if err != nil {
		return err
	}
	_ = o.Using("db1")
	// beego要求需要先注册结构体
	orm.RegisterModel(new(TExchangeInfo))
	u := &TExchangeInfo{
		ID:          10086,
		DeparmentID: 1,
		Times:       0,
		Number:      10,
	}
	_, err = o.InsertOrUpdate(u)

	return err
}
```
添加你的期望，然后执行orm动作。接着我们在标准输出口看到打印出来的sql语句
```bash
=== RUN   TestInsertOrUpdatePrintSql
[ORM]2020/09/16 23:43:39  -[Queries/default] - [  OK /     db.Exec /     0.1ms] - [INSERT INTO `t_exchange_info` (`deparment_id`, `times`, `number`, `lastmodified`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `deparment_id`=?, `times`=?, `number`=?, `lastmodified`=?] - `1`, `0`, `10`, `2020-09-16 23:43:39.178543 +0800 CST`, `1`, `0`, `10`, `2020-09-16 23:43:39.178543 +0800 CST`
--- PASS: TestInsertOrUpdatePrintSql (0.00s)
PASS
```

## 分析问题
整理一下输出语句，我们发现，beego orm使用的是数据库自身的`insert or update`功能来实现的新增插入修改更新的交互。但是整条语句中却毫无主键的痕迹——

```sql
INSERT INTO `t_exchange_info` (`deparment_id`, `times`, `number`, `lastmodified`) VALUES (`1`, `0`, `10`, `2020-09-16 23:43:39.178543 +0800 CST`) ON DUPLICATE KEY UPDATE `deparment_id`=`1`, `times`=`0`, `number`=`10`, `lastmodified`=`2020-09-16 23:43:39.178543 +0800 CST`
```

那么我们应该意识到，很可能是beego orm在执行过程中，过滤掉了主键。这难道是个bug吗？

在追溯源码之后，我们判定问题在于[github.com/astaxie/beego@v1.12.2/orm/db_mysql.go](https://github.com/astaxie/beego/blob/f6519b29a846bdf59a2b86baa011c242f78387d5/orm/db_mysql.go#L122)第122行代码这里。快速使用**Goland**自带的断点debug功能打一个断点，然后进行单步调试。

最终我们发现真正问题在于在[github.com/astaxie/beego@v1.12.2/orm/db.go](https://github.com/astaxie/beego/blob/f6519b29a846bdf59a2b86baa011c242f78387d5/orm/db.go#L91)第91行这里，在结构体字段的tag中包含有auto属性时，会被跳过，这就是造成过滤的原因。

![](/images/beego-orm.png)

## 结论
经过咨询得知，那位大兄弟在建立数据库交互所使用的数据结构体时，习惯在主键上打一个`auto`tag，认为这样表示主键自增的意思。

我告诉他，`auto`标签只是用于告诉框架进行自增操作，属于框架代码层面的操作，而不是数据库层面的操作，并不表示为主键。如果要表示主键，也应该是`pk`。

去掉`auto`，问题解决。

## 附：sqlmock更多用法
> 查询语句mock

```go
package sqlmock

import (
	"bytes"
	"crypto/rand"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"github.com/DATA-DOG/go-sqlmock"
	_ "github.com/go-sql-driver/mysql"
	"github.com/jinzhu/gorm"
	"math/big"
	"time"
)

type OrderStatus uint8

const (
	OrderPending OrderStatus = iota
	OrderTransferring
	OrderSuccess
	OrderReturning
	OrderRefunded
	OrderCancelled
)

type Order struct {
	ID         int64       `json:"id" gorm:"primary_key"`
	UserID     int64       `json:"user_id"`
	GID        int64       `json:"g_id"`
	UnitPrice  int64       `json:"unit_price"`
	Count      int64       `json:"count"`
	Status     OrderStatus `json:"status"`
	TotalPrice int64       `json:"total_price"`
	CreatedAt  int64       `json:"-"`
	UpdateAt   int64       `json:"-"`
}

func (o *Order) MarshalJSON() ([]byte, error) {
	type Alias Order
	const layout = "2006-01-02 15:04:05"
	return json.Marshal(&struct {
		*Alias
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	}{
		Alias:     (*Alias)(o),
		CreatedAt: time.Unix(o.CreatedAt, 0).Format(layout),
		UpdatedAt: time.Unix(o.UpdateAt, 0).Format(layout),
	})
}

func QueryRows() error {
	db, mock, err := sqlmock.New()
	if err != nil {
		return err
	}

	autoGenOrder := func() func() []driver.Value {
		i := 0
		userId := 10
		good := new(big.Int).SetInt64(999)
		price := new(big.Int).SetInt64(99)
		counts := new(big.Int).SetInt64(9)
		sts := new(big.Int).SetInt64(5)
		allSts := []OrderStatus{
			OrderPending,
			OrderTransferring,
			OrderSuccess,
			OrderReturning,
			OrderRefunded,
			OrderCancelled,
		}
		currentTime := time.Now().Unix()
		return func() []driver.Value {
			i++
			gid, _ := rand.Int(rand.Reader, good)
			unitePrice, _ := rand.Int(rand.Reader, price)
			count, _ := rand.Int(rand.Reader, counts)
			totalPrice := unitePrice.Int64() * count.Int64()
			status, _ := rand.Int(rand.Reader, sts)
			return []driver.Value{
				i, userId, gid.Int64(), unitePrice.Int64(), count.Int64(),
				totalPrice, allSts[status.Int64()], currentTime, currentTime + int64(i)*price.Int64(),
			}
		}
	}()

	rows := sqlmock.NewRows([]string{
		"id", "user_id", "g_id", "unit_price", "count",
		"total_price", "status", "created_at", "update_at",
	})

	for i := 0; i < 20; i++ {
		rows.AddRow(autoGenOrder()...)
	}

	o, err := gorm.Open("mysql", db)
	if err != nil {
		return err
	}
	defer o.Close()

	o.LogMode(true)

	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	var results []*Order
	o.Where("id > ?", 0).Find(&results)
	jsonBytes, err := json.Marshal(results)
	if err != nil {
		return err
	}
	fmt.Println(bytes.NewBuffer(jsonBytes).String())

	return nil
}
```

