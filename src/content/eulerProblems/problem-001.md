---
problemNumber: 1
title: 'Multiples of 3 or 5'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler1.java'
---

## The problem

Add up every natural number below 1000 that is divisible by 3 or by 5.

## My solution

There is no loop at all. The whole program is one expression using inclusion–exclusion and the arithmetic-series formula:

```java
System.out.println(3*(333*334)/2 + 5*(199*200)/2 - 15*(66*67)/2);
```

Below 1000 there are 333 multiples of 3, 199 multiples of 5 and 66 multiples of 15. The multiples of k sum to k·(1 + 2 + … + m) = k·m(m+1)/2, where m is how many there are. Adding the sums for 3 and 5 counts the multiples of 15 twice, so their sum is subtracted once. The counts (⌊999/3⌋, ⌊999/5⌋, ⌊999/15⌋) were worked out by hand and hard-coded, so this is O(1).
