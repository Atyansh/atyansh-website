---
problemNumber: 62
title: 'Cubic Permutations'
difficulty: 15
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler62.java'
---

## The problem

Find the smallest cube for which exactly five of the permutations of its digits are also cubes.

## My solution

This one enumerates permutations. For each base a in a hard-coded range, 5,014 to 6,000, the code takes n = a³ and steps through every distinct rearrangement of its digits that comes after it lexicographically, using the next-permutation routine from my Problem 24 solution. Each rearrangement is tested for being a cube by rounding `Math.pow(x, 1.0/3)` and cubing it back. The cubes found, plus n itself, go into a `TreeSet`, and if it ends up with exactly five members, n is printed.

```java
while(!next.equals(new String(arr))) {
  next = new String(arr);
  long permutation = Long.parseLong(next);

  long cbrt = isPerfectCube(permutation);

  if(cbrt > 0) {
    set.add(permutation);
  }

  Euler24.next(arr, arr.length - 1);
}
```

Generating only the lexicographically later rearrangements means n is always the smallest cube in its group and no rearrangement has a leading zero. The cubes in this range have 12 digits, so each base has a lot of rearrangements to walk through, and the loop prints each base to stderr to show its progress.
