import type { Period, WrappedComputed } from "@/lib/wrapped/computeWrapped";
import type { WrappedPostAction } from "@/components/wrapped/types";

export type SlideProps = {
  model: WrappedComputed;
  mode: Period;
  isShareMode: boolean;
  isActive?: boolean;
  isDemo?: boolean;
  visualAnimate?: boolean;
  onPrimaryCTA: () => void;
  onSecondaryCTA?: () => void;
  onDone?: () => void;
  onShare?: () => void;
  comparisonLine?: string;
};

export type SlideCTAContext = {
  goNext: () => void;
  setPostAction: (action: WrappedPostAction) => void;
  toggleShareMode: (value: boolean) => void;
  close: () => void;
  model: WrappedComputed;
  mode: Period;
};

export type SlideConfig = {
  key: string;
  Component: React.ComponentType<SlideProps>;
  primaryCtaLabel?: string | null;
  onPrimaryCta?: (context: SlideCTAContext) => void;
};
