import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";

// Tracks whether a scrollable element has content hidden above or below the
// fold, for pairing with `.scroll-fade` edge gradients. Wire `update` to the
// element's scroll event; size changes are observed automatically, but content
// changes need an `update()` from the owner (e.g. a watcher on list length).
export function useScrollFades(el: Readonly<Ref<HTMLElement | null>>) {
  const moreAbove = ref(false);
  const moreBelow = ref(false);

  function update() {
    const node = el.value;
    moreAbove.value = !!node && node.scrollTop > 1;
    moreBelow.value = !!node && node.scrollTop + node.clientHeight < node.scrollHeight - 1;
  }

  let observer: ResizeObserver | undefined;
  onMounted(() => {
    observer = new ResizeObserver(update);
    if (el.value) observer.observe(el.value);
    update();
  });
  // The element can appear/disappear behind a v-if after mount.
  watch(el, (node) => {
    observer?.disconnect();
    if (node) observer?.observe(node);
    nextTick(update);
  });
  onBeforeUnmount(() => observer?.disconnect());

  return { moreAbove, moreBelow, update };
}
