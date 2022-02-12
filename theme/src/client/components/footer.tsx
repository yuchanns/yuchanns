import { defineComponent } from 'vue'
import Github from './socials/github'
import Twitter from './socials/twitter'
import { useThemeLocaleData } from '../utils'
import { useSiteLocaleData } from '@vuepress/client'

export default defineComponent({
  setup() {
    const data = useThemeLocaleData().value
    const siteData = useSiteLocaleData().value
    return () => (
      <>
        <hr style="margin-bottom: 1.625rem;" />
        <footer>
          <div class="single-footer-grid-root">
            <div class="single-footer-grid single-footer-grid-item">
              <div class="single-footer-grid-container">
                <div class="single-footer-grid-avatar">
                  <img class="avatar-img" src={ data.avatar } alt={ data.name } />
                </div>
              </div>
              <div class="single-footer-grid-container">
                <h5 class="single-title">{ data.name }</h5>
              </div>
            </div>
            <div class="single-footer-grid-label single-footer-grid-item">
              <div class="single-footer-grid-label-container">
                <p class="typography-label">{ siteData.description }</p>
                <p class="typography-label-description">{ data.description }</p>
              </div>
            </div>
            <div class="single-footer-grid-social single-footer-grid-item">
              <div class="single-footer-grid-social-container">
                <Github />
                <Twitter />
              </div>
            </div>
          </div>
        </footer>
      </>
    )
  }
})
