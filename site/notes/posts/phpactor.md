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
* Debug
* Completion
* SignatureHelp
* Hover
* Indexer
* WorkspaceSymbol
* GotoDefinition
* GotoImplementation
* Highlight
* References
* TypeDefinition
* FileRename
* Rename
* Selection
* DocumentSymbol
* TextDocument
* Stats
* Service
* CommandHelper
* DidChangeWatchedFiles
* CodeAction
* Exit

并将 Handler 包装成 HandlerMethodRunner 注册到分发中间件实例 `Phpactor\LanguageServer\Core\Dispatcher\Dispatcher\MiddlewareDispatcher`

包括 `HandlerMiddleware($runner)` 和 `CancellationMiddleware($runner)`

首次接收请求时将初始化参数保存、注册能力(`Phpactor/LanguageServerProtocol/ServerCapabilities`)并进行索引建立(Indexer)，然后开始监听请求并进行分发。

### Indexer
调用时机：Initialized 和 文件更新。

根据初始化时获取到的项目根路径，对路径的文件使用生成器进行遍历，并解析建立生成
AST 目录。 保存到 `~/.cache/phpactor` 下
