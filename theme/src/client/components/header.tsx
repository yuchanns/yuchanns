import { defineComponent } from 'vue'
import ToggleTheme from './toggleTheme'
import { useThemeLocaleData } from '../utils'
import { useSiteLocaleData, RouterLink } from '@vuepress/client'
import { isRelativeURL } from '../utils'

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
          { data.nav.map(item => isRelativeURL(item.link) ?
              <RouterLink to={ item.link }>{ item.name }</RouterLink> :
              <a href={ item.link }>{ item.name }</a>
          )}
          <ToggleTheme />
        </div>
      </header>
    )
  }
})