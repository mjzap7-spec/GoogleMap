/** Local categories keep emoji browsing off the network and limit the mounted grid. */
const baseCategories = [
  {
    id: 'smileys',
    label: 'Smileys',
    icon: '😀',
    emojis:
      '😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 😤 😡 😠 🤬 😈 👿 💀 👻 👽 🤖 💩'.split(
        ' ',
      ),
  },
  {
    id: 'gestures',
    label: 'People & gestures',
    icon: '👋',
    emojis:
      '👋 🤚 🖐️ ✋ 🖖 👌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 👂 👃 🧠 👀 👁️ 👅 👄 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙋 🙆 🙅 🤦 🤷 💁 🙇 🧏 🧑‍💻 👩‍💻 👨‍💻 👍🏻 👍🏼 👍🏽 👍🏾 👍🏿'.split(
        ' ',
      ),
  },
  {
    id: 'symbols',
    label: 'Hearts & symbols',
    icon: '❤️',
    emojis:
      '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 💋 💯 💢 💥 💫 💦 💤 ✨ ⭐ 🌟 🔥 ✅ ☑️ ✔️ ❌ ❎ ❓ ❗ ‼️ ⁉️ ⚠️ ⛔ 🚫 ♻️ 🔔 🔕 🎵 🎶 ➡️ ⬅️ ⬆️ ⬇️ 🔄 ➕ ➖ ♾️ 🆕 🆗 🆘'.split(
        ' ',
      ),
  },
  {
    id: 'nature',
    label: 'Animals & nature',
    icon: '🐻',
    emojis:
      '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦋 🐝 🐞 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐟 🐬 🐳 🦈 🐊 🐘 🦒 🦓 🐎 🦄 🐕 🐈 🐾 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🍁 🍂 🍃 🌷 🌹 🌺 🌸 🌼 🌻 🌞 🌝 🌙 ☀️ 🌤️ ☁️ 🌧️ ⛈️ 🌈 ❄️ ⛄ 💨 🌊'.split(
        ' ',
      ),
  },
  {
    id: 'food',
    label: 'Food & drink',
    icon: '🍕',
    emojis:
      '🍎 🍏 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🧀 🥚 🍳 🥞 🧇 🥓 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🥙 🌮 🌯 🥗 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 🍿 🍯 🥛 ☕ 🍵 🧃 🥤 🧋 🥂 🍻 🍷 🍹 🍽️'.split(
        ' ',
      ),
  },
  {
    id: 'travel',
    label: 'Travel & places',
    icon: '🚗',
    emojis:
      '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🛵 🏍️ 🚲 🛴 🛹 🚂 🚆 🚇 🚊 🚝 🚄 ✈️ 🛫 🛬 🚀 🚁 🚤 ⛵ 🚢 ⚓ ⛽ 🚦 🗺️ 🧭 📍 📌 🌍 🌎 🌏 🏠 🏡 🏘️ 🏢 🏥 🏦 🏨 🏫 🏪 🏭 🏰 🏯 🗼 🗽 ⛲ 🎡 🎢 🏖️ 🏝️ 🏜️ 🌋 🏔️ ⛰️ 🏕️ 🛤️ 🌅 🌄 🌆 🌃 🌉'.split(
        ' ',
      ),
  },
  {
    id: 'activities',
    label: 'Activities',
    icon: '⚽',
    emojis:
      '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🏏 ⛳ 🥊 🥋 🎽 🛼 🎿 ⛷️ 🏂 🏋️ 🤸 🤼 🤽 🏊 🏄 🚣 🧗 🚴 🏃 🚶 🧘 🏆 🥇 🥈 🥉 🏅 🎖️ 🎯 🎳 🎮 🕹️ 🎲 🧩 ♟️ 🎭 🎨 🎬 🎤 🎧 🎷 🎸 🎹 🎺 🎻 🥁 🎪 🎟️ 🎉 🎊 🎈 🎆 🎇 🪁'.split(
        ' ',
      ),
  },
  {
    id: 'objects',
    label: 'Objects',
    icon: '💡',
    emojis:
      '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 📷 📸 📹 🎥 📺 📻 ☎️ 🔋 🔌 💡 🔦 🕯️ 🧯 🛒 💰 💳 💎 ⚖️ 🔧 🔨 🛠️ ⚙️ 🧰 🧲 💊 🩹 🩺 🧪 🔬 🔭 📡 🧹 🧺 🧼 🧽 🛁 🚿 🛏️ 🛋️ 🚪 🪑 🧸 🎁 🛍️ 🎒 🧳 👑 💍 🕶️ 👓 👟 🧢 🧣 🧤 👕 👗 👔 📚 📖 📝 📅 📆 📊 📈 📉 📂 📁 📎 ✂️ ✏️ 🖊️ 🔍 🔎 🔑 🗝️ 🔒 🔓 📦 ✉️ 📬'.split(
        ' ',
      ),
  },
] as const;

