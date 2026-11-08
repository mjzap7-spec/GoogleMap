export const topics = [
  [
    'Getting started',
    'Use the bottom toolbar for Contacts, recording, Settings, and Chats. Tap Help at the top right for guidance.',
  ],
  [
    'People on the map',
    'Turn on Show people, then filter by All, Contacts, Groups, or Nearby. These controls only change your map view. They do not share your location. Tap a person to see when their location last updated. Faded markers indicate older updates.',
  ],
  [
    'Location sharing',
    'In Settings, choose No one, Nearby users within 1 km, or My groups under Who can see me. Stop all sharing ends location and trip sharing. Recording your path and showing other people are separate controls. If stopping cannot be confirmed online, retry when connected.',
  ],
  [
    'Contacts and requests',
    'Use New contact to send a request by email. Open the inbox icon to review requests and responses. Show all opens your full Contacts list. Use the pencil icon to edit a nickname or the chat icon to send a message.',
  ],
  [
    'Private groups',
    'Your groups appear first, followed by groups created by others. Search by name and tap the join icon on the right to join or rejoin. Joined groups appear in Chats.',
  ],
  [
    'Trip sharing',
    'Tap Share my trip in a joined group. Members can turn on Show people to see your route and tap Follow to track you. Drag the map to stop following. Tap Stop on your own map to end sharing.',
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
    'On phones, select a conversation to open full-width messages. Go back or tap the people button to return to the list. Use the arrow beside a group to show or hide members. Group messages go to everyone in the group; selecting a person opens a private chat. The smiley button adds emoji.',
  ],
  [
    'Message status',
    'Sending… means your message is waiting to send. One check (✓) means it was sent successfully. Two checks (✓✓) mean the other person has read it; in a group, at least one other member has read it. Checks update automatically when both devices are online.',
  ],
  [
    'Unread messages',
    'The Chats button shows your total unread message count. Badges beside a person or group show their unread count. Open the conversation and view messages to mark them as read. A collapsed group also includes unread private messages from its members.',
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
  [
    'Message actions',
    'Long-press a message to select it. Use the top toolbar to reply, edit your own message, or delete. Select more messages with the checkboxes, or select the entire chat. With multiple selections only Delete is available.',
  ],
  [
    'Local chat history',
    'Select one or more messages and tap the trash icon to delete them immediately on this device, without confirmation. Other participants keep their messages. The three-dot chat menu lets you clear the chat history. New messages still appear. Local deletion survives reopening the app, but clearing app storage or reinstalling resets it.',
  ],
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
