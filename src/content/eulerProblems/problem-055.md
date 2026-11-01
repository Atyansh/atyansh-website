---
problemNumber: 55
title: 'Lychrel Numbers'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler55.java'
---

## The problem

Repeatedly reversing a number's digits and adding the result to it usually produces a palindrome eventually. Count the numbers below ten thousand that don't reach one within 50 iterations.

## My solution

Direct simulation with `BigInteger`, since the values pick up digits with each iteration and quickly outgrow a `long`. For each starting number, the code reverses the decimal string, adds it, and checks whether the sum is a palindrome, up to 50 times. Numbers that never produce one are counted.

```java
for(int i = 0; i < 50; i++) {
  reverse = reverse(regular.toString());
  regular = regular.add(reverse);

  if(palindrome(regular.toString()))
    continue outer;
}
count++;
```

The palindrome check only runs after an addition, so a starting number that is already a palindrome still has to produce a new one, which is what the problem asks for.
