import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const sampleBusinesses = [
  {
    name: "Siround Dental",
    industry: "Dental",
    city: "Prishtina",
    plan: "pro",
    phone: "+38344111222",
    website_url: "https://siround-dental.example"
  },
  {
    name: "Kosovo Fit Studio",
    industry: "Fitness",
    city: "Prizren",
    plan: "basic",
    phone: "+38349111222",
    website_url: "https://fit-studio.example"
  },
  {
    name: "Blue Harbor Realty",
    industry: "Real Estate",
    city: "Tirana",
    plan: "pro",
    phone: "+355692228888",
    website_url: "https://blue-harbor.example"
  },
  {
    name: "Besa Restaurant Group",
    industry: "Food & Beverage",
    city: "Peja",
    plan: "trial",
    phone: "+38345111444",
    website_url: "https://besa-restaurants.example"
  }
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];

const ensureOwnerUserId = async () => {
  if (process.env.SEED_OWNER_USER_ID) return process.env.SEED_OWNER_USER_ID;

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw error;

  const firstUserId = data?.users?.[0]?.id;
  if (!firstUserId) {
    throw new Error("No auth users found. Create a user first or pass SEED_OWNER_USER_ID.");
  }

  return firstUserId;
};

const ensureBusiness = async (ownerUserId, input) => {
  const { data: existing } = await supabase
    .from("businesses")
    .select("id")
    .eq("name", input.name)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      owner_user_id: ownerUserId,
      owner_id: ownerUserId,
      name: input.name,
      business_name: input.name,
      industry: input.industry,
      city: input.city,
      phone: input.phone,
      website_url: input.website_url,
      plan: input.plan,
      status: "active"
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
};

const ensureSubscription = async (businessId, plan) => {
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return;

  const status = plan === "trial" ? "trialing" : "active";
  const mrr = plan === "pro" ? 199 : plan === "basic" ? 89 : 0;

  const { error } = await supabase.from("subscriptions").insert({
    business_id: businessId,
    provider: "stripe",
    plan,
    status,
    mrr_eur: mrr,
    current_period_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  });

  if (error) throw error;
};

const createConversation = async (businessId) => {
  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({
      business_id: businessId,
      channel: pick(["web", "instagram", "whatsapp"]),
      visitor_id: `visitor_${rand(1000, 9999)}`,
      status: pick(["open", "open", "closed", "escalated"])
    })
    .select("id")
    .single();

  if (error) throw error;
  return conversation.id;
};

const createMessage = async (businessId, conversationId, sender) => {
  const contentBySender = {
    visitor: [
      "Hi, can you share your pricing?",
      "Do you have availability this week?",
      "Can I get a callback on this number?"
    ],
    ai: [
      "Absolutely. I can walk you through the options.",
      "I found two plans that fit your use case.",
      "Would you like me to book a call with our team?"
    ],
    human: [
      "I am joining this thread now.",
      "Thanks for the details, we can proceed today.",
      "I can handle this manually and confirm shortly."
    ]
  };

  const { error } = await supabase.from("messages").insert({
    business_id: businessId,
    conversation_id: conversationId,
    sender,
    content: pick(contentBySender[sender]),
    tokens_in: sender === "visitor" ? rand(12, 110) : 0,
    tokens_out: sender !== "visitor" ? rand(40, 300) : 0,
    cost_usd: sender !== "visitor" ? Number((Math.random() * 0.09).toFixed(4)) : 0,
    created_at: new Date(Date.now() - rand(0, 6) * 24 * 60 * 60 * 1000).toISOString()
  });

  if (error) throw error;
};

const createLead = async (businessId, conversationId) => {
  const { error } = await supabase.from("leads").insert({
    business_id: businessId,
    conversation_id: conversationId,
    lead_type: pick(["reservation", "call_request", "quote", "demo"]),
    name: pick(["Arta", "Luan", "Meri", "Dardan"]),
    phone: pick(["+38344123456", "+355692223334", "+38349222111"]),
    email: pick(["lead1@example.com", "lead2@example.com", "lead3@example.com"]),
    payload: { source: "seed-script" }
  });

  if (error) throw error;
};

const createSession = async (businessId) => {
  const { error } = await supabase.from("website_sessions").insert({
    business_id: businessId,
    session_id: `sess_${rand(100000, 999999)}`,
    source: pick(["organic", "direct", "instagram", "paid"]),
    path: pick(["/", "/pricing", "/book", "/contact"]),
    created_at: new Date(Date.now() - rand(0, 6) * 24 * 60 * 60 * 1000).toISOString()
  });

  if (error) throw error;
};

const run = async () => {
  const ownerUserId = await ensureOwnerUserId();

  if (process.env.SEED_ADMIN_USER_ID) {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: process.env.SEED_ADMIN_USER_ID,
        role: "admin"
      },
      { onConflict: "id" }
    );
    if (error) throw error;
  }

  for (const sample of sampleBusinesses) {
    const businessId = await ensureBusiness(ownerUserId, sample);
    await ensureSubscription(businessId, sample.plan);

    const conversations = rand(5, 12);
    for (let i = 0; i < conversations; i += 1) {
      const conversationId = await createConversation(businessId);
      const messageCount = rand(3, 8);
      for (let j = 0; j < messageCount; j += 1) {
        await createMessage(businessId, conversationId, pick(["visitor", "ai", "human"]));
      }

      if (Math.random() > 0.6) {
        await createLead(businessId, conversationId);
      }
    }

    const sessions = rand(20, 40);
    for (let i = 0; i < sessions; i += 1) {
      await createSession(businessId);
    }
  }

  console.log("Founder dashboard seed complete.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
