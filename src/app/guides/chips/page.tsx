import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { GuideCTA, GuideCallout, GuideFAQ, GuideHero, GuideRelated, GuideSection } from "@/components/guide-blocks";

export const metadata: Metadata = {
  title: "FPL Chips Explained: Wildcard, Free Hit, Bench Boost, Triple Captain",
  description:
    "What each Fantasy Premier League chip does, how many you get, and roughly when to use them - Wildcard, Free Hit, Bench Boost, and Triple Captain explained simply.",
  alternates: { canonical: "/guides/chips" },
};

export default function ChipsGuidePage() {
  return (
    <AppShell title="FPL Chips Explained" eyebrow="Wildcard, Free Hit, Bench Boost, Triple Captain">
      <GuideHero
        eyebrow="Chips guide"
        title="What FPL's chips actually do, and when to use them"
        dek="Four chips, two of each across the season - one set usable in the first half, one in the second. Each one bends the normal rules for a single gameweek. Here's what each one changes, in plain terms."
      />

      <GuideSection title="Wildcard">
        <p>
          Lets you rebuild your entire 15-player squad for free - no -4 hits, no limit on how many players you
          change. Your squad value resets to whatever those players cost right now, not what you originally paid.
        </p>
        <p>
          Best used when your squad has drifted far from ideal - bad fixtures across the board, several injuries
          at once, or a shift in form that makes half your team not worth owning anymore. Not worth it for
          fixing one or two players; that&apos;s what a normal transfer is for.
        </p>
      </GuideSection>

      <GuideSection title="Free Hit">
        <p>
          Also a full squad rebuild for one gameweek only - but unlike Wildcard, your squad automatically reverts
          back to exactly what it was before, the moment the gameweek ends.
        </p>
        <p>
          Built for one-off situations: a gameweek where several of your players are blanking (no fixture) or a
          gameweek where a specific set of teams have an unusually good match-up you want in for a single week,
          without permanently restructuring your squad around it.
        </p>
      </GuideSection>

      <GuideSection title="Bench Boost">
        <p>
          Your bench players&apos; points count too, for one gameweek - normally only your starting XI scores. Turns
          your bench from insurance into 4 extra scoring players.
        </p>
        <p>
          Only worth playing when your whole 15, not just your XI, has good fixtures that week - there&apos;s no
          point boosting a bench that&apos;s not going to play or is up against tough opponents.
        </p>
      </GuideSection>

      <GuideSection title="Triple Captain">
        <p>
          Your captain&apos;s score triples instead of doubles, for one gameweek. Same idea as normal captaincy,
          just with a bigger multiplier on the pick you&apos;re most confident in.
        </p>
        <p>
          Usually saved for a premium player with a clearly favourable fixture, sometimes stacked with a double
          gameweek (when a team plays twice in one round) to maximise the ceiling.
        </p>
      </GuideSection>

      <GuideCallout label="How many you actually get">
        Two of each chip across a season - one Wildcard, Free Hit, Bench Boost, and Triple Captain usable in the
        first half, a fresh set of the same four unlocking for the second half. Unused first-half chips don&apos;t
        carry over into the second set.
      </GuideCallout>

      <GuideFAQ
        items={[
          {
            q: "Do chips cost points or transfers?",
            a: "No - playing a chip is free. Wildcard specifically also removes the normal transfer limit for that gameweek.",
          },
          {
            q: "Can I use two chips in the same gameweek?",
            a: "No, only one chip can be active per gameweek.",
          },
          {
            q: "What's the difference between Wildcard and Free Hit?",
            a: "Wildcard changes are permanent - your new squad stays. Free Hit changes revert automatically after that one gameweek.",
          },
          {
            q: "Do unused chips carry over to the second half of the season?",
            a: "No - each half of the season has its own set of four chips, and unused first-half chips are lost when the second set unlocks.",
          },
        ]}
      />

      <GuideCTA
        heading="Not sure when to play yours?"
        body="Matchday OS plans across the full gameweek horizon, not just the next one, so chip timing accounts for what's coming - not just this week."
        href="/about"
        label="See how it works"
      />
      <GuideRelated current="/guides/chips" />
    </AppShell>
  );
}
