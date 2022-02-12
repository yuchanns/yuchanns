import { defineComponent } from 'vue'
import { Content } from '@vuepress/client'
import Header from '../components/header'
import Footer from '../components/footer'
import RootFoot from '../components/rootFoot'
import '../styles/main.scss'

export default defineComponent({
  setup() {
    return () => (
      <div class="wrapper">
        <Header />
        <main>
          <article>
            <section>
              <Content />
            </section>
          </article>
        </main>
        <Footer />
        <RootFoot />
      </div>
    )
  }
})
