---
problemNumber: 35
title: 'Circular Primes'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler35.java'
---

## The problem

A circular prime stays prime under every rotation of its digits (197, 971 and 719, for example). Count the circular primes below one million.

## My solution

Trial division throughout. The count starts at 1 to cover 2; then for every odd i from 3 to 999,999 that is prime, I rotate it repeatedly, testing each rotation, until I'm back at i. The first composite rotation rules the number out.

`rotate` moves the last digit to the front with arithmetic instead of strings:

```java
int a = n % 10;
n /= 10;
int b = 1;

while(n / b != 0)
  b *= 10;

n += a*b;
```

Zeros take care of themselves: a number ending in 0 is even and fails the primality test before it's ever rotated, and any 0 elsewhere eventually rotates into the last place with the same result.

`isPrime` divides by odd numbers up to √n. Composites usually fail on a small divisor, so most of the cost comes from the primes.
