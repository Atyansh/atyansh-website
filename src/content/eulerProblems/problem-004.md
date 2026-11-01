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

Counting down from 999 doesn't guarantee that the first palindrome found is the largest, since a product with a small second factor can come before one with two factors in the 900s. That's why the code keeps a running maximum over every product.
