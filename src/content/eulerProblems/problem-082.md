---
problemNumber: 82
title: 'Path Sum: Three Ways'
difficulty: 20
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler82.java'
---

## The problem

In the same 80×80 grid, find the smallest path sum from any cell in the left column to any cell in the right column, now allowing moves up, down and right.

## My solution

This reuses the queue-based shortest-path search from problem 81. Each `Node` now has `up`, `down` and `right` links. A node's distance is relaxed through each of them, and a neighbour goes back on the FIFO queue whenever its distance improves.

To allow any starting cell, I run the search once from each of the 80 left-column cells, seeding that cell's distance with its own value:

```java
for(int i = 0; i < length; i++) {
  pattern[i][0].distance = pattern[i][0].value;
  setDistance(pattern[i][0]);
}
```

Distances aren't reset between runs. Each run starts from what earlier runs found and can only lower it, so after the last run every cell holds its cheapest distance from any left-column start. Reseeding a start cell with its own value never raises it, because any path into that cell from another start costs more than the cell alone. The answer is the smallest distance in the right column.

As in 81, this is Bellman–Ford with a work queue (SPFA), and it converges to the true shortest distances because all the values are positive.
