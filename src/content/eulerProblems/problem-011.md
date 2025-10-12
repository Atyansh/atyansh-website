---
problemNumber: 11
title: 'Largest Product in a Grid'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler11.java'
---

## Problem Statement

In the 20×20 grid (provided in the problem), what is the greatest product of four adjacent numbers in the same direction (up, down, left, right, or diagonally)?

Example: The diagonal product 26 × 63 × 78 × 14 = 1,788,696 is shown.

## Approach

To find the maximum product of four adjacent numbers in any direction:

1. Parse the 20×20 grid into a 2D array
2. Check all four possible directions from each cell:
   - Horizontal (right)
   - Vertical (down)
   - Diagonal down-right
   - Diagonal down-left
3. For each direction, calculate the product of 4 consecutive numbers
4. Keep track of the maximum product found
5. Ensure boundary checks to avoid going outside the grid

Implementation tips:
- Only check from positions where 4 numbers can fit in the given direction
- Use directional vectors for cleaner code
- Store the maximum product and update it whenever a larger product is found

Time complexity: O(n²) where n is the grid size (20 in this case).
