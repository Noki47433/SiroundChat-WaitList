import type { SlideConfig } from "@/components/wrapped/slides/types";
import { Slide01_Hook } from "@/components/wrapped/slides/Slide01_Hook";
import { Slide02_Money } from "@/components/wrapped/slides/Slide02_Money";
import { Slide03_LeadsReservations } from "@/components/wrapped/slides/Slide03_LeadsReservations";
import { Slide04_TimeSaved } from "@/components/wrapped/slides/Slide04_TimeSaved";
import { Slide05_CustomersHelped } from "@/components/wrapped/slides/Slide05_CustomersHelped";
import { Slide06_MVPChat } from "@/components/wrapped/slides/Slide06_MVPChat";
import { Slide07_Closing } from "@/components/wrapped/slides/Slide07_Closing";

export const weeklySlides: SlideConfig[] = [
  {
    key: "hook",
    Component: Slide01_Hook,
    primaryCtaLabel: "Start ▶",
    onPrimaryCta: ({ goNext }) => goNext()
  },
  {
    key: "money",
    Component: Slide02_Money,
    primaryCtaLabel: "Show me how →",
    onPrimaryCta: ({ goNext, setPostAction }) => {
      setPostAction({ type: "impact-details" });
      goNext();
    }
  },
  {
    key: "leads-reservations",
    Component: Slide03_LeadsReservations,
    primaryCtaLabel: "View captured leads",
    onPrimaryCta: ({ goNext, setPostAction }) => {
      setPostAction({ type: "leads" });
      goNext();
    }
  },
  {
    key: "time-saved",
    Component: Slide04_TimeSaved,
    primaryCtaLabel: "See resolved chats",
    onPrimaryCta: ({ goNext, setPostAction }) => {
      setPostAction({ type: "conversations" });
      goNext();
    }
  },
  {
    key: "customers-helped",
    Component: Slide05_CustomersHelped,
    primaryCtaLabel: "Set staff cost (optional)",
    onPrimaryCta: ({ goNext, setPostAction }) => {
      setPostAction({ type: "settings" });
      goNext();
    }
  },
  {
    key: "mvp-chat",
    Component: Slide06_MVPChat,
    primaryCtaLabel: "Open conversation",
    onPrimaryCta: ({ goNext, setPostAction, model }) => {
      if (model.mvpConversation?.id) {
        setPostAction({ type: "conversation", id: model.mvpConversation.id });
      } else {
        setPostAction({ type: "impact-details" });
      }
      goNext();
    }
  },
  {
    key: "closing",
    Component: Slide07_Closing,
    primaryCtaLabel: null,
    onPrimaryCta: ({ close }) => close()
  }
];
