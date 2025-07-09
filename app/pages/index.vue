<script setup lang="ts">
import { appDescription, appName } from '~/constants'
</script>

<template>
  <main>
    <h1>{{ appName }}</h1>
    <p>{{ appDescription }}</p>
    <NuxtLink to="/discord/slash-commands">
      commands
    </NuxtLink>
  </main>
</template>
