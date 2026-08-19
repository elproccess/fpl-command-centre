import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { GuideCTA, GuideCallout, GuideFAQ, GuideHero, GuideList, GuideRelated, GuideSection } from "@/components/guide-blocks";

export const metadata: Metadata = {
  title: "How FPL Captaincy Works (and How to Pick One)",
  description:
    "The captain and vice-captain mechanic in Fantasy Premier League explained, plus what actually goes into a good pick each gameweek.",
  alternates: { canonical: "/guides/captaincy" },
};

export default function CaptaincyGuidePage() {
  return (
    <AppShell title="FPL Captaincy Explained" eyebrow="The single biggest score swing each gameweek">
      <GuideHero
        eyebrow="Captaincy guide"
        title="How FPL captaincy works, and how to actually pick one"
        dek="Your captain's points double. Get it right and it's the biggest single boost available each week - get it wrong and it's the biggest missed opportunity. Here's the mechanic, and what actually goes into a good pick."
      />

      <GuideSection title="The mechanic">
        <p>
          Before each deadline, you mark one player in your starting XI as <b>captain</b> and another as{" "}
          <b>vice-captain</b>. Whatever your captain scores that gameweek gets doubled - a 10-point haul becomes
          20.
        </p>
        <p>
          If your captain doesn&apos;t play at all (injury, suspension, unexpectedly benched), the armband
          automatically passes to your vice-captain instead - their score doubles rather than losing the
          multiplier entirely. If neither plays, you lose the double for that gameweek.
        </p>
      </GuideSection>

      <GuideSection title="What actually goes into a good pick">
        <p>The obvious answer is &quot;pick your best player&quot; - but a good captaincy choice weighs several things together:</p>
        <GuideList
          items={[
            "Fixture difficulty - a strong player against a weak defence is a better swing than the same player against a tough one",
            "Minutes security - a player who might get subbed off or rested is a real risk on a pick that's supposed to double your points",
            "Recent form - not just reputation, but what they've actually been doing in their last few matches",
            "Underlying chances - shots, expected goals, and expected assists tend to predict future returns better than past points alone",
            "Home vs away - most attacking players perform a little better at home, though it's a smaller factor than fixture difficulty",
          ]}
        />
      </GuideSection>

      <GuideSection title="Common captaincy mistakes">
        <p>
          Captaining a player just because they&apos;re expensive or widely owned, without checking their actual
          fixture. Picking a defender or defensive midfielder for captain when a clean sheet alone won&apos;t
          produce a big enough score if they don&apos;t also contribute goals or assists. And leaving your
          vice-captain as someone who&apos;s also a doubtful starter - if your captain and vice-captain both don&apos;t
          play, you lose the double entirely.
        </p>
      </GuideSection>

      <GuideCallout label="The safe habit worth building">
        Always set your vice-captain to someone you&apos;re highly confident will actually start, even if they&apos;re
        not your top scoring pick. The vice-captain&apos;s job is to be a safety net, not a second guess at your
        best player.
      </GuideCallout>

      <GuideFAQ
        items={[
          {
            q: "What happens if my captain doesn't play?",
            a: "The double automatically transfers to your vice-captain instead, as long as they play.",
          },
          {
            q: "Can I change my captain after the deadline?",
            a: "No - your captain and vice-captain lock in at the gameweek deadline, same as the rest of your squad.",
          },
          {
            q: "Does the captain have to be in my starting XI?",
            a: "Yes - captaincy only applies to a player in your starting XI, not your bench.",
          },
          {
            q: "Is it ever better to captain a cheap player over an expensive one?",
            a: "Yes, when the cheaper player has a clearly better fixture and is in better recent form - price and reputation don't score points, output does.",
          },
        ]}
      />

      <GuideCTA
        heading="Want the reasoning, not just a name?"
        body="Matchday OS shows captaincy picks with the actual fixture, form, and minutes-security reasoning behind them - not just a ranked list."
        href="/about"
        label="See how it works"
      />
      <GuideRelated current="/guides/captaincy" />
    </AppShell>
  );
}
