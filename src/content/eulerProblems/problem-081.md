---
problemNumber: 81
title: 'Path Sum: Two Ways'
difficulty: 10
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler81.java'
---

## The problem

In an 80×80 grid of numbers, find the smallest possible sum along a path from the top-left cell to the bottom-right cell that only moves right or down.

## My solution

I treat the grid as a graph and run a queue-based shortest-path search, not the usual row-by-row DP. Each cell becomes a `Node` with its value, links to the cell below (`touch1`) and to the right (`touch2`), and a `distance` that starts at `Long.MAX_VALUE`. The top-left node's distance is set to its own value and it's put on a FIFO queue. Then I repeatedly take a node off the queue and relax both neighbours, putting a neighbour back on the queue whenever its distance improves:

```java
if(travel.touch1 != null)
  if(travel.touch1.distance > (travel.distance + travel.touch1.value)) {
    travel.touch1.distance = travel.distance + travel.touch1.value;
    q.add(travel.touch1);
  }
```

This is label-correcting search (Bellman–Ford with a work queue, also known as SPFA). A cell can be queued more than once if a cheaper path to it turns up later. All the values are positive, so the process ends and the bottom-right node is left holding the minimum path sum.

The input file in the repo is the whole matrix on one comma-separated line, so a `Scanner` with `,` as its delimiter reads all 6,400 values in order. The 80×80 size is hard-coded.

## Notes

With only right and down moves, the grid is a DAG, and a single pass computing min(above, left) + value at each cell gives the same answer with each cell visited once. The queue approach pays off in problems 82 and 83, where I reused it with more neighbour links.
