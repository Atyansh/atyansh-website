---
problemNumber: 59
title: 'XOR Decryption'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler59.java'
---

## Problem Statement

Each character on a computer is assigned a unique code and the preferred standard is ASCII (American Standard Code for Information Interchange). For example, uppercase A = 65, asterisk (*) = 42, and lowercase k = 107.

A modern encryption method is to take a text file, convert the bytes to ASCII, then XOR each byte with a given value, taken from a secret key. The advantage with the XOR function is that using the same encryption key on the cipher text, restores the plain text; for example, 65 XOR 42 = 107, then 107 XOR 42 = 65.

For unbreakable encryption, the key is the same length as the plain text message, and the key is made up of random bytes. The user would keep the encrypted message and the encryption key in different locations, and without both "halves", it is impossible to decrypt the message.

Unfortunately, this method is impractical for most users, so the modified method is to use a password as a key. If the password is shorter than the message, which is likely, the key is repeated cyclically throughout the message. The balance for this method is using a sufficiently long password key for security, but short enough to be memorable.

Your task has been made easy, as the encryption key consists of three lower case characters. Using the provided cipher text file, find the original message, then find the sum of the ASCII values in the original text.

## Approach

The solution involves:
1. Reading the encrypted ASCII values from the file
2. Trying all combinations of three lowercase letters (26^3 = 17,576 combinations)
3. Decrypting with each key by XORing cyclically
4. Checking if the result contains common English words (like "the", "and")
5. Summing the ASCII values of the correctly decrypted message
