---
problemNumber: 21
title: 'Amicable Numbers'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler21.java'
---

## The problem

Let d(n) be the sum of the proper divisors of n. Two different numbers a and b are amicable if d(a) = b and d(b) = a. Find the sum of all amicable numbers below 10,000.

## My solution

Brute force. For each `i`, I compute `sum1 = d(i)` by trying every `j` from 1 to i/2, then compute `sum2 = d(sum1)` the same way. If `sum2 == i` and `sum1 != i`, then `i` is amicable and gets added:

```java
for(int j = 1; j <= i/2; j++)
  if(i % j == 0)
    sum1 += j;

for(int j = 1; j <= sum1/2; j++)
  if(sum1 % j == 0)
    sum2 += j;

if(sum2 == i && sum1 != i)
  sum += i;
```

The `sum1 != i` check excludes perfect numbers like 6 and 28, where d(n) = n. Each number is checked on its own, so both members of a pair get added when the loop reaches each of them.

The outer loop starts at 100 rather than 2, which is safe because the smallest amicable pair is 220 and 284. Divisor sums are found by trial division up to n/2, so the total work is roughly quadratic in the limit, around 40 million modulo operations, which is fine at this size.

## Notes

Trial division only up to √n, adding both j and n/j for each divisor found, would make each d(n) far cheaper. A sieve that adds each j to all its multiples would compute every d(n) below the limit in O(n log n).
