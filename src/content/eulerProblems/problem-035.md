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

Trial division throughout, no sieve. The count starts at 1 to cover 2; then for every odd i from 3 to 999,999 that is prime, I rotate it repeatedly, testing each rotation, until I'm back at i. The first composite rotation abandons the number.

`rotate` moves the last digit to the front with arithmetic instead of strings:

```java
int a = n % 10;
n /= 10;
int b = 1;

while(n / b != 0)
  b *= 10;

n += a*b;
```

Rotating a number that ends in 0 would silently drop a digit, but that never happens: such a number is even, so it fails the primality test before it gets rotated. That also means any number containing a 0 is correctly rejected.

`isPrime` divides by odd numbers up to √n. Composites usually fail on a small divisor, so the full √n cost is paid mainly by the primes; a Python model of the loop puts the total at about 4 × 10⁷ trial divisions.
