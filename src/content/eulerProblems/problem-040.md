---
problemNumber: 40
title: "Champernowne's Constant"
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler40.java'
---

## The problem

Concatenating the positive integers gives the decimal 0.123456789101112…. Find the product of its digits at positions 1, 10, 100, …, 1,000,000.

## My solution

I generate the digits into a `LinkedList<Integer>` until it holds at least a million, copy it to an array, and multiply the entries at indices 0, 9, 99, …, 999,999.

To emit each number's digits in order without using strings, I reverse the number arithmetically and pop digits off the reversed copy. Reversal drops trailing zeros (10 reversed is 1), so the code also divides a second copy of the original once per popped digit; whatever is left in it afterward counts the lost zeros, which get appended:

```java
while(rev != 0) {
  list.add(rev % 10);
  size++;
  rev /= 10;
  num /= 10;
}

while(num != 0) {
  num /= 10;
  list.add(0);
  size++;
}
```

That's about a million boxed `Integer`s in a linked list plus one array copy: wasteful in memory, but fast enough.

## Notes

The digit at position k can be found without generating anything: skip the 9 digits of one-digit numbers, the 180 of two-digit numbers and so on until k falls inside a block, then index into the right number.
