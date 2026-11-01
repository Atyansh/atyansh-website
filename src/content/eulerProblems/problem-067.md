---
problemNumber: 67
title: 'Maximum Path Sum II'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler67.java'
---

## The problem

Find the largest total along a path from the top of a 100-row number triangle to the bottom, moving to one of the two adjacent numbers on the row below at each step. It's Problem 18 at a size where trying all 2⁹⁹ paths is impossible.

## My solution

The triangle is read into rows of `Node` objects, each linked to the two nodes below it (`touch1`, `touch2`). A FIFO queue then pushes best totals downward from the top. When going through a node gives one of its children a larger total than the child currently has, the child's `distance` is updated and the child is enqueued. The answer is the largest `distance` in the bottom row.

```java
if(travel.touch1.distance < (travel.distance + travel.touch1.value)) {
  travel.touch1.distance = travel.distance + travel.touch1.value;
  q.add(travel.touch1);
}
```

This is a queue-based longest-path relaxation, but on the triangle the FIFO order means every row is fully processed before the next one starts. So each node's total is already final when it is dequeued, and it gets enqueued at most twice (once per parent). In effect it is top-down dynamic programming, linear in the 5,050 nodes. When this file was first written it called `Euler18.setDistance` from my Problem 18 solution; it later got its own copy of the method.
