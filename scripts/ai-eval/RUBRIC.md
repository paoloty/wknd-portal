# AI writer rubric

Every draft is graded against the facts it was given (the `facts` field in `results/<run>/cases.json`),
by a human/LLM judge reading as a strict senior editor, on top of the code checks. One grade per draft:

| Code | Criterion | Fail when |
|---|---|---|
| F | Facts | any statement the facts don't support: wrong number, wrong team/player, a streak/lead/run/record/high the facts don't give or give differently, a season or holder guessed, math of its own, a settled race described as open, "ever"/"in history" |
| M | Must-mentions | a MAJOR HIGHLIGHT is missing, or present without its number or its defining word (record, career high, streak…) |
| E | Echo / meta | the copy talks about itself, repeats an instruction ("the spotlight stays on…"), copies a label line, or copies a style example's content as a fact |
| I | Irrelevance | a fact that doesn't belong in this piece (an old game, a bench player's DNP, a 1.4 PPG absence) |
| V | Voice | not natural conyo: English frame with Tagalog in the hinges spread through every paragraph; **fail** if plain English, if Tagalog is only stickers/closers, if 3+ hinges are crammed in a sentence, if grammar is misused (possessive "si X's", passive "were made sayang", "made + stat"), or if a particle/filler repeats |
| H | Headline | (recap/sections) names the winner and the biggest highlight, ≤ 12 words, no "today/tonight", no generic game-type label, not a repeat of recent headlines |
| R | Repetition | the same word/stat/phrase said twice, the same opener as a recent piece, stat lists instead of a story |

Scoring per draft: **pass** (no F/M/E, V at most "mild"), **mild** (only V mild or H/R/I slips), **fail** (any F, M, E, or V fail).

Voice scale: *natural* (reads like a Makati kid talking hoops), *mild* (a little flat or one forced hinge), *fail* (as above).

Per-writer scorecard = pass / mild / fail counts, plus the list of F/E findings. Quality bar: 0 F, 0 E,
0 missing MAJOR highlight, voice natural in >= 90 % of drafts and never "fail".
