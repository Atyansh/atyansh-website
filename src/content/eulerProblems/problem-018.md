---
problemNumber: 18
title: 'Maximum Path Sum I'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler18.java'
---

## The problem

In a 15-row triangle of numbers, walk from the apex to the bottom row, stepping each time to one of the two adjacent numbers below. Find the largest possible total.

## My solution

I have two solutions: the Java one from 2014 and a Python one I added in 2016.

**Java (`Euler18.java`)** treats the triangle as a graph. Each entry becomes a `Node` with links (`touch1`, `touch2`) to its two children, and a `distance` field that holds the best path sum found so far ending at that node. Starting from the apex, a queue-based relaxation pushes better sums downward, re-queuing a child whenever its distance improves:

```java
if(travel.touch1.distance < (travel.distance + travel.touch1.value)) {
  travel.touch1.distance = travel.distance + travel.touch1.value;
  q.add(travel.touch1);
}
```

When the queue empties, the answer is the largest `distance` in the bottom row. It's a longest-path search on a DAG. Because the queue is FIFO and every edge goes down exactly one row, nodes are processed row by row, so each node's value is already final when it is dequeued. In practice this is the top-down dynamic program with some duplicate queue entries.

**Python (`Euler18.py`, Python 2)** is the bottom-up dynamic program in a few lines. It reverses the rows so the bottom row comes first, then folds each row into the one above by adding the larger of the two children:

```python
for i in range(len(ll) - 1):
  for j in range(len(ll[i]) - 1):
    ll[i+1][j] += max(ll[i][j], ll[i][j+1])
```

The last row in the reversed list (the apex) ends up holding the answer; the script prints it as a one-element list. Both versions are O(n²) in the number of rows.

## Notes

My Problem 67 solution (the 100-row version of this triangle) is this same Java program with the file name and row count changed. The queue approach scales fine to 100 rows because, as above, it never does more than a constant amount of work per node.
