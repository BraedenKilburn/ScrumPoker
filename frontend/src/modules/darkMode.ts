export function keepDarkTheme() {
  const html = document.querySelector("html");
  if (!html) return;

  html.classList.add("p-dark");
  localStorage.removeItem("theme");
}
