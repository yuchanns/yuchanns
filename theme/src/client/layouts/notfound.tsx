import { defineComponent } from 'vue'
import Header from '../components/header'
import Footer from '../components/rootFoot'
import '../styles/main.scss'

export default defineComponent({
  setup() {
    return () => (
      <div class="wrapper">
        <Header />
        <main>
          <h1>Not Found</h1>
          <p>You just hit a route that doesn't exist... the sadness.</p>
        </main>
        <Footer />
      </div>
    )
  }
})
