---
title: 'SPAM: a Secure Package Manager'
description: 'Design for a package registry kept as a signed, Stellar-replicated ledger, so a malicious registry, maintainer or CI service can be detected and contained.'
authors: ['Fraser Brown', 'Ariana Mirian', 'Atyansh Jaiswal', 'Andres Nötzli', 'Deian Stefan']
pubDate: 2017-04-01
featured: true
tags: ['package managers', 'software supply chain', 'Byzantine fault tolerance', 'Stellar Consensus Protocol', 'npm']
links:
  pdf: '/papers/spam.pdf'
---

## The problem

Uncurated registries such as npm, PyPI and RubyGems let anyone publish anything. At the time, their main defences were serving the registry over HTTPS and checking package hashes after download. Those defences address network attackers, not the registry itself or the people publishing to it. The paper considers three kinds of threat, using npm as the running example:

- **A malicious registry.** The operator might be compromised, compelled by a government, or simply untrustworthy, and could serve backdoored or outdated versions. While writing the paper, the authors also found that npm shrinkwrap files could pin dependencies to plain `http` URLs, which lets a network attacker tamper with those installs.
- **Malicious or careless developers.** A short list of direct dependencies pulls in a much larger transitive tree, and nobody audits all of it.
- **Malicious integration services.** Giving a CI service such as Travis your publish token means trusting it, and everyone who depends on you, not to push a bad release.

## Measurements

The npm numbers come from a clone of the registry fetched in December 2016:

- Among the 20 most popular packages, the average package listed 50 dependencies (median 1, maximum 626). The `hackathon-starter` project template alone pulls in 558 dependencies.
- Of 6,498 projects by npm's top ten authors, 1,693 (26.1%) had out-of-date dependencies.
- In the first 1,000 GitHub results for `provider: npm api_key`, 174 of 527 unique developers had committed YAML files containing unencrypted keys.

## Design

### A signed, hash-chained ledger

The registry's state is an append-only ledger of signed client messages. Each entry eₙ holds a sequence number n, the client's signed message m, and the hash H(n ‖ m ‖ eₙ₋₁), so every entry commits to the whole history before it. Clients change state through ten message types (Table 1 in the paper), including registering a user or package, releasing a version, adding or revoking collaborator and device keys, replacing keys, flagging versions as suspicious or approved, proving an identity, and an `extensible` message for application-specific data.

### Keys tied to identities

- Each account gets a **user key**, and each project gets its own **project key**. Only project keys can sign releases, so a stolen CI key can push updates to one project but cannot take over the account. Extra project keys can be issued per machine or per CI service.
- A `prove_identity` message links the user key to external accounts by publishing signed posts, for example a tweet (an idea taken from Keybase). Other users can then decide whose packages they trust.
- **Revoking a project key** asks the owner to mark the first suspicious change in the project's history. Everything after that point is flagged.
- **Replacing a lost user key** requires re-proving a majority of the user's external identities with the new key. An attacker who steals the key therefore cannot stop the owner from rotating it without also compromising most of the owner's external accounts.

### A federated registry

The ledger is replicated with the **Stellar Consensus Protocol (SCP)**, a federated Byzantine agreement protocol:

- **Top-level mirrors** (at least four, which tolerates one failure) store the ledger and the package data. A client can talk to any mirror and trusts an answer once it has signed replies from at least two different nodes.
- **Second-level nodes** keep only the ledger. Anyone can run one. Each node also keeps a "rollback safety" buffer of the last signed SCP messages from its quorum slice. Those messages commit to the full ledger history, so if mirrors collude to rewrite history, an honest node can prove it by showing two contradictory messages signed by the same node.
- **Archive services** (the paper uses the Internet Archive as an example) can record in the ledger, through the `extensible` message, that they hold copies of released packages and identity proofs. A key replacement with no archived identity proof can then be treated as a compromise, and a backdoored package that was published and later removed still leaves evidence.

## Guarantees

- If a majority of top-level mirrors are honest, SCP provides availability and ledger safety. The client verifies every package's signature and checks that the version has not been flagged.
- Without second-level nodes, a colluding quorum of mirrors can roll back history or replace a user's key, because verifying identity proofs is the registry's job.
- With second-level nodes, rollback is detected and attributed as long as one first- or second-level node is honest. Detecting forged key replacements also needs the archive extension.
- SPAM cannot stop people from running malicious code. What it adds is attribution, plus an optional client policy that installs only packages, including sub-dependencies, signed by developers the user trusts. Using the social graph to estimate trust is left as an idea for future work.

## Evaluation

This is a design paper. It describes the ledger, the message set, the key handling and the threat model. It does not describe an implementation, performance results, or a deployment. The quantitative results are the npm and GitHub measurements above.

## Limitations the paper states

- Packages signed with a compromised key are trusted until the key is revoked.
- A malicious node can front-run name registrations: it sees a requested user name and registers it for an attacker first.
- User and project names cannot be transferred. Supporting transfers while keeping key continuity against nation-state attackers is described as an open problem.
- Compared with The Update Framework (TUF) and Diplomat, which SPAM borrows the user/project key split from, SPAM assumes a stronger attacker (the registry itself is untrusted). The cost is that it cannot easily be added on top of existing registries.
