---
title: 'Cosmic Bot'
description: 'A small discord.py bot with one command, !alien, that posts the full alien sheet for any of 197 Cosmic Encounter aliens from a bundled text file.'
technologies: ['Python', 'discord.py']
featured: false
startDate: 2020-08-01
links:
  github: 'https://github.com/atyansh/cosmic-bot'
---

In Cosmic Encounter each player is an alien with a power that bends the rules, and the base game plus expansions add up to a lot of them. I wrote this Discord bot in August 2020 so that typing `!alien <name>` in a channel posts that alien's full sheet.

## How it works

There is no scraper and no database. All of the data lives in `alien_scrape.txt`, a plain-text dump of 197 alien sheets separated by two blank lines. Each entry starts with a header line holding the name, a bracketed tag for mandatory/optional and the expansion it comes from (`ACE [M:CD] Wins with One Colony`), followed by the power text, history, notes, and the Wild and Super flare text.

At startup the bot splits the file into entries and keys each one by whatever comes before the `[`, lowercased. The one command joins its arguments into a name and looks it up:

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

The bot token is read from a `secret_config.json` that `.gitignore` keeps out of the repo.

## State

This is a v0.1 that never got past its first command. Lookup is an exact, case-insensitive match on the name, so typos and partial names just get "Could not find alien named ...". The bot also sends the whole sheet as one message, and Discord caps messages at 2,000 characters: 13 of the 197 sheets are longer than that, so asking for those aliens fails. The last commit (September 2020) fixed the not-found reply, which had been printing a literal `{alien_name}` because the `.format()` call was missing.
