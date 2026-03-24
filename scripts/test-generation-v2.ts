import { generateIndustrySiteV2 } from "../lib/builder/generation/v2";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const cases = [
  {
    name: "barbershop",
    input: {
      businessName: "North Cut",
      industry: "barbershop",
      subtype: null,
      description: "Modern neighborhood barbershop known for fades, beard detailing, and a sharp room.",
      targetCustomer: "professionals who like clean weekly grooming",
      tone: "bold premium",
      primaryColor: "#1a1a1a",
      secondaryColor: "#f7f1e8",
      fontFamily: null,
      services: ["Skin fades", "Beard shaping", "Hot towel finish"],
      proofPoints: ["Booked out on Fridays", "Known for clean beard lines", "Late appointments available"],
      contact: { phone: "+38344111222", address: "Prishtine Center" },
      openingHours: "Mon-Sat 09:00-20:00",
      socials: null,
      uploadedImages: [],
      language: "en",
      qualityMode: "best" as const,
      brief: {
        audience: "professionals who want a sharp cut without wasted time",
        coreOffer: "precision barbering with dependable appointment flow",
        primaryCtaGoal: "book_appointment",
        topServices: ["Skin fades", "Beard shaping", "Hot towel finish"],
        proofPoints: ["Booked out on Fridays", "Known for clean beard lines", "Late appointments available"],
        tone: "bold premium"
      }
    }
  },
  {
    name: "restaurant",
    input: {
      businessName: "Mora Table",
      industry: "restaurant",
      subtype: null,
      description: "Evening restaurant serving charcoal dishes, seasonal pasta, and a serious wine list.",
      targetCustomer: "date-night guests and small groups",
      tone: "warm premium",
      primaryColor: "#7C2D12",
      secondaryColor: "#FFF7EE",
      fontFamily: null,
      services: ["Charcoal mains", "Seasonal pasta", "Dessert board"],
      proofPoints: ["Guests book ahead for Friday dinner", "House pasta is a repeat order", "Known for warm late-night atmosphere"],
      contact: { phone: "+38344111333", address: "Peje Old Town" },
      openingHours: "Tue-Sun 17:00-23:30",
      socials: null,
      uploadedImages: [],
      language: "en",
      qualityMode: "best" as const,
      brief: {
        audience: "guests planning dinner, dates, and weekend tables",
        coreOffer: "charcoal-led dinner service with a warm room and strong reservation flow",
        primaryCtaGoal: "reserve",
        topServices: ["Charcoal mains", "Seasonal pasta", "Dessert board"],
        proofPoints: ["Guests book ahead for Friday dinner", "House pasta is a repeat order", "Known for warm late-night atmosphere"],
        tone: "warm premium"
      }
    }
  },
  {
    name: "dental",
    input: {
      businessName: "Dentiva Care",
      industry: "dental clinic",
      subtype: null,
      description: "Family-focused dental clinic offering preventive care, cosmetic treatments, and clear treatment planning.",
      targetCustomer: "families and nervous first-time patients",
      tone: "calm clear",
      primaryColor: "#0F766E",
      secondaryColor: "#EFF7F5",
      fontFamily: null,
      services: ["Preventive care", "Whitening", "Restorative dentistry"],
      proofPoints: ["Clear treatment explanations", "Family-friendly appointments", "Modern clinic environment"],
      contact: { phone: "+38344111444", address: "Prizren Riverside" },
      openingHours: "Mon-Fri 08:00-18:00",
      socials: null,
      uploadedImages: [],
      language: "en",
      qualityMode: "best" as const,
      brief: {
        audience: "families and nervous first-time patients",
        coreOffer: "calm dental care with clear next steps and modern clinic standards",
        primaryCtaGoal: "book_visit",
        topServices: ["Preventive care", "Whitening", "Restorative dentistry"],
        proofPoints: ["Clear treatment explanations", "Family-friendly appointments", "Modern clinic environment"],
        tone: "calm clear"
      }
    }
  },
  {
    name: "real_estate",
    input: {
      businessName: "Northline Realty",
      industry: "real estate agency",
      subtype: null,
      description: "Local real estate agency helping buyers, sellers, and investors navigate city apartments and family homes.",
      targetCustomer: "buyers and sellers who want local guidance",
      tone: "credible modern",
      primaryColor: "#1F2937",
      secondaryColor: "#F7F5F0",
      fontFamily: null,
      services: ["City apartments", "Family homes", "Seller strategy"],
      proofPoints: ["Neighborhood-specific guidance", "Buyer search support", "Seller positioning and negotiation"],
      contact: { phone: "+38344111555", address: "Gjakove Center" },
      openingHours: "Mon-Sat 09:00-18:00",
      socials: null,
      uploadedImages: [],
      language: "en",
      qualityMode: "best" as const,
      brief: {
        audience: "buyers and sellers who want local guidance",
        coreOffer: "market-aware real estate support with clear next steps and area expertise",
        primaryCtaGoal: "inquire",
        topServices: ["City apartments", "Family homes", "Seller strategy"],
        proofPoints: ["Neighborhood-specific guidance", "Buyer search support", "Seller positioning and negotiation"],
        tone: "credible modern"
      }
    }
  }
];

async function main() {
  for (const testCase of cases) {
    const result = await generateIndustrySiteV2({ input: testCase.input, openai: null });
    assert(result, `[${testCase.name}] expected generator result`);
    const safeResult = result!;
    assert(safeResult.validation.passed, `[${testCase.name}] validation failed: ${JSON.stringify(safeResult.validation.issues)}`);
    assert(safeResult.meta.sectionBlueprintIds.length >= 6, `[${testCase.name}] section stack too short`);
    const flat = JSON.stringify(safeResult.siteDocument).toLowerCase();
    assert(!flat.includes("built for busy local clients"), `[${testCase.name}] banned phrase leaked`);
    console.log(`- ${testCase.name}: ${safeResult.meta.archetypeId} / ${safeResult.meta.layoutId}`);
    console.log(`  sections: ${safeResult.meta.sectionBlueprintIds.join(", ")}`);
    console.log(`  hero: ${safeResult.siteDocument.pages[0]?.sections[0]?.content?.headline}`);
  }
  console.log("Industry V2 generation checks passed.");
}

main().catch((error) => {
  console.error("Industry V2 generation checks failed.");
  console.error(error);
  process.exit(1);
});
