export const topics = [
  [
    'Getting started',
    'Use the bottom toolbar for Contacts, recording, Settings, and Chats. Tap Help at the top right for guidance.',
  ],
  [
    'Show Nearby Users',
    'Turn on Show Nearby Users to see people sharing nearby or in a group you joined. Turn it off to hide everyone else on your map.',
  ],
  [
    'Location sharing',
    'Turn on Share my location in Settings to share within 1 km. Turn on Share with private groups to limit sharing to fellow members. Shared trips have their own Stop button.',
  ],
  [
    'Contacts and requests',
    'Use New contact to send a request by email. Open the envelope to review requests and responses.',
  ],
  [
    'Private groups',
    'Your groups appear first, followed by groups created by others. Search by name and tap the join icon on the right to join or rejoin. Joined groups appear in Chats.',
  ],
  [
    'Trip sharing',
    'Tap Share my trip in a joined group. Members can turn on Show Nearby Users to see your route and tap Follow to track you. Drag the map to stop following. Tap Stop on your own map to end sharing.',
  ],
  [
    'Recording',
    'Your path starts recording when you open the app with location access. Tap the center button to pause or resume. Clear path removes the recorded line.',
  ],
  [
    'Map markers and zoom',
    'Use + and − to zoom. Avatars resize with zoom. Tap a count marker to choose a person when markers overlap. Tap the target button to return to your GPS position.',
  ],
  [
    'Missing users or locations',
    'Check GPS permission and internet access. For nearby discovery, the other person must allow nearby visibility and be within 1 km. For groups, both people must have joined and the other person must share a location or trip.',
  ],
  [
    'Updates and battery',
    'Group sharing updates about every 30 seconds while the app is open. Sharing pauses in the background. Stale group locations disappear after about two minutes.',
  ],
  [
    'Settings',
    'Change location visibility, app language, profile details, and password in Settings. Google accounts manage their passwords through Google.',
  ],
  [
    'Password reset',
    'Choose Forgot password on Sign in. Check Spam or Junk if the email is missing. Complete the reset, return to the app, and sign in with your new password.',
  ],
  [
    'Chats',
    'Select a group to chat with all its members. Select a name underneath for a private conversation within that group.',
  ],
  [
    'Edit contact',
    'Change the nickname and tap Save. Profile details are provided by your contact.',
  ],
  [
    'Sign in',
    'Use your email and password or continue with Google. Forgot password sends a reset link.',
  ],
  ['Create account', 'Register with email or Google, then complete your profile to open the map.'],
] as const;
export function screenHelp(path: string, section?: string) {
  if (path === '/contacts')
    return section === 'groups' ? 'Private groups' : 'Contacts and requests';
  if (path.startsWith('/contact/')) return 'Edit contact';
  if (path === '/chat' || path.startsWith('/chat/')) return 'Chats';
  if (path === '/profile') return 'Settings';
  if (path === '/sign-in') return 'Sign in';
  if (path === '/sign-up') return 'Create account';
  if (path === '/reset-password') return 'Password reset';
  return path === '/' ? 'Map markers and zoom' : 'Getting started';
}
