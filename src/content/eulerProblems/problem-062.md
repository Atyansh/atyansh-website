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

Generating only the lexicographically later rearrangements means n is always the smallest cube in its group and no rearrangement has a leading zero. The cost is the weak spot. The cubes in this range have 12 digits, and a 12-digit number can have hundreds of millions of distinct rearrangements (12! ≈ 4.8 × 10⁸ when no digit repeats). My commit message for this solution says it "took ridiculously long to compute, find a better solution". The loop prints each base to stderr as a progress indicator. The code doesn't explain the starting value of 5,014, and no cube below it is checked.

## Notes

The better solution is to skip permutations entirely: sort each cube's digits into a key, group cubes by key in a hash map while counting upward, and stop at the first key that collects five cubes (after finishing that digit length, to make sure no sixth joins it). That needs one cube per base up to about 10,000, instead of up to hundreds of millions of rearrangements for every base.
