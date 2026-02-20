// Summary: Preset FAQ lists for each business type to seed the chatbot builder; secondary reference.
import { BusinessType, FaqItem } from "./chatbotTypes";

type FaqPresetMap = Record<BusinessType, FaqItem[]>;

export const FAQ_PRESETS: FaqPresetMap = {
  restaurant: [
    {
      id: "rest-1",
      question: "Do you take reservations?",
      answer: "Yes, you can reserve a table anytime using our booking form or by calling us."
    },
    {
      id: "rest-2",
      question: "Do you offer delivery?",
      answer: "We offer delivery through our partners and direct phone orders."
    },
    {
      id: "rest-3",
      question: "Do you have vegetarian options?",
      answer: "Yes, we have multiple vegetarian and vegan options on the menu."
    },
    {
      id: "rest-4",
      question: "Do you have Wi-Fi?",
      answer: "Yes, free Wi-Fi is available for all guests."
    }
  ],
  hotel: [
    { id: "hotel-1", question: "What time is check-in?", answer: "Check-in starts at 3 PM. Early check-in is available when rooms are ready." },
    { id: "hotel-2", question: "Is breakfast included?", answer: "Breakfast is included for all direct bookings and select packages." },
    { id: "hotel-3", question: "Do you have parking?", answer: "Yes, we have secure on-site parking for guests." },
    { id: "hotel-4", question: "Do you allow pets?", answer: "We have a limited number of pet-friendly rooms. Please contact us to confirm availability." }
  ],
  cafe: [
    { id: "cafe-1", question: "Do you have dairy-free milk?", answer: "Yes, we offer oat, almond, and soy milk options." },
    { id: "cafe-2", question: "Can I work from the cafe?", answer: "Absolutely. We have Wi-Fi and outlets available for guests." },
    { id: "cafe-3", question: "Do you take large group orders?", answer: "Yes, please call ahead for group orders or catering requests." },
    { id: "cafe-4", question: "Do you serve food?", answer: "We have pastries, sandwiches, and a small brunch menu served all day." }
  ],
  barber: [
    { id: "barber-1", question: "Do you accept walk-ins?", answer: "Walk-ins are welcome, but appointments are recommended to avoid wait times." },
    { id: "barber-2", question: "Do you offer beard trims?", answer: "Yes, we offer beard trims, shaping, and hot towel shaves." },
    { id: "barber-3", question: "What are your hours?", answer: "We are open from 9 AM to 7 PM, Monday through Saturday." },
    { id: "barber-4", question: "Do you cut kids’ hair?", answer: "Yes, we provide haircuts for all ages." }
  ],
  real_estate: [
    { id: "re-1", question: "How do I book a viewing?", answer: "Share the property address or MLS ID and we will schedule a viewing for you." },
    { id: "re-2", question: "Do you help with mortgages?", answer: "We can connect you with vetted lenders and guide you through pre-approval." },
    { id: "re-3", question: "What areas do you cover?", answer: "We cover the metro area and nearby suburbs. Ask about a specific neighborhood anytime." },
    { id: "re-4", question: "Do you manage rentals?", answer: "Yes, we provide property management and tenant screening services." }
  ],
  clinic: [
    { id: "clinic-1", question: "How do I book an appointment?", answer: "Share your preferred date and reason for visit; we will confirm the closest slot." },
    { id: "clinic-2", question: "Do you accept insurance?", answer: "We accept most major insurance plans. Please bring your card for verification." },
    { id: "clinic-3", question: "What are your hours?", answer: "We are open 8 AM – 6 PM on weekdays and 9 AM – 2 PM on Saturdays." },
    { id: "clinic-4", question: "Do you offer telehealth?", answer: "Yes, virtual visits are available for many appointment types." }
  ],
  gym: [
    { id: "gym-1", question: "Do you offer day passes?", answer: "Yes, day passes are available. Ask at the front desk or purchase online." },
    { id: "gym-2", question: "Do you have personal trainers?", answer: "We have certified trainers available for 1:1 and small group sessions." },
    { id: "gym-3", question: "What classes do you offer?", answer: "We offer HIIT, yoga, strength, and spin classes daily." },
    { id: "gym-4", question: "Is there locker access?", answer: "Secure lockers and showers are available for all members and guests." }
  ],
  taxi: [
    { id: "taxi-1", question: "How do I book a ride?", answer: "Share your pickup and drop-off locations and we will dispatch the nearest driver." },
    { id: "taxi-2", question: "Do you offer airport runs?", answer: "Yes, we provide flat-rate airport transfers. Ask for today’s rate." },
    { id: "taxi-3", question: "Can I pay by card?", answer: "Yes, we accept cash and all major cards." },
    { id: "taxi-4", question: "Can I schedule in advance?", answer: "You can schedule rides in advance for early mornings or busy times." }
  ],
  ecommerce: [
    { id: "ecom-1", question: "What is your return policy?", answer: "You can return items within 30 days in original condition for a refund." },
    { id: "ecom-2", question: "How long is shipping?", answer: "Standard shipping takes 3–5 business days; express options are available." },
    { id: "ecom-3", question: "Do you ship internationally?", answer: "Yes, we ship to most countries. Rates are calculated at checkout." },
    { id: "ecom-4", question: "How do I track my order?", answer: "Use your order number to track delivery in your account or via the tracking link." }
  ],
  custom: []
};
