import { defineComponent } from 'vue'
import ToggleTheme from './toggleTheme'
import { useThemeLocaleData } from '../utils'
import { useSiteLocaleData, RouterLink } from '@vuepress/client'

export default defineComponent({
  setup() {
    const data = useThemeLocaleData().value
    const siteData = useSiteLocaleData().value
    return () => (
      <header class="header">
        <h4 class="site-title typography-title">
          <RouterLink to={ siteData.base } class="site-title-link">{ siteData.title }</RouterLink>
        </h4>
        <div class="spacer"></div>
        <div class="nav">
          { data.nav.map(item => <a href={ item.link }>{ item.name }</a>) }
          <ToggleTheme />
        </div>
      </header>
    )
  }
})
