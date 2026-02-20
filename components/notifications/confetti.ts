import confetti from "canvas-confetti";

const firedNotifications = new Set<string>();

export function fireConfetti(notificationId?: string) {
  if (typeof window === "undefined") return;
  if (notificationId && firedNotifications.has(notificationId)) return;
  if (notificationId) {
    firedNotifications.add(notificationId);
  }

  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.6 }
  });
}
