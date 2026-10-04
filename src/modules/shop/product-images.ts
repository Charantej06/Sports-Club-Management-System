// Upgrade the bundled legacy illustrations while preserving staff-supplied imagery.
const overrides: Record<string, string> = {
  "tennis-strings": "strings",
  "tennis-grip": "overgrips",
  "padel-grips": "overgrips",
  "padel-protector": "protector",
  "padel-bag": "backpack",
  "badminton-pro": "badminton",
  "badminton-club": "badminton",
  "nylon-shuttle": "nylon",
  "badminton-string": "strings",
  "cricket-ball": "cricketball",
  "club-polo": "polo",
  "club-jacket": "jacket",
  "club-duffel": "duffel",
  "club-rope": "rope",
};
export function productImage(id: string, image: string) {
  const legacy = /^\/images\/products\/([a-z]+)\.svg$/.exec(image);
  const bundled = new Set(["racket", "padel", "bat", "ball", "bag", "grip", "bottle", "shirt", "shorts", "sock", "shoe", "shuttle", "pad", "helmet", "glove", "cap", "towel"]);
  return legacy && bundled.has(legacy[1])
    ? `/images/products/generated/${overrides[id] || legacy[1]}.webp`
    : image;
}
