import { createApp } from 'vue'
import App from '@/App.vue'
import router from '@/router'

import PrimeVue from 'primevue/config'
import 'primevue/resources/themes/lara-dark-green/theme.css'
import 'primeicons/primeicons.css'

import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import ToastService from 'primevue/toastservice'
import Dialog from 'primevue/dialog';

import { createSocketIo } from '@/modules/socket'
import '@/assets/main.scss'

const app = createApp(App)
app.use(router)

app.use(PrimeVue)
app.use(ToastService)
app.component('FloatLabel', FloatLabel)
app.component('InputText', InputText)
app.component('VButton', Button)
app.component('VDialog', Dialog)

const socket = createSocketIo()
app.provide('socket', socket)

app.mount('#app')
