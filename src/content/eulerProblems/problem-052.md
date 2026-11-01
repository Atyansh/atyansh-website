---
problemNumber: 52
title: 'Permuted Multiples'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler52.java'
---

## The problem

Find the smallest positive integer x such that 2x, 3x, 4x, 5x and 6x are all rearrangements of the digits of x.

## My solution

Count up from 1. For each i, the digits of i go into a `TreeSet`, then the code walks the digits of 2i through 6i. `TreeSet.add` returns true only for a digit that wasn't already there, so the first time it succeeds, the multiple uses a digit that i doesn't have, and the search moves on to i + 1.

```java
while(num != 0) {
  if(digits.add(num % 10)) {
    i++;
    continue a;
  }
  num /= 10;
}
```

## Notes

This only checks that each multiple uses a subset of i's digits, not that it is a true permutation with the same length and digit counts, so in principle it could accept a wrong number. It doesn't: the first number to pass this test is also the first to pass a full permutation check. One easy pruning that isn't used: x and 6x must have the same number of digits, which forces x to start with a 1.
