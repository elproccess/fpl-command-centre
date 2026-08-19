import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { GuideCTA, GuideCallout, GuideFAQ, GuideHero, GuideRelated, GuideSection } from "@/components/guide-blocks";

export const metadata: Metadata = {
  title: "Common FPL Mistakes Beginners Make (and How to Avoid Them)",
  description:
    "The most common Fantasy Premier League mistakes new managers make - team stacking, chasing last week's points, ignoring injury flags, and wasting hits.",
  alternates: { canonical: "/guides/mistakes" },
};

export default function MistakesGuidePage() {
  return (
    <AppShell title="Common FPL Mistakes" eyebrow="The ones that cost the most points early on">
      <GuideHero
        eyebrow="Beginner mistakes"
        title="The FPL mistakes that quietly cost the most points"
        dek="None of these are complicated once you know to look for them - they're just easy to miss in your first few gameweeks. Here are the ones that come up again and again."
      />

      <GuideSection title="Stacking too many players from one team">
        <p>
          You&apos;re capped at 3 players from any single club, but even under that cap, leaning too heavily on one
          team is risky - a bad fixture run, an injury crisis, or a poor patch of form hits several of your
          players at once instead of just one.
        </p>
      </GuideSection>

      <GuideSection title="Chasing last week's top scorer">
        <p>
          A huge score last gameweek doesn&apos;t mean it repeats - it might have been a favourable one-off fixture,
          a penalty they won&apos;t get again, or simple variance. What matters going forward is fixtures, form, and
          underlying chances from here, not what already happened.
        </p>
      </GuideSection>

      <GuideSection title="Leaving budget unspent">
        <p>
          Money sitting in your bank scores you nothing. It&apos;s fine to hold a little back for flexibility, but a
          large unspent balance usually means your squad could be stronger for the same total spend.
        </p>
      </GuideSection>

      <GuideSection title="Ignoring injury and rotation risk">
        <p>
          A player carrying a visible injury or suspension flag is easy to catch. The harder case is a player
          with no flag at all who simply isn&apos;t nailed to their club&apos;s starting XI - new signings, players
          coming back from injury, or squad players in a rotation-heavy team. No red flag doesn&apos;t automatically
          mean safe minutes.
        </p>
      </GuideSection>

      <GuideSection title="Taking hits without a clear reason">
        <p>
          A -4 hit needs to make back more than 4 points to be worth it, and that&apos;s not guaranteed even for a
          player upgrade that looks obviously better on paper. Banking a free transfer and waiting one more week
          is usually the safer default unless there&apos;s a specific, time-sensitive reason to move now.
        </p>
      </GuideSection>

      <GuideCallout label="The pattern behind most of these">
        Almost every early mistake comes from reacting to what already happened instead of checking what&apos;s
        actually true about your squad right now - budget, structure, availability, and what&apos;s coming up. That
        check takes a couple of minutes and catches most of the list above.
      </GuideCallout>

      <GuideFAQ
        items={[
          {
            q: "Is it bad to have 3 players from the same club?",
            a: "Not automatically - it's the maximum allowed, and fine if that club has good fixtures. The risk is depending on it too heavily if their form or fixtures turn.",
          },
          {
            q: "Should I always spend my full budget?",
            a: "Not necessarily all the way to zero, but a large unspent balance usually signals your squad could be stronger for the same money.",
          },
          {
            q: "How do I check for rotation risk if there's no injury flag?",
            a: "Look at recent minutes and starts, not just reputation or price - a proven starter elsewhere or last season isn't automatically a proven starter now, especially after a transfer.",
          },
          {
            q: "Is taking a -4 hit ever worth it?",
            a: "Yes, when there's a clear, specific reason - but it needs to make back more than 4 points, which isn't guaranteed just because a player looks better on paper.",
          },
        ]}
      />

      <GuideCTA
        heading="Let the check do this for you"
        body="Matchday OS's squad health check flags team-stacking, unspent budget, availability issues, and minutes risk automatically - before your deadline, not after."
        href="/about"
        label="See how it works"
      />
      <GuideRelated current="/guides/mistakes" />
    </AppShell>
  );
}
