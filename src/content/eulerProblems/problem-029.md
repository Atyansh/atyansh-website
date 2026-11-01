---
problemNumber: 29
title: 'Distinct Powers'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler29.java'
---

## The problem

Count how many distinct values aᵇ takes for 2 ≤ a ≤ 100 and 2 ≤ b ≤ 100.

## My solution

Direct computation. All 99 × 99 = 9,801 powers go into a `TreeSet<BigInteger>` (100¹⁰⁰ has 201 digits, far beyond `long`), duplicates such as 2⁴ = 4² collapse automatically, and the set's size is the answer:

```java
for(int a = 2; a < 101; a++, A = A.add(inc))
  for(int b = 2; b < 101; b++)
    set.add(A.pow(b));
```

Under ten thousand big-integer exponentiations and set insertions, so it's quick.

## Notes

Duplicates only come from perfect powers, so writing each a as rᵏ with r minimal and storing the pair (r, k·b) gives the same count with small integers.
