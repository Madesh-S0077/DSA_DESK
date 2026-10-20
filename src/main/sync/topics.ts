// Maps platform tags onto the guide's 18 topics. Earlier rules are more specific and win.

const RULES: [string, string[]][] = [
  ['Tries', ['trie']],
  ['Advanced Data Structures', ['segment-tree', 'binary-indexed-tree', 'ordered-set', 'data structures', 'fenwick']],
  ['Intervals', ['line-sweep', 'intervals']],
  ['Heap / Priority Queue', ['heap-priority-queue', 'heap', 'priority-queue']],
  ['Stack & Monotonic Stack', ['monotonic-stack', 'stack']],
  ['Queue & Monotonic Queue', ['monotonic-queue', 'queue']],
  ['Linked Lists', ['linked-list', 'doubly-linked-list']],
  ['Sliding Window', ['sliding-window']],
  ['Two Pointers', ['two-pointers', 'two pointers', 'two-pointer-algorithm']],
  ['Binary Search', ['binary-search', 'binary search', 'ternary search']],
  ['Dynamic Programming', ['dynamic-programming', 'dp', 'memoization']],
  [
    'Graphs',
    ['graph', 'graphs', 'breadth-first-search', 'depth-first-search', 'bfs', 'dfs', 'dfs and similar', 'union-find', 'dsu',
      'topological-sort', 'shortest-path', 'shortest paths', 'minimum-spanning-tree', 'flows', 'graph matchings']
  ],
  ['Trees', ['tree', 'binary-tree', 'binary-search-tree', 'trees']],
  ['Recursion & Backtracking', ['backtracking', 'recursion']],
  ['Bit Manipulation', ['bit-manipulation', 'bitmasks', 'bitmask', 'bit-magic']],
  ['Greedy', ['greedy', 'constructive algorithms']],
  ['Math & Number Theory', ['math', 'mathematical', 'number-theory', 'prime-number', 'number theory', 'combinatorics', 'probabilities', 'geometry', 'chinese remainder theorem']],
  ['Arrays & Hashing', ['array', 'arrays', 'hash-table', 'hash', 'hashing', 'prefix-sum', 'string', 'strings', 'sorting', 'sortings', 'counting', 'matrix']]
]

export function topicForTags(tags: string[]): string | null {
  const norm = new Set(tags.map((t) => t.toLowerCase().trim()))
  for (const [topic, keys] of RULES) {
    if (keys.some((k) => norm.has(k))) return topic
  }
  return null
}
