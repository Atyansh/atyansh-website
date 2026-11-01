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

I precompute the digit factorials in a table, then loop over 3 … 999,999, summing table lookups digit by digit and comparing the total with the number. Starting at 3 excludes 1 and 2.

It gets the right answer, but two things are shakier than they look.

**The upper bound is a guess.** The justified bound is 7 × 9! = 2,540,160: an 8-digit number is at least 10⁷, while its digit-factorial sum is at most 8 × 9! ≈ 2.9 × 10⁶, so nothing with 8 or more digits works, but 7-digit numbers up to 2,540,160 still need checking. Stopping at 10⁶ skips that range. I checked separately that there are no solutions in it, so the guess holds.

**`fact[9]` is never filled in.** The table is built with

```java
for(int i = 2; i < 9; i++)
  fact[i] = fact[i-1]*i;
```

so `fact[9]` stays 0 and every digit 9 contributes nothing. None of the real solutions contain a 9, and I checked with a Python port of the loop that the broken table produces no false matches below a million, so the printed sum is still correct.
