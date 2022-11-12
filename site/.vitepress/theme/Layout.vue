<script setup>
import DefaultTheme from 'vitepress/theme'
import { BacklinkReferences } from './plugins/zettelkasten/components'
import { useData } from 'vitepress'
const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-footer-before>
        <BacklinkReferences />
    </template>
  </Layout>
</template>
