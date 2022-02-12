import { defineComponent } from 'vue'
import { useThemeLocaleData } from '../utils'
import { useSiteLocaleData } from '@vuepress/client'

export default defineComponent({
  setup() {
    const year = new Date().getFullYear()
    const data = useThemeLocaleData().value
    const siteData = useSiteLocaleData().value
    return () => (
      <footer class="footer">
        <span class="typography-thin">
          { siteData.title } © { data.startDate }-{ year } { data.copyright === undefined ? (<span />) : (<>| <span v-html={ data.copyright } /></>) } | Powerd by <a href="https://v2.vuepress.vuejs.org">Vuepress</a> <a href="https://github.com/yuchanns/yuchanns">Theme Yuchanns</a>
        </span>
      </footer>
    )
  }
})
