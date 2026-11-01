---
problemNumber: 10
title: 'Summation of Primes'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler10.java'
---

## The problem

Add up all the primes below two million.

## My solution

Trial division, not a sieve. The sum starts at 2, then every odd number from 3 up to 1,999,999 is tested and added if it is prime:

```java
public static boolean isPrime(long n) {
  long sqrt = (long) Math.sqrt(n);
  for(long i = 3; i <= sqrt; i += 2)
    if(n % i == 0)
      return false;
  return true;
}
```

`isPrime` only tries odd divisors up to √n. It has no check for even inputs; that's fine because the caller only passes odd numbers. The sum is a `long` because it doesn't fit in an `int`.

Each test costs at most about √n / 2 ≈ 700 divisions, and composites usually fail much sooner, so roughly a million candidates is still manageable.

## Notes

A Sieve of Eratosthenes (O(n log log n) with a 2-million-entry boolean array) is the standard faster approach for "all primes below N".
