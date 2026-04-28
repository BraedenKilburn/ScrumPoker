<script setup lang="ts">
import packageJson from "../../package.json";
</script>

<template>
  <footer>
    <span>Created by Braeden Kilburn</span>
    <span class="meta">
      v{{ packageJson.version }}
      <span aria-hidden="true">.</span>
      <a href="https://github.com/BraedenKilburn/ScrumPoker" target="_blank" rel="noopener">
        open source
      </a>
    </span>
  </footer>
</template>

<style scoped lang="scss">
footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: var(--footer-height);
  padding: 0 1rem;
  border-top: 1px solid var(--p-content-border-color);
  color: var(--p-text-muted-color);
  font-size: 0.82rem;

  .meta {
    display: inline-flex;
    align-items: center;
    gap: 0.7rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  a {
    color: inherit;
  }
}
</style>
