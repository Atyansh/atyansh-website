---
title: 'Worm Concept'
description: "A short Ren'Py visual novel set in the world of Wildbow's Worm: an original story with branching choices and three endings."
technologies: ["Ren'Py", 'Python']
featured: false
startDate: 2020-03-01
endDate: 2020-04-09
links:
  github: 'https://github.com/atyansh/worm_concept'
---

*Worm* is Wildbow's web serial about "capes", people who get superpowers from the worst day of their lives. In 2020 I made a short fan visual novel set in its world with Ren'Py. The story is original, written around three of the serial's main characters (Taylor, Lisa and Alec), and full of its world: trigger events, Parahumans Online, Winslow High, Fugly Bob's.

## The story

You play a student at Winslow High who has powers and is keeping them quiet. You're half-listening to a lecture on cape theory when Lisa, who has been quietly scouting the school for capes, leans over and lets you know she's figured you out. How you answer decides the ending:

```python
menu:
    "Tell her you're just a cape nerd":
        jump nerd
    "Admit you're a cape":
        jump cape
    "Flirt with her":
        jump flirt
```

Play it cool and she lets it go, though she clearly doesn't buy it. Come clean and Lisa takes you to meet Alec and Taylor, and the scene ends with the four of you heading out to dinner. Flirt, and you find out what Taylor does with her bugs.

## How it's built

It's a standard Ren'Py project. `definitions.rpy` sets up the characters and their sprites, with a few expressions each for Taylor and Alec. `script.rpy` holds the story and branches. `myscreens.rpy` adds custom screens: an end-card for each of the three endings and a looping video of Taylor dancing that plays over the scene for one beat. There's background music and a school-bell sound effect. I built it for Mac and Android too.
