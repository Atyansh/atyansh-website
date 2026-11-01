---
problemNumber: 69
title: 'Totient Maximum'
difficulty: 10
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler69.java'
---

## The problem

Euler's totient φ(n) counts the numbers below n that share no factor with n. Find the n ≤ 1,000,000 for which n/φ(n) is largest.

## My solution

The Java file is a brute force I abandoned. It only tries even n and computes φ(n) by counting the odd j < n with gcd(n, j) = 1 (even j can never be coprime to an even n), using Euclid's algorithm. That's around 1.25 × 10¹¹ gcd calls. A comment at the bottom of the file records what happened next: "This is taking too long. I calculated the answer mathematically."

```java
for(int i = 2; i < 1000000; i+=2) {
  int totient = 0;
  for(int j = 1; j < i; j+=2) {
    if(hcf(i, j) == 1)
      totient++;
  }
  ...
```

The math is short. n/φ(n) is the product of p/(p − 1) over the distinct primes p dividing n. It depends only on which primes divide n, not their powers, every extra prime factor makes it larger, and smaller primes contribute more. So the best n under the limit is a product of consecutive primes 2·3·5·7·…, continued as long as the product stays at or below one million. That's the reasoning in the file's comment too: use as many of the smallest primes as possible.
