<template>
  <div class="shell">
    <header class="top">
      <HostMark />
    </header>
    <main class="stage">
      <div class="card">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.top {
  padding: 1.15rem 1.4rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.stage {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2.25rem 1.4rem 3rem;
}

.card {
  width: min(26rem, 100%);
  padding: 1.7rem 1.5rem 1.6rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}
</style>
