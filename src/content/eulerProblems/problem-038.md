---
problemNumber: 38
title: 'Pandigital Multiples'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler38.java'
---

## The problem

Take an integer, multiply it by 1, 2, …, n for some n > 1, and concatenate the products. Find the largest 1–9 pandigital 9-digit number that can be formed this way.

## My solution

For each base i below 10,000 I append i × 1, i × 2, … to a string while feeding each product's digits into a `TreeSet`, and abandon i as soon as a digit is 0 or repeats. If the loop reaches 9 digits without a failure, the string is 1–9 pandigital (it can't run past 9 digits without repeating one), so I parse it and keep the maximum.

```java
while(num != 0) {
  if(num % 10 == 0 || !digits.add(num % 10))
    continue a;

  num /= 10;
  count++;
}
```

The bound of 10,000 is exact, and it also takes care of n > 1 automatically. A 5-digit base gives at least 5 + 5 = 10 digits after two products, so the base has at most 4 digits, and a base with at most 4 digits needs at least two products to reach 9 digits.

The program also prints each base that sets a new maximum before printing the result, a leftover from debugging.
