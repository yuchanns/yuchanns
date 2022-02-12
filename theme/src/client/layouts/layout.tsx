import { defineComponent } from 'vue'
import { Content, ClientOnly } from '@vuepress/client'
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
              <ClientOnly><Content /></ClientOnly>
            </section>
          </article>
        </main>
        <Footer />
        <RootFoot />
      </div>
    )
  }
})
