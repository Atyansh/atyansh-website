---
problemNumber: 7
title: '10001st Prime'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler7.java'
---

## The problem

Find the 10,001st prime number.

## My solution

Count primes one at a time using trial division. The counter starts at 1 to account for 2, then the loop tests odd numbers from 3 upward until it has seen 10,001 primes:

```java
int n = 1;
long i = 3;
while(n != 10001) {
  if(isPrime(i))
    n++;
  i += 2;
}
System.out.println(i - 2);
```

`isPrime` divides by 3, 5, 7, … up to ⌊√n⌋ and returns false on the first hit. Because `i` is bumped by 2 after the 10,001st prime is counted, the program prints `i - 2`.

The test divides by every odd number, not just by primes, and nothing is stored between calls. For 10,001 primes that is still fast.
