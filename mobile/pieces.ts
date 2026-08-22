import { Linking, Platform, type ImageSourcePropType } from "react-native";

export type Piece = {
  id: string;
  name: string;
  line: string;
  alt: string;
  source: ImageSourcePropType;
};

export const PIECES: Piece[] = [
  {
    id: "tee",
    name: "tees.",
    line: "The b. on cotton. Everyday blanco, off the counter.",
    alt: "A cream Blanco tee with the geometric b. and blanco. wordmark.",
    source: require("./assets/wear/wear-tee.jpg")
  },
  {
    id: "hoodie",
    name: "hoodies.",
    line: "For slower days. Sit in, pick up, take the house with you.",
    alt: "An espresso Blanco hoodie with the cream b. and your way.",
    source: require("./assets/wear/wear-hoodie.jpg")
  },
  {
    id: "tote",
    name: "totes.",
    line: "The board, to go. Coffee in one hand, the house in the other.",
    alt: "A canvas Blanco tote with the geometric b. and blanco. wordmark.",
    source: require("./assets/wear/wear-tote.jpg")
  },
  {
    id: "club",
    name: "coffee club.",
    line: "Already in the house. Brewed differently, on the back.",
    alt: "The Blanco coffee club tee behind the counter.",
    source: require("./assets/wear/club.jpg")
  }
];

export const INSTAGRAM = "https://www.instagram.com/blancocoffeehouse/";
export const HOUSE_STREET = "4 Fiveways Parade";
export const HOUSE_TOWN = "Hazel Grove, Stockport";
export const HOUSE_POST = "SK7 6DG";
export const HOUSE_ADDRESS =
  "4 Fiveways Parade, Hazel Grove, Stockport, SK7 6DG";
export const HOUSE_MAPS =
  "https://www.google.com/maps/search/?api=1&query=Blanco+Coffee+House&query_place_id=ChIJA7O_BgBLekgRM6KmmvtDE_k";
export const HOUSE_APPLE_MAPS =
  "https://maps.apple.com/?q=" +
  encodeURIComponent("Blanco Coffee House, " + HOUSE_ADDRESS);

function withWww(url: string) {
  return String(url || "").replace(
    /^(https?:\/\/)blancocoffeehouse\.com(?=[:/?#]|$)/i,
    "$1www.blancocoffeehouse.com"
  );
}

function resolveHouseUrl() {
  const raw = String(process.env.EXPO_PUBLIC_HOUSE_URL || "").trim();
  if (/^https?:\/\//i.test(raw)) return withWww(raw.replace(/\/+$/, ""));
  return "https://www.blancocoffeehouse.com";
}

export const HOUSE_SITE = resolveHouseUrl();
export const HOUSE_BOARD = HOUSE_SITE + "/go.html";
export const ACCOUNT_URL = HOUSE_SITE + "/account.html";
export const GALLERY_URL = HOUSE_SITE + "/gallery.html";
export const HOUSE_APP = HOUSE_SITE + "/?app=1";
export const MENU_APP = HOUSE_APP;
export const ACCOUNT_APP = ACCOUNT_URL + "?app=1";

export async function openAway(url: string) {
  const href = String(url || "");
  if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) return;
  try {
    await Linking.openURL(href);
  } catch {
    /* nothing on the phone can open it */
  }
}

export async function openHouseMap() {
  await openAway(Platform.OS === "ios" ? HOUSE_APPLE_MAPS : HOUSE_MAPS);
}
