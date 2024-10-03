<script setup lang="ts">
import { ref } from 'vue'

import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const points = ref([
  { point: 3, description: 'A few hours', complexity: 'A task that takes a few hours' },
  { point: 5, description: 'About a day', complexity: 'A task that takes about a day' },
  { point: 8, description: 'A few days', complexity: 'A task that takes a few days' },
  { point: 13, description: 'About a week', complexity: 'A task that takes about a week' },
  { point: 21, description: 'A couple weeks', complexity: 'A task that takes a couple weeks' },
  {
    point: 40,
    description: 'More than a couple weeks',
    complexity: 'A task that takes more than a sprint'
  },
  { point: '?', description: 'Unknown', complexity: 'Unable to provide a meaningful estimate' }
])
</script>

<template>
  <Accordion :value="null">
    <AccordionPanel>
      <AccordionHeader>Point Breakdown</AccordionHeader>
      <AccordionContent>
        <DataTable :value="points">
          <Column field="point" header="Point"></Column>
          <Column field="description" header="Description"></Column>
          <Column field="complexity" header="Complexity"></Column>
        </DataTable>
      </AccordionContent>
    </AccordionPanel>
  </Accordion>
</template>

<style scoped lang="scss">
.p-accordion {
  width: 100%;
}
</style>
