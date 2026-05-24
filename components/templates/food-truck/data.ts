export interface FoodTruckLink {
  label: string;
  href: string;
}

export interface FoodTruckStat {
  value: string;
  label: string;
}

export interface FoodTruckMenuItem {
  name: string;
  price: string;
  description: string;
  spiceLevel?: number;
  image?: string;
}

export interface FoodTruckMenuPromo {
  eyebrow: string;
  title: string;
  body: string;
}

export interface FoodTruckMenuFeature {
  name: string;
  image: string;
  prices: string;
  featured?: boolean;
}

export interface FoodTruckCategory {
  id: "burgers" | "chicken" | "veggie" | "drinks";
  label: string;
}

export const foodTruckData = {
  brand: {
    name: "Northside Grill",
    tagline: "Burgers, chicken, and house sides done right.",
    logoUrl: null as string | null
  },
  header: {
    links: [
      { label: "Menu", href: "#menu" },
      { label: "Location", href: "#location" },
      { label: "Contact", href: "#contact" }
    ] satisfies FoodTruckLink[],
    locationLabel: "West Market District"
  },
  hero: {
    titleTop: "NORTHSIDE",
    titleBottom: "GRILL",
    tagline: "Casual burgers, crisp chicken, and house sides served fresh every day.",
    description:
      "Built for quick lunches, relaxed dinners, and easy group meals, with bold sauces, soft buns, and comfort-food staples that travel well.",
    primaryCta: {
      label: "Call to order",
      href: "tel:+15550132044"
    },
    secondaryCta: {
      label: "View menu",
      href: "#menu"
    },
    schedule: {
      eyebrow: "Open daily",
      location: "27 Market Lane, West Market District",
      hours: "11:00 AM – 10:00 PM"
    },
    stats: [
      { value: "11+", label: "Burgers" },
      { value: "10+", label: "House sauces" },
      { value: "Daily", label: "Fresh prep" }
    ] satisfies FoodTruckStat[],
    heroImage: "/templates/food-truck/graphics/signature-burger.svg"
  },
  menu: {
    heading: "OUR MENU",
    subheading: "Classic burgers, crispy chicken, loaded sides, and cold drinks in one practical menu.",
    promo: {
      eyebrow: "Combo offer",
      title: "Burger + fries + drink",
      body: "Build a complete meal from €14.50."
    } satisfies FoodTruckMenuPromo,
    categories: [
      { id: "burgers", label: "Signature burgers" },
      { id: "chicken", label: "Crispy chicken" },
      { id: "veggie", label: "Veggie" },
      { id: "drinks", label: "Drinks" }
    ] satisfies FoodTruckCategory[],
    items: {
      burgers: [
        {
          name: "Cheesy Buffalo",
          price: "€10.50",
          description: "Brioche bun, house beef patty, cheddar, burger sauce, pickles, onion, tomato, and lettuce.",
          spiceLevel: 2,
          image: "/templates/food-truck/burgers/beef/cheesy-buffalo.webp"
        },
        {
          name: "Angry Bull",
          price: "€12.00",
          description: "Brioche bun, house beef patty, cheddar, chili cheese sauce, jalapeno, pickles, and lettuce.",
          spiceLevel: 3,
          image: "/templates/food-truck/burgers/beef/angry-bull.webp"
        },
        {
          name: "Smoky BBQ",
          price: "€13.00",
          description: "Brioche bun, house beef patty, cheddar, onion rings, crisp onions, BBQ sauce, tomato, and lettuce.",
          spiceLevel: 1,
          image: "/templates/food-truck/burgers/beef/smoky-bbq.webp"
        },
        {
          name: "Blazing Nacho",
          price: "€13.00",
          description: "Brioche bun, house beef patty, cheddar, jalapeno, nachos, sriracha sauce, tomato, and lettuce.",
          spiceLevel: 3,
          image: "/templates/food-truck/burgers/beef/blazing-nacho.webp"
        },
        {
          name: "Classic Cheese",
          price: "€7.00",
          description: "Brioche bun, house beef patty, cheddar, burger sauce, pickles, onion, tomato, and lettuce.",
          spiceLevel: 0,
          image: "/templates/food-truck/burgers/beef/classic-cheese.webp"
        }
      ] satisfies FoodTruckMenuItem[],
      chicken: [
        {
          name: "Crunchy Chicken",
          price: "€8.50",
          description: "Brioche bun, crispy chicken strips, cheddar, burger sauce, and lettuce.",
          spiceLevel: 1,
          image: "/templates/food-truck/burgers/chicken/crunchy-chicken.webp"
        },
        {
          name: "Loaded Crunchy",
          price: "€9.00",
          description: "Brioche bun, crispy chicken strips, cheddar, burger sauce, tomato, onion, pickles, and lettuce.",
          spiceLevel: 1,
          image: "/templates/food-truck/burgers/chicken/loaded-crunchy.webp"
        },
        {
          name: "Crispy Ringer",
          price: "€10.00",
          description: "Brioche bun, crispy chicken strips, cheddar, burger sauce, onion rings, tomato, and lettuce.",
          spiceLevel: 1,
          image: "/templates/food-truck/burgers/chicken/crispy-ringer.webp"
        },
        {
          name: "Mexican Cracker",
          price: "€11.00",
          description: "Brioche bun, crispy chicken strips, cheddar, jalapeno, nachos, sriracha sauce, and lettuce.",
          spiceLevel: 2,
          image: "/templates/food-truck/burgers/chicken/mexican-cracker.webp"
        },
        {
          name: "Flip Chicken",
          price: "€6.00",
          description: "Brioche bun, crispy chicken strips, cheddar, burger sauce, and lettuce.",
          spiceLevel: 0,
          image: "/templates/food-truck/burgers/chicken/flip-chicken.webp"
        },
        {
          name: "Loaded Bomber",
          price: "€13.00",
          description: "Brioche bun, crispy chicken strips, cheddar, chili cheese bites, onion, jalapeno, and lettuce.",
          spiceLevel: 2,
          image: "/templates/food-truck/burgers/chicken/loaded-bomber.webp"
        }
      ] satisfies FoodTruckMenuItem[],
      veggie: [
        {
          name: "Plant Power",
          price: "€9.00",
          description: "Brioche bun, falafel patty, cheddar, burger sauce, pickles, lettuce, onion, and tomato.",
          spiceLevel: 0
        },
        {
          name: "Veggie BBQ",
          price: "€11.00",
          description: "Brioche bun, falafel patty, cheddar, burger sauce, onion rings, BBQ sauce, tomato, and lettuce.",
          spiceLevel: 0
        }
      ] satisfies FoodTruckMenuItem[],
      drinks: [
        {
          name: "Cola, Zero, Fanta, Sprite",
          price: "€2.50",
          description: "330ml chilled can.",
          image: "/templates/food-truck/graphics/soda-pack.svg"
        },
        {
          name: "Juice pouch",
          price: "€1.50",
          description: "200ml fruit drink.",
          image: "/templates/food-truck/graphics/juice-pouch.svg"
        },
        {
          name: "Still water",
          price: "€2.00",
          description: "500ml bottled water.",
          image: "/templates/food-truck/graphics/water-bottle.svg"
        },
        {
          name: "Energy drink",
          price: "€3.50",
          description: "250ml can.",
          image: "/templates/food-truck/graphics/energy-drink.svg"
        }
      ] satisfies FoodTruckMenuItem[]
    },
    appetizers: [
      {
        name: "Chili Cheese Nuggets",
        image: "/templates/food-truck/appetizers/chili-cheese-nuggets.webp",
        prices: "6 pcs €5.00 • 10 pcs €7.50 • 16 pcs €11.00"
      },
      {
        name: "Mozzarella Sticks",
        image: "/templates/food-truck/appetizers/mozzarella-sticks.webp",
        prices: "4 pcs €5.00 • 8 pcs €9.00 • 14 pcs €14.00"
      },
      {
        name: "Onion Rings",
        image: "/templates/food-truck/appetizers/onion-rings.webp",
        prices: "6 pcs €4.00 • 12 pcs €7.00 • 24 pcs €12.00"
      },
      {
        name: "Fries",
        image: "/templates/food-truck/appetizers/fries.webp",
        prices: "€3.50",
        featured: true
      }
    ] satisfies FoodTruckMenuFeature[],
    crispyChicken: [
      {
        name: "Chicken Wings",
        image: "/templates/food-truck/fried-chicken/chicken-wings.webp",
        prices: "6 pcs €7.50 • 10 pcs €11.00 • 20 pcs €20.00"
      },
      {
        name: "Chicken Strips",
        image: "/templates/food-truck/fried-chicken/chicken-strips.webp",
        prices: "3 pcs €6.00 • 6 pcs €11.50 • 9 pcs €16.00"
      }
    ] satisfies FoodTruckMenuFeature[]
  },
  location: {
    heading: "LOCATION",
    description: "Find us in the West Market district for lunch, dinner, and easy weekend group orders.",
    mapImage: "/templates/food-truck/location-map.jpg",
    addressTitle: "Main location",
    addressLines: ["27 Market Lane", "West Market District", "Open for dine-in, takeout, and pickup"],
    calendarTitle: "Open daily",
    calendarBody: "Drop in for weekday lunches, evening service, and weekend comfort-food runs.",
    hoursTitle: "Hours",
    hoursBody: "Monday – Sunday: 11:00 AM – 10:00 PM",
    eventsTitle: "Private events & catering",
    eventsBody: "Need crowd-friendly food for a work lunch or casual gathering? Reach out for group menus and event availability."
  },
  contact: {
    heading: "CONTACT",
    description: "Questions, catering requests, or group dinner plans? Reach out and we’ll point you to the right service.",
    phone: {
      label: "Phone",
      value: "(555) 013-2044",
      href: "tel:+15550132044",
      help: "Call the restaurant directly"
    },
    email: {
      label: "Email",
      value: "hello@northsidegrill.com",
      href: "mailto:hello@northsidegrill.com",
      help: "Email for group bookings and general questions"
    },
    instagram: {
      label: "Instagram",
      value: "@northsidegrill",
      href: "https://instagram.com/northsidegrill",
      help: "See menu drops and daily specials"
    },
    visitTitle: "Visit us",
    visitBody: "Open every day from 11:00 AM to 10:00 PM at 27 Market Lane, West Market District.",
    visitNote: "Kitchen hotline: (555) 013-2044"
  },
  reservation: {
    heading: "Reserve a table",
    description:
      "Planning dinner for a group or a weekend visit? Send a reservation request and we’ll confirm the best available time.",
    buttonLabel: "Request reservation",
    buttonHref: "mailto:reservations@northsidegrill.com?subject=Reservation%20Request"
  },
  footer: {
    description: "A casual neighborhood restaurant for burgers, fried chicken, sides, and quick group meals.",
    links: [
      { label: "Menu", href: "#menu" },
      { label: "Location", href: "#location" },
      { label: "Contact", href: "#contact" },
      { label: "Reservations", href: "#reservations" }
    ] satisfies FoodTruckLink[],
    contactLabel: "Contact",
    address: "27 Market Lane, West Market District",
    copyright: "© Northside Grill. All rights reserved."
  },
  stickyCta: {
    locationLabel: "Open daily",
    locationDetail: "West Market District",
    buttonLabel: "Call the restaurant",
    buttonHref: "tel:+15550132044"
  }
};

export type FoodTruckTemplateData = typeof foodTruckData;
