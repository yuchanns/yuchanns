---
title: "【译】写给Vue开发者的React指南"
date: 2020-08-23T09:43:55+08:00
draft: false
---
> 原文：[react-for-vue-developers](https://sebastiandedeyne.com/react-for-vue-developers)。

在过去的三年里，我曾在不同的项目中使用了React和Vue，遍及小型网站和大规模的应用。

上个月我写了一篇[《为什么我偏爱React更甚于Vue》](https://sebastiandedeyne.com/why-i-prefer-react-over-vue/)的文章，很快我参加了[全栈之音](http://www.fullstackradio.com/114)上Adam Wathan的谈话节目，从一名Vue开发者的角度对React进行了讨论。

我们在播客上讲了很多东西，但大部分内容可以说都是通过一些代码片段对比两者之间的相似与不同之处。

这篇文章简明扼要地介绍了Vue的大部分功能，以及在2019年我是如何通过React的hooks实现同样的效果。

## 模板
React可选项：JSX。

Vue使用HTML字符串和一些自定义指令作为模板。通常推荐以`.vue`后缀来区分模板和脚本（以及可选的样式）。

```jsx
<template>
  <p>Hello, {{ name }}!</p>
</template>

<script>
export default {
  props: ['name']
};
</script>
```

React则使用[JSX](https://facebook.github.io/jsx/)——一种ECMAScript的扩展（语法糖）。

```jsx
export default function Greeter({ name }) {
  return <p>Hello, {name}!</p>;
}
```

### 条件渲染
React可选项：逻辑`&&`运算符、三元表达式或提前返回。

Vue使用`v-if`、`v-else`和`v-else-if`指令来实现模板的局部条件渲染。


```jsx
<template>
  <article>
    <h1 v-if="awesome">Vue is awesome!</h1>
  </article>
</template>

<script>
export default {
  props: ['awesome']
};
</script>
```

由于React并不支持指令，所以你需要通过语言层面实现模板的条件渲染。

`&&`运算符提供了一种`if`条件语句的简单表达方式。

```jsx
export default function Awesome({ awesome }) {
  return (
    <article>
      {awesome && <h1>React is awesome!</h1>};
    </article>
  );
}
```

如果你还需要`else`从句，就使用三元表达式来代替。

```jsx
export default function Awesome({ awesome }) {
  return (
    <article>
      {awesome ? (
        <h1>React is awesome!</h1>
      ) : (
        <h1>Oh no 😢</h1>
      )};
    </article>
}
```

当然你也可以让两个分支完全分开，然后通过提前返回代替选择。

```jsx
export default function Awesome({ awesome }) {
  if (!awesome) {
    return (
      <article>
        <h1>Oh no 😢</h1>
      </article>
    );
  }

  return (
    <article>
      <h1>React is awesome!</h1>
    </article>
  );
}
```

### 列表渲染
React可选项：`Array.map`

Vue使用`v-for`指令遍历数组和对象。


```jsx
<template>
  <ul>
    <li v-for="(ingredient, index) in ingredients" :key="index">
      {{ ingredient }}
    </li>
  </ul>
</template>

<script>
export default {
  props: ['ingredients']
};
</script>
```

在React中，你可以通过内建的`Array.map`函数将数组映射成元素集合。

```jsx
export default function Recipe({ ingredients }) {
  return (
    <ul>
      {ingredients.map((ingredient, index) => (
        <li key={index}>{ingredient}</li>
      ))}
    </ul>
  );
}
```
对象的迭代则需要一点技巧。Vue允许你同样使用`v-for`指令获取key和value。


```jsx
<template>
  <ul>
    <li v-for="(value, key) in object" :key="key">
      {{ key }}: {{ value }}
    </li>
  </ul>
</template>

<script>
export default {
  props: ['object'] // E.g. { a: 'Foo', b: 'Bar' }
};
</script>
```
在React中我喜欢使用内建的`Object.entries`函数迭代对象。

```jsx
export default function KeyValueList({ object }) {
  return (
    <ul>
      {Object.entries(object).map(([key, value]) => (
        <li key={key}>{value}</li>
      ))}
    </ul>
  );
}
```

### 类和样式绑定
React可选项：手动传递属性。

Vue自动将`class`和`style`属性绑定到组件的外层HTML元素上。


```jsx
<!-- Post.vue -->

<template>
  <article>
    <h1>{{ title }}</h1>
  </article>
</template>

<script>
export default {
  props: ['title'],
};
</script>

<!--
<post
  :title="About CSS"
  class="margin-bottom"
  style="color: red"
/>
-->
```
在React中，你需要手动传入`className`和`style`属性。注意，`style`的值必须是一个对象类型，不支持字符串。

```jsx
export default function Post({ title, className, style }) {
  return (
    <article className={className} style={style}>
      {title}
    </article>
  );
}

{/* <Post
  title="About CSS"
  className="margin-bottom"
  style={{ color: 'red' }}
/> */}
```
如果想要传递（除了title以外）剩余的全部属性，展开运算符就派上用场了。

```jsx
export default function Post({ title, ...props }) {
  return (
    <article {...props}>
      {title}
    </article>
  );
}
```
如果你怀念Vue出色的`class`API，可以看看Jed Watson写的[classnames](https://github.com/JedWatson/classnames)扩展库

## 属性
React可选项： 属性

属性的行为在React和Vue中几乎完全一样，唯一的不同就是React组件不会继承未知的属性。


```jsx
<!-- Post.vue -->

<template>
  <h1>{{ title }}</h1>
</template>

<script>
export default {
  props: ['title'],
};
</script>
```


```jsx
export default function Post({ title }) {
  return <h3>{title}</h3>;
}
```
Vue使用一个`:`前缀来传递属性变量，本质是`v-bind`指令的别名。React则使用花括号动态传递变量值。


```jsx
<!-- Post.vue -->

<template>
  <post-title :title="title" />
</template>

<script>
export default {
  props: ['title'],
};
</script>
```


```jsx
export default function Post({ title }) {
  return <PostTitle title={title} />;
}
```

## 数据
React可选项：`useState`钩子。

Vue的`data`选项用于存储组件内部的状态值。


```jsx
<!-- ButtonCounter.vue -->

<template>
  <button @click="count++">
    You clicked me {{ count }} times.
  </button>
</template>

<script>
export default {
  data() {
    return {
      count: 0
    }
  }
};
</script>
```
React通过暴露`useState`钩子返回一个长度为2的数组，其中包含了当前状态值和用于更新状态值的setter函数。

```jsx
import { useState } from 'react';

export default function ButtonCounter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      {count}
    </button>
  );
}
```
也可以根据个人喜好，选择在多个`useState`调用间分发状态或者全部在一个对象中进行。

```jsx
import { useState } from 'react';

export default function ProfileForm() {
  const [name, setName] = useState('Sebastian');
  const [email, setEmail] = useState('sebastian@spatie.be');

  // ...
}
```


```jsx
import { useState } from 'react';

export default function ProfileForm() {
  const [values, setValues] = useState({
    name: 'Sebastian',
    email: 'sebastian@spatie.be'
  });

  // ...
}
```

### v-model
`v-model`是Vue的一个快捷指令，可以在传递`value`属性的同时监听`input`事件。这样让Vue看起来似乎拥有了两种值绑定的方式，但实际上在底层依旧是“属性单向传递，事件触发更新”。


```jsx
<!-- Profile.vue -->

<template>
  <input type="text" v-model="name" />
</template>

<script>
export default {
  data() {
    return {
      name: 'Sebastian'
    }
  }
};
</script>
```
Vue对`v-model`指令扩展了以下用法：


```jsx
<template>
  <input
    type="text"
    :value="name"
    @input="name = $event.target.value"
  />
</template>
```

而React没有与之对等的指令。你必须每次都明确指定：

```jsx
import { useState } from 'react';

export default function Profile() {
  const [name, setName] = useState('Sebastian');

  return (
    <input
      type="text"
      value={name}
      onChange={event => setName(event.target.name)}
    />
  );
}
```

## 计算属性
React可选项：变量，选择性包裹在`useMemo`中。

Vue使用计算属性的理由有两个：避免逻辑和标记语言的混合使用，以及在一个组件实例中缓存需要进行复杂计算的属性值。

不使用计算属性的情况下：


```jsx
<!-- ReversedMessage.vue -->

<template>
  <p>{{ message.split('').reverse().join('') }}</p>
</template>

<script>
export default {
  props: ['message']
};
</script>
```


```jsx
export default function ReversedMessage({ message }) {
  return <p>{message.split('').reverse().join('')}</p>;
}
```

在React中，你可以通过将计算属性结果赋予一个变量的方式在模板里取值。


```jsx
<!-- ReversedMessage.vue -->

<template>
  <p>{{ reversedMessage }}</p>
</template>

<script>
export default {
  props: ['message'],

  computed: {
    reversedMessage() {
      return this.message.split('').reverse().join('');
    }
  }
};
</script>
```


```jsx
export default function ReversedMessage({ message }) {
  const reversedMessage = message.split('').reverse().join('');

  return <p>{reversedMessage}</p>;
}
```
出于对性能的考虑，计算属性可以包裹在一个`useMemo`钩子中。`useMemo`要求一个返回计算结果的闭包回调函数，以及一个依赖变量数组。

在下面的例子中，`reversedMessage`仅当依赖的`message`发生了改变才会重新进行计算。

```jsx
import { useMemo } from 'react';

export default function ReversedMessage({ message }) {
  const reversedMessage = useMemo(() => {
    return message.split('').reverse().join('');
  }, [message]);

  return <p>{reversedMessage}</p>;
}
```

## 方法
React可选项：函数。

Vue具有一个`methods`选项，用来声明可在组件中使用的方法。


```jsx
<!-- ImportantButton.vue -->

<template>
  <button onClick="doSomething">
    Do something!
  </button>
</template>

<script>
export default {
  methods: {
    doSomething() {
      // ...
    }
  }
};
</script>
```

在React中，你可以直接在组件内部声明普通函数。

```jsx
export default function ImportantButton() {
  function doSomething() {
    // ...
  }

  return (
    <button onClick={doSomething}>
      Do something!
    </button>
  );
}
```

## 事件
React可选项：回调属性。

事件本质上就是一系列在子组件发生变化时所调用的回调函数。Vue将事件视为一等公民，所以你可以通过`@`来进行监听，这是`v-on`指令的缩写。


```jsx
<!-- PostForm.vue -->

<template>
  <form>
    <button type="button" @click="$emit('save')">
      Save
    </button>
    <button type="button" @click="$emit('publish')">
      Publish
    </button>
  </form>
</template>
```

事件在React里不具备特殊的地位，就仅仅是一些被子组件所调用的回调属性。

```jsx
export default function PostForm({ onSave, onPublish }) {
  return (
    <form>
      <button type="button" onClick={onSave}>
        Save
      </button>
      <button type="button" onClick={onPublish}>
        Publish
      </button>
    </form>
  );
}
```
### 事件修饰符
React可选项：高阶函数，如果有那个必要的话。

Vue拥有一些诸如`prevent`和`stop`等等的修饰符，用于在不接触事件处理句柄的情况下更改其处理方式。


```jsx
<!-- AjaxForm.vue -->

<template>
  <form @submit.prevent="submitWithAjax">
    <!-- ... -->
  </form>
</template>

<script>
export default {
  methods: {
    submitWithAjax() {
      // ...
    }
  }
};
</script>
```
React里并没有这类修饰符语法。阻止默认行为以及阻断事件传播主要就在回调属性中进行处理。

```jsx
export default function AjaxForm() {
  function submitWithAjax(event) {
    event.preventDefault();
    // ...
  }

  return (
    <form onSubmit={submitWithAjax}>
      {/* ... */}
    </form>
  );
}
```

如果你实在想要使用修饰符一类的功能，你可以使用高阶函数来代替。

```jsx
function prevent(callback) {
  return (event) => {
      event.preventDefault();
      callback(event);
  };
}

export default function AjaxForm() {
  function submitWithAjax(event) {
    // ...
  }

  return (
    <form onSubmit={prevent(submitWithAjax)}>
      {/* ... */}
    </form>
  );
}
```

## 生命周期方法
React可选项：`useEffect`钩子。

> 免责声明
>
> 对于类组件来说，React和Vue在处理组件生命周期的情况下具有非常相似的API。而使用钩子情况下，`useEffect`可以解决绝大部分生命周期相关的问题。然而Effects和生命周期方法是两种截然不同的范式，所以他们很难拿来比较。因此，本小节仅限于几个实践案例，了解Effects需要阅读其更详细的说明文章。

一个常见的例子是安装和卸载第三方库文件。


```jsx
<template>
  <input type="text" ref="input" />
</template>

<script>
import DateTimePicker from 'awesome-date-time-picker';

export default {
  mounted() {
   this.dateTimePickerInstance =
     new DateTimePicker(this.$refs.input);
  },

  beforeDestroy() {
    this.dateTimePickerInstance.destroy();
  }
};
</script>
```

通过`useEffect`你可以声明一个需要在渲染完成后运行的“副作用”。当你在`useEffect`中返回一个回调函数时，它将会在Effect被清除时参与其中。在这个例子里，就是当组件被销毁时。

```jsx
import { useEffect, useRef } from 'react';
import DateTimePicker from 'awesome-date-time-picker';

export default function Component() {
  const dateTimePickerRef = useRef();

  useEffect(() => {
    const dateTimePickerInstance =
      new DateTimePicker(dateTimePickerRef.current);

    return () => {
      dateTimePickerInstance.destroy();
    };
  }, []);

  return <input type="text" ref={dateTimePickerRef} />;
}
```

这看起来就像Vue组件在`mounted`中注册一个`beforeDestroy`监听器。


```jsx
<script>
export default {
  mounted() {
    const dateTimePicker =
      new DateTimePicker(this.$refs.input);

    this.$once('hook:beforeDestroy', () => {
      dateTimePicker.destroy();
    });
  }
};
</script>
```

类似于`useMemo`，`useEffect`接受一个依赖数组作为第二参数。

如果没有指定任何依赖，effect将会在每次渲染后执行，并在下一次渲染之前进行清除。这样有点像`mounted`、`updated`、`beforeUpdate`和`beforeDestroy`的组合。

```jsx
useEffect(() => {
    // Happens after every render

    return () => {
        // Optional; clean up before next render
    };
});
```

如果你明确指定了effect没有任何依赖，那么effect只会在组件的第一次渲染时执行。因为它没有任何原因驱动更新。这个则类似于`mounted`和`beforeDestroyed`的组合。

```jsx
useEffect(() => {
    // Happens on mount

    return () => {
        // Optional; clean up before unmount
    };
}, []);
```

如果你指定了某些依赖，那么effect就只会在这些依赖变化时执行——将在监视器这一小节继续说明。

```jsx
const [count, setCount] = useState(0);

useEffect(() => {
    // Happens when `count` changes

    return () => {
        // Optional; clean up when `count` changed
    };
}, [count]);
```

强行把生命周期钩子和`useEffect`调用进行一一对应不是一个好主意。最好重新将事情考虑为一组进行声明的副作用。何时需要调用effect是一个在实现时考虑的细节。

就像Ryan Florence总结的那样：

> 问题不在于“effect什么时候执行”，而是“effect需要与哪些状态进行同步”。

```
useEffect(fn) // 所有状态

useEffect(fn, []) // 无状态

useEffect(fn, [these, states])
```
[@ryanflorence on Twitter](https://twitter.com/ryanflorence/status/1125041041063665666)

## 监视器
React可选项：`useEffect`钩子。

监视器在概念上类似于生命周期钩子：“当X发生时，执行Y”。React中并不存在监视器，但你仍然可以用`useEffect`达到同样的效果。


```jsx
<!-- AjaxToggle.vue -->

<template>
  <input type="checkbox" v-model="checked" />
</template>

<script>
export default {
  data() {
    return {
      checked: false
    }
  },

  watch: {
    checked(checked) {
      syncWithServer(checked);
    }
  },

  methods: {
    syncWithServer(checked) {
      // ...
    }
  }
};
</script>
```


```jsx
import { useEffect, useState } from 'react';

export default function AjaxToggle() {
  const [checked, setChecked] = useState(false);

  function syncWithServer(checked) {
    // ...
  }

  useEffect(() => {
    syncWithServer(checked);
  }, [checked]);

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => setChecked(!checked)}
    />
  );
}
```

注意，`useEffect`也会在第一次渲染后执行。这等同于在Vue监视器中使用`immediate`参数。

如果你不想在第一次渲染后执行，那么你需要创建一个`ref`用来存储第一次渲染发生与否。


```jsx
import { useEffect, useRef, useState } from 'react';

export default function AjaxToggle() {
  const [checked, setChecked] = useState(false);
  const firstRender = useRef(true);

  function syncWithServer(checked) {
    // ...
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    syncWithServer(checked);
  }, [checked]);

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => setChecked(!checked)}
    />
  );
}
```

## 插槽和作用域插槽
React可选：JSX属性或渲染属性

如果你将一个模板渲染在一个组件的开标签和闭标签之间，React会将它作为`children`属性变量传递。

在React中你需要声明一个`<slot />`告知内容应该属于哪里。而React只需要你渲染`children`属性。


```jsx
<!-- RedParagraph.vue -->

<template>
  <p style="color: red">
    <slot />
  </p>
</template>
```


```jsx
export default function RedParagraph({ children }) {
  return (
    <p style={{ color: 'red' }}>
      {children}
    </p>
  );
}
```

由于`slots`只是一些React的属性值，因此我们不需要在模板中进行任何声明。我们只需要用JSX语法接收属性变量，然后将它渲染在我们需要的任何时候任何地点。


```jsx
<!-- Layout.vue -->

<template>
  <div class="flex">
    <section class="w-1/3">
        <slot name="sidebar" />
    </section>
    <main class="flex-1">
        <slot />
    </main>
  </div>
</template>

<!-- In use: -->

<layout>
  <template #sidebar>
    <nav>...</nav>
  </template>
  <template #default>
    <post>...</post>
  </template>
</layout>
```


```jsx
export default function RedParagraph({ sidebar, children }) {
  return (
    <div className="flex">
      <section className="w-1/3">
        {sidebar}
      </section>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}

// In use:

return (
  <Layout sidebar={<nav>...</nav>}>
    <Post>...</Post>
  </Layout>
);
```

Vue拥有的作用域插槽可以将数据传递给对应的插槽进行渲染。作用域插槽的关键部分将会被渲染。

常规的插槽在被传递给父组件之前就进行了渲染。而父组件则决定如何处理这个渲染片段。

作用域插槽无法在父组件之前进行渲染，因为要依赖一些从父组件传递过来的数据。换言之，作用域插槽就是惰性求值的插槽。

惰性求值在JavaScript中要简单得很多：将其包裹在一个函数中，在需要的时候调用它。如果你在React中需要作用域插槽，传递一个在调用时会返回渲染模板的函数就可以。

对于作用域插槽，我们可以再次使用`children`或者任何传递给具名插槽的的属性。但是我们通过传递一个函数来代替声明一个模板。


```jsx
<!-- CurrentUser.vue -->

<template>
  <span>
    <slot :user="user" />
  </span>
</template>

<script>
export default {
  inject: ['user']
};
</script>

<!-- In use: -->

<template>
  <current-user>
    <template #default="{ user }">
      {{ user.firstName }}
    </template>
  </current-user>
</template>
```


```jsx
import { useContext } from 'react';
import UserContext from './UserContext';

export default function CurrentUser({ children }) {
  const { user } = useContext(UserContext);

  return (
    <span>
      {children(user)}
    </span>
  );
}

// In use:

return (
  <CurrentUser>
    {user => user.firstName}
  </CurrentUser>
);
```

## 依赖注入
React可选项：`createContext`和`useContext`钩子。

依赖注入允许一个组件和其子树共享状态。React中有相似的特性叫做上下文(context)。


```jsx
<!-- MyProvider.vue -->

<template>
  <div><slot /></div>
</template>

<script>
export default {
  provide: {
    foo: 'bar'
  },
};
</script>

<!-- Must be rendered inside a MyProvider instance: -->

<template>
  <p>{{ foo }}</p>
</template>

<script>
export default {
  inject: ['foo']
};
</script>
```


```jsx
import { createContext, useContext } from 'react';

const fooContext = createContext('foo');

function MyProvider({ children }) {
  return (
    <FooContext.Provider value="foo">
      {children}
    </FooContext.Provider>
  );
}

// Must be rendered inside a MyProvider instance:

function MyConsumer() {
  const foo = useContext(FooContext);

  return <p>{foo}</p>;
}
```

## 自定义指令
React可选项：组件。

React中不存在指令，然而大部分指令能解决的问题都可以用组件来代替解决。


```jsx
<div v-tooltip="Hello!">
  <p>...</p>
</div>
```


```jsx
return (
  <Tooltip text="Hello">
    <div>
      <p>...</p>
    </div>
  </Tooltip>
);
```

## 过渡动画
React可选：第三方库。

React没有任何内置的过渡动画工具。如果你在寻找类似于Vue中、实际不制作任何动画而使用类编排动画的工具，可以看看[react-transition-group](https://github.com/reactjs/react-transition-group)。

如果你想要一个承担更重任务的库，可以看看[Pose](https://popmotion.io/pose/)。


