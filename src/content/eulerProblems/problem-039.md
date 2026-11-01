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

The sides aren't ordered, so each triangle is counted six times, once for every arrangement of its three (always distinct) side lengths. For p = 120, where the problem lists three triangles, the code counts 18. A constant factor doesn't change which p wins, so the result is still right. Summing p²/2 over all perimeters gives about 1.7 × 10⁸ inner iterations.

## Notes

Requiring a < b < c, skipping odd p (a Pythagorean triple always has an even perimeter), or solving for b directly given p and a would each cut the work substantially.
