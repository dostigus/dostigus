<template>
  <button
    type="button"
    class="logout"
    :disabled="busy"
    @click="logout"
  >
    {{ busy ? 'Signing out…' : 'Log out' }}
  </button>
</template>

<script setup lang="ts">
const { clear } = useUserSession()
const busy = ref(false)

async function logout() {
  if (busy.value) {
    return
  }
  busy.value = true
  try {
    await clear()
    await navigateTo('/login')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.logout {
  appearance: none;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text-muted);
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.logout:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--accent);
}

.logout:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
