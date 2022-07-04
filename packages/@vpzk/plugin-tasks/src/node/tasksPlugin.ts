import type { Plugin, PluginObject } from '@vuepress/core'
import tasks from '@hedgedoc/markdown-it-task-lists'

export interface tasksOptions {
    enabled: boolean
    lineNumber: boolean
    label: boolean
    labelAfter: boolean
}

export const tasksPlugin = (opts: tasksOptions): Plugin => {
    const plugin: PluginObject = {
        name: '@vpzk/plugin-tasks'
    }

    plugin.extendsMarkdown = (md) => {
        md.use(tasks, opts)
    }

    return plugin
}