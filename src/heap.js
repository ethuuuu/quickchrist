// Binary min-heap. push(key, val) adds; pop() returns { key, val } with the
// smallest key, or undefined when empty. Keys and values live in two parallel
// arrays so no object is created per push.
export class MinHeap {
  constructor() {
    this.keys = [];
    this.vals = [];
  }

  get size() {
    return this.keys.length;
  }

  push(key, val) {
    const k = this.keys;
    const v = this.vals;
    let i = k.length;
    k.push(key);
    v.push(val);
    // Sift up: move the new item toward the root while it is smaller than its parent.
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (k[parent] <= key) break;
      k[i] = k[parent];
      v[i] = v[parent];
      i = parent;
    }
    k[i] = key;
    v[i] = val;
  }

  pop() {
    const k = this.keys;
    const v = this.vals;
    if (k.length === 0) return undefined;
    const top = { key: k[0], val: v[0] };
    const lastKey = k.pop();
    const lastVal = v.pop();
    const n = k.length;
    if (n > 0) {
      // Sift down: put the last item at the root, then move it down past smaller children.
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && k[child + 1] < k[child]) child++;
        if (k[child] >= lastKey) break;
        k[i] = k[child];
        v[i] = v[child];
        i = child;
      }
      k[i] = lastKey;
      v[i] = lastVal;
    }
    return top;
  }
}
