---
problemNumber: 41
title: 'Pandigital Prime'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler41.java'
---

## The problem

An n-digit number is pandigital if it uses each of the digits 1 to n exactly once. Find the largest pandigital prime.

## My solution

Brute force: every odd number from 101 up to 999,999,999 is a candidate, about 5 × 10⁸ of them.

```java
for(int i = 101; i < 1000000000; i += 2) {
  if(isPandigital(i) && isPrime(i))
    max = i;
}
```

`isPandigital` runs first because it's the cheaper filter. It counts the digits, then checks that each digit lies in 1 … count and hasn't been seen before (using a fresh `TreeSet` per call). Only pandigital numbers reach `isPrime`, which is trial division by odd numbers up to √n. The loop goes upward, so `max` is overwritten by each pandigital prime it finds and ends on the largest.

## Notes

A digit-sum argument narrows down where the answer can be: 1 + 2 + … + 9 = 45 and 1 + 2 + … + 8 = 36 are both divisible by 3, so every 9- and 8-digit pandigital number is divisible by 3 and can't be prime.
