import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "@/App.vue";
import router from "@/router";
import { prefetchRoomViews } from "@/router/routes";
import { bootAppearance } from "@/composables/useAppearance";

import PrimeVue from "primevue/config";
import Lara from "@primeuix/themes/lara";
// Self-hosted Open Sans. Deliberately not <link rel="preload">ed: under real
// slow-4G throttling each preloaded face delayed first paint ~270ms by
// competing with the entry bundle, which this SPA needs before it paints at
// all; `font-display: swap` already keeps text visible meanwhile.
import "@fontsource-variable/open-sans/wght.css";
import "@fontsource-variable/open-sans/wght-italic.css";
import Card from "primevue/card";
import FloatLabel from "primevue/floatlabel";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Tag from "primevue/tag";
import ToastService from "primevue/toastservice";
import Dialog from "primevue/dialog";

import "@/assets/base.css";

// Appearance lives for the app's lifetime, not a room session: boot it once here.
bootAppearance();

const app = createApp(App);
app.use(router);

const pinia = createPinia();
app.use(pinia);

app.use(PrimeVue, {
  license: import.meta.env.VITE_PRIMEVUE_LICENSE_KEY,
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
prefetchRoomViews();
