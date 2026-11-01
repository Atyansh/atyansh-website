---
problemNumber: 79
title: 'Passcode Derivation'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler79.java'
---

## The problem

A file holds 50 successful login attempts, each giving three characters of a secret passcode in their original order. Work out the shortest passcode consistent with all of them.

## My solution

The code builds the passcode one digit at a time by repeatedly finding a digit that nothing has to come before. It works on one column of the three-character attempts at a time, starting with column 0:

1. Across all attempts whose digit in the current column hasn't been placed yet, collect those digits (`check`) and the digits that immediately follow them (`fail`).
2. If some digit is in `check` but never in `fail`, nothing remaining needs to come before it. Append it to the passcode, mark it done, and rescan the same column.
3. If no digit qualifies, move on to the next column pair (second and third characters).
4. When the columns run out, append any third-column digits that were never placed.

```java
for(Character c : check) {
  if(!fail.contains(c)) {
    done.add(c);
    code += c.charValue();
    continue a;
  }
}
index++;
```

It's a topological sort in spirit, worked out column by column from the attempts instead of through an explicit graph. The result uses each digit that appears in the file exactly once, and every one of the 50 attempts is a subsequence of it, so it's as short as possible.
