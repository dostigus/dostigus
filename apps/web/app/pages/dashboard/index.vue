<template>
  <div class="overview">
    <header class="head">
      <h1>{{ $t('dashboard.overview.title') }}</h1>
      <p>{{ $t('dashboard.overview.lead') }}</p>
    </header>
    <p class="stub">
      {{ $t('dashboard.overview.stub') }}
    </p>
  </div>
</template>

<style scoped>
.overview {
  max-width: 34rem;
}

.head h1 {
  margin: 0 0 0.35rem;
  font-size: 1.45rem;
}

.head p,
.stub {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}

.stub {
  margin-top: 1.25rem;
  padding: 1.5rem 1.45rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--card);
}
</style>
