import { useEffect, useState } from "react";

export function useSectionObserver(sectionIds: readonly string[]) {
  const [activeSection, setActiveSection] = useState(sectionIds[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-section-id");
            if (id) {
              setActiveSection(id);
            }
          }
        });
      },
      {
        rootMargin: "-35% 0px -45% 0px",
        threshold: 0
      }
    );

    sectionIds.forEach((id) => {
      const element = document.querySelector<HTMLElement>(`[data-section-id="${id}"]`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [sectionIds]);

  return { activeSection };
}
