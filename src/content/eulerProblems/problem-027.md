---
problemNumber: 27
title: 'Quadratic Primes'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler27.java'
---

## The problem

Among quadratics n² + an + b with |a| < 1000 and |b| ≤ 1000, find the one that gives the longest run of primes for n = 0, 1, 2, …, and report the product a × b.

## My solution

Brute force over the coefficients, with one pruning step: at n = 0 the quadratic is just b, so b has to be prime. I loop a from −999 to 999 and b over the odd numbers from 3 to 999, which rules out negative b, even b and b = 1000 without testing them. b = 2 can be skipped too: n = 2 then gives 2a + 6, which is even and equals 2 only when a = −2, and in that case n = 1 gives 1. So with b = 2 the run never gets past n = 1.

For each (a, b) I count primes for consecutive n until the first composite:

```java
prime = b;
length = n = 0;

while(isPrime(prime)) {
  length++;
  n++;
  prime = n*n + a*n + b;
}
```

`isPrime` is trial division by odd numbers up to √n, and it returns false for anything below 2, which covers the negative values the quadratic produces when a is negative. That's about a million (a, b) pairs, and most fail within the first couple of terms.
