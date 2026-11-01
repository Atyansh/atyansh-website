---
problemNumber: 15
title: 'Lattice Paths'
difficulty: 5
solved: true
solutionLanguage: 'Mathematical'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler15.txt'
---

## The problem

Count the routes from the top-left to the bottom-right corner of a 20×20 grid when you can only move right or down.

## My solution

I didn't write a program for this one. `Euler15.txt` holds only the counting argument.

Every route is exactly 40 moves long: 20 to the right and 20 down. A route is completely determined by which 20 of those 40 moves are the rightward ones, since the rest are then forced to be downward. So the number of routes is the binomial coefficient C(40, 20) = 40! / (20! · 20!).

## Notes

The same number appears as the central entry of row 40 of Pascal's triangle, which is what you'd get from the dynamic-programming recurrence paths(r, c) = paths(r−1, c) + paths(r, c−1).
