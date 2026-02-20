import type { SlideConfig } from "@/components/wrapped/slides/types";
import { SlideM01_Intro } from "@/components/wrapped/slides/monthly/SlideM01_Intro";
import { SlideM02_Revenue } from "@/components/wrapped/slides/monthly/SlideM02_Revenue";
import { SlideM03_LeadsReservations } from "@/components/wrapped/slides/monthly/SlideM03_LeadsReservations";
import { SlideM04_TimeSaved } from "@/components/wrapped/slides/monthly/SlideM04_TimeSaved";
import { SlideM05_PeakDay } from "@/components/wrapped/slides/monthly/SlideM05_PeakDay";
import { SlideM06_Personality } from "@/components/wrapped/slides/monthly/SlideM06_Personality";
import { SlideM07_TopQuestion } from "@/components/wrapped/slides/monthly/SlideM07_TopQuestion";
import { SlideM08_NextGoal } from "@/components/wrapped/slides/monthly/SlideM08_NextGoal";
import { SlideM09_Closing } from "@/components/wrapped/slides/monthly/SlideM09_Closing";

export const monthlySlides: SlideConfig[] = [
  {
    key: "intro",
    Component: SlideM01_Intro,
    primaryCtaLabel: "Start ▶",
    onPrimaryCta: ({ goNext }) => goNext()
  },
  {
    key: "revenue",
    Component: SlideM02_Revenue,
    primaryCtaLabel: "Show me how →",
    onPrimaryCta: ({ goNext, setPostAction }) => {
      setPostAction({ type: "impact-details" });
      goNext();
    }
  },
  {
    key: "leads-reservations",
    Component: SlideM03_LeadsReservations,
    primaryCtaLabel: "View captured leads",
    onPrimaryCta: ({ goNext, setPostAction }) => {
      setPostAction({ type: "leads" });
      goNext();
    }
  },
  {
    key: "time-saved",
    Component: SlideM04_TimeSaved,
    primaryCtaLabel: "See resolved chats",
    onPrimaryCta: ({ goNext, setPostAction }) => {
      setPostAction({ type: "conversations" });
      goNext();
    }
  },
  {
    key: "peak-day",
    Component: SlideM05_PeakDay,
    primaryCtaLabel: "Next ▶",
    onPrimaryCta: ({ goNext }) => goNext()
  },
  {
    key: "personality",
    Component: SlideM06_Personality,
    primaryCtaLabel: "Next ▶",
    onPrimaryCta: ({ goNext }) => goNext()
  },
  {
    key: "top-question",
    Component: SlideM07_TopQuestion,
    primaryCtaLabel: "Next ▶",
    onPrimaryCta: ({ goNext }) => goNext()
  },
  {
    key: "next-goal",
    Component: SlideM08_NextGoal,
    primaryCtaLabel: "Next ▶",
    onPrimaryCta: ({ goNext }) => goNext()
  },
  {
    key: "closing",
    Component: SlideM09_Closing,
    primaryCtaLabel: null,
    onPrimaryCta: ({ close }) => close()
  }
];
