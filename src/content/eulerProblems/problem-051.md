---
problemNumber: 51
title: 'Prime Digit Replacements'
difficulty: 15
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler51.java'
---

## The problem

Take a prime, pick some of its digit positions, and fill all of them with the same digit, trying 0 through 9. Find the smallest prime that is part of a family where eight of those ten numbers are prime.

## My solution

The search walks odd numbers upward from 5. For each prime, `calculate` tries every non-empty subset of digit positions, encoded as a bitmask from 1 to 2ᴸ − 1 (L is the number of digits). For each mask it writes each digit 0–9 into the masked positions, skips results with a leading zero, and counts how many are prime by trial division. It returns the best count over all masks, and the main loop stops at the first prime where that count is 8. Any mask that reaches 8 is printed to stderr as a binary "pivot" pattern, which shows which digit positions make up the family.

```java
for(char ch = '0'; ch <= '9'; ch++) {
  char[] digits = num.toCharArray();
  for(Integer index : arr)
    digits[length-index.intValue()-1] = ch;

  if(isPrime(Long.parseLong(new String(digits))) && digits[0] != '0') {
    temp++;
  }
}
```

That's 2ᴸ × 10 primality tests per prime (640 for a six-digit number), which is quick at this size.