const additions: Record<string, string> = {
  smileys: '🫠 🫢 🫣 🫡 🫥 🥹 😮‍💨 😵‍💫 😶‍🌫️ 🥲 🥸 😺 😸 😹 😻 😼 😽 🙀 😿 😾 👾 🤡 👹 👺 ☠️',
  gestures:
    '🫰 🫵 🫶 🫱 🫲 🫳 🫴 🤌 🦿 🦵 🦶 🦻 🦷 🦴 🫀 🫁 👮 🕵️ 💂 🥷 👷 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🤱 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 🧑‍⚕️ 🧑‍🎓 🧑‍🏫 🧑‍🌾 🧑‍🍳 🧑‍🔧 🧑‍🏭 🧑‍💼 🧑‍🔬 🧑‍🎤 🧑‍🎨 🧑‍✈️ 🧑‍🚀 🧑‍🚒 🕺 💃 👯 👫 👬 👭 🧑‍🤝‍🧑 👨‍👩‍👧 👨‍👩‍👧‍👦 👩‍👩‍👦 👨‍👨‍👧',
  symbols:
    '❤️‍🔥 ❤️‍🩹 🫧 🗯️ 💬 🗨️ 💭 🔰 🔱 ⚜️ 🔆 🔅 🟣 🔵 🟢 🟡 🟠 🔴 ⚫ ⚪ 🟤 🟪 🟦 🟩 🟨 🟧 🟥 ⬛ ⬜ 🟫 🔺 🔻 🔸 🔹 🔶 🔷 🔘 🔲 🔳 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 #️⃣ *️⃣ ▶️ ⏸️ ⏹️ ⏩ ⏪ 🔀 🔁 🔂 💤 🆓 🆒 🆙 🆔',
  nature:
    '🦝 🦬 🦣 🦛 🦏 🦌 🦙 🐪 🐫 🐐 🐑 🐏 🐖 🐄 🐂 🐃 🐆 🐅 🦧 🦍 🦥 🦦 🦨 🦡 🦔 🐿️ 🦫 🐇 🐀 🐁 🐩 🦮 🐕‍🦺 🐈‍⬛ 🪶 🦚 🦜 🦩 🦢 🦃 🦤 🕊️ 🦇 🪰 🪱 🐌 🐜 🦗 🕷️ 🕸️ 🦂 🪲 🪳 🦟 🦠 🦕 🦖 🐉 🐲 🦭 🦞 🦐 🦪 🪸 🐚 🪷 🪴 🍄 🌾 💐 🪨 🪵 🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘 🪐 ☄️ 🌠 🌌 🌪️ 🌫️ 🌡️ ☔',
  food: '🫒 🫑 🥜 🌰 🫘 🥨 🫓 🥖 🧈 🧂 🫔 🫕 🥘 🍢 🍡 🥠 🥮 🍥 🦴 🧆 🍘 🥡 🧊 🫖 🍼 🍺 🍸 🥃 🍶 🧉 🍾 🥄 🍴 🥢',
  travel:
    '🛻 🛺 🚋 🚃 🚅 🚈 🚉 🚞 🚟 🚠 🚡 🚥 🚨 🛑 🚧 🛞 🛟 🛶 🛳️ ⛴️ 🛥️ 🛩️ 🛸 🪂 🛎️ 🧱 🛖 🏚️ 🏗️ 🏬 🏣 🏤 🏩 🏛️ ⛪ 🕌 🛕 🕍 ⛩️ 🕋 ⛺ 🏞️ 🏟️ 🌁 🏙️ 🎠 🛝 🗾 🗿',
  activities:
    '🎣 🤿 🛷 🥌 🏑 🥍 🏹 🤺 🪃 🤾 🤹 🏇 🏌️ 🪀 🪄 🎰 🀄 🎴 🃏 ♠️ ♥️ ♦️ ♣️ 🎼 🪕 🪗 🪘 🪩 🎫 🎗️ 🎐 🎏 🎎 🧨 🎃 🥽',
  objects:
    '🪙 🪪 🪫 💾 💿 📀 📼 📽️ 🔎 🧮 ⏰ ⏱️ ⏲️ ⌛ ⏳ 🗑️ 🪣 🪠 🧻 🪥 🪒 🪞 🪟 🧴 🧷 🧵 🪡 🧶 🪢 🧯 🪓 🪚 🪛 ⛏️ 🪝 🧱 🧬 🧫 ⚗️ 🧾 📜 📰 🗞️ 🔖 🏷️ 📏 📐 🖇️ 🗂️ 🗃️ 🗄️ 🗒️ 🗓️ 📇 🖌️ 🖍️ 🖋️ 📤 📥 📨 📩 📧 🗳️ 🕯️ 🪔 🥿 👠 👡 👢 🩴 🥾 👞 👖 🩳 🩱 👙 🧥 🥼 🦺 🥻 👘 👜 👝 👛',
};
const toneBases =
  '👋 🤚 🖐 ✋ 🖖 👌 🤏 ✌ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🙏 💪 🫶'.split(
    ' ',
  );
