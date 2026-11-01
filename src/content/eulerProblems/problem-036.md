---
problemNumber: 36
title: 'Double-base Palindromes'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler36.java'
---

## The problem

Sum all numbers below one million that are palindromes in both base 10 and base 2 (without leading zeros).

## My solution

Plain brute force. For every i below a million I build the decimal string with `Integer.toString` and the binary string with `Integer.toBinaryString`, and check each by comparing characters from both ends toward the middle. Neither method emits leading zeros, so the problem's leading-zero rule is handled for free. A million iterations with two short strings each runs quickly.

## Notes

Only odd numbers can be binary palindromes (the leading bit is 1, so the last must be too). Going further, there are fewer than 2,000 decimal palindromes below a million, and generating just those and testing them in binary would skip almost all of the loop.
