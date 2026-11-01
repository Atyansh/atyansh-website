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

- There is no √n cutoff, so the loop keeps going until `i` reaches the largest prime factor. Since T(k) = k(k+1)/2, that factor can be as large as about k, so each count costs O(k) and the whole search is roughly quadratic in the index. It's still fast enough at this size.
- The loop condition is `value < 500`, so it would also stop on a triangle number with exactly 500 divisors, which the problem doesn't allow. No triangle number before the answer has exactly 500, so the result is correct anyway.
- The usual speed-up uses the fact that k and k+1 are coprime: count the divisors of k and k+1 separately (after halving the even one) and multiply.
