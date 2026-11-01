---
problemNumber: 28
title: 'Number Spiral Diagonals'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler28.java'
---

## The problem

Write 1, 2, 3, … in a clockwise spiral outward from the centre of a 1001 × 1001 grid, and sum the numbers on both diagonals.

## My solution

I simulated it literally. The code allocates a 1001 × 1001 `int` array, starts at the centre, and walks right, down, left, up with run lengths 1, 1, 2, 2, 3, 3, …, writing each number in turn. Once the grid is full it sums `spiral[i][i] + spiral[i][1001-i-1]` over every row and subtracts 1, because the centre cell is on both diagonals and got counted twice.

The only fiddly part is stopping. Each lap's rightward run also steps out into the next ring, but the last lap has no next ring, so its run along the top row is one cell short. The code handles this by doing `move-1` steps right, checking whether the grid is full, and only then taking the final step:

```java
for(int j = 0; j < move-1; j++)
  spiral[row][++col] = i++;

if(i > total)
  break;
else
  spiral[row][++col] = i++;
```

## Notes

The corners of the ring with odd side s are s², s² − (s − 1), s² − 2(s − 1) and s² − 3(s − 1), so the diagonal sum can also be written as a sum over the rings (or a closed-form cubic in the grid size). My Problem 58 solution uses that corner pattern to walk a much larger spiral without building it.
