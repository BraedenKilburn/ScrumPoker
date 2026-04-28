import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "@/App.vue";
import router from "@/router";

import PrimeVue from "primevue/config";
import Lara from "@primeuix/themes/lara";
import "primeicons/primeicons.css";
import Card from "primevue/card";
import FloatLabel from "primevue/floatlabel";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Tag from "primevue/tag";
import ToastService from "primevue/toastservice";
import Dialog from "primevue/dialog";

import "@/assets/main.scss";

const app = createApp(App);
app.use(router);

const pinia = createPinia();
app.use(pinia);

app.use(PrimeVue, {
  theme: {
    preset: Lara,
    options: {
      darkModeSelector: ".p-dark",
    },
  },
});
app.use(ToastService);

app.component("FloatLabel", FloatLabel);
app.component("InputText", InputText);
app.component("VButton", Button);
app.component("VCard", Card);
app.component("VDialog", Dialog);
app.component("VTag", Tag);

app.mount("#app");
