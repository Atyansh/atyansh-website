---
problemNumber: 12
title: 'Highly Divisible Triangular Number'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler12.java'
---

## The problem

Triangle numbers are 1, 1+2, 1+2+3, and so on. Find the first one with more than 500 divisors.

## My solution

I build the triangle numbers incrementally (`triangle += n`) and count the divisors of each one until the count reaches 500.

The divisor count uses the prime-factorization formula: if n = p₁^a₁ · p₂^a₂ · …, then n has (a₁+1)(a₂+1)… divisors. `countFactors` strips out factors of 2 first, then trial-divides by 3, 5, 7, …, multiplying the running count by `freq + 1` for each divisor tried:

```java
while(n > 1) {
  while(n % i == 0) {
    n /= i;
    freq++;
  }
  count *= freq+1;
  freq = 0;
  i += 2;
}
```

For odd `i` that don't divide `n`, `freq` is 0 and the count is multiplied by 1, so composite `i` values are harmless.

## Notes

Triangle numbers have a nice structure for this: T(k) = k(k+1)/2, and k and k+1 share no factors, so the divisor count of T(k) is the product of the divisor counts of k and k+1 (after halving whichever one is even).
