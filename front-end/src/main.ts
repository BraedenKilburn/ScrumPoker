import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import router from '@/router'

import PrimeVue from 'primevue/config'
import Lara from '@primevue/themes/lara'
import 'primeicons/primeicons.css'

import Card from 'primevue/card'
import FloatLabel from 'primevue/floatlabel'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ToastService from 'primevue/toastservice'
import Dialog from 'primevue/dialog'

import VueGtag from 'vue-gtag'

import '@/assets/main.scss'

const app = createApp(App)
app.use(router)

app.use(
  VueGtag,
  {
    config: { id: import.meta.env.VITE_GTAG_ID }
  },
  router
)

const pinia = createPinia()
app.use(pinia)

app.use(PrimeVue, {
  theme: {
    preset: Lara,
    options: {
      darkModeSelector: '.p-dark'
    }
  }
})
app.use(ToastService)
app.component('FloatLabel', FloatLabel)
app.component('InputText', InputText)
app.component('VButton', Button)
app.component('VCard', Card)
app.component('VDialog', Dialog)

app.mount('#app')
