<script setup lang="ts">
import { appDescription, appName } from '~/constants'

const dashboardRoute = useRouter().getRoutes().find(route => route.name === 'discord-slash-commands')
</script>

<template>
  <main>
    <h1>{{ appName }}</h1>
    <p>{{ appDescription }}</p>
    <NuxtLink v-if="dashboardRoute" :to="dashboardRoute.path">
      commands
    </NuxtLink>
  </main>
</template>
