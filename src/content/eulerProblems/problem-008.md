---
problemNumber: 8
title: 'Largest Product in a Series'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler8.java'
---

## The problem

Given a fixed 1000-digit number, find the largest product of a run of adjacent digits.

## My solution

The 1000 digits are pasted into the source as a string literal. I slide a window across it and multiply the digits in the window directly, converting each character with `charAt(i) - 48` (48 is the ASCII code for '0'):

```java
for(int i = 0; i < length-4; i++) {
  temp = (((int) (num.charAt(i))) - 48) *
         (((int) (num.charAt(i+1))) - 48) *
         (((int) (num.charAt(i+2))) - 48) *
         (((int) (num.charAt(i+3))) - 48) *
         (((int) (num.charAt(i+4))) - 48);
  if(temp > max)
    max = temp;
}
```

Each window is multiplied from scratch, which is instant for 996 windows.

## Notes

My code multiplies five adjacent digits, which is what the problem asked for when I solved it. Project Euler later changed it to thirteen.
