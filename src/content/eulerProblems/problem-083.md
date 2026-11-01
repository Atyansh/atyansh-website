---
problemNumber: 83
title: 'Path Sum: Four Ways'
difficulty: 25
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler83.java'
---

## The problem

In the same 80×80 grid, find the smallest path sum from the top-left cell to the bottom-right cell when moves in all four directions are allowed.

## My solution

This is the same code as problems 81 and 82 with a fourth link. Every `Node` points `up`, `down`, `left` and `right`, the top-left node is seeded with its own value, and a FIFO queue drives the relaxation. Whenever a neighbour's distance improves through the current node, the neighbour is updated and queued again:

```java
if(travel.left != null)
  if(travel.left.distance > (travel.distance + travel.left.value)) {
    travel.left.distance = travel.distance + travel.left.value;
    q.add(travel.left);
  }
```

Once moves can go left and up, there's no simple DP order over the grid, and this is where a general shortest-path search becomes necessary. My version isn't Dijkstra: there's no priority queue, so a cell can be processed several times as cheaper paths reach it. It's queue-based Bellman–Ford (SPFA). With positive cell values it still converges to the exact shortest distances, and the answer is the bottom-right node's distance.

## Notes

Dijkstra with a priority queue would process each of the 6,400 cells exactly once. The queue version gets the same answer by possibly reprocessing some cells.
