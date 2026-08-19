import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { GuideCTA, GuideCallout, GuideFAQ, GuideHero, GuideList, GuideRelated, GuideSection } from "@/components/guide-blocks";

export const metadata: Metadata = {
  title: "How to Play Fantasy Premier League: A Beginner's Guide",
  description:
    "New to FPL? A plain-English guide to squads, budget, scoring, transfers, and deadlines - everything you need to know before your first gameweek.",
  alternates: { canonical: "/guides/beginners" },
};

export default function BeginnersGuidePage() {
  return (
    <AppShell title="FPL for Beginners" eyebrow="Everything you need before your first gameweek">
      <GuideHero
        eyebrow="Beginner's guide"
        title="How to play Fantasy Premier League, explained simply"
        dek="You pick a 15-player squad within a budget, one plays captain for double points, and your score depends on how they actually perform in real matches. That's the whole game - everything else is detail."
      />

      <GuideSection title="Building your squad">
        <p>
          You get <b>£100.0m</b> to build a 15-player squad: 2 goalkeepers, 5 defenders, 5 midfielders, and
          3 forwards. You can pick at most <b>3 players from any one real Premier League club</b>, so you can&apos;t
          just load up on one team&apos;s entire attack.
        </p>
        <p>
          Each gameweek you pick a <b>starting XI</b> from your 15 in a valid formation (always 1 goalkeeper, at
          least 3 defenders, at least 2 forwards). The other 4 sit on your bench as backup in case a starter
          doesn&apos;t play.
        </p>
      </GuideSection>

      <GuideSection title="How scoring actually works">
        <p>Points come from what your players do in their real matches that gameweek. Roughly:</p>
        <GuideList
          items={[
            "Playing 60+ minutes: 2 points (1 point for under 60 minutes, 0 for not playing)",
            "Goals: more for defenders and goalkeepers than forwards, since it's rarer",
            "Assists: 3 points regardless of position",
            "Clean sheets: points for defenders, goalkeepers, and midfielders if their team doesn't concede",
            "Cards, own goals, missed penalties: negative points",
            "Bonus points: the 3 best performers in each match get extra points on top, based on a live in-match rating",
          ]}
        />
      </GuideSection>

      <GuideSection title="Captain and vice-captain">
        <p>
          Before each deadline you pick a <b>captain</b> - whatever they score that gameweek is doubled. If your
          captain doesn&apos;t play at all, it falls back to your <b>vice-captain</b> instead, so always pick a backup
          who&apos;s actually going to start.
        </p>
      </GuideSection>

      <GuideSection title="Transfers, deadlines, and the bank">
        <p>
          You get <b>1 free transfer</b> each gameweek to swap a player. Don&apos;t use it? It banks - you can stack
          up to <b>5 free transfers</b> at once. Make an extra transfer beyond what you&apos;ve banked and it costs
          <b> -4 points</b> (a &quot;hit&quot;), so it needs to be worth it.
        </p>
        <p>
          Every gameweek has a <b>deadline</b> - once it passes, your squad and captain are locked in for that
          round of matches. Selling a player for more than you paid also banks a small profit into your budget
          (minus a small sell-on fee), so your £100.0m can grow over the season.
        </p>
      </GuideSection>

      <GuideCallout label="The one thing that trips people up early">
        Points only count for players who actually start (or come on) and perform. A big-name player on the bench
        of their real club scores you nothing, no matter how good they are - ownership and reputation don&apos;t
        matter, minutes on the pitch do.
      </GuideCallout>

      <GuideFAQ
        items={[
          {
            q: "How much budget do I start with?",
            a: "£100.0m, to build a 15-player squad across goalkeepers, defenders, midfielders, and forwards.",
          },
          {
            q: "How many players can I pick from one club?",
            a: "A maximum of 3 players from any single real Premier League club.",
          },
          {
            q: "What happens if I don't use my free transfer?",
            a: "It carries over to next gameweek - you can bank up to 5 free transfers at once before they stop stacking.",
          },
          {
            q: "What's a 'hit' in FPL?",
            a: "Making a transfer beyond what you've got banked costs -4 points, deducted from your gameweek score. Sometimes worth it, often not.",
          },
          {
            q: "Does my captain's score really double?",
            a: "Yes - whatever your captain scores that gameweek is doubled. If they don't play, your vice-captain's score doubles instead.",
          },
        ]}
      />

      <GuideCTA
        heading="Ready to build your squad?"
        body="Import your team once your squad's set and Matchday OS checks it for real issues - unavailable players, unspent budget, fixture risk - before your first deadline."
        href="/about"
        label="See how it works"
      />
      <GuideRelated current="/guides/beginners" />
    </AppShell>
  );
}
