---
title: PHPACTOR LSP 流程分析
---
[[文章索引|posts]]

## 启动

使用 `phpactor language-server -vvv` 启动 LSP 服务。

* `bin/phpactor`
* 实例化 `Phpactor/Application`
* `parent::run()`
* 读取参数 `language-server -vvv`
* ``$application->doRun()``
* ``$application->initialize()``
* `Phpactor::boot()`
* `PhpactorContainer::register()` 注册 `LanguageServerExtension` 扩展
* `LanguageServerExtension::load()`
* `LanguageServerExtension::registerCommand()`
* 注册 `Phpactor\Extension\LanguageServer\Command\StartCommand` 实例
* `$application->doRunCommand()`
* `$command->run()`
* `$command->execute()`
* 构建 `Phpactor\LanguageServer\Core\LanguageServer 实例`
* `$server->run()`

启动了 **Amp** 框架搭建的 Language Server 并异步监听和处理进来的连接。

## 请求分发
在构建 `Phpactor\LanguageServer\Core\LanguageServer`
实例时，聚合了事件分发服务：
* ServiceListener (注入 DiagnosticService)
* WorkspaceListener (注入 Workspace)
* DidChangeWatchedFilesListener
* DiagnosticService

注册了 **Handler**:
* TextDocument
* Stats
* Service
* Command
* DidChangeWatchedFiles
* CodeAction
* Exit

并将 Handler 包装成 HandlerMethodRunner 注册到分发中间件实例 `Phpactor\LanguageServer\Core\Dispatcher\Dispatcher\MiddlewareDispatcher`

首次接收请求时将初始化参数保存，然后开始监听请求并进行分发。
