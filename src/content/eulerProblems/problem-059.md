---
problemNumber: 59
title: 'XOR Decryption'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler59.java'
---

## The problem

A file contains English text encrypted by XOR with a repeating three-letter lowercase key. Recover the text and add up the ASCII values of its characters.

## My solution

Brute force over all 26³ = 17,576 keys, with each key byte running from 'a' (97) to 'z' (122). For each key, the code decrypts the whole message and counts how many characters come out as a space (ASCII 32), keeping a running sum of the decrypted values. The key that produces the most spaces wins, and its sum is printed.

```java
tempValue = tokens[x] ^ i;
tempAnswer += tempValue;
if(tempValue == 32)
  temp++;
```

Spaces make a good score because they are the most common character in English prose, while a wrong key byte only turns a ciphertext byte into a space by coincidence. The ciphertext is processed three bytes at a time, one per key letter. Its 1,201 bytes leave one byte over at the end, which is added to the sum but not scored.
