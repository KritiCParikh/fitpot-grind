// FitPot reminder messages (phase 5.8).
//
// The rule for every line here: kind and considerate. Encourage, never guilt.
// No "pay up", no shaming, no pressure about the pot. Rest is part of
// training. A short walk counts. If someone's having a hard day, the tone
// should still feel welcome.
//
// {name} first name, {in} people in today, {of} group size, {streak} days.

export const MESSAGES = {
  morning: [
    { title: 'Good morning, {name}', body: 'A new day and a fresh start. Whatever you have planned, we\'re cheering for you.' },
    { title: 'Morning, {name}', body: 'Even ten minutes of movement is a win. Go gently and enjoy it.' },
    { title: 'Rise and shine', body: 'Your crew is starting their day too. You\'re not doing this alone.' },
    { title: 'Hello, {name}', body: 'Drink some water, stretch a little, and plan a moment for yourself today.' },
    { title: 'A good day to move', body: 'No pressure on how big. Showing up is the whole point.' },
    { title: 'Morning check in', body: 'How are you feeling today? Pick a workout that suits the day you\'re having.' },
    { title: 'Day {streak} of your streak?', body: 'You\'ve been showing up. Let\'s keep the good feeling going, one step at a time.', needsStreak: true },
    { title: 'Morning, {name}', body: 'Small steps add up. Today\'s one of them.' },
  ],
  afternoon: [
    { title: 'Quick hello, {name}', body: 'Halfway through the day. There\'s still plenty of time for a workout that fits.' },
    { title: 'A little reminder', body: 'A walk at lunch, a few stretches, a short session. It all counts.' },
    { title: 'Your crew is moving', body: '{in} of {of} have checked in so far. Join them when it suits you.', needsGroup: true },
    { title: 'How\'s your day going?', body: 'If it\'s been a busy one, even a short workout this evening is plenty.' },
    { title: 'Take a breath', body: 'Stand up, roll your shoulders, have some water. Then plan your workout.' },
    { title: 'Still with you', body: 'There\'s time. Pick something you enjoy and go for it.' },
    { title: 'Afternoon boost', body: 'Your future self will thank you. Even a short session feels good.' },
    { title: 'Hey {name}', body: 'Workout later today? Put on your shoes now and the rest gets easier.' },
  ],
  evening: [
    { title: 'Evening, {name}', body: 'If you can still fit something in today, a short session is great. If not, rest well and go again tomorrow.' },
    { title: 'Gentle reminder', body: 'A few minutes still counts. Check in when you\'re done, and be proud of it.' },
    { title: 'Still time today', body: '{in} of {of} are in. There\'s room for you too, whenever you\'re ready.', needsGroup: true },
    { title: 'You\'ve got this', body: 'A walk, some stretching, a quick set. Whatever feels right tonight.' },
    { title: 'Before the day ends', body: 'Movement helps you sleep better too. Even a little is worth it.' },
    { title: 'Hey {name}', body: 'Long day? A short stretch can be your workout. Be kind to yourself.' },
  ],
  // Sent once, in the evening slot, after you've checked in.
  done: [
    { title: 'Nice work today, {name}', body: 'You showed up. Enjoy the rest of your evening.' },
    { title: 'Done for today', body: 'That\'s {streak} days in a row. Proud of you.', needsStreak: true },
    { title: 'Well done', body: 'Your crew saw you check in. Rest up and recover well.' },
    { title: 'You did it', body: 'Another day in the bank. Take care of yourself tonight.' },
  ],
  // Rest day voted: one kind note in the evening, no workout nudges.
  rest: [
    { title: 'Rest day', body: 'Recovery is part of training. Enjoy the break, {name}.' },
    { title: 'Taking it easy today', body: 'Rest well, eat well, sleep well. Back at it tomorrow.' },
  ],
  // Not in a group yet: personal reminders only.
  solo: [
    { title: 'Hello, {name}', body: 'A good day to move a little. Log it in FitPot when you\'re done.' },
    { title: 'Your training log', body: 'Try to beat last time by one rep, or simply enjoy the session.' },
    { title: 'Little steps', body: 'A walk counts. A stretch counts. You count.' },
  ],
}

/** Pick a message for today: rotates through the list day by day, and skips lines whose numbers we don't have. */
export function pickMessage(kind, { dayIndex = 0, name = 'there', inToday, groupSize, streak } = {}) {
  const list = (MESSAGES[kind] || MESSAGES.solo).filter((m) =>
    (!m.needsGroup || (groupSize > 1 && inToday != null)) && (!m.needsStreak || streak >= 2))
  const m = list[((dayIndex % list.length) + list.length) % list.length]
  const fill = (s) => s.replace('{name}', name).replace('{in}', inToday).replace('{of}', groupSize).replace('{streak}', streak)
  return { title: fill(m.title), body: fill(m.body) }
}
