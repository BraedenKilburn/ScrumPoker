import { ref } from 'vue'

/**
 * Is the current theme dark?
 */
export const isDarkMode = ref(false)

/**
 * Set the 'p-dark' class name on the html element.
 */
function setClassName(themeName: string) {
  const html = document.querySelector('html')
  if (!html) return

  html.classList.toggle('p-dark', themeName === 'theme-dark')
}

/**
 * Set the theme and save it in localStorage.
 */
export function setTheme(themeName: string) {
  isDarkMode.value = themeName === 'theme-dark'
  localStorage.setItem('theme', themeName)
  setClassName(themeName)
}

/**
 * Keep the theme when the user refreshes the page.
 * First, check if the user has a theme saved in localStorage.
 * If not, check if the user prefers light mode.
 */
export function keepTheme() {
  const theme = localStorage.getItem('theme')
  if (theme) {
    setTheme(theme)
    return
  }

  const prefersLightTheme = window.matchMedia('(prefers-color-scheme: light)')
  if (prefersLightTheme.matches) {
    setTheme('theme-light')
    return
  }

  setTheme('theme-dark')
}
