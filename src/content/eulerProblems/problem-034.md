---
problemNumber: 34
title: 'Digit Factorials'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler34.java'
---

## The problem

Find the sum of all numbers that equal the sum of the factorials of their digits (1 and 2 don't count, since they aren't sums).

## My solution

I precompute factorials in a small lookup table, then loop over 3 … 999,999, peeling off digits with `% 10`, summing their table entries and comparing the total with the number:

```java
while(num != 0) {
  curious += fact[num % 10];
  num /= 10;
}

if(curious == i)
  sum += curious;
```

Starting at 3 excludes 1 and 2. With the lookup table, each check is just a handful of array lookups, so the million iterations run quickly.
