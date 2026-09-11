'use client';
import { Footprints, Moon, Sunrise, Utensils } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DailyGuide as Guide } from '@/lib/daily-guide';

const icons = {
  before: Footprints,
  food: Utensils,
  after: Moon,
  recovery: Moon,
  next: Sunrise,
};

export function DailyGuide({ guide }: { guide: Guide }) {
  return (
    <section className="daily-guide" aria-label="Your daily guide">
      <h3>Your daily guide</h3>
      <Tabs key={guide.key} defaultValue={guide.sections[0].id}>
        <TabsList className="daily-guide-tabs" aria-label="Daily tips">
          {guide.sections.map((section) => (
            <TabsTrigger key={section.id} value={section.id}>
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {guide.sections.map((section) => {
          const Icon = icons[section.id];
          return (
            <TabsContent
              key={section.id}
              value={section.id}
              className="daily-guide-panel"
            >
              <h4>
                <Icon size={19} aria-hidden="true" />
                {section.title}
              </h4>
              {section.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </TabsContent>
          );
        })}
      </Tabs>
      <details className="guide-sources">
        <summary>About these tips</summary>
        <p>
          General guidance for this type of day. Choose foods and routines that
          suit you.
        </p>
        <ul>
          <li>
            <a
              href="https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/"
              target="_blank"
              rel="noreferrer"
            >
              NHS · running and rest days
            </a>
          </li>
          <li>
            <a
              href="https://www.londonmarathonevents.co.uk/london-marathon/medical-advice"
              target="_blank"
              rel="noreferrer"
            >
              London Marathon · preparation, fluids and recovery
            </a>
          </li>
          <li>
            <a
              href="https://www.sportsdietitians.com.au/wp-content/uploads/2020/07/Recovery-Nutrition.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Sports Dietitians Australia · recovery nutrition
            </a>
          </li>
          <li>
            <a
              href="https://www.nhs.uk/live-well/sleep-and-tiredness/self-help-tips-to-fight-fatigue/"
              target="_blank"
              rel="noreferrer"
            >
              NHS · sleep and recovery
            </a>
          </li>
        </ul>
      </details>
    </section>
  );
}
