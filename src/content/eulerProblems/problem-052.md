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

Since x and 6x need the same number of digits, x has to start with a 1.
