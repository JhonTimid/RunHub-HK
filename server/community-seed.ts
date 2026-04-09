import { storage } from "./storage";

export async function seedCommunityData() {
  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length > 0) {
    console.log(`[community-seed] already seeded ${existingUsers.length} users`);
    return;
  }

  const now = new Date().toISOString();

  // Seed mock users
  const ryan = await storage.insertUser({
    name: "Ryan Pang", handle: "ryanruns_hk",
    avatarInitials: "RP", avatarColor: "#22c55e",
    location: "Kowloon, HK", bio: "Marathon trainee. Sub-3:30 chasing. Trail is life.",
    totalRuns: 8, avgRating: 4.8, createdAt: now,
  });

  const maya = await storage.insertUser({
    name: "Maya Chen", handle: "mayatrails",
    avatarInitials: "MC", avatarColor: "#3b82f6",
    location: "Sai Kung, HK", bio: "Trail runner & UTMB dreamer. Hiker by day.",
    totalRuns: 23, avgRating: 4.9, createdAt: now,
  });

  const jake = await storage.insertUser({
    name: "Jake Liu", handle: "jakeliu_pace",
    avatarInitials: "JL", avatarColor: "#f97316",
    location: "Central, HK", bio: "Road runner. Sub-45 10K. Coffee after every run.",
    totalRuns: 12, avgRating: 4.6, createdAt: now,
  });

  const sophia = await storage.insertUser({
    name: "Sophia Wong", handle: "sophiawong_run",
    avatarInitials: "SW", avatarColor: "#a855f7",
    location: "Tsim Sha Tsui, HK", bio: "Fun runs & recovery queen. Running is therapy.",
    totalRuns: 5, avgRating: 4.7, createdAt: now,
  });

  const alex = await storage.insertUser({
    name: "Alex Tam", handle: "alextam_hk",
    avatarInitials: "AT", avatarColor: "#ec4899",
    location: "Sha Tin, HK", bio: "Track intervals nerd. Olympic distance triathlete.",
    totalRuns: 31, avgRating: 4.5, createdAt: now,
  });

  // Helper to get future date
  const futureDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().slice(0, 10);
  };
  const pastDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  // Seed community runs
  const run1 = await storage.insertCommunityRun({
    hostId: maya.id, title: "Saturday Morning Sai Kung Trail",
    runType: "trail", date: futureDate(5), startTime: "06:30",
    meetingPoint: "Pak Tam Chung Visitor Centre, Sai Kung",
    meetingLat: 22.3947, meetingLng: 114.3444,
    distanceKm: 18, paceMin: "6:00", paceMax: "7:30",
    maxParticipants: 12, description: "Beautiful coastal trail through UNESCO Geopark. Moderate difficulty — bring water, trail shoes, and sunscreen. We regroup at every junction. Post-run dim sum optional!",
    visibility: "public", status: "active", createdAt: now, updatedAt: now,
  });

  const run2 = await storage.insertCommunityRun({
    hostId: jake.id, title: "Harbourfront Tempo Run",
    runType: "road", date: futureDate(2), startTime: "07:00",
    meetingPoint: "Tsim Sha Tsui East Promenade, near Clock Tower",
    meetingLat: 22.2966, meetingLng: 114.1722,
    distanceKm: 10, paceMin: "4:45", paceMax: "5:15",
    maxParticipants: 8, description: "Tempo pace along the iconic harbourfront. Flat, fast, and scenic. Bring your A game — this one's a quality session, not a casual jog.",
    visibility: "public", status: "active", createdAt: now, updatedAt: now,
  });

  const run3 = await storage.insertCommunityRun({
    hostId: ryan.id, title: "Sunday Long Run — Zone 2 Vibes",
    runType: "road", date: futureDate(7), startTime: "06:00",
    meetingPoint: "Victoria Park Main Entrance, Causeway Bay",
    meetingLat: 22.2823, meetingLng: 114.1878,
    distanceKm: 21, paceMin: "5:30", paceMax: "6:15",
    maxParticipants: null, description: "Chill long run building marathon base. Zone 2 heart rate all the way. No one gets dropped. We do loops in Victoria Park and head towards the East Corridor. Gels welcome.",
    visibility: "public", status: "active", createdAt: now, updatedAt: now,
  });

  const run4 = await storage.insertCommunityRun({
    hostId: alex.id, title: "Track Tuesday — Intervals",
    runType: "track", date: futureDate(3), startTime: "19:00",
    meetingPoint: "Sha Tin Sports Ground Track, Sha Tin",
    meetingLat: 22.3810, meetingLng: 114.1879,
    distanceKm: 8, paceMin: "4:00", paceMax: "4:30",
    maxParticipants: 10, description: "8x800m intervals with 90s rest. Target pace 4:00–4:20/km. Bring spikes or flats. Great for 5K/10K speed. All levels welcome — adjust pace to your level.",
    visibility: "public", status: "active", createdAt: now, updatedAt: now,
  });

  const run5 = await storage.insertCommunityRun({
    hostId: sophia.id, title: "Recovery Jog + Coffee",
    runType: "recovery", date: futureDate(1), startTime: "08:30",
    meetingPoint: "Bonham Road, Sai Ying Pun (near Sheung Wan MTR Exit E2)",
    meetingLat: 22.2843, meetingLng: 114.1470,
    distanceKm: 5, paceMin: "6:30", paceMax: "7:30",
    maxParticipants: null, description: "Easy recovery run through Hong Kong Park and around Sheung Wan. Super chill, conversation pace. We end at a great coffee spot in Sai Ying Pun. Perfect for post-race recovery or active rest days.",
    visibility: "public", status: "active", createdAt: now, updatedAt: now,
  });

  const run6 = await storage.insertCommunityRun({
    hostId: maya.id, title: "Wilson Trail Section 1 — Sunrise",
    runType: "trail", date: futureDate(10), startTime: "05:45",
    meetingPoint: "Stanley Gap Road Trail Head, Stanley",
    meetingLat: 22.2426, meetingLng: 114.2119,
    distanceKm: 24, paceMin: "7:00", paceMax: "8:30",
    maxParticipants: 8, description: "Wilson Trail sections 1–2 starting at sunrise. Technical trail, some scrambling. Must have trail experience. Poles recommended. We summit twins then descend to Stanley. Car shuttle or taxi back.",
    visibility: "public", status: "active", createdAt: now, updatedAt: now,
  });

  const run7 = await storage.insertCommunityRun({
    hostId: jake.id, title: "Post-Race Recovery Run",
    runType: "recovery", date: pastDate(3), startTime: "08:00",
    meetingPoint: "Kowloon Park, Nathan Road Entrance",
    meetingLat: 22.3014, meetingLng: 114.1699,
    distanceKm: 5, paceMin: "6:30", paceMax: "7:30",
    maxParticipants: 6, description: "Easy post-race shakeout after the Harbourfront 10K. Everyone welcome. Flat loops in Kowloon Park.",
    visibility: "public", status: "completed", createdAt: now, updatedAt: now,
  });

  const run8 = await storage.insertCommunityRun({
    hostId: ryan.id, title: "MacLehose Trail Segment 2",
    runType: "trail", date: futureDate(14), startTime: "07:00",
    meetingPoint: "Pak Sha Wan Pier, Sai Kung",
    meetingLat: 22.3693, meetingLng: 114.2831,
    distanceKm: 16, paceMin: "6:30", paceMax: "8:00",
    maxParticipants: 10, description: "MacLehose Trail Segment 2 through High Island Reservoir. One of HK's most scenic trails. Moderate effort, about 3 hours. Trail shoes essential. Water refill midway.",
    visibility: "public", status: "active", createdAt: now, updatedAt: now,
  });

  // Add participants to runs
  for (const uid of [jake.id, sophia.id, alex.id]) await storage.joinRun(run1.id, uid);
  for (const uid of [ryan.id, maya.id]) await storage.joinRun(run2.id, uid);
  for (const uid of [maya.id, jake.id, alex.id, sophia.id]) await storage.joinRun(run3.id, uid);
  for (const uid of [ryan.id, maya.id, sophia.id]) await storage.joinRun(run4.id, uid);
  for (const uid of [ryan.id, jake.id, alex.id]) await storage.joinRun(run5.id, uid);
  for (const uid of [ryan.id]) await storage.joinRun(run6.id, uid);
  for (const uid of [ryan.id, maya.id, alex.id]) await storage.joinRun(run7.id, uid);

  // Seed chat messages for run1
  const msgs = [
    { runId: run1.id, userId: jake.id, message: "Looking forward to this! Should I bring poles?", createdAt: now },
    { runId: run1.id, userId: maya.id, message: "Poles optional for this one — terrain is mostly runnable. Good choice though if you have them 💪", createdAt: now },
    { runId: run1.id, userId: sophia.id, message: "What's the plan if it rains?", createdAt: now },
    { runId: run1.id, userId: maya.id, message: "We run anyway 😂 HK trails are even more fun in light rain. Just watch the rocks!", createdAt: now },
    { runId: run1.id, userId: alex.id, message: "See you all at the trailhead! Bringing extra gels if anyone needs.", createdAt: now },
  ];
  for (const m of msgs) await storage.insertMessage(m);

  // Seed chat for run2
  const msgs2 = [
    { runId: run2.id, userId: ryan.id, message: "What's target pace exactly?", createdAt: now },
    { runId: run2.id, userId: jake.id, message: "Aiming for 4:50/km steady state. You'll be fine Ryan!", createdAt: now },
    { runId: run2.id, userId: maya.id, message: "Love this route. Tsim Sha Tsui at 7am is so clean 🌅", createdAt: now },
  ];
  for (const m of msgs2) await storage.insertMessage(m);

  // Seed ratings for completed run
  await storage.insertRating({ runId: run7.id, raterId: ryan.id, hostId: jake.id, stars: 5, review: "Jake is an amazing host. Perfect pace, great energy. Will join every run he organizes!", createdAt: now });
  await storage.insertRating({ runId: run7.id, raterId: maya.id, hostId: jake.id, stars: 5, review: "Super well organized. Clear meeting point, good pace management. Highly recommended!", createdAt: now });
  await storage.insertRating({ runId: run7.id, raterId: alex.id, hostId: jake.id, stars: 4, review: "Great run, good group. Would have liked a slightly faster pace but overall excellent experience.", createdAt: now });

  const finalUsers = await storage.getAllUsers();
  const finalRuns = await storage.getAllCommunityRuns();
  console.log(`[community-seed] Seeded ${finalUsers.length} users, ${finalRuns.length} runs`);
}
