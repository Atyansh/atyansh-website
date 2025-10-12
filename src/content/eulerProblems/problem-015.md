---
problemNumber: 15
title: 'Lattice Paths'
difficulty: 5
solved: true
solutionLanguage: 'Mathematical'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler15.txt'
---

# Problem 15: Lattice Paths

## Problem Statement

Starting in the top left corner of a 2×2 grid, and only being able to move to the right and down, there are exactly 6 routes to the bottom right corner.

**How many such routes are there through a 20×20 grid?**

## Approach

This problem has an elegant mathematical solution using combinatorics.

### Key Insight

In a 20×20 grid:
- You need to make exactly **20 moves to the right**
- You need to make exactly **20 moves downwards**
- **Total moves required: 40**

The question becomes: **In how many ways can we arrange 20 right moves and 20 down moves?**

### Mathematical Solution

If we select which 20 of the 40 total moves will be "right" moves, the remaining 20 moves are automatically "down" moves.

The answer is the binomial coefficient:

**C(40, 20) = 40! / (20! × 20!)**

This is also known as:
- "40 choose 20"
- The number of ways to select 20 items from 40

### Why This Works

- Each valid path is uniquely determined by choosing which 20 positions (out of 40 total moves) will be right moves
- Every choice of 20 positions for right moves creates exactly one valid path
- Therefore, the number of paths equals C(40, 20)

## Complexity

- **Time Complexity**: O(1) - Single mathematical calculation
- **Space Complexity**: O(1)

## Alternative Approaches

1. **Dynamic Programming**: Build up solutions from smaller grids (inefficient but educational)
2. **Pascal's Triangle**: The answer appears in row 40 of Pascal's triangle
3. **Recursive Formula**: Grid(m,n) = Grid(m-1,n) + Grid(m,n-1)

## Related Concepts

- Combinatorics
- Binomial coefficients
- Pascal's triangle
- Lattice paths
- Dynamic programming

## Solution

View the solution explanation on [GitHub](https://github.com/atyansh/Project-Euler/blob/master/Euler15.txt).
