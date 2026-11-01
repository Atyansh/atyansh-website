---
title: 'Cosmic Bot'
description: "A Discord bot for our Cosmic Encounter games on Tabletop Simulator: type !alien and a name to pull up that alien's full power sheet."
technologies: ['Python', 'discord.py']
featured: false
startDate: 2020-08-01
links:
  github: 'https://github.com/atyansh/cosmic-bot'
---

During the COVID lockdowns, my friends and I played a lot of Cosmic Encounter on Tabletop Simulator, with a Discord group for voice and chat. In Cosmic Encounter every player is an alien with a power that breaks the rules in its own way. Between the base game and its expansions there are nearly 200 of them, so someone was always asking what an alien actually does.

So I made a bot for our Discord. Type `!alien <name>` and it posts that alien's full sheet mid-game: the power, its history, notes, and the Wild and Super flares.

```
!alien ace
```

## How it works

It's deliberately tiny. All 197 alien sheets live in one plain-text file, separated by blank lines. Each sheet starts with a header line like `ACE [M:CD] Wins with One Colony`. At startup the bot splits the file into sheets and indexes each one by the alien's name, so a lookup is a single dictionary hit:

```python
aliens = open("alien_scrape.txt", 'r').read().split('\n\n\n')
for alien in aliens:
    (key, _) = alien.split('[')
    alien_dict[key.strip().lower()] = alien

@bot.command()
async def alien(ctx, *args):
    alien_name = " ".join(args).lower()
    if alien_name in alien_dict:
        await ctx.send(alien_dict[alien_name])
```

Names are matched case-insensitively, and multi-word names like "Evil Twin" work because the command joins its arguments back together. It's built on discord.py, with the bot token kept in a config file that stays out of git.
