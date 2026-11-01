---
problemNumber: 39
title: 'Integer Right Triangles'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler39.java'
---

## The problem

For each perimeter p ≤ 1000, count the right triangles with integer sides and that perimeter, and find the p with the most.

## My solution

Brute force over every perimeter from 3 to 1000 and every split of it into three positive sides, checking whether any of the three can be the hypotenuse:

```java
for(int a = 1; a < p-1; a++) {
  for(int b = 1; b < p-a-1; b++) {
    int c = p-a-b;

    A = a*a; B = b*b; C = c*c;

    if(A+B == C || B+C == A || A+C == B)
      count++;
  }
}
```

The sides aren't ordered, so each triangle shows up once for every arrangement of its three (always distinct) side lengths, six times in all. That multiplies every perimeter's count by the same factor, so the perimeter with the highest count is still the one with the most triangles. Summing p²/2 over all perimeters gives about 1.7 × 10⁸ inner iterations.