const skinTones = ['🏻', '🏼', '🏽', '🏾', '🏿'];

/** Built once, with no image downloads or runtime emoji library. */
export const emojiCategories = [
  {
    id: 'animated',
    label: 'Animated',
    icon: '✨',
    emojis: '❤️ 😂 🤣 🥰 😍 🥳 👋 👍 👏 🙌 🙏 💪 🔥 ✨ 🎉 🎊 🎈 💯 🚀 ⚽'.split(' '),
  },
  ...baseCategories.map((category) => ({
    ...category,
    emojis: [
      ...new Set([
        ...category.emojis,
        ...additions[category.id].split(' '),
        ...(category.id === 'gestures'
          ? toneBases.flatMap((emoji) => skinTones.map((tone) => emoji + tone))
          : []),
      ]),
    ],
  })),
  {
    id: 'flags',
    label: 'Flags',
    icon: '🏳️',
    emojis:
      '🏳️ 🏴 🏁 🚩 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️ 🇺🇸 🇨🇦 🇲🇽 🇧🇷 🇦🇷 🇨🇱 🇨🇴 🇵🇪 🇪🇨 🇺🇾 🇵🇾 🇧🇴 🇨🇷 🇵🇦 🇩🇴 🇯🇲 🇬🇹 🇬🇧 🇮🇪 🇫🇷 🇩🇪 🇮🇹 🇪🇸 🇵🇹 🇳🇱 🇧🇪 🇨🇭 🇦🇹 🇩🇰 🇳🇴 🇸🇪 🇫🇮 🇮🇸 🇵🇱 🇨🇿 🇬🇷 🇺🇦 🇷🇴 🇭🇺 🇭🇷 🇷🇸 🇹🇷 🇦🇺 🇳🇿 🇯🇵 🇨🇳 🇮🇳 🇮🇩 🇲🇾 🇸🇬 🇹🇭 🇻🇳 🇵🇭 🇳🇵 🇧🇩 🇵🇰 🇱🇰 🇸🇦 🇦🇪 🇶🇦 🇪🇬 🇲🇦 🇿🇦 🇳🇬 🇰🇪 🇬🇭 🇪🇹 🇹🇿 🇺🇬 🇸🇳 🇪🇺 🇺🇳'.split(
        ' ',
      ),
  },
];

// Keep recognition of previously sent flags, while leaving them out of the picker.
export const emojiPickerCategories = emojiCategories.filter((category) => category.id !== 'flags');
