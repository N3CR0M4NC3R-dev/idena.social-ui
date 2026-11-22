# Moderation on Idena Social

Idena Social has no central administrator. Moderation decisions are recorded on the Idena blockchain by the **idena.social-mod** contract. They cover which accounts are banned, which posts are hidden, and who the moderators are. Each Idena Social app reads those decisions and chooses what to show. The contract only records decisions; it can't delete anything.

This document explains how moderation works in this app (idena.social-ui):

- **For everyone:** [who moderates](#who-moderates), [what gets hidden](#what-gets-hidden), [reporting](#reporting) and [appeals](#appeals).
- **For moderators:** [the moderator's guide](#the-moderators-guide).
- **For developers:** [the technical reference](#technical-reference).

The contract's own README is the reference for its methods, storage, events and gas.

---

## How moderation works

### Who moderates

There are two kinds of moderator:

- **Stakers** are identities with at least 1,000,000 iDNA staked. The contract checks the stake on a staker's first action in an epoch and trusts it until the epoch ends. Stake only drops at validation, when the epoch turns over and that trust lapses, so a staker whose stake drops below the threshold stops moderating straight away. The exception is an identity killed mid-epoch after its stake was confirmed: it keeps a staker's powers until the epoch ends.
- **Vouched moderators** are accounts that at least one staker has vouched for. A staker can have at most 5 vouches in effect at a time. A vouch stays in effect until its staker withdraws it, or until any staker revokes every vouch for that account.

Neither kind can be banned. A vouched moderator becomes bannable once a staker revokes their vouches.

| Role | Can |
|---|---|
| **Staker** | Everything a vouched moderator can, plus vouch for accounts and revoke vouches |
| **Vouched moderator** | Ban and unban accounts, hide and restore posts |
| **Anyone not banned** | Report accounts and posts |
| **Banned account** | Only withdraw vouches it made earlier; can't report |

The address in Settings determines your role, just as it determines who posts. Your role shows as a badge on your own profile.

### What moderators can do

- **Ban an account**, for a number of epochs or permanently. A new ban replaces the previous one, and bans expire on their own.
- **Hide a post** (a "transaction ban"). It stays hidden until a moderator restores it, even if its author is never banned. Moderators can hide up to 100 posts in one transaction.
- **Unban an account or restore a post**, optionally giving a reason.

Every decision is public on the blockchain: who made it, when, and the reason given.

### What gets hidden

#### Posts, replies and comments

1. **Posts made while their author is banned** are never shown anywhere. That covers feeds, threads, profiles and Post Activity.
2. **Posts made before the ban, and posts hidden individually,** depend on their replies:
   - a post with replies or comments that are still shown stays in place as a placeholder, so the conversation under it survives;
   - otherwise it's removed entirely.

   The placeholder shows no content, no author and no actions.
3. **After an unban, or when a ban expires,** everything comes back, including posts made during the ban. Posts that were hidden individually stay hidden until they're restored.

| Hidden by | Placeholder |
|---|---|
| Moderators | "Post hidden by moderators · Spam" (with the reason, if one was given) |
| This app's own list ([see below](#this-apps-own-ban-list)) | "Post hidden" |

**Likes and tips from banned accounts still count.** In the likes and tips lists they carry a "Banned" label.

#### Accounts

- **Profile details:** a banned account shows only its address and its robohash avatar, with no profile name, bio or picture. The app doesn't download the picture at all. After a ban ends, the details return when the cached profile is refreshed, within 24 hours.
- **The banned account's profile** shows a banner: "Banned until epoch 182 · Spam" or "Banned permanently", the moderator who banned it, and a **Message moderator** button.
- **Direct messages** from banned accounts are still delivered. The sender is labelled "Banned".
- **Post Activity** shows no notifications for hidden replies and comments.
- **If your own account is banned,** your profile shows the banner, and the composers warn you before you pay a fee: "Your account is banned until epoch 182: your posts won't be shown on idena.social." The posting contract can't stop the post from being sent, but this app won't show it.

### Reporting

Anyone the contract hasn't banned can report an account or a post. A reason is required.

**Where to report:**
- **The "⋯" menu on posts, replies and comments:** "Report post…" or "Report @alice…".
- **A profile:** the flag button next to Message.
- **A one-on-one conversation:** "Report" in its header. This reports the account, not a message: moderators can't read direct messages, so a message would give them nothing to review.

**The option isn't offered:**
- for your own posts and account;
- for accounts that are already banned;
- when the contract has banned you.

If no address is set in Settings, the report sheet asks you to set one.

```
Report post by @alice                          ✕
───────────────────────────────────────────────
A post by
alice                    Human · Age 12 · Stake 4200
Why?
[Spam] [Scam/phishing] [Illegal] [Harassment] [Other]
 ┌───────────────────────────────────────────┐
 │ Fake airdrop link                         │
 └───────────────────────────────────────────┘
                                 17 / 280 bytes
Reports are public on the blockchain: anyone can
see your address and this reason.
Max fee 2.42 iDNA: only the gas used is charged.
                            [Cancel]  [Report]
```

- **Reason:** Report stays disabled until you pick a reason or type one. "Other" asks you to write it. Reasons can be up to 280 bytes; most characters are 1 byte, but accented letters, other alphabets and emoji take 2 to 4.
- **Reports are public.** A report is a blockchain event that includes your address. Keep that in mind before reporting someone who might retaliate.
- **Once is enough.** If you've already reported something, the sheet shows "You reported this on 21 Nov 2026: Spam" instead of the button.
- **Cost:** about 1.2 iDNA with a short reason, up to about 1.9 iDNA with a 280-byte one ([fees](#fees)).

Moderators can report too, alongside their own tools.

### Appeals

A banned account's profile names the moderator who banned it and offers **Message moderator**. Messages from banned accounts are still delivered, so that's the way to ask for a ban to be reviewed. Any moderator can unban an account, not only the one who banned it.

### This app's own ban list

Separately from the contract, whoever runs this app can hide accounts and posts in its code. These are the UI ban lists ([configuration](#configuration)). Things to know about them:

- **They only add to what's hidden.** A listed account or post stays hidden whatever the contract says, and an on-chain unban can't lift it. There's no list that un-hides anything the contract hides.
- **They affect what's shown, not who moderates.** A listed moderator can still moderate on chain, and this app still applies their decisions.
- **A listed account's profile** reads "This account is hidden on idena.social". All of its posts follow rule 2 above: there's no ban date, so they're placeholders if they have replies and are removed otherwise.

---

## The moderator's guide

### Seeing hidden content: Show

- **In normal views** you see the same as everyone else, except that placeholders offer **Show**.
- **Show reveals the post in place, on your screen only.** The post is marked "Hidden from others · reason", with these actions:
  - **Hide again**;
  - **Restore…**, for a post hidden individually through the contract;
  - **Moderate @author**, which opens the author's Moderate panel.

  Like, reply and tip are disabled on a revealed post, because a reply would turn a removed post into a public placeholder.
- **Revealing doesn't last.** Nothing is saved: revealed posts hide again when you navigate away or reload. Their text and media are fetched when you reveal them and aren't stored.
- **Posts removed entirely** have no placeholder. You reach them through the Moderation page, where hidden posts are collapsed behind Show too.
- **Show needs verification** (next section). Moderator actions don't, because signing the transaction already proves you own the address.

### Verifying that you own your address

Show only works when the address in Settings has a moderator role and this browser has proof that you own that address. Without that check, anyone could type a moderator's address into Settings and use Show.

**What this does and doesn't protect.** Hidden content is still public on the blockchain and on IPFS. The check stops people impersonating a moderator in this app. It isn't access control over the content.

| Way to prove it | When | Cost |
|---|---|---|
| **Your encrypted key and password in Settings** | "Make posts with: Idena app" | Free. The app checks that the key's address matches the one in Settings. |
| **Your node's key** | "Make posts with: RPC" | Free and automatic. The app checks that the node's key matches the address. |
| **A witnessed transaction** | Idena app, no key saved | Any transaction you send from this browser, or a dedicated one: 0 iDNA to yourself, so you only pay its fee (about 0.2 iDNA). |

**How a transaction is witnessed:**
- When the app builds a transaction for the Idena web app to sign, it remembers the address, epoch, nonce, recipient and a hash of the payload.
- Once a mined transaction from that address matches all of them, you're verified. A nonce can only be used once per address in an epoch, so a match means whoever holds the key signed exactly what this browser built.
- A transaction built elsewhere, or not seen mined within 24 hours, doesn't count.

Clicking Show before you're verified opens **View hidden posts**, which offers both ways: open Settings to enter your key, or **Send** a verification transaction and wait for it to be mined. The Moderation page header shows "Verified ✓ You can view hidden posts." or "Not verified: you can moderate, but not view hidden posts." with a **Verify** button.

The proof is kept in this browser. It lapses when you change the address in Settings, or when the key or password stops being valid.

### The "⋯" menu

Every post, reply and comment has one.

```
┌──────────────────────────────────┐
│ Copy link                        │
│ View on explorer                 │
│ Report post…                     │
│ Report @alice…                   │
│ ──────────── Moderation ──────── │  moderators only
│ Hide this post…                  │
│ Ban @alice…                      │
└──────────────────────────────────┘
```

Actions the contract would refuse are shown disabled, with the reason: "Stakers can't be banned." or "Moderators can't be banned: a staker must revoke their vouches first." Your own posts have no Report or Ban items. Placeholders have no menu: Restore and Unban are on revealed posts, in the Moderate panel and on the Moderation page.

### The Moderate panel

**Moderate** is on every other account's profile, and in a one-on-one conversation's header. The panel shows:
- the account's current ban, and who made it;
- whether it's a staker, who vouches for it, and who it vouches for;
- reports against it: how many accounts reported it, the newest, and up to three reasons, with a link to the Reports tab.

Its actions depend on the account and on your role:
- **Ban…** or **Unban…**;
- for stakers: **Vouch as moderator…** or **Withdraw vouch…**, and **Revoke moderator status…** ([vouching](#vouching)).

### The Moderation page

It's in the menu for moderators only, because it shows hidden content. Its badge counts report groups that have a report you haven't seen yet; opening the Reports tab clears it. The header shows your role and whether you're verified.

- **Reports** (`/moderation`): the [reports queue](#the-reports-queue).
- **Banned** (`/moderation/banned`):
  - accounts banned through the contract, each with **Review posts** ([cleaning up](#cleaning-up-a-banned-account)) and **Unban…**;
  - posts hidden individually, each with **Restore…**;
  - "Hidden by this UI (in code)": this app's own list, read-only.
- **Log** (`/moderation/log`): every moderation action, newest first, with its moderator, reason and time, including the reasons given for unbans and restores. Hidden posts are collapsed behind Show; visible ones link to the post. Reports aren't listed here.
- **Moderators** (`/moderation/moderators`): vouched moderators and who vouches for them.
- **My vouches** (`/moderation/vouches`): for stakers, and for anyone with vouches still in effect ([vouching](#vouching)).

### The reports queue

```
┌───────────────────────────────────────────────┐
│ Post by alice · 4 reporters · newest 2h       │
│ ┌───────────────────────────────────────────┐ │
│ │ Get 1000 iDNA free at …                   │ │
│ │ View the post                             │ │
│ └───────────────────────────────────────────┘ │
│ • Spam                         Ban reporter…  │
│   0x12… · Human, stake 3,400 · 2h             │
│ • Scam/phishing                Ban reporter…  │
│   0x9a… · Verified, stake 120 · 5h            │
│ • …                                           │
│ +1 more                                       │
│ [Hide post…]  [Ban alice…]  [Dismiss]         │
└───────────────────────────────────────────────┘
```

- **Grouping:** reports are grouped by what they target, an account or a post, and each reporter counts once, with their latest reason. Groups with the most reporters come first, then the most recent.
- **Who reported:** anyone not banned can report, including addresses with no identity. So each report shows the reporter's identity status and stake. **Validated reporters only** limits the queue to Newbie, Verified and Human reporters.
- **What was reported:**
  - a reported account shows its status, age and stake;
  - a reported post shows its text and media, with a link to it. A post that's hidden is collapsed behind Show;
  - a reported transaction that isn't a loaded post (a message, or a post too old to have been loaded) shows its type and sender, with an explorer link. Ban is offered, but Hide isn't.
- **Resolved groups:** a group closes while its account is banned, or while its post is hidden (individually, or because its author is banned). If the ban or hide is lifted, it opens again. **Show resolved or dismissed** lists closed groups below the open ones.
- **Dismiss** closes a group in your browser only: the contract can't record a dismissal, so other moderators still see it. A newer report reopens it, and **Reopen** undoes a dismissal.
- **Report spam:** **Ban reporter…** bans an account that floods the queue. Reports from accounts that are banned leave the queue, and banned accounts can't report.

### Banning, unbanning, hiding, restoring

Each action opens a sheet that checks it against the contract as soon as it opens, and again just before you sign ([checks before signing](#checks-before-signing)). If the contract would refuse it, the sheet says why, and the action stays disabled.

#### Ban

```
Ban alice                                      ✕
───────────────────────────────────────────────
alice                    Human · Age 12 · Stake 4200
┌───────────────────────────────────────────────┐
│ Banned until epoch 182 · spam                 │
│ by 0x9f…                                      │
│ This ban will replace it.                     │
└───────────────────────────────────────────────┘
Duration
 (•) Until the next validation (14 Dec)
 ( ) 3 epochs
 ( ) 10 epochs
 ( ) Permanent
 ( ) Custom  [____] epochs
Reason
[Spam] [Scam/phishing] [Illegal] [Harassment]
 ┌───────────────────────────────────────────┐
 │ Repeated link spam in #trading            │
 └───────────────────────────────────────────┘
                                 30 / 280 bytes
Hides alice's posts, replies and comments on
idena.social while the ban lasts.
Max fee 8.92 iDNA: only the gas used is charged.
                               [Cancel]  [Ban]
```

- **Duration:** "Until the next validation" lasts one epoch. Its date comes from the network's next validation time. Longer bans are given in epochs, because epochs vary in length. A custom ban can be up to 65,535 epochs.
- **Reasons:** the chips keep reasons consistent across moderators, which keeps the log readable.

#### Hide a post

The same sheet without a duration: "Only this post is hidden. alice can keep posting."

#### Unban

The sheet shows the current ban, takes an optional reason ([Appeal accepted] [Mistake]), and says what the unban changes, counting the posts this app has loaded: "12 posts restored, 5 posts shown for the first time (made during the ban). 3 posts hidden individually stay hidden."

#### Restore a post

The same, for one post. If its author is still banned, the sheet says so: "alice is banned, so this post stays hidden until the ban ends."

#### While it's on its way

After you sign, the sheet waits for the transaction's receipt, and it can't be closed in the meantime. "Done." means the contract applied the action; it shows across the app at once. If the contract refused it, the sheet shows the contract's reason: "Rejected: <reason>. The fee was still charged."

### Cleaning up a banned account

Unbanning brings back everything the account posted, including posts made during the ban. Before unbanning, a moderator can hide the posts that should stay hidden. **Review posts** on the Banned tab opens `/moderation/banned/<address>`:

```
alice
Banned until epoch 182 · spam
by 0x9f…
───────────────────────────────────────────────
Posted during the ban: they first appear on the unban
 ☑ Post · Nov 20 · Show
 ☑ …
Posted before the ban: restored on the unban
 ☑ Post · Nov 18 · Show
 ☐ Reply · Nov 02 · Show
 ☑ …
Already hidden individually (3): they stay hidden
 …
───────────────────────────────────────────────
                [Hide 46 selected…]  [Unban…]
```

- **Everything starts selected.** Untick the posts that should come back.
- **Only posts this app has loaded are listed.** Scanning further back finds older ones.
- **One reason for the whole batch,** optional and best left short: the reason is stored with every post, and it's most of a batch's cost ([fees](#fees)). The account's ban already explains why.
- **Up to 100 posts per transaction.** The sheet says how many transactions a selection needs, for example "147 posts · 2 transactions (100 + 47)". With the Idena app, each transaction needs its own click, because browsers only allow the app's tab to open right after a click: "Transaction 1 of 2 done.", then **Sign transaction 2 of 2**.
- **Resending is safe.** The contract skips posts that are already hidden, so if you're not sure a batch went through, send the same selection again.

### Vouching

Stakers make other accounts moderators by vouching for them.

- **Vouch as moderator…** is in the Moderate panel, for stakers, on accounts that aren't stakers themselves. It's disabled, with the reason, when the account is banned or all 5 of your vouches are in use. The confirmation is explicit: "alice will be able to ban and unban any non-moderator, and hide and restore posts. Your vouch stays even if your stake drops. You can withdraw it at any time." It also shows who else vouches and how many of your vouches are in use.
- **Withdraw vouch…** replaces it once you vouch for the account, and says whether the account stays a moderator through other vouches.
- **Revoke moderator status…** removes every vouch for a vouched moderator, whoever made them: "Removes all 4 vouches for alice, from 0xab…, 0xcd…, …. alice stops being a moderator immediately and can then be banned." Each of those stakers gets their vouch back to use again. It isn't offered for an account that is also a staker, since that account moderates through its stake.
- **My vouches (2/5)** lists your vouches with when you made them, whether others also vouch, and **Withdraw…** on each.
- **If your stake drops below the threshold, or the contract bans you,** your vouches stay in effect, but you can't moderate. A drop at validation takes effect with the new epoch. If your identity is killed mid-epoch, the contract keeps accepting your actions until the epoch ends, provided it confirmed your stake that epoch, but this app goes by your current stake and stops offering them. The Moderation menu item stays, and the page shows only My vouches, headed "You can no longer moderate, but your 3 vouches stay in effect."
- **Near the threshold,** a staker within 5% of it sees "Stake 1,003,120: you stop moderating below 1,000,000." on the Moderation page.

### Fees

Only the gas a transaction uses is charged. The **max fee** shown on each sheet is a cap that your balance must cover when you sign. Most of it is gas reserved for the contract's stake check, and that reserved gas isn't spent. A staker's max fee always includes it, even once the contract has confirmed their stake for the epoch and skips the check. A staker's 1,000,000 iDNA is locked in stake, so the max fee has to come from the account's liquid balance.

Measured at a fee per gas of 0.000112 iDNA. Fees scale with the network's current fee per gas. The charged amounts were measured against the previous contract, which checked a staker's stake on every action; the current one uses less gas in every case.

| Action | Charged | Max fee |
|---|---|---|
| Ban | 3.89 iDNA | 8.9 |
| Hide a post | 2.80 iDNA | 5.4 |
| Restore a post | 2.54 iDNA | 5.4 |
| Unban | 2.52 iDNA | 5.4 |
| Hide 2 posts in one batch | 3.38 iDNA | 7.2 |
| Hide or restore, as a vouched moderator | 1.5–1.7 iDNA | 4.7 |
| Report, short reason | 1.23 iDNA | 2.4 |
| Report, 278-byte reason | 1.85 iDNA | 2.8 |
| Vouch | 2.93 iDNA | 5.3 |
| Withdraw a vouch | 1.36 iDNA | 2.5 |
| Revoke (one voucher) | 2.41 iDNA | 5.4 |

A batch costs about 0.5 iDNA for each extra post with no reason, and up to about 1.5 iDNA per post with a 280-byte reason, because the reason is stored with every post. A full batch of 100 is roughly 50 iDNA or more. A vouched moderator's actions run directly in the contract, with no stake check, which is why they cost less. So do a staker's after their first action in an epoch, except that a ban always checks that its target isn't a staker.

---

## Technical reference

### Configuration

Moderation is configured in code only (`src/logic/moderation.ts`); none of it appears in Settings.

```ts
// The idena.social-mod contract the app follows. null turns the contract integration off.
export const moderationConfig: ModerationConfig | null = {
    contractAddress: '0x…',
    // The rest mirror the contract's rules: update them with the contract.
    stakeThreshold: 1_000_000,
    maxVouches: 5,
    maxReasonBytes: 280,
    maxBanEpochs: 65_535,
    maxTransactionBatch: 100,
    defaultCallbackGas: 4_000_000,
    gasPerBatchedBan: 2_000_000,
    gasPerExistingVoucher: 60_000, // approximate, for vouch and revokeVouches
};

// Hidden by this app whatever the contract says, even when the config is null.
// Any case, with or without 0x. Removing an entry is the only way to lift it.
export const uiBannedAddresses: string[] = [
    // '0x1234…', // spam, 2026-11-21
];

export const uiBannedTransactions: string[] = [
    // '0xabcd…', // illegal content
];
```

- **`null` turns off everything that comes from the contract:** no event replay, no contract bans, no "⋯" menu, no reporting, no Moderation page and no badges. With `null` and empty UI lists, the app shows everything.
- **Changing `contractAddress`:** the cache records which contract it was built from, and when that differs, it's cleared and the new contract is replayed from its first transaction.
- **UI ban lists:** entries are normalised when the module loads, so they can be pasted in any case. A unit test checks that each entry is a 20-byte address or a 32-byte hash, so a typo can't quietly match nothing.

### How the app reads the contract

- **History comes from the indexer.** The app lists the contract's transactions from the indexer (`api/Address/<contract>/Txs`) and fetches each relevant one's events (`api/Transaction/<hash>/Events`), whichever source the app finds posts with. A node can't list a contract's transactions, and the default node blocks `bcn_transactions`.
- **Replay:** events are applied in chain order to derive the active address bans (with the start of each uninterrupted ban), transaction bans, vouches and reports. Failed transactions are skipped. A callback that refuses an action leaves a successful transaction without the action's event, so the events, not the receipts' success flags, are the truth.
- **Polling:** every 10 seconds, the app asks for the contract's newest transactions until it reaches the last one it applied. Transactions still in the mempool are left for later. A sync is applied and saved only once every page and event list has arrived, so an interrupted sync simply runs again. At startup, scanning waits for one sync, for at most 5 seconds, so it doesn't fetch content that's about to be hidden.
- **Reports are replayed separately.** Anyone can send reports cheaply, and each transaction needs its own events request. So the main sync only notes report transactions (hash, sender and place in chain order). A second pass fetches their events, 20 per poll: every report for moderators, only your own for everyone else (for "You reported this"). Report spam therefore can't delay bans, and visitors don't make a request for every report ever sent.
- **Ban expiry** compares a ban's `endEpoch` with the current epoch from `dna_epoch`. The epoch is refreshed every 10 minutes, and every minute once the next validation is due.
- **Storage:** the replayed events and the replay's position are kept in IndexedDB (`moderation_events`, `moderation_meta`). The cache is replayed from scratch when the contract address or the replay version changes, when it's inconsistent, and after Settings › clear cached content.
- **Hidden content isn't fetched.** The text and media of hidden posts aren't downloaded or cached when posts are scanned. Otherwise every viewer's browser would download and keep content the moderators removed, which could include illegal images. They're fetched when a ban ends, or when a moderator reveals the post (without caching).
- **Map keys** (for `contract_readMap`) are lowercase `0x` addresses or hashes, as UTF-8 and then hex. Address lists (`m:`, `v:`) come back as hex, 40 characters per address. A stake epoch (`s:`) comes back as hex too: a 2-byte little-endian u16, so `0xf000` is epoch 240.

### Checks before signing

The default node (restricted.idena.io) can't dry-run contract calls: it blocks `contract_estimateCall`, and `bcn_estimateRawTx` runs a call as the zero address. A refused action is still charged, and when a stake check in the contract's callback refuses it, the transaction even succeeds ([confirming actions](#confirming-actions)). So the app repeats the contract's checks with `contract_readMap` and `dna_identity` reads before anything is signed.

**Who counts as a staker** in the table below follows the contract: an address whose `dna_identity` stake is at least `stakeThreshold`, or whose `s:<address>` holds the current epoch from `dna_epoch`. The second covers an identity killed after the contract confirmed its stake that epoch. A failed read of either counts as the node not answering, never as "not a staker". Only these checks read `s:`; badges, menus, the Moderate panel and the Moderation page go by live stake.

| Action | Checks |
|---|---|
| Every action | Moderation is configured; an address is set; nothing on the same target is already on its way; your balance covers the max fee |
| Moderator actions | You're a staker or a vouched moderator; `b:<you>` isn't active; the reason fits in `maxReasonBytes` |
| Ban | The target is an address and isn't you; it isn't a staker; `m:<target>` is empty (not a vouched moderator); the epochs are within `maxBanEpochs` |
| Unban | `b:<target>` is active |
| Hide / restore | `t:<hash>` is unset / set |
| Batch hide | 1 to `maxTransactionBatch` hashes, each a valid hash |
| Report | `b:<you>` isn't active; a reason is given and fits; an account target isn't you |
| Vouch | You're a staker and not banned; the target isn't you or banned, and you don't vouch for it yet; your vouches in effect (`v:<you>`, keeping those still listed in each target's `m:`) are fewer than `maxVouches` |
| Withdraw | You vouch for the target (allowed even if you're banned or no longer a staker) |
| Revoke | You're a staker and not banned; `m:<target>` isn't empty |

### Confirming actions

- **By receipt.** The app waits for the transaction's receipt and checks for the action's own event (for example `ban`, or a `banTransaction` per newly hidden post). A refused action is charged either way, and shows in one of two ways:
  - **In a callback,** the transaction succeeds without the event, and the error comes from its `actionResult.subActionResults`. Checks that follow an identity lookup run there: a ban's, since it always looks up its target, and the stake check on a staker's first action in an epoch.
  - **Inside the call,** the transaction fails, with the error in the receipt's `error`. That's every other check, including every check on reports and withdrawals, and on a vouched moderator's or a confirmed staker's actions other than a ban.
- **Finding the transaction.** With "Make posts with: RPC", the node returns the hash at once. With the Idena app, the app finds the mined transaction through the indexer, matching the one it built by epoch, nonce, recipient and payload. If another transaction takes that nonce first, the built one can never be mined, and the sheet says so.
- **Shown at once.** The indexer can lag the chain by a minute. So a confirmed transaction's events are applied to the app's state straight away, and dropped once the replay lists the transaction, or after 3 minutes.
- **One action per target at a time.** A second action on a target with one on its way would only be charged and refused, so it's blocked until the first settles.

### Gas

- **Send 0 iDNA.** The contract never reads the amount sent: on mainnet, idena-go gives a call that sends nothing a nil amount, which fails the call if the contract reads it.
- **Callback gas.** Every ban, and a staker's first action in an epoch, checks stake in a callback after an identity lookup. The callback's gas (`_gasLimit`, in WASM gas, which is 100 times finer than the gas the node charges) is reserved out of the transaction's gas limit, so the max fee has to cover it. A ban reserves it twice, because it looks up the target too. The callbacks use under 2M WASM gas (measured against the previous contract), so the app passes 2.5M rather than the contract's default 4M.
- **Confirmed stakers.** A lookup that finds the stake confirms it in `s:` until the epoch ends, and the staker's later actions run inline and reserve nothing, apart from a ban's lookup of its target. The app still sizes a staker's max fee for the lookup, which covers the inline path too.
- **Vouch and revoke** cost about 60,000 WASM gas more per voucher the target already has, so the app adds that for each voucher in `m:<target>`.
- **Batches:** a hidden post costs about 0.5M WASM gas with no reason and 1.4M with a 280-byte one. The contract's default reservation is 4M plus 2M per post. The app passes a tighter `_gasLimit` from the post count and the reason's length. A vouched moderator's batch runs inline, so its max fee covers the whole batch. A confirmed staker's batch runs inline too, and the max fee sized for its callback covers it.
- **The charge** is the gas used × the fee per gas, plus the size fee (10 gas per byte). A receipt's `txFee` is only part of it: the indexer's `fee` is the full charge.

### Implementation notes

- **"Replies that are still shown" is recursive.** Replies that are themselves removed don't count, so a spam post whose only replies are more spam disappears along with them.
- **Likes are posts.** A like is a reply whose text is an emoji. Likes don't count as replies when deciding on a placeholder, or every liked spam post would leave one. They're never hidden, so likes from banned accounts keep counting. A "like" that carries media isn't one any app sends: it's hidden like any other post, or a banned account could get media past every ban.
- **When "during the ban" starts.** It starts at the timestamp of the first `ban` event of the current uninterrupted ban. A replacement ban made while the previous one is in effect doesn't reset it; after an unban or expiry, the next ban starts a new period. The `epoch` field stored with a ban isn't used for this: a ban made mid-epoch would also catch that epoch's earlier posts.
- **Placeholders can appear late.** Replies arrive as blocks are scanned, so a removed post can become a placeholder once its first reply is found.

### Not supported

- **Moderation settings in the app.** The configuration is code-only by design.
- **Un-hiding what the contract hides.** The UI lists only add to it.
- **Shared report dismissals.** That would need a contract method or a server. Dismissals are kept per browser.
- **Moderating direct messages.** Moderators can't read them. Senders are labelled instead, and reports from a conversation target the account.
- **A public moderation log.** The Moderation page shows hidden content, so it's for moderators only. The decisions themselves are public on chain.
