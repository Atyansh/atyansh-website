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

600851475143 isn't divisible by 2, 3 or 5, so the search starts at `i = 7` and steps through the odd numbers.
