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

Trial division. The sum starts at 2, then every odd number from 3 up to 1,999,999 is tested and added if it is prime:

```java
public static boolean isPrime(long n) {
  long sqrt = (long) Math.sqrt(n);
  for(long i = 3; i <= sqrt; i += 2)
    if(n % i == 0)
      return false;
  return true;
}
```

`isPrime` only tries odd divisors up to √n, and the caller only ever passes it odd numbers. The sum is a `long` because it doesn't fit in an `int`.

Each test costs at most about √n / 2 ≈ 700 divisions, and composites usually fail much sooner, so roughly a million candidates is manageable.
