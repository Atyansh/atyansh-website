---
problemNumber: 92
title: 'Square Digit Chains'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler92.java'
---

## The problem

Repeatedly replace a number with the sum of the squares of its digits. Every chain ends up at either 1 or 89. Count the starting numbers below ten million that reach 89.

## My solution

Pure brute force, with no caching. For each start from 1 to 9,999,999, I follow the chain while recording every value in a fresh `TreeSet`. The loop stops when `add` returns false, meaning a value repeated. If 89 showed up along the way, the start is counted:

```java
while(chain.add(num)) {
  if(num == 89)
    count++;

  sum = 0;
  while(num != 0) {
    sum += (num % 10)*(num % 10);
    num /= 10;
  }
  num = sum;
}
```

Since 89 can only be added to the set once, each start is counted at most once. Chains reaching 1 stop when 1 repeats, and chains reaching 89 go around the 89 → 145 → … → 89 cycle once and stop. That's ten million chains of up to about 20 values, each building its own `TreeSet`, so it's slow but simple.

## Notes

The obvious speedup: after one step, every start below 10⁷ is at most 7 × 9² = 567. Working out where each of 1 to 567 ends up first turns every start into a single digit-square sum plus a table lookup.
