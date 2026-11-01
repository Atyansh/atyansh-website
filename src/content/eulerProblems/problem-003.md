---
problemNumber: 3
title: 'Largest Prime Factor'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler3.java'
---

## The problem

Find the largest prime factor of 600851475143.

## My solution

Trial division that divides each factor out as soon as it is found. Every time a divisor `i` divides the remaining number, I divide it out completely and record `i` as the latest factor. When the remaining number reaches 1, the last factor recorded is the largest one.

```java
while(num > 1) {
  while(num % i == 0) {
    num /= i;
    answer = i;
  }
  i += 2;
}
```

Because factors are removed in increasing order, any `i` that divides the remainder must be prime: all of its own smaller prime factors were already divided out.

## Notes

Two shortcuts in the code only work because of this particular input. The search starts at `i = 7` and steps over odd numbers, skipping 2, 3 and 5; that's safe only because 600851475143 isn't divisible by any of them. There is also no √n cutoff, so the loop runs until `i` reaches the largest prime factor itself. That is fast here because all the prime factors are small, but on a number with a large prime factor (or a large prime) it would take about n/2 iterations.
