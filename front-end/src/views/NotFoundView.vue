<template>
  <main>
    <VCard class="not-found-card">
      <template #title>
        <h1>404 Not Found</h1>
      </template>
      <template #content>
        <p>Sorry, the page you are looking for does not exist.</p>
      </template>
      <template #footer>
        <VButton label="Return to Home" as="router-link" to="/" />
      </template>
    </VCard>
  </main>
</template>

<style scoped lang="scss">
main {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>

<style lang="scss">
.not-found-card {
  width: 90vw;
  text-align: center;
  padding: 1rem;

  h1 {
    margin: 0;
  }

  a {
    width: 100%;
  }

  @media (min-width: 768px) {
    width: 50vw;
  }
}
</style>
