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

I started with a brute force in Java. It only tries even n and computes φ(n) by counting the odd j < n with gcd(n, j) = 1 (even j can never be coprime to an even n), using Euclid's algorithm. That's around 1.25 × 10¹¹ gcd calls, which was too slow, so I worked the answer out with a bit of number theory instead and left the reasoning in a comment at the bottom of the file.

```java
for(int i = 2; i < 1000000; i+=2) {
  int totient = 0;
  for(int j = 1; j < i; j+=2) {
    if(hcf(i, j) == 1)
      totient++;
  }
  ...
```

The math is short. Euler's product formula gives n/φ(n) as the product of p/(p − 1) over the distinct primes p dividing n. That depends only on which primes divide n, not on their powers. Every extra prime factor multiplies the ratio by something greater than 1, and smaller primes multiply it by more (2/1 beats 3/2, which beats 5/4, and so on). So the best n is built from as many of the smallest primes as possible: multiply 2·3·5·7·… together and stop just before the product would pass one million.
