---
problemNumber: 4
title: 'Largest Palindrome Product'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler4.java'
---

## The problem

Find the largest palindrome that is the product of two 3-digit numbers.

## My solution

Brute force. Two nested loops run `i` and `j` from 999 down to 100, multiply them, and keep the largest product that is a palindrome. There is no early exit, so all 900 × 900 = 810,000 products are checked (each pair twice, as i·j and j·i).

The palindrome test converts the number to a string and compares characters from both ends toward the middle:

```java
for(int i = 0; i < length/2; i++)
  if(s.charAt(i) != s.charAt(length - 1 - i))
    return false;
return true;
```

## Notes

Counting down doesn't help on its own here, because the first palindrome found isn't necessarily the largest. The code handles that correctly by tracking a running maximum instead of stopping early. Restricting the inner loop to `j ≤ i` and breaking once `i·j` drops below the current maximum would cut the work a lot.
