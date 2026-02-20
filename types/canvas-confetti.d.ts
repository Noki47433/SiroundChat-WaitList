declare module "canvas-confetti" {
  type ConfettiOrigin = { x?: number; y?: number };
  type ConfettiOptions = {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: ConfettiOrigin;
    colors?: string[];
    shapes?: string[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  };
  type Confetti = (options?: ConfettiOptions) => Promise<null> | null;
  const confetti: Confetti;
  export default confetti;
}
