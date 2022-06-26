<script setup>
import ParentLayout from '@vuepress/theme-default/lib/client/layouts/Layout.vue'
import { BacklinkReferences } from '@vpzk/plugin-zettelkasten/lib/client/components/references'
import { usePageData } from '@vuepress/client'

const key = usePageData().value.key
</script>

<template>
  <ParentLayout>
    <template #page-content-bottom>
    <BacklinkReferences key={key} />
    </template>
  </ParentLayout>
</template>

