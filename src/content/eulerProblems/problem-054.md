---
problemNumber: 54
title: 'Poker Hands'
difficulty: 10
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler54.java'
---

## Problem Statement

In the card game poker, a hand consists of five cards and are ranked, from lowest to highest, in the following way:

- High Card: Highest value card
- One Pair: Two cards of the same value
- Two Pairs: Two different pairs
- Three of a Kind: Three cards of the same value
- Straight: All cards are consecutive values
- Flush: All cards of the same suit
- Full House: Three of a kind and a pair
- Four of a Kind: Four cards of the same value
- Straight Flush: All cards are consecutive values of same suit
- Royal Flush: Ten, Jack, Queen, King, Ace, in same suit

The cards are valued in the order: 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace.

The file, poker.txt, contains one-thousand random hands dealt to two players. Each line of the file contains ten cards (separated by a single space): the first five are Player 1's cards and the last five are Player 2's cards. You can assume that all hands are valid, and that each round has a clear winner.

How many hands does Player 1 win?

## Approach

The solution involves:
1. Parsing poker hands from the input file
2. Implementing hand ranking logic for all poker hand types
3. Implementing tie-breaking rules for equal ranked hands
4. Comparing each pair of hands and determining the winner
5. Counting Player 1's victories
